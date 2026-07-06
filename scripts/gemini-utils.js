import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// generate-content.js / regenerate-brief.js / verify-daily-content.js の3箇所で
// 個別に計算すると、ロジックの修正漏れにより「今日」の判定がスクリプト間でずれる
// 危険がある（例: JST日付境界をまたぐタイミングでの不一致）ため、ここに一本化する。
export const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

export function getTodayJST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// public/data/ に保存済みの日付ファイルのうち直近n日分の日付文字列を返す。
// regenerate-brief.js の自動補完対象と verify-daily-content.js の検証対象を
// 同じ集合に揃えるための共通実装（片方だけ範囲を変更して検知漏れが起きるのを防ぐ）。
export function getRecentDates(n) {
  return readdirSync(DATA_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-n)
    .map((f) => f.replace('.json', ''));
}

// 1プロセス（= generate-content.js / regenerate-brief.js の1回の実行）あたりの
// Gemini 実呼び出し（リトライ含む）上限。無料枠が復活した後、想定外の連続リトライや
// バックフィル処理で1日分のクォータを一度に使い切ってしまわないための安全弁。
// 通常時の想定使用量: generate-content.js は最大4回、regenerate-brief.js は
// 3日バックフィルで最大6回。多少のリトライ（1〜2回分）が乗っても正規の処理を
// 打ち切らないよう、余裕を持たせて16をデフォルトとする。
// "0" を明示指定した場合は意図的な無効化（Gemini呼び出し完全停止）として扱う。
function resolveMaxCalls() {
  const raw = process.env.GEMINI_MAX_CALLS_PER_RUN;
  if (raw === undefined || raw === '') return 16;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 16;
}

const CALL_BUDGET = {
  used: 0,
  max: resolveMaxCalls(),
};

export async function callGemini(model, prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const m = genai.getGenerativeModel({ model });

  // retryDelay をエラー本文から取得（秒単位。見つからなければ 70 秒）
  function extractRetryDelay(msg) {
    const match = msg.match(/retryDelay["\s:]+(\d+)s/);
    return match ? (parseInt(match[1], 10) + 10) * 1000 : 70000;
  }

  // リトライ対象のエラーかどうか判定（RPM/RPD超過・サービス一時障害）
  function isRetryable(msg) {
    return (
      msg.includes('429') ||
      msg.includes('503') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('quota')
    );
  }

  // 割当クォータが0（アカウント/請求設定側で無料枠が付与されていない等）の場合は
  // 何秒待っても回復しない。リトライを続けると1呼び出しあたり数分を浪費するため即座に諦める
  function isZeroQuota(msg) {
    return /limit:\s*0\b/.test(msg);
  }

  const MAX_ATTEMPTS = 4;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (CALL_BUDGET.used >= CALL_BUDGET.max) {
      console.error(`::error::Gemini呼び出し上限（${CALL_BUDGET.max}回/実行）に達したため、これ以上のAI処理をスキップします（無料枠の一括消費を防止）`);
      const budgetErr = new Error(`Gemini call budget exceeded (${CALL_BUDGET.max} calls/run)`);
      budgetErr.budgetExceeded = true;
      throw budgetErr;
    }
    CALL_BUDGET.used++;
    try {
      const result = await m.generateContent(prompt);
      const text = result.response.text().trim();
      if (!text) throw new Error('Gemini returned empty response');
      return text;
    } catch (err) {
      const msg = String(err.message);
      if (isZeroQuota(msg)) {
        console.error(`::error::Gemini APIのクォータ割当が0です。このAPIキーのプロジェクトに無料枠が付与されていません。Google AI Studio/Cloud Consoleで請求設定・APIキーの状態を確認してください: ${msg.slice(0, 150)}`);
        const zeroQuotaErr = new Error(msg);
        zeroQuotaErr.zeroQuota = true;
        throw zeroQuotaErr;
      }
      if (isRetryable(msg) && attempt < MAX_ATTEMPTS - 1) {
        const wait = extractRetryDelay(msg);
        console.warn(`[WARN] Gemini エラー（リトライ可能）- ${Math.round(wait / 1000)}秒後にリトライ (${attempt + 1}/${MAX_ATTEMPTS - 1}): ${msg.slice(0, 80)}`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        // isRetryable の判定結果をここで確定させ、呼び出し元がメッセージ文字列を
        // 再度 includes('429') 等で判定し直さずに済むようにする
        // （JSON.parse の SyntaxError メッセージにたまたま "429" という数値が
        // 含まれるケース等での誤判定を防ぐ）
        if (isRetryable(msg)) err.rateLimited = true;
        console.error(`[ERROR] Gemini 呼び出し失敗 (attempt ${attempt + 1}): ${msg.slice(0, 120)}`);
        throw err;
      }
    }
  }
}

export function parseJsonFromText(text) {
  let cleaned = text
    .replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
  // コードフェンス除去後も前後に説明文が残ることがあるため、
  // 最初の { または [ から対応する最後の } / ] までを切り出す
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

// クォータ0・呼び出し予算超過はどちらも「待っても回復しない／これ以上呼んでも無駄」な
// 致命的エラー。呼び出し元ではこの1関数で判定し、個別に err.zeroQuota / err.budgetExceeded
// を書き並べない（判定条件が増えても呼び出し元を直さずに済む）
export function isFatalGeminiError(err) {
  return Boolean(err && (err.zeroQuota || err.budgetExceeded));
}

// ── 本日のニュース要約（summary）生成 ──────────────────────────────
// generate-content.js（当日のメイン生成）と regenerate-brief.js（未生成分の
// 補完バッチ）の両方から同じプロンプト・パース・エラー処理を使うための共通実装。
// 過去にこの2箇所のプロンプトが個別に編集され内容が食い違っていたため、
// ここに一本化した。

export async function generateSummaryPoints(allArticles, model) {
  if (!allArticles || allArticles.length === 0) return null;
  const inputJson = JSON.stringify(allArticles, null, 2);
  const prompt = `あなたは中央省庁のPMO（プロジェクト管理オフィス）・PJMO（プロジェクト管理支援）担当者向けの行政DX・AI活用の専門キュレーターです。

以下は本日キュレーションされた行政DX・AI・セキュリティ関連の記事一覧です。
これらを読んで、PMO/PJMO担当者が「今日知っておくべき重要ポイント」を箇条書きで要約してください。

【要約ルール】
- 4〜6箇条で、各箇条は1行（40〜70字）
- 「何が起きたか・何が変わったか」を事実ベースで端的に
- 重要度の高いもの（セキュリティ速報・政府の重要決定・調達・AI活用）を優先
- 複数記事を無理に1行にまとめず、独立したポイントとして列挙
- 行政用語・省略語は省略せず正式名で記載
- 「重要」「画期的」等の主観的形容詞は使わない

対象記事:
${inputJson}

以下のJSON形式のみで出力すること（説明文・コードブロック記号は不要）:
{
  "points": [
    "箇条書き1",
    "箇条書き2",
    "箇条書き3"
  ]
}`;

  try {
    const text = await callGemini(model, prompt);
    const result = parseJsonFromText(text);
    return Array.isArray(result.points)
      ? result.points.filter((p) => typeof p === 'string' && p.trim().length > 0)
      : null;
  } catch (err) {
    if (isFatalGeminiError(err)) throw err;
    console.warn(`[WARN] ニュース要約生成エラー: ${err.message}`);
    return null;
  }
}

// hero_article / sub_articles / news_topics から generateSummaryPoints 用の
// 記事リストを組み立てる。generate-content.js（生成直後のメモリ上データ）と
// regenerate-brief.js（保存済みJSONの再読込データ）のどちらの形状からも
// 同じ手順で組み立てられるよう、フィールド名を共通化してある。
export function buildSummaryInput(heroArticle, subArticles, newsTopics) {
  return [
    ...(heroArticle ? [{ title: heroArticle.title, summary: heroArticle.summary, source: heroArticle.source_name }] : []),
    ...(subArticles || []).map((a) => ({ title: a.title, summary: a.summary, source: a.source_name })),
    ...(newsTopics || []).slice(0, 8).map((t) => ({ title: t.title, summary: t.summary, source: t.source })),
  ];
}

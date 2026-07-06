/**
 * generate-content.js
 * 政府公式RSS＋Google Alerts RSSを収集し、Gemini APIでフィルタリング・要約して
 * public/data/ に JSON として保存する。
 *
 * 使用方法: GEMINI_API_KEY=xxx node scripts/generate-content.js
 *
 * 環境変数:
 *   GEMINI_API_KEY          - Google Gemini API キー（必須）
 *   GEMINI_MODEL            - 使用モデル（省略時: gemini-2.5-flash-lite）
 *   TARGET_DATE             - 対象日 YYYY-MM-DD（省略時: 今日 JST）
 *   GEMINI_MAX_CALLS_PER_RUN - 1実行あたりのGemini呼び出し上限（省略時: 16。gemini-utils.js参照）
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { callGemini, parseJsonFromText, isFatalGeminiError, generateSummaryPoints, buildSummaryInput, DATA_DIR, getTodayJST } from './gemini-utils.js';

// ── 政府公式 RSS ソース ────────────────────────────────────────────────
// 中央省庁PMO/PJMO担当者が最低限押さえるべき公式情報源
const GOV_SOURCES = [
  // ── セキュリティ（優先度最高）
  { name: 'JPCERT/CC 注意喚起',        url: 'https://www.jpcert.or.jp/rss/jpcert-all.rdf',                type: 'security' },
  { name: 'IPA 重要なセキュリティ情報', url: 'https://www.ipa.go.jp/security/alert-rss.rdf',              type: 'security' },
  { name: 'NISC 新着情報',             url: 'https://www.nisc.go.jp/rss/nisc_alert.rdf',                 type: 'security' },

  // ── デジタル庁
  { name: 'デジタル庁 note',            url: 'https://digital-gov.note.jp/rss',                           type: 'ai_government' },
];

// ── ガバメントクラウド認定CSP公式RSS ───────────────────────────────────
// AI要約は行わず、フィード情報（タイトル・日時・出典）をそのまま掲載する
const CLOUD_SOURCES = [
  { provider: 'AWS',                  name: 'AWS What\'s New',              url: 'https://aws.amazon.com/new/feed/' },
  { provider: 'AWS',                  name: 'AWS Service Health',           url: 'https://status.aws.amazon.com/rss/all.rss' },
  { provider: 'Microsoft Azure',      name: 'Azure Updates',                url: 'https://www.microsoft.com/releasecommunications/api/v2/azure/rss' },
  { provider: 'Google Cloud',         name: 'Google Cloud リリースノート',   url: 'https://cloud.google.com/feeds/gcp-release-notes.xml' },
  { provider: 'Google Cloud',         name: 'Google Cloud Blog',            url: 'https://cloudblog.withgoogle.com/rss/' },
  { provider: 'Oracle Cloud',         name: 'Oracle Blogs',                 url: 'https://blogs.oracle.com/feed' },
  { provider: 'さくらインターネット',  name: 'さくらインターネット ニュース', url: 'https://www.sakura.ad.jp/corporate/feed/' },
  { provider: 'さくらインターネット',  name: 'さくらインターネット メンテナンス情報', url: 'https://www.sakura.ad.jp/rss/mainte.rdf' },
];
const CLOUD_ITEMS_PER_PROVIDER = 5;

// ── Google Alerts RSS ────────────────────────────────────────────────
const GOOGLE_ALERT_SOURCES = [
  { name: 'Google Alert: クラウド×政府',     url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/3339123942717391102' },
  { name: 'Google Alert: AI×行政',           url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/5311248654206121616' },
  { name: 'Google Alert: AIガバナンス',       url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/9123460682984763914' },
  { name: 'Google Alert: ガバメントクラウド', url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/5311248654206123495' },
  { name: 'Google Alert: デジタル庁',         url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/849933549589956730'  },
  { name: 'Google Alert: PMO/PJMOプロジェクト管理', url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/3339123942717391505' },
  { name: 'Google Alert: 政府情報システム',   url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/9123460682984763418' },
  { name: 'Google Alert: 生成AI×行政',       url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/5311248654206122373' },
];



// ── ペイウォールキーワード ────────────────────────────────────────────
const PAYWALL_KEYWORDS = ['会員限定', '有料会員', 'プレミアム会員', '有料記事', '会員専用'];

// news_topics の各カード末尾に表示する「PMO/PJMOが取るべきアクション」欄は、
// Gemini呼び出しの成否に関わらず必ず同じ位置・同じ体裁で表示する（フロントエンド側は
// 空文字を許容しない）。Gemini生成のrelevanceが得られない場合はこの既定文言で埋める。
const DEFAULT_RELEVANCE = '元記事の内容を確認し、所管業務への影響・対応要否を確認すること。';

// news_topics の sources 配列に格納する1記事分のエントリを組み立てる（複数箇所で共通利用）
function toSourceEntry(a) {
  return { name: a.sourceName || '', url: a.url || '' };
}

// ── 日付ユーティリティ ────────────────────────────────────────────────
// getTodayJST は gemini-utils.js に集約（verify-daily-content.js と定義がずれないように）

function formatDateJa(dateStr) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  // YYYY-MM-DD を直接パースして getDay() のタイムゾーンずれを回避
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // ローカルミッドナイト → タイムゾーン不問
  return `${y}年${m}月${d}日（${weekdays[dow]}）`;
}

// ── URL バリデーション ─────────────────────────────────────────────────
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

// ── XML パーサ ────────────────────────────────────────────────────────
function extractTag(xml, tag) {
  const m = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`)
  );
  return m ? (m[1] ?? m[2] ?? '').trim() : '';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')                               // 実タグを除去
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')                               // エンティティ展開後に再除去
    .replace(/\s+/g, ' ').trim();
}

// フィルタ（ペイウォード除外・鮮度チェック）を適用する前の生アイテムを抽出する。
// parseRSS（政府記事・Google Alerts用）と parseCloudItems（CSP公式RSS用）で共通利用
function parseItemsRaw(xml) {
  const items = [];
  const itemRegex = /<(?:item|entry)(?: [^>]*)?>[\s\S]*?<\/(?:item|entry)>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[0];
    const title = stripHtml(extractTag(block, 'title'));

    // RSS: <link>URL</link> / Atom: <link href="URL" rel="alternate"/>
    // Google Alerts は Atom 形式で href 属性に Google リダイレクト URL が入る
    let rawLink = extractTag(block, 'link');
    if (!rawLink) {
      const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (hrefMatch) rawLink = hrefMatch[1];
    }
    // XML属性値の &amp; を & に戻してから Google リダイレクト URL を展開
    if (rawLink) {
      rawLink = rawLink.replace(/&amp;/g, '&');
      const googleRedirect = rawLink.match(/[?&]url=([^&]+)/);
      if (googleRedirect) {
        try { rawLink = decodeURIComponent(googleRedirect[1]); } catch { /* keep original */ }
      }
    }
    const link = (rawLink || extractTag(block, 'id')).replace(/\s/g, '');

    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || extractTag(block, 'dc:date');
    const description = stripHtml(extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content'));

    if (!title || !link) continue;

    items.push({ title, url: link, description, pubDate });
  }
  return items;
}

function parseRSS(xml, sourceName) {
  return parseItemsRaw(xml)
    .filter((item) =>
      // ペイウォードチェック（保存用に切り詰める前の全文でチェックする）
      !PAYWALL_KEYWORDS.some((kw) => item.title.includes(kw) || item.description.includes(kw))
    )
    .filter((item) => {
      // 36時間以内チェック（前日の業務時間帯記事もカバー）
      if (!item.pubDate) return true;
      const age = Date.now() - new Date(item.pubDate).getTime();
      return !(Number.isNaN(age) || age > 36 * 60 * 60 * 1000);
    })
    .map((item) => ({ ...item, description: item.description.slice(0, 200), sourceName }));
}

// CSP公式RSSはAI要約対象外・鮮度フィルタ対象外（更新頻度がフィードごとに異なるため）。
// 各フィードの最新アイテムをそのまま件数制限のみ行って掲載する
function parseCloudItems(xml, sourceName, provider) {
  return parseItemsRaw(xml).map((item) => ({ ...item, sourceName, provider }));
}

// ── RSS フェッチ ──────────────────────────────────────────────────────
async function fetchFeed(url, name, charset = null) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GovDX-Today/1.0 (+https://github.com/dx-specialist-jp/govdxtoday)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let xml;
    if (charset) {
      const buf = await res.arrayBuffer();
      xml = new TextDecoder(charset).decode(buf);
    } else {
      xml = await res.text();
    }
    return parseRSS(xml, name);
  } catch (err) {
    console.warn(`[WARN] ${name}: ${err.message}`);
    return [];
  }
}

async function fetchCloudFeed(src) {
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': 'GovDX-Today/1.0 (+https://github.com/dx-specialist-jp/govdxtoday)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseCloudItems(xml, src.name, src.provider);
  } catch (err) {
    console.warn(`[WARN] ${src.name}: ${err.message}`);
    return [];
  }
}

// ── セクション名マッピング ────────────────────────────────────────────
const SECTION_MAP = {
  security:      'セキュリティ速報',
  ai_government: '行政AI最前線',
  dx:            '行政DXトピックス',
};

// ── フォールバック記事生成（Gemini 未使用時）────────────────────────────
// Weekly Report 等の定期レポートは security_alerts に含めない
const URGENT_SECURITY_PATTERNS = ['注意喚起', '緊急', 'JVN:', 'CVE-'];

function buildFallbackArticle(a) {
  const isUrgent = a.articleType === 'security' &&
    URGENT_SECURITY_PATTERNS.some((p) => a.title.includes(p));
  return {
    ...a,
    summary: a.description?.slice(0, 150) || a.title,
    importance_score: isUrgent ? 4 : a.articleType === 'ai_government' ? 3 : 2,
    is_security_alert: isUrgent,
  };
}

// ── Gemini API: callGemini / parseJsonFromText は gemini-utils.js から import ──

// ── (A) 政府記事バッチ要約 ──────────────────────────────────────────
async function summarizeGovArticles(articles, model) {
  if (articles.length === 0) return [];

  // 件数が多い場合は最新20件に絞る（トークン増加防止）
  const targetArticles = articles.slice(0, 20);
  if (articles.length > targetArticles.length) {
    console.warn(`[WARN] 政府記事が${targetArticles.length}件を超えています (${articles.length}件)。超過分はフォールバック処理します`);
  }
  const inputJson = JSON.stringify(
    targetArticles.map((a, i) => ({
      index: i,
      source: a.sourceName,
      title: a.title,
      content: a.description,
    }))
  );
  console.log(`[INFO] 政府記事要約: ${targetArticles.length}件 / 入力サイズ: ${inputJson.length}文字`);

  const prompt = `あなたは中央省庁のPMO（プロジェクト管理オフィス）・PJMO（プロジェクト管理支援）担当者を読者に持つ、行政DX・AI活用の専門キュレーターです。

以下の政府公式情報を、PMO/PJMO担当者が「今日の業務で何を確認・対応すべきか」をすぐに把握できるよう要約してください。

【要約フォーマット（summary フィールド）】
1行目: 何が起きたか・何が発表されたかを端的に（60字以内）
2行目: （空行）
3行目以降: PMO/PJMOとしての対応ポイントを箇条書き（最大3点、各1行）
  → 「確認すべき文書・章番号」「対応期限・スケジュール感」「担当部署・役割名」を可能な限り具体的に
  → 例: 「▶ 各府省PJMOは6月末までにCAIO設置状況を内閣官房に報告」
  → 例: 「▶ ガイドライン第3章（pp.28-45）のプロジェクト管理要件を確認」

【追加ルール】
- 技術用語は行政担当者が理解できる表現に言い換える（例: コンテナ→仮想化技術の一種）
- 出典の事実のみ記載し、AI独自の解釈・推測は含めない
- 「重要」「画期的」等の主観的形容詞は使わない

【重要度判定（importance_score: 整数1〜5）】
5: 即時対応必須（CVE・CVSS9以上の脆弱性、施行間近のガイドライン改定、政府緊急指示）
4: 今月中に確認が必要（新ガイドライン公開、政府AI戦略・源内関連の重要決定、調達制度変更、ガバメントクラウド移行関連）
3: 四半期以内に把握が望ましい（行政DX動向、デジタル庁・各省庁のAI導入事例、制度変更予告、自治体先進事例、政策方針の発表）
2: 参考情報（行政に波及しうるAI業界トレンド、海外行政DX事例、技術動向、審議会・委員会の実質的な審議内容）
1: PMO/PJMO業務に直接関係しない情報（必ずスコア1とする）

【スコア1（必須）の記事パターン ― 下記に該当するものは内容を問わず1とする】
- 開催案内・開催のご案内（審議会・委員会・研究会・ワーキンググループの日程告知のみ）
- 議事録・配布資料の掲載お知らせ（内容ではなく「掲載した」という連絡のみ）
- 更新連絡（既存ページ・既存資料の更新を知らせるだけの記事）
- 入札・一般競争入札・企画競争の公告（政策内容を含まない調達公告）
- 大臣・長官の記者会見動画・要旨の掲載通知（会見内容を含まず「掲載した」旨だけのもの）
- 人事・採用・官庁訪問情報
- こども向け広報・一般市民向け見学・イベント案内
- 交通事故統計、山岳遭難、自殺統計等の行政DXと無関係な広報

【採用優先】
デジタル庁施策・ガバメントクラウド・源内・マイナンバー・行政AI・DX計画に関する情報

【セキュリティ速報判定（is_security_alert: true/false）】
trueとする条件: CVE番号付きの脆弱性情報、IPA・JPCERT・NISCの緊急注意喚起、政府システムへの直接的な脅威

対象記事:
${inputJson}

以下のJSONのみを出力すること（説明文・コードブロック記号は不要）:
[
  {
    "index": 元の記事インデックス（整数）,
    "summary": "要約テキスト（改行は\\nで表現）",
    "importance_score": 1〜5の整数,
    "is_security_alert": true または false
  }
]`;

  try {
    const text = await callGemini(model, prompt);
    const results = parseJsonFromText(text);
    if (!Array.isArray(results)) {
      console.warn('[WARN] 政府記事要約: GeminiがJSON配列以外を返しました。フォールバックを使用します');
      return articles.map(buildFallbackArticle);
    }
    // targetArticles だけが Gemini に渡されているので、それ以外はフォールバック
    const summarized = targetArticles.map((article, i) => {
      const r = results.find((x) => Number(x.index) === i) || {};
      return {
        ...article,
        summary: r.summary || article.description?.slice(0, 150) || article.title,
        importance_score: Number(r.importance_score) || 2,
        is_security_alert: Boolean(r.is_security_alert),
      };
    });
    const remaining = articles.slice(targetArticles.length).map(buildFallbackArticle);
    return [...summarized, ...remaining];
  } catch (err) {
    if (isFatalGeminiError(err) || err.rateLimited) throw err;
    console.warn(`[WARN] 政府記事要約エラー: ${err.message}`);
    return articles.map(buildFallbackArticle);
  }
}

// ── (B) ニュース記事フィルタリング・要約 ────────────────────────────
async function filterAndSummarizeNews(articles, model, maxCount = 5) {
  if (articles.length === 0) return [];

  // 入力件数を40件に制限してトークン増加を防ぐ
  const targetArticles = articles.slice(0, 40);
  // URLはプロンプトから除外し、インデックスでマッチング（トークン削減）
  const inputJson = JSON.stringify(
    targetArticles.map((a, i) => ({
      index: i,
      title: a.title,
      summary: a.description,
      source: a.sourceName,
    }))
  );
  console.log(`[INFO] ニュースフィルタ: ${targetArticles.length}件 / 入力サイズ: ${inputJson.length}文字`);

  const prompt = `あなたは中央省庁のPMO（プロジェクト管理オフィス）・PJMO（プロジェクト管理支援）担当者を読者に持つ、行政DX・AI活用の専門キュレーターです。

以下のニュース記事一覧から、中央省庁PMO/PJMO担当者の業務に関連するものを厳選し、トピックとして要約してください。

【グルーピングのルール（重要）】
- 複数の記事が同じ出来事・同じ発表・同じ事案を報じている場合（＝異なる報道機関が同一ニュースを配信しているだけの場合）は、1つのトピックに統合すること
- キーワードが同じでも、報じている内容・論点が異なる記事（例: 同じ「マイナンバー」でも「制度改正」の記事と別の自治体の「system障害」の記事など）は、統合せず別トピックのままにすること
- 統合するかどうかの判断基準は「読者が同じ出来事の重複情報として読むか、別の話題として読むか」であり、単なるキーワード一致では判断しないこと
- 統合したトピックの title・summary は、いずれか1記事の言い回しをそのまま使うのではなく、まとめた記事群の内容を踏まえて1つに書き直すこと
- 統合したトピックの relevance（PMO/PJMO対応）は、まとめた記事群全体を踏まえて1文だけ記載すること（記事ごとに分けて書かない）

【選別基準（高スコア）】
- 政府・省庁・政府CIOポータルが直接関与するIT施策・デジタル化の動向
- ガバメントクラウド（AWS/Azure/Google/Oracle）の政府システム対応状況
- 行政機関・自治体でのAI・生成AI導入事例（PMOが横展開参考にできる）
- 政府調達・仕様書作成・契約形態に影響する制度・判例の変化
- CVE番号付き・IPA/JPCERT推奨対応のセキュリティ脆弱性
- EU AI法・個人情報保護法改正等、日本の行政システムに波及する規制動向
- マイナンバー・ベース・レジストリ・デジタル手続法に関わるシステム要件の変化
- 先進自治体のDX事例（中央省庁が参考にできる業務改革・AI活用）
- PMO/PJMOのプロジェクト管理手法・ガバナンス体制の実践事例（生成AI・DX推進体制の構築、プロジェクトガバナンスの先進事例）
  → 民間企業の事例でも、PMO/PJMOが自組織のプロジェクト運営に応用できる内容であれば採用対象とする（単なる自社製品PRは除く）

【除外（スコア1以下）】
- 民間企業のみのマーケティングPR記事
- コンシューマ向けスマホ・ゲーム・SNSの記事
- 日本の行政・法制度に影響のない純粋な海外の話題
- 数値改善のない「〇〇を発表」だけのプレスリリース

【要約ルール】
- summary: 事実を2行以内（100字以内）で要約。「何が変わった/発表された」を明確に
- relevance: 「○○担当のPMO/PJMOは□□を確認/対応すること」という形式で1文（具体的な役割・アクションを示す）
- category: 以下から最も適切な1つを選ぶ
  「AI活用」「セキュリティ」「クラウド/インフラ」「制度/ガイドライン」「自治体DX事例」「調達・契約」「働き方/業務改革」「プロジェクト管理」

対象記事:
${inputJson}

同一ニュースの統合を済ませた上で、PMO/PJMO業務に関連性の高い上位${maxCount}トピックを選定し、以下のJSONのみを出力すること（説明文・コードブロック記号は不要）:
[
  {
    "indices": [このトピックを構成する元記事インデックスの配列（同一ニュースを統合した場合は複数、単独記事なら1件のみ）],
    "title": "統合後のタイトル（内容を踏まえて1つに書き直す）",
    "summary": "2行以内の要約",
    "relevance": "PMO/PJMOとしての具体的な対応・確認事項を1文で（トピック全体で1つ）",
    "category": "カテゴリタグ",
    "score": 関連性スコア（1〜10の整数）
  }
]`;

  const buildFallbackTopics = () =>
    articles.slice(0, maxCount).map((a) => ({
      title: a.title,
      summary: a.description || a.title,
      relevance: DEFAULT_RELEVANCE,
      category: 'その他',
      sources: [toSourceEntry(a)],
      score: 0,
    }));

  try {
    const text = await callGemini(model, prompt);
    const results = parseJsonFromText(text);
    if (!Array.isArray(results)) {
      console.warn('[WARN] ニュースフィルタ: GeminiがJSON配列以外を返しました。フォールバックを使用します');
      return buildFallbackTopics();
    }
    const seenIndices = new Set();
    return results
      .map((r) => {
        // Geminiが数値配列の要素を文字列で返すことがあるため、旧index実装と同様
        // Number() で明示的に変換してから整数判定する（"3" のような文字列も許容する）
        const rawIndices = Array.isArray(r.indices) ? r.indices : [];
        const validIndices = [];
        for (const raw of rawIndices) {
          const idx = Number(raw);
          if (Number.isInteger(idx) && idx >= 0 && idx < targetArticles.length) {
            validIndices.push(idx);
          } else {
            console.warn(`[WARN] ニュースフィルタ: 無効なindex (${JSON.stringify(raw)}) をスキップ`);
          }
        }
        return { ...r, validIndices };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .filter((r) => {
        if (r.validIndices.length === 0) {
          console.warn(`[WARN] ニュースフィルタ: 有効なindicesなしの結果をスキップ (${JSON.stringify(r.indices)})`);
          return false;
        }
        // 既に採用済みのindexは除外（Geminiが同一記事を複数トピックに重複割当した場合の対策）
        r.validIndices = r.validIndices.filter((idx) => !seenIndices.has(idx));
        if (r.validIndices.length === 0) return false;
        r.validIndices.forEach((idx) => seenIndices.add(idx));
        return true;
      })
      .slice(0, maxCount)
      .map((r) => {
        const origArticles = r.validIndices.map((idx) => targetArticles[idx]);
        const primary = origArticles[0];
        const seenUrls = new Set();
        const sources = origArticles
          .filter((a) => {
            if (!a.url || seenUrls.has(a.url)) return false;
            seenUrls.add(a.url);
            return true;
          })
          .map(toSourceEntry);
        return {
          title: r.title || primary.title || '',
          summary: r.summary || primary.description || primary.title || '',
          relevance: r.relevance || DEFAULT_RELEVANCE,
          category: r.category || 'その他',
          sources,
          score: Number(r.score) || 0,
        };
      });
  } catch (err) {
    if (isFatalGeminiError(err) || err.rateLimited) throw err;
    console.warn(`[WARN] ニュースフィルタエラー: ${err.message}`);
    return buildFallbackTopics();
  }
}

// ── (C) 今日のニュース要約生成は
// gemini-utils.js の generateSummaryPoints（regenerate-brief.js と共通実装）を使用 ──

// ── tags.json 更新 ────────────────────────────────────────────────────
function updateTagsIndex(date, dateJa, dayData) {
  const tagsPath = resolve(DATA_DIR, 'tags.json');
  let tagsData = { tags: {}, tag_counts: {}, updated_at: '' };
  try { tagsData = JSON.parse(readFileSync(tagsPath, 'utf-8')); } catch { /* 新規 */ }

  // 対象日の既存エントリを削除
  for (const tag of Object.keys(tagsData.tags)) {
    tagsData.tags[tag] = tagsData.tags[tag].filter((a) => a.date !== date);
    if (tagsData.tags[tag].length === 0) delete tagsData.tags[tag];
  }

  // ニューストピックをカテゴリタグで登録
  for (const topic of (dayData.news_topics || [])) {
    if (!topic.category) continue;
    const tag = topic.category;
    if (!tagsData.tags[tag]) tagsData.tags[tag] = [];
    // 複数ソースを統合したトピックでも、tags.json は従来通り1件1ソースの
    // フラットな形式を維持するため、代表として先頭ソースのみを記録する
    const primarySource = (topic.sources || [])[0] || { name: topic.source, url: topic.url };
    tagsData.tags[tag].unshift({
      date,
      date_ja: dateJa,
      title: topic.title,
      summary: topic.summary || '',
      source: primarySource.name || '',
      url: primarySource.url || '',
      relevance: topic.relevance || '',
      type: 'news',
    });
  }

  // 政府記事をセクションタイプで登録
  const govArticles = [dayData.hero_article, ...(dayData.sub_articles || [])].filter(Boolean);
  for (const article of govArticles) {
    const sn = article.section_name || '';
    let tag = '';
    if (sn.includes('AI') || sn.includes('生成')) tag = '行政AI';
    else if (sn.includes('DX')) tag = '行政DX';
    else if (sn.includes('セキュリティ') || sn.includes('情報セキュリティ')) tag = 'セキュリティ';
    if (!tag) continue;
    if (!tagsData.tags[tag]) tagsData.tags[tag] = [];
    tagsData.tags[tag].unshift({
      date,
      date_ja: dateJa,
      title: article.title,
      summary: article.summary || '',
      source: article.source_name || '',
      url: article.source_url || '',
      type: 'government',
    });
  }

  // カウント更新
  tagsData.tag_counts = Object.fromEntries(
    Object.entries(tagsData.tags).map(([k, v]) => [k, v.length])
  );
  tagsData.updated_at = new Date().toISOString();

  writeFileSync(tagsPath, JSON.stringify(tagsData, null, 2), 'utf-8');
  console.log('[INFO] tags.json 更新完了');
}

// ── index.json 更新 ───────────────────────────────────────────────────
function updateIndex(date, summaryShort, articleCount, hasSecurityAlert) {
  const indexPath = resolve(DATA_DIR, 'index.json');
  let index = { dates: [] };
  try { index = JSON.parse(readFileSync(indexPath, 'utf-8')); } catch { /* 新規 */ }

  index.dates = index.dates.filter((d) => d.date !== date);
  index.dates.unshift({ date, summary_short: summaryShort, article_count: articleCount, has_security_alert: hasSecurityAlert });
  index.dates = index.dates.slice(0, 90);

  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[INFO] index.json 更新 (${index.dates.length}日分)`);
}

// ── メイン ────────────────────────────────────────────────────────────
async function main() {
  const targetDate = process.env.TARGET_DATE || getTodayJST();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

  console.log(`[INFO] 対象日: ${targetDate} / モデル: ${model}`);
  mkdirSync(DATA_DIR, { recursive: true });

  // ①②③ 政府公式・Google Alerts・クラウドCSP公式のRSSを収集
  // （3種類とも互いに独立したネットワークI/Oのため、フェッチ自体は同時に投げる）
  console.log('[INFO] RSSフィードを収集中（政府公式・Google Alerts・クラウドCSP公式、並列）...');
  const [govResults, alertResults, cloudResults] = await Promise.all([
    Promise.all(GOV_SOURCES.map((src) => fetchFeed(src.url, src.name, src.charset).then((items) => ({ src, items })))),
    GOOGLE_ALERT_SOURCES.length > 0
      ? Promise.all(GOOGLE_ALERT_SOURCES.map((src) => fetchFeed(src.url, src.name).then((items) => ({ src, items }))))
      : Promise.resolve([]),
    Promise.all(CLOUD_SOURCES.map((src) => fetchCloudFeed(src))),
  ]);

  // ① 政府公式記事
  const govArticlesRaw = [];
  for (const { src, items } of govResults) {
    items.forEach((a) => govArticlesRaw.push({ ...a, articleType: src.type }));
    console.log(`[INFO]   ${src.name}: ${items.length}件`);
  }
  console.log(`[INFO] 政府記事合計: ${govArticlesRaw.length}件`);

  // ② Google Alerts RSS
  const newsArticlesRaw = [];
  if (GOOGLE_ALERT_SOURCES.length > 0) {
    for (const { src, items } of alertResults) {
      newsArticlesRaw.push(...items);
      console.log(`[INFO]   ${src.name}: ${items.length}件`);
    }
  } else {
    console.log('[INFO] Google Alerts RSS 未設定 → ニューストピックはスキップ');
  }
  // URL重複排除
  const seenUrls = new Set();
  const newsDeduped = newsArticlesRaw.filter((a) => {
    if (!a.url || seenUrls.has(a.url)) return false;
    seenUrls.add(a.url);
    return true;
  });
  console.log(`[INFO] Google Alerts 記事合計: ${newsArticlesRaw.length}件 → 重複排除後: ${newsDeduped.length}件`);

  // ③ ガバメントクラウド認定CSP公式RSS（AI要約なし、生RSS情報をそのまま掲載）
  const cloudItemsRaw = [];
  CLOUD_SOURCES.forEach((src, i) => {
    cloudItemsRaw.push(...cloudResults[i]);
    console.log(`[INFO]   ${src.name}: ${cloudResults[i].length}件`);
  });
  // 同一プロバイダの複数フィード（例: Google Cloudのリリースノート＋ブログ）が
  // 同じ記事を重複配信する場合があるためURLで重複排除する
  const seenCloudUrls = new Set();
  const cloudItemsDeduped = cloudItemsRaw.filter((item) => {
    if (!isValidUrl(item.url) || seenCloudUrls.has(item.url)) return false;
    seenCloudUrls.add(item.url);
    return true;
  });
  // pubDateが欠落・不正な日付文字列の場合はepoch(0)扱いにして必ず最下位に沈める
  // （Dateの引き算がNaNになるとsortの比較結果が不定になり、ゴミ日付の記事が
  // 新着扱いで上位に紛れ込むことがあるため、数値化してから比較する）
  const cloudDateValue = (item) => {
    const t = new Date(item.pubDate).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const cloudUpdates = [...new Set(CLOUD_SOURCES.map((s) => s.provider))]
    .map((provider) => ({
      provider,
      items: cloudItemsDeduped
        .filter((item) => item.provider === provider)
        .sort((a, b) => cloudDateValue(b) - cloudDateValue(a))
        .slice(0, CLOUD_ITEMS_PER_PROVIDER)
        .map((item) => ({
          title: item.title,
          url: item.url,
          pub_date: cloudDateValue(item) === 0 ? '' : new Date(item.pubDate).toISOString(),
          source: item.sourceName,
        })),
    }))
    .filter((p) => p.items.length > 0);
  console.log(`[INFO] クラウド公式情報: ${cloudUpdates.reduce((n, p) => n + p.items.length, 0)}件（${cloudUpdates.length}プロバイダ）`);

  let summarizedGov = [];
  let newsTopics = [];
  let geminiOk = false;

  if (hasApiKey) {
    try {
      // ③④ 政府記事の要約とニュースのフィルタリングは互いに独立しているため並列実行。
      // Promise.allSettled で両方の完了を待ってから結果を確定させる（Promise.race的に
      // 片方だけ待って抜けると、もう一方の内部リトライがバックグラウンドで残り続けて
      // プロセス終了を遅らせるため使わない）
      console.log('[INFO] 政府記事を要約中...');
      console.log('[INFO] ニュース記事をフィルタリング中...');
      const [govResult, newsResult] = await Promise.allSettled([
        summarizeGovArticles(govArticlesRaw, model),
        filterAndSummarizeNews(newsDeduped, model, 10),
      ]);
      if (govResult.status === 'rejected') throw govResult.reason;
      if (newsResult.status === 'rejected') throw newsResult.reason;
      summarizedGov = govResult.value;
      newsTopics = newsResult.value;
      geminiOk = true;
    } catch (err) {
      const label = err.zeroQuota ? '（クォータ割当0・要アカウント確認）' : err.budgetExceeded ? '（1実行あたりの呼び出し上限に到達）' : err.rateLimited ? '（レート制限）' : '';
      console.warn(`[WARN] Gemini APIエラー${label}: ${err.message}`);
      summarizedGov = govArticlesRaw.map(buildFallbackArticle);
      newsTopics = newsDeduped.slice(0, 10).map((a) => ({
        title: a.title,
        summary: a.description || a.title,
        relevance: DEFAULT_RELEVANCE,
        category: 'その他',
        sources: [toSourceEntry(a)],
        score: 0,
      }));
    }
  } else {
    console.warn('[WARN] GEMINI_API_KEY 未設定。フォールバックデータを使用します。');
    summarizedGov = govArticlesRaw.map(buildFallbackArticle);
    newsTopics = newsDeduped.slice(0, 10).map((a) => ({
      title: a.title,
      summary: a.description || a.title,
      relevance: DEFAULT_RELEVANCE,
      category: 'その他',
      sources: [toSourceEntry(a)],
      score: 0,
    }));
  }

  // ⑥ 記事を選定

  // セキュリティ速報
  const securityAlerts = summarizedGov
    .filter((a) => a.is_security_alert && a.importance_score >= 4)
    .map((a) => ({ title: a.title, url: isValidUrl(a.url) ? a.url : '', source: a.sourceName }));

  // 非セキュリティ記事: スコア降順、同スコア内はテーマ順（行政AI → 行政DX）
  const GOV_TYPE_ORDER = ['ai_government', 'dx'];
  const allNonSecurity = summarizedGov
    .filter((a) => !a.is_security_alert)
    .sort((a, b) => {
      const scoreDiff = b.importance_score - a.importance_score;
      if (scoreDiff !== 0) return scoreDiff;
      const ai = GOV_TYPE_ORDER.indexOf(a.articleType);
      const bi = GOV_TYPE_ORDER.indexOf(b.articleType);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  // 同一ソースから最大3件に制限
  const sourceCount = {};
  const nonSecurity = allNonSecurity.filter((a) => {
    const key = a.sourceName;
    sourceCount[key] = (sourceCount[key] || 0) + 1;
    return sourceCount[key] <= 3;
  });

  const buildArticleContext = (a) => {
    const sourceUrl = isValidUrl(a.url) ? a.url : '';
    if (!sourceUrl) console.warn(`[WARN] 無効なURL除外: "${a.url}" (${a.title?.slice(0, 40)})`);
    return {
      section_name: SECTION_MAP[a.articleType] || SECTION_MAP.dx,
      title: a.title,
      summary: a.summary || a.description?.slice(0, 150) || a.title,
      source_name: a.sourceName,
      source_url: sourceUrl,
      pub_date: (() => {
        if (!a.pubDate) return targetDate;
        const d = new Date(a.pubDate);
        return isNaN(d.getTime()) ? targetDate : d.toISOString().slice(0, 10);
      })(),
    };
  };

  // 注目記事: importance_score >= 3 のみ（開催案内・更新連絡等は除外）
  const highPriorityGov = nonSecurity.filter((a) => a.importance_score >= 3);
  // 参考情報（score 2）→ ニューストピックへ移動
  const midPriorityGov  = nonSecurity.filter((a) => a.importance_score === 2);

  const heroArticle = highPriorityGov[0] ? buildArticleContext(highPriorityGov[0]) : null;
  const subArticles = highPriorityGov.slice(1, 6).map(buildArticleContext); // 最大5件

  // score 2 の政府記事をニューストピック形式に変換して追加
  const ARTICLE_TYPE_TO_CATEGORY = {
    security:      'セキュリティ',
    ai_government: '行政AI',
    dx:            '行政DX',
  };
  const govMidAsNews = midPriorityGov
    .filter((a) => isValidUrl(a.url))
    .map((a) => ({
      title:     a.title,
      summary:   a.summary || a.description?.slice(0, 100) || a.title,
      relevance: DEFAULT_RELEVANCE,
      category:  ARTICLE_TYPE_TO_CATEGORY[a.articleType] || '行政DX',
      sources:   [toSourceEntry(a)],
      score:     a.importance_score,
    }));

  // newsTopics の URL バリデーション（sources配列内の各ソースを個別に検証）
  newsTopics = newsTopics.map((t) => ({
    ...t,
    sources: (t.sources || []).map((s) => {
      if (!isValidUrl(s.url)) {
        console.warn(`[WARN] ニュースURL無効: "${s.url}" → クリア`);
        return { ...s, url: '' };
      }
      return s;
    }),
  }));

  // gov 参考情報を追加してテーマ順に並べ直す
  const NEWS_CATEGORY_ORDER = [
    'セキュリティ', '行政AI', '行政DX',
    'AI活用', 'プロジェクト管理', 'クラウド/インフラ', '制度/ガイドライン',
    '自治体DX事例', '調達・契約', '働き方/業務改革', 'その他',
  ];
  newsTopics = [...newsTopics, ...govMidAsNews].sort((a, b) => {
    const ai = NEWS_CATEGORY_ORDER.indexOf(a.category);
    const bi = NEWS_CATEGORY_ORDER.indexOf(b.category);
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (catDiff !== 0) return catDiff;
    return (b.score || 0) - (a.score || 0);
  });

  // ⑤ 今日のニュース要約を生成
  // メイン処理（gov要約・newsフィルタ）が成功した場合のみここで生成する。
  // 失敗（レート制限など）時は null のまま保存し、5分後に regenerate-brief.js が補完する。
  let newsSummary = null;
  if (hasApiKey && geminiOk) {
    try {
      console.log('[INFO] 今日のニュース要約を生成中...');
      newsSummary = await generateSummaryPoints(buildSummaryInput(heroArticle, subArticles, newsTopics), model);
    } catch (err) {
      // クォータ0・呼び出し上限到達はここで打ち切り、regenerate-brief.js に委譲する。
      // 他のステップ（政府記事・ニューストピック）は既に確定済みなのでスクリプト全体は失敗させない。
      const label = err.zeroQuota ? '（クォータ割当0・要アカウント確認）' : err.budgetExceeded ? '（1実行あたりの呼び出し上限に到達）' : '';
      console.warn(`[WARN] summaryエラー${label}: ${err.message}`);
    }
  } else if (!geminiOk) {
    console.log('[INFO] メインAPI処理が未成功のため、summary は regenerate-brief.js に委譲');
  }

  // ⑦ JSON 保存
  const dayData = {
    date: targetDate,
    date_ja: formatDateJa(targetDate),
    news_summary: newsSummary,
    security_alerts: securityAlerts,
    hero_article: heroArticle,
    sub_articles: subArticles,
    news_topics: newsTopics,
    cloud_updates: cloudUpdates,
    generated_at: new Date().toISOString(),
  };

  const outPath = resolve(DATA_DIR, `${targetDate}.json`);
  writeFileSync(outPath, JSON.stringify(dayData, null, 2), 'utf-8');
  console.log(`[INFO] ${outPath} 保存完了`);

  // ⑧ index.json 更新
  const govCount = (heroArticle ? 1 : 0) + subArticles.length;
  const totalCount = govCount + newsTopics.length;
  const summaryShort = heroArticle
    ? `${heroArticle.title.slice(0, 30)}…など${govCount}件`
    : subArticles.length > 0
      ? `${(subArticles[0]?.title || '').slice(0, 30)}…など${govCount}件`
      : newsTopics.length > 0
        ? `${(newsTopics[0]?.title || '').slice(0, 28)}…など${newsTopics.length}件`
        : 'データなし';
  updateIndex(targetDate, summaryShort, totalCount, securityAlerts.length > 0);

  // ⑨ tags.json 更新
  updateTagsIndex(targetDate, formatDateJa(targetDate), dayData);

  console.log('[INFO] 完了');
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});

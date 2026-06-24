/**
 * generate-content.js
 * 政府公式RSS＋Google Alerts RSSを収集し、Gemini APIでフィルタリング・要約して
 * public/data/ に JSON として保存する。
 *
 * 使用方法: GEMINI_API_KEY=xxx node scripts/generate-content.js
 *
 * 環境変数:
 *   GEMINI_API_KEY  - Google Gemini API キー（必須）
 *   GEMINI_MODEL    - 使用モデル（省略時: gemini-2.0-flash）
 *   TARGET_DATE     - 対象日 YYYY-MM-DD（省略時: 今日 JST）
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'public', 'data');

// ── 政府公式 RSS ソース ────────────────────────────────────────────────
// 中央省庁PMO/PJMO担当者が最低限押さえるべき公式情報源
const GOV_SOURCES = [
  // ── セキュリティ（優先度最高）
  { name: 'JPCERT/CC 注意喚起',        url: 'https://www.jpcert.or.jp/rss/jpcert-all.rdf',                type: 'security' },
  { name: 'IPA 重要なセキュリティ情報', url: 'https://www.ipa.go.jp/security/alert-rss.rdf',              type: 'security' },
  { name: 'NISC 新着情報',             url: 'https://www.nisc.go.jp/rss/nisc_alert.rdf',                 type: 'security' },

  // ── デジタル庁（DX政策の中核）
  { name: 'デジタル庁 新着情報',        url: 'https://www.digital.go.jp/rss/news.xml',                   type: 'ai_government' },
  { name: 'デジタル庁 note',            url: 'https://digital-gov.note.jp/rss',                           type: 'ai_government' },

  // ── 各省庁 DX・AI関連
  { name: '経済産業省 新着情報',        url: 'https://www.meti.go.jp/press/rss.rdf',                     type: 'dx' },
  { name: '内閣府 新着情報',            url: 'https://www.cao.go.jp/rss/news.rdf',                       type: 'dx' },
  { name: '厚生労働省 新着情報',        url: 'https://www.mhlw.go.jp/stf/news.rdf',                      type: 'dx' },
  { name: '金融庁 新着情報',            url: 'https://www.fsa.go.jp/fsaNewsListAll_rss2.xml',             type: 'dx' },
];

// ── Google Alerts RSS ────────────────────────────────────────────────
const GOOGLE_ALERT_SOURCES = [
  { name: 'Google Alert: クラウド×政府',     url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/3339123942717391102' },
  { name: 'Google Alert: AI×行政',           url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/5311248654206121616' },
  { name: 'Google Alert: AIガバナンス',       url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/9123460682984763914' },
  { name: 'Google Alert: ガバメントクラウド', url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/5311248654206123495' },
  { name: 'Google Alert: デジタル庁',         url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/849933549589956730'  },
  { name: 'Google Alert: 情報システム調達',   url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/3339123942717391505' },
  { name: 'Google Alert: 政府情報システム',   url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/9123460682984763418' },
  { name: 'Google Alert: 生成AI×行政',       url: 'https://www.google.co.jp/alerts/feeds/11004476688740155475/5311248654206122373' },
];

// ── DX Tips テーマ一覧 ───────────────────────────────────────────────
// 中央省庁PMO/PJMO担当者が実務で役立てられるテーマ（30日間ローテーション）
const DX_TIP_TOPICS = [
  // プロジェクト管理・PMO
  'PMO審査でのAI活用チェックポイント：データ機密性・ハルシネーション対策・Human-in-the-Loop',
  '政府情報システム開発プロジェクトのリスク管理とエスカレーション基準',
  'ITダッシュボードの活用：プロジェクト進捗を定量的に可視化するKPI設計',
  'アジャイル開発と政府標準ガイドライン（PJMGv3）の整合のとり方',
  'ステークホルダー管理：複数府省にまたがるプロジェクトの合意形成技法',

  // AI活用・倫理
  'ガバメントAI「源内」効果的な活用法：業務別プロンプト設計のコツ',
  '生成AI導入前に確認すべきデータ機密性区分と入力制御の実装',
  'AIシステム調達仕様書の書き方：評価基準・性能要件・倫理条項',
  '行政手続きへのAI適用可否判断フレームワーク（高リスク・要注意・適用可）',
  'AI出力の品質管理：バリデーション設計とモニタリング計画の作り方',

  // セキュリティ
  'ゼロトラストセキュリティの政府システムへの段階的適用ロードマップ',
  '情報セキュリティポリシー年次見直しチェックリスト（デジタル庁準拠）',
  'サイバーインシデント発生時のPMO対応手順：報告ライン・BCP発動判断',
  'ガバメントクラウド上のシステムに求められるセキュリティ要件整理',
  'フィッシング・標的型攻撃から組織を守る職員教育プログラム設計',

  // クラウド・インフラ
  'ガバメントクラウド移行計画策定の5ステップ（対象・スケジュール・リスク・調達・体制）',
  'クラウドコスト最適化：政府システムでのFinOps実践ポイント',
  'オンプレミスからクラウドへの段階移行設計：データ移行のリスク低減手法',
  'マルチクラウド環境でのデータ主権・ロックイン回避策',

  // 制度・調達
  '政府IT調達の変化点：競争的対話方式・アジャイル型仕様書の実務',
  'PJMO向け：公共調達における契約変更・仕様変更の手続きと記録',
  'デジタル行財政改革で変わる政府システム調達の最新動向整理',
  '政府標準ガイドライン（GCAS）の主要ポイントと実プロジェクトへの適用',

  // データ連携・業務改革
  'マイナンバー利活用拡大に対応するシステム改修の設計留意点',
  'ベース・レジストリ活用：行政データ連携の標準化とAPIセキュリティ',
  'RPA・AI-OCRを活用した定型業務自動化のPoC設計から本番展開まで',
  '行政手続きのデジタル完結（Fax・押印廃止）推進の実務チェックリスト',
  '個人情報保護法改正対応：政府情報システムの設計見直しポイント',

  // 組織・人材
  'CAIO（最高AI責任者）設置・運用の実務：役割定義と省内連携体制',
  'DX人材育成計画の作り方：デジタルスキル標準（DSS）を活用したロードマップ',
];


// ── ペイウォールキーワード ────────────────────────────────────────────
const PAYWALL_KEYWORDS = ['会員限定', '有料会員', 'プレミアム会員', '有料記事', '会員専用'];

// ── 日付ユーティリティ ────────────────────────────────────────────────
function getTodayJST() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateJa(dateStr) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  // YYYY-MM-DD を直接パースして getDay() のタイムゾーンずれを回避
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // ローカルミッドナイト → タイムゾーン不問
  return `${y}年${m}月${d}日（${weekdays[dow]}）`;
}

function getDayOfYear(dateStr) {
  const d = new Date(dateStr + 'T00:00:00+09:00');
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
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
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseRSS(xml, sourceName) {
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
    // Google リダイレクト URL（google.com/url?...&url=ENCODED_URL）を実際の記事 URL に展開
    if (rawLink) {
      const googleRedirect = rawLink.match(/[?&]url=([^&]+)/);
      if (googleRedirect) {
        try { rawLink = decodeURIComponent(googleRedirect[1]); } catch { /* keep original */ }
      }
    }
    const link = (rawLink || extractTag(block, 'id')).replace(/\s/g, '');

    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || extractTag(block, 'dc:date');
    const description = stripHtml(extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content'));

    if (!title || !link) continue;

    // ペイウォードチェック
    if (PAYWALL_KEYWORDS.some((kw) => title.includes(kw) || description.includes(kw))) continue;

    // 36時間以内チェック（前日の業務時間帯記事もカバー）
    if (pubDate) {
      const age = Date.now() - new Date(pubDate).getTime();
      if (age > 36 * 60 * 60 * 1000) continue;
    }

    items.push({ title, url: link, description: description.slice(0, 400), pubDate, sourceName });
  }
  return items;
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

// ── セクション名マッピング ────────────────────────────────────────────
const SECTION_MAP = {
  security:      '🔒 セキュリティ速報',
  ai_government: '🤖 行政AI最前線',
  dx:            '🏛️ 行政DXトピックス',
};

// ── Gemini API ────────────────────────────────────────────────────────
async function callGemini(model, prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const m = genai.getGenerativeModel({ model });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await m.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      const msg = String(err.message);
      // 「current quota」はRPD日次上限 → リトライ不可。それ以外の429はRPM → 待機してリトライ
      const isRpmLimit = msg.includes('429') && !msg.includes('current quota');
      if (isRpmLimit && attempt < 2) {
        const wait = (attempt + 1) * 30000;
        console.warn(`[WARN] Gemini RPMリミット - ${wait / 1000}秒後にリトライ (${attempt + 1}/2)`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

function parseJsonFromText(text) {
  const cleaned = text
    .replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

// ── (A) 政府記事バッチ要約 ──────────────────────────────────────────
async function summarizeGovArticles(articles, model) {
  if (articles.length === 0) return [];

  const inputJson = JSON.stringify(
    articles.map((a, i) => ({
      index: i,
      source: a.sourceName,
      title: a.title,
      content: a.description,
    })),
    null, 2
  );

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
    return articles.map((article, i) => {
      const r = results.find((x) => x.index === i) || {};
      return {
        ...article,
        summary: r.summary || article.description?.slice(0, 150) || article.title,
        importance_score: Number(r.importance_score) || 2,
        is_security_alert: Boolean(r.is_security_alert),
      };
    });
  } catch (err) {
    console.warn(`[WARN] 政府記事要約エラー: ${err.message}`);
    return articles.map((a) => ({
      ...a,
      summary: a.description?.slice(0, 150) || a.title,
      importance_score: 2,
      is_security_alert: false,
    }));
  }
}

// ── (B) ニュース記事フィルタリング・要約 ────────────────────────────
async function filterAndSummarizeNews(articles, model, maxCount = 5) {
  if (articles.length === 0) return [];

  const inputJson = JSON.stringify(
    articles.map((a) => ({
      title: a.title,
      summary: a.description,
      source: a.sourceName,
      url: a.url,
    })),
    null, 2
  );

  const prompt = `あなたは中央省庁のPMO（プロジェクト管理オフィス）・PJMO（プロジェクト管理支援）担当者を読者に持つ、行政DX・AI活用の専門キュレーターです。

以下のニュース記事一覧から、中央省庁PMO/PJMO担当者の業務に関連するものを厳選して要約してください。

【選別基準（高スコア）】
- 政府・省庁・政府CIOポータルが直接関与するIT施策・デジタル化の動向
- ガバメントクラウド（AWS/Azure/Google/Oracle）の政府システム対応状況
- 行政機関・自治体でのAI・生成AI導入事例（PMOが横展開参考にできる）
- 政府調達・仕様書作成・契約形態に影響する制度・判例の変化
- CVE番号付き・IPA/JPCERT推奨対応のセキュリティ脆弱性
- EU AI法・個人情報保護法改正等、日本の行政システムに波及する規制動向
- マイナンバー・ベース・レジストリ・デジタル手続法に関わるシステム要件の変化
- 先進自治体のDX事例（中央省庁が参考にできる業務改革・AI活用）

【除外（スコア1以下）】
- 民間企業のみのマーケティングPR記事
- コンシューマ向けスマホ・ゲーム・SNSの記事
- 日本の行政・法制度に影響のない純粋な海外の話題
- 数値改善のない「〇〇を発表」だけのプレスリリース

【要約ルール】
- summary: 事実を2行以内（100字以内）で要約。「何が変わった/発表された」を明確に
- relevance: 「○○担当のPMO/PJMOは□□を確認/対応すること」という形式で1文（具体的な役割・アクションを示す）
  例: 「ガバメントクラウド移行プロジェクトのPJMOは、調達仕様書のセキュリティ要件を本件に合わせて見直す必要がある」
  例: 「AI導入を検討中のPMOは、本事例を先行事例として事業計画書に参照できる」
- category: 以下から最も適切な1つを選ぶ
  「AI活用」「セキュリティ」「クラウド/インフラ」「制度/ガイドライン」「自治体DX事例」「調達・契約」「働き方/業務改革」

対象記事:
${inputJson}

PMO/PJMO業務に関連性の高い上位${maxCount}本を選定し、以下のJSONのみを出力すること（説明文・コードブロック記号は不要）:
[
  {
    "title": "記事タイトル（原文のまま）",
    "summary": "2行以内の要約",
    "relevance": "PMO/PJMOとしての具体的な対応・確認事項を1文で",
    "category": "カテゴリタグ",
    "source": "出典サイト名",
    "url": "記事URL",
    "score": 関連性スコア（1〜10の整数）
  }
]`;

  try {
    const text = await callGemini(model, prompt);
    const results = parseJsonFromText(text);
    return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, maxCount);
  } catch (err) {
    console.warn(`[WARN] ニュースフィルタエラー: ${err.message}`);
    // フォールバック: Gemini失敗時は最新N件をそのまま返す
    return articles.slice(0, maxCount).map((a) => ({
      title: a.title,
      summary: a.description || a.title,
      relevance: '',
      category: 'その他',
      source: a.sourceName,
      url: a.url,
      score: 0,
    }));
  }
}

// ── (C) DX Tips 生成 ─────────────────────────────────────────────────
async function generateDxTip(date, model) {
  const topic = DX_TIP_TOPICS[getDayOfYear(date) % DX_TIP_TOPICS.length];

  const prompt = `あなたは中央省庁のPMO（プロジェクト管理オフィス）・PJMO（プロジェクト管理支援）担当者向けの行政DX実務アドバイザーです。

以下のテーマについて、今日から実践できる実務的なDX Tipsを1本作成してください。

テーマ: ${topic}

【作成ルール】
- タイトル: 25字以内。「〜のポイント」「〜の進め方」「〜チェックリスト」等、実務的なフォーマット
- 本文: 以下の構成で250〜350字（改行 \\n を使って読みやすく）
    ① 背景・なぜ今重要か（1〜2文）
    ② 実務ステップまたはチェック項目（①②③の番号付きで3〜4項目）
    ③ 注意点・よくある落とし穴（1文）
  → PMO/PJMO担当者が「今日の仕事でそのまま使える」レベルの具体性で書く
  → 「〜すること」「〜を確認」「〜に留意」等、行動指示形で記述
  → 行政特有の事情（機密性区分・調達プロセス・閣議決定・ガイドライン番号等）を盛り込む
- 参照元: 実在する政府公開文書の正式名称を1つ（「デジタル庁○○ガイドライン」「IPA○○ガイド」等）
- 参照元URL: その文書の実在する公開URL（確信がない場合は "" を指定、架空URLは禁止）

以下のJSONのみを出力すること（説明文・コードブロック記号は不要）:
{
  "title": "タイトル",
  "body": "本文（改行は \\n で表現）",
  "reference": "文書名",
  "reference_url": "URL（不確かな場合は空文字）"
}`;

  try {
    const text = await callGemini(model, prompt);
    return parseJsonFromText(text);
  } catch (err) {
    console.warn(`[WARN] DX Tip生成エラー: ${err.message}`);
    return {
      title: topic.slice(0, 20),
      body: `${topic}について、PMO/PJMO視点から実務的な観点で整理します。詳細はデジタル庁の公開ガイドラインをご参照ください。`,
      reference: 'デジタル庁「デジタル社会の実現に向けた重点計画」',
      reference_url: 'https://www.digital.go.jp/policies/priority-policy-program',
    };
  }
}

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
    tagsData.tags[tag].unshift({
      date,
      date_ja: dateJa,
      title: topic.title,
      summary: topic.summary || '',
      source: topic.source || '',
      url: topic.url || '',
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
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

  console.log(`[INFO] 対象日: ${targetDate} / モデル: ${model}`);
  mkdirSync(DATA_DIR, { recursive: true });

  // ① 政府公式記事を収集
  console.log('[INFO] 政府公式RSSを収集中...');
  const govArticlesRaw = [];
  for (const src of GOV_SOURCES) {
    const items = await fetchFeed(src.url, src.name, src.charset);
    items.forEach((a) => govArticlesRaw.push({ ...a, articleType: src.type }));
    console.log(`[INFO]   ${src.name}: ${items.length}件`);
  }
  console.log(`[INFO] 政府記事合計: ${govArticlesRaw.length}件`);

  // ② Google Alerts RSS を収集
  const newsArticlesRaw = [];
  if (GOOGLE_ALERT_SOURCES.length > 0) {
    console.log('[INFO] Google Alerts RSSを収集中...');
    for (const src of GOOGLE_ALERT_SOURCES) {
      const items = await fetchFeed(src.url, src.name);
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

  let summarizedGov = [];
  let newsTopics = [];
  let dxTip = null;

  if (hasApiKey) {
    try {
      // ③ 政府記事を要約
      console.log('[INFO] 政府記事を要約中...');
      summarizedGov = await summarizeGovArticles(govArticlesRaw, model);

      // ④ ニュースをフィルタリング・要約
      console.log('[INFO] ニュース記事をフィルタリング中...');
      newsTopics = await filterAndSummarizeNews(newsDeduped, model, 10);

      // ⑤ DX Tips 生成
      console.log('[INFO] DX Tips を生成中...');
      dxTip = await generateDxTip(targetDate, model);
    } catch (err) {
      const is429 = String(err.message).includes('429');
      console.warn(`[WARN] Gemini APIエラー${is429 ? '（レート制限）' : ''}: ${err.message}`);
      // フォールバック: 要約なしで記事をそのまま使用
      summarizedGov = govArticlesRaw.map((a) => ({
        ...a,
        summary: a.description?.slice(0, 150) || a.title,
        importance_score: a.articleType === 'security' ? 4 : a.articleType === 'ai_government' ? 3 : 2,
        is_security_alert: a.articleType === 'security',
      }));
    }
  } else {
    console.warn('[WARN] GEMINI_API_KEY 未設定。フォールバックデータを使用します。');
    summarizedGov = govArticlesRaw.map((a) => ({
      ...a,
      summary: a.description?.slice(0, 150) || a.title,
      importance_score: a.articleType === 'security' ? 4 : a.articleType === 'ai_government' ? 3 : 2,
      is_security_alert: a.articleType === 'security',
    }));
    newsTopics = newsDeduped.slice(0, 10).map((a) => ({
      title: a.title,
      summary: a.description || a.title,
      relevance: '',
      category: 'その他',
      source: a.sourceName,
      url: a.url,
      score: 0,
    }));
  }

  // ⑥ 記事を選定

  // セキュリティ速報
  const securityAlerts = summarizedGov
    .filter((a) => a.is_security_alert && a.importance_score >= 4)
    .map((a) => ({ title: a.title, url: a.url, source: a.sourceName }));

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
  const subArticles = highPriorityGov.slice(1, 16).map(buildArticleContext);

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
      relevance: '',
      category:  ARTICLE_TYPE_TO_CATEGORY[a.articleType] || '行政DX',
      source:    a.sourceName,
      url:       a.url,
      score:     a.importance_score,
    }));

  // newsTopics の URL バリデーション
  newsTopics = newsTopics.map((t) => {
    if (!isValidUrl(t.url)) {
      console.warn(`[WARN] ニュースURL無効: "${t.url}" → クリア`);
      return { ...t, url: '' };
    }
    return t;
  });

  // gov 参考情報を追加してテーマ順に並べ直す
  const NEWS_CATEGORY_ORDER = [
    'セキュリティ', '行政AI', '行政DX',
    'AI活用', 'クラウド/インフラ', '制度/ガイドライン',
    '自治体DX事例', '調達・契約', '働き方/業務改革', 'その他',
  ];
  newsTopics = [...newsTopics, ...govMidAsNews].sort((a, b) => {
    const ai = NEWS_CATEGORY_ORDER.indexOf(a.category);
    const bi = NEWS_CATEGORY_ORDER.indexOf(b.category);
    const catDiff = (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    if (catDiff !== 0) return catDiff;
    return (b.score || 0) - (a.score || 0);
  });

  // DX Tips の reference_url バリデーション
  if (dxTip && !isValidUrl(dxTip.reference_url)) {
    console.warn(`[WARN] DX Tips参照URL無効: "${dxTip.reference_url}" → クリア`);
    dxTip = { ...dxTip, reference_url: '' };
  }

  // ⑦ JSON 保存
  const dayData = {
    date: targetDate,
    date_ja: formatDateJa(targetDate),
    security_alerts: securityAlerts,
    hero_article: heroArticle,
    sub_articles: subArticles,
    news_topics: newsTopics,
    dx_tip: dxTip,
    generated_at: new Date().toISOString(),
  };

  const outPath = resolve(DATA_DIR, `${targetDate}.json`);
  writeFileSync(outPath, JSON.stringify(dayData, null, 2), 'utf-8');
  console.log(`[INFO] ${outPath} 保存完了`);

  // ⑧ index.json 更新
  const total = (heroArticle ? 1 : 0) + subArticles.length;
  const summaryShort = heroArticle
    ? `${heroArticle.title.slice(0, 30)}…など${total}件`
    : 'データなし';
  updateIndex(targetDate, summaryShort, total, securityAlerts.length > 0);

  // ⑨ tags.json 更新
  updateTagsIndex(targetDate, formatDateJa(targetDate), dayData);

  console.log('[INFO] 完了');
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});

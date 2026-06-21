/**
 * generate-content.js
 * 政府公式RSS＋無料ニュースRSSを収集し、Gemini APIでフィルタリング・要約して
 * public/data/ に JSON として保存する。
 *
 * 使用方法: GEMINI_API_KEY=xxx node scripts/generate-content.js
 *
 * 環境変数:
 *   GEMINI_API_KEY  - Google Gemini API キー（必須）
 *   GEMINI_MODEL    - 使用モデル（省略時: gemini-1.5-flash）
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
  { name: 'JPCERT/CC 注意喚起',        url: 'https://www.jpcert.or.jp/rss/jpcert-all.rdf',              type: 'security' },
  { name: 'IPA 重要なセキュリティ情報', url: 'https://www.ipa.go.jp/security/security-alert/rss.rdf',   type: 'security' },
  { name: 'NISC 新着情報',             url: 'https://www.nisc.go.jp/rss/nisc_alert.rdf',               type: 'security' },
  { name: '警察庁 サイバー警察局',      url: 'https://www.npa.go.jp/rss.xml',                           type: 'security' },

  // ── デジタル庁（DX政策の中核）
  { name: 'デジタル庁 新着情報',        url: 'https://www.digital.go.jp/feed',                          type: 'ai_government' },
  { name: 'デジタル庁 note',            url: 'https://digital-gov.note.jp/rss',                         type: 'ai_government' },
  { name: '政府CIOポータル',            url: 'https://cio.go.jp/rss.xml',                               type: 'ai_government' },

  // ── 各省庁 DX・AI関連
  { name: '総務省 報道発表',            url: 'https://www.soumu.go.jp/rss/topics.rdf',                  type: 'dx' },
  { name: '経済産業省 新着情報',        url: 'https://www.meti.go.jp/press/rss.rdf',                    type: 'dx' },
  { name: '内閣府 新着情報',            url: 'https://www.cao.go.jp/rss.rdf',                           type: 'dx' },
  { name: '内閣官房 新着情報',          url: 'https://www.cas.go.jp/rss.rdf',                           type: 'dx' },
  { name: '国土交通省 新着情報',        url: 'https://www.mlit.go.jp/rss.xml',                          type: 'dx' },
  { name: '厚生労働省 新着情報',        url: 'https://www.mhlw.go.jp/rss/topics.rdf',                  type: 'dx' },
  { name: '文部科学省 新着情報',        url: 'https://www.mext.go.jp/b_menu/list/rss.rdf',              type: 'dx' },
  { name: '金融庁 新着情報',            url: 'https://www.fsa.go.jp/rss.xml',                           type: 'dx' },

  // ── 自治体標準化・地方DX（横展開参考事例）
  { name: 'J-LIS 地方公共団体情報システム機構', url: 'https://www.j-lis.go.jp/rss.xml',               type: 'dx' },
];

// ── 無料ニュース RSS ソース ───────────────────────────────────────────
// PMO/PJMO視点で行政DX・AI・セキュリティに絞った無料媒体
const NEWS_SOURCES = [
  // ITmedia系（網羅性高い、無料）
  { name: 'ITmedia NEWS',            url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml',              paywall: false },
  { name: 'ITmedia AI+',             url: 'https://rss.itmedia.co.jp/rss/2.0/aiplus.xml',                   paywall: false },
  { name: 'ITmedia エンタープライズ', url: 'https://rss.itmedia.co.jp/rss/2.0/enterprise.xml',               paywall: false },
  { name: '@IT',                     url: 'https://rss.itmedia.co.jp/rss/2.0/ait.xml',                      paywall: false },

  // インプレス系（クラウド・IT業界）
  { name: 'Internet Watch',          url: 'https://internet.watch.impress.co.jp/data/rss/1.0/iw/feed.rdf',  paywall: false },
  { name: 'クラウド Watch',           url: 'https://cloud.watch.impress.co.jp/data/rss/1.0/cw/feed.rdf',    paywall: false },
  { name: 'IT Leaders',              url: 'https://it.impress.com/rss/topNews.rdf',                          paywall: false },

  // 専門IT媒体
  { name: 'ZDNet Japan',             url: 'https://japan.zdnet.com/rss/index.xml',                           paywall: false },
  { name: 'TechCrunch Japan',        url: 'https://jp.techcrunch.com/feed/',                                 paywall: false },

  // 自治体・行政DX専門
  { name: '自治体通信',               url: 'https://jichitai.works/feed/',                                    paywall: false },

  // 公共放送（政策・社会的文脈）
  { name: 'NHKニュース 科学・IT',     url: 'https://www.nhk.or.jp/rss/news/cat3.xml',                        paywall: false },
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

// ── X (Twitter) アカウント — RSSHub経由で巡回 ────────────────────────
// RSSHUB_BASE_URL が設定されていない場合はスキップ
// ※ Twitter API制限強化(2023〜)によりパブリックRSSHubでは取得できない場合あり
//    自前のRSSHubインスタンスまたはTwitter対応インスタンスを推奨
const X_SOURCES = [
  // 中央省庁・公的機関
  { name: 'デジタル庁 (@digital_jpn)',      handle: 'digital_jpn',    type: 'ai_government' },
  { name: 'JPCERT/CC (@JPCERT_CC)',          handle: 'JPCERT_CC',      type: 'security' },
  { name: 'IPA (@IPA_NPA)',                  handle: 'IPA_NPA',        type: 'security' },
  { name: '総務省 (@MIC_Japan)',             handle: 'MIC_Japan',      type: 'dx' },
  { name: '経済産業省 (@meti_NIPPON)',       handle: 'meti_NIPPON',    type: 'dx' },
  { name: '内閣官房 (@kantei)',             handle: 'kantei',         type: 'dx' },
  { name: 'NISC (@NISC_Japan)',              handle: 'NISC_Japan',     type: 'security' },
  // ITニュース
  { name: 'ITmedia NEWS (@ITmedia_News)',    handle: 'ITmedia_News',   type: 'dx' },
  { name: 'ZDNet Japan (@ZDNetJapan)',       handle: 'ZDNetJapan',     type: 'dx' },
  { name: 'クラウド Watch (@cloud_watch)',   handle: 'cloud_watch',    type: 'dx' },
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
    const link = (extractTag(block, 'link') || extractTag(block, 'id')).replace(/\s/g, '');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    const description = stripHtml(extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content'));

    if (!title || !link) continue;

    // ペイウォードチェック
    if (PAYWALL_KEYWORDS.some((kw) => title.includes(kw) || description.includes(kw))) continue;

    // 24時間以内チェック
    if (pubDate) {
      const age = Date.now() - new Date(pubDate).getTime();
      if (age > 26 * 60 * 60 * 1000) continue;
    }

    items.push({ title, url: link, description: description.slice(0, 400), pubDate, sourceName });
  }
  return items;
}

// ── RSS フェッチ ──────────────────────────────────────────────────────
async function fetchFeed(url, name) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GovDX-Today/1.0 (+https://github.com/dx-specialist-jp/govdxtoday)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
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
  ai_trend:      '🌍 AI業界トレンド（政府視点）',
};

// ── Gemini API ────────────────────────────────────────────────────────
async function callGemini(model, prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const m = genai.getGenerativeModel({ model });
  const result = await m.generateContent(prompt);
  return result.response.text().trim();
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
4: 今月中に確認が必要（新ガイドライン公開、政府AI戦略・源内関連の重要決定、調達制度変更）
3: 四半期以内に把握が望ましい（行政DX動向、制度変更予告、自治体先進事例）
2: 参考情報（AI業界トレンド、海外事例、技術動向）
1: 間接的に関連する情報

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
        summary: r.summary || article.description.slice(0, 150),
        importance_score: Number(r.importance_score) || 2,
        is_security_alert: Boolean(r.is_security_alert),
      };
    });
  } catch (err) {
    console.warn(`[WARN] 政府記事要約エラー: ${err.message}`);
    return articles.map((a) => ({
      ...a,
      summary: a.description.slice(0, 150) || a.title,
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
    return [];
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
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

  console.log(`[INFO] 対象日: ${targetDate} / モデル: ${model}`);
  mkdirSync(DATA_DIR, { recursive: true });

  // ① 政府公式記事を収集
  console.log('[INFO] 政府公式RSSを収集中...');
  const govArticlesRaw = [];
  for (const src of GOV_SOURCES) {
    const items = await fetchFeed(src.url, src.name);
    items.forEach((a) => govArticlesRaw.push({ ...a, articleType: src.type }));
    console.log(`[INFO]   ${src.name}: ${items.length}件`);
  }
  console.log(`[INFO] 政府記事合計: ${govArticlesRaw.length}件`);

  // ② 無料ニュースを収集
  console.log('[INFO] ニュースRSSを収集中...');
  const newsArticlesRaw = [];
  for (const src of NEWS_SOURCES) {
    const items = await fetchFeed(src.url, src.name);
    newsArticlesRaw.push(...items);
    console.log(`[INFO]   ${src.name}: ${items.length}件`);
  }
  console.log(`[INFO] ニュース記事合計: ${newsArticlesRaw.length}件`);

  // ② b. X (Twitter) アカウントを巡回（RSSHub経由）
  const rsshubBase = process.env.RSSHUB_BASE_URL;
  if (rsshubBase) {
    console.log(`[INFO] X（Twitter）アカウントを収集中... (RSSHub: ${rsshubBase})`);
    for (const src of X_SOURCES) {
      const feedUrl = `${rsshubBase}/twitter/user/${src.handle}`;
      const items = await fetchFeed(feedUrl, src.name);
      if (items.length > 0) {
        items.forEach((a) => govArticlesRaw.push({ ...a, articleType: src.type }));
        console.log(`[INFO]   @${src.handle}: ${items.length}件`);
      } else {
        console.log(`[INFO]   @${src.handle}: 0件（Twitter API制限またはRSSHub未対応の可能性）`);
      }
    }
    console.log(`[INFO] X収集後の記事合計: ${govArticlesRaw.length}件`);
  } else {
    console.log('[INFO] RSSHUB_BASE_URL 未設定 → X (Twitter) 収集をスキップ');
  }

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
      newsTopics = await filterAndSummarizeNews(newsArticlesRaw, model, 5);

      // ⑤ DX Tips 生成
      console.log('[INFO] DX Tips を生成中...');
      dxTip = await generateDxTip(targetDate, model);
    } catch (err) {
      const is429 = String(err.message).includes('429');
      console.warn(`[WARN] Gemini APIエラー${is429 ? '（レート制限）' : ''}: ${err.message}`);
      // フォールバック: 要約なしで記事をそのまま使用
      summarizedGov = govArticlesRaw.map((a) => ({
        ...a,
        summary: a.description.slice(0, 150) || a.title,
        importance_score: a.articleType === 'security' ? 4 : 2,
        is_security_alert: a.articleType === 'security',
      }));
    }
  } else {
    console.warn('[WARN] GEMINI_API_KEY 未設定。フォールバックデータを使用します。');
    summarizedGov = govArticlesRaw.map((a) => ({
      ...a,
      summary: a.description.slice(0, 150) || a.title,
      importance_score: a.articleType === 'security' ? 4 : 2,
      is_security_alert: a.articleType === 'security',
    }));
  }

  // ⑥ 記事を選定
  const securityAlerts = summarizedGov
    .filter((a) => a.is_security_alert && a.importance_score >= 4)
    .map((a) => ({ title: a.title, url: a.url, source: a.sourceName }));

  const nonSecurity = summarizedGov
    .filter((a) => !a.is_security_alert)
    .sort((a, b) => b.importance_score - a.importance_score);

  const buildArticleContext = (a) => {
    const sourceUrl = isValidUrl(a.url) ? a.url : '';
    if (!sourceUrl) console.warn(`[WARN] 無効なURL除外: "${a.url}" (${a.title?.slice(0, 40)})`);
    return {
      section_name: SECTION_MAP[a.articleType] || SECTION_MAP.dx,
      title: a.title,
      summary: a.summary || a.description.slice(0, 150) || a.title,
      source_name: a.sourceName,
      source_url: sourceUrl,
      pub_date: a.pubDate ? a.pubDate.slice(0, 10) : targetDate,
    };
  };

  // newsTopics の URL バリデーション
  newsTopics = newsTopics.map((t) => {
    if (!isValidUrl(t.url)) {
      console.warn(`[WARN] ニュースURL無効: "${t.url}" → クリア`);
      return { ...t, url: '' };
    }
    return t;
  });

  // DX Tips の reference_url バリデーション
  if (dxTip && !isValidUrl(dxTip.reference_url)) {
    console.warn(`[WARN] DX Tips参照URL無効: "${dxTip.reference_url}" → クリア`);
    dxTip = { ...dxTip, reference_url: '' };
  }

  const heroArticle = nonSecurity[0] ? buildArticleContext(nonSecurity[0]) : null;
  const subArticles = nonSecurity.slice(1, 4).map(buildArticleContext);

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

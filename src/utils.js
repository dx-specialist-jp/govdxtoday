// AI生成の points/actions 配列は空文字・空白のみの要素を含むことがある。
// 表示可否の判定（セクション本体・ナビゲーションの両方）を1箇所に揃え、
// 「ナビには出るがセクションは非表示」のようなズレを防ぐ。
export function filterMeaningfulItems(items) {
  return (Array.isArray(items) ? items : []).filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

export const isHttpUrl = (url) => Boolean(url && url.startsWith('http'));

// クラウドサービスプロバイダー別タグ（例: 「AWS最新情報」）は generate-content.js の
// updateTagsIndex が `${provider}最新情報` の形式で生成する。編集部キュレーション済みの
// カテゴリタグ（AI活用・セキュリティ等）とは性質が異なる（生RSSそのまま）ため、
// サイドバー・タグ一覧では別セクションに分けて表示する
export const isCspTag = (tag) => tag.endsWith('最新情報');

// カテゴリタグの表示順。似た分類が隣り合うようグループ単位で並べる
// （行政・府省 → AI → セキュリティ → クラウド → 制度・調達 → 業務 → その他）
const TAG_ORDER = [
  '行政DX', '行政DX事例', '自治体DX事例', 'デジタル庁', '財務省',
  '行政AI', 'AI活用', 'AIガバナンス',
  'セキュリティ',
  'クラウド/インフラ', 'ガバメントクラウド',
  '制度/ガイドライン', '調達・契約', '調達/契約',
  'プロジェクト管理', '働き方/業務改革',
];

// 件数0でも常に表示するタグ
const PREFERRED_TAGS = [
  '行政DX', '自治体DX事例', '財務省',
  '行政AI', 'AI活用',
  'セキュリティ',
  'クラウド/インフラ',
  '制度/ガイドライン',
  '働き方/業務改革',
];

// サイドバー・タグページ共通のカテゴリタグ一覧（CSP別タグを除く）を表示順で返す。
// TAG_ORDER にない新しいタグは既知タグの後ろ、「その他」は常に末尾に置く
export function buildCategoryTagList(counts) {
  const tags = new Set([
    ...PREFERRED_TAGS,
    ...Object.keys(counts).filter((t) => counts[t] > 0 && !isCspTag(t)),
  ]);
  const rank = (t) => {
    if (t === 'その他') return Infinity;
    const i = TAG_ORDER.indexOf(t);
    return i === -1 ? TAG_ORDER.length : i;
  };
  return [...tags].sort((a, b) => rank(a) - rank(b));
}

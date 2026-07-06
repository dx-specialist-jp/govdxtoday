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

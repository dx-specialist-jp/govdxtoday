// AI生成の points/actions 配列は空文字・空白のみの要素を含むことがある。
// 表示可否の判定（セクション本体・ナビゲーションの両方）を1箇所に揃え、
// 「ナビには出るがセクションは非表示」のようなズレを防ぐ。
export function filterMeaningfulItems(items) {
  return (Array.isArray(items) ? items : []).filter(
    (item) => typeof item === 'string' && item.trim().length > 0
  );
}

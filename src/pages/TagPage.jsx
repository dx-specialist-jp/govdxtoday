import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

const BASE = import.meta.env.BASE_URL;

const PREFERRED_TAGS = [
  'AI活用',
  'セキュリティ',
  '行政AI',
  '行政DX',
  'クラウド/インフラ',
  '制度/ガイドライン',
  '自治体DX事例',
  '調達・契約',
  '働き方/業務改革',
];

function groupByDate(articles) {
  const groups = {};
  for (const a of articles) {
    const key = a.date;
    if (!groups[key]) groups[key] = { date: a.date, date_ja: a.date_ja, items: [] };
    groups[key].items.push(a);
  }
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
}

export default function TagPage() {
  const { tagName } = useParams();
  const decodedTag = decodeURIComponent(tagName || '');
  const [tagsData, setTagsData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTagsData(null);
    setError(null);
    fetch(`${BASE}data/tags.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setTagsData)
      .catch((e) => setError(e.message));
  }, []);

  const articles = (tagsData?.tags?.[decodedTag]) || [];
  const groups = groupByDate(articles);
  const counts = tagsData?.tag_counts || {};
  // 優先タグ + データに存在する追加タグ（count > 0 かつ優先リスト外）を結合
  const extraTags = Object.keys(counts).filter((t) => counts[t] > 0 && !PREFERRED_TAGS.includes(t));
  const ALL_TAGS = [...PREFERRED_TAGS, ...extraTags];

  if (error) {
    return (
      <>
        <div className="page-dark-header">
          <div className="page-dark-header-inner">
            <p className="page-dark-eyebrow">Tag</p>
            <h1 className="page-dark-title">{decodedTag}</h1>
          </div>
        </div>
        <div className="main-content">
          <div className="error-box" role="alert">読み込みエラー: {error}</div>
        </div>
      </>
    );
  }

  if (!tagsData) return <div className="loading" role="status" aria-live="polite">読み込み中</div>;

  return (
    <>
      <div className="page-dark-header">
        <div className="page-dark-header-inner">
          <p className="page-dark-eyebrow">
            <Link to="/" style={{ color: '#7096f8', textDecoration: 'none' }}>今日</Link>
            {' › '}タグ
          </p>
          <h1 className="page-dark-title">{decodedTag}</h1>
          <p className="page-dark-subtitle">
            {articles.length > 0 ? `${articles.length}件の記事` : '記事なし'}
          </p>
        </div>
      </div>

      <div className="main-content">
        {/* タグ一覧 */}
        <div className="digest-section">
          <p className="section-label">他のタグで探す</p>
          <nav className="all-tags-grid" aria-label="タグナビゲーション">
            {ALL_TAGS.map((label) => (
              <Link
                key={label}
                to={`/tag/${encodeURIComponent(label)}`}
                className={`tag-nav-pill${label === decodedTag ? ' active' : ''}`}
                aria-current={label === decodedTag ? 'page' : undefined}
              >
                {label}
                {counts[label] > 0 && (
                  <span className="tag-nav-pill-count" aria-label={`${counts[label]}件`}>
                    ({counts[label]})
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {/* 記事一覧 */}
        {articles.length === 0 ? (
          <div className="empty-state">
            <strong>記事はまだありません</strong>
            <p>このタグの記事が収集されると、ここに表示されます。</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="tag-group">
              <p className="tag-group-label">
                {group.date_ja || group.date}
              </p>
              {group.items.map((article, i) => {
                const hasUrl = article.url && article.url.startsWith('http');
                return (
                  <article key={i} className="tag-article-card">
                    <h2>
                      {hasUrl ? (
                        <a
                          href={article.url}
                          className="tag-article-title article-title-link"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${article.title}（外部サイトへ）`}
                        >
                          {article.title}
                        </a>
                      ) : (
                        <span className="tag-article-title">{article.title}</span>
                      )}
                    </h2>
                    {article.summary && (
                      <p className="tag-article-summary">{article.summary}</p>
                    )}
                    <div className="tag-article-meta">
                      {article.source && <span>{article.source}</span>}
                      {article.source && <span aria-hidden="true">·</span>}
                      <Link
                        to={`/day/${article.date}`}
                        className="tag-article-daylink"
                      >
                        {article.date} のダイジェストを見る
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

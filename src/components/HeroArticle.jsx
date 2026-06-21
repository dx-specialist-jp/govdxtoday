export default function HeroArticle({ article }) {
  if (!article) return null;

  const hasUrl = article.source_url && article.source_url.startsWith('http');

  const titleEl = hasUrl ? (
    <a
      href={article.source_url}
      className="hero-title article-title-link"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${article.title}（外部サイトへ）`}
    >
      {article.title}
    </a>
  ) : (
    <span className="hero-title">{article.title}</span>
  );

  return (
    <div className="digest-section">
      <p className="section-label">📌 今日のピックアップ</p>
      <article className="hero-card">
        {article.section_name && (
          <span className="article-section-tag">{article.section_name}</span>
        )}
        <h2>{titleEl}</h2>
        <p className="hero-summary">{article.summary}</p>
        <div className="article-meta">
          <span>出典</span>
          {hasUrl ? (
            <a
              href={article.source_url}
              className="source-link"
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              aria-hidden="true"
            >
              {article.source_name} ↗
            </a>
          ) : (
            <span className="source-link-plain">{article.source_name}</span>
          )}
          {article.pub_date && (
            <>
              <span className="article-meta-sep">·</span>
              <span>{article.pub_date}</span>
            </>
          )}
        </div>
      </article>
    </div>
  );
}

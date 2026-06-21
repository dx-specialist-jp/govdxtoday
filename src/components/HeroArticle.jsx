export default function HeroArticle({ article }) {
  if (!article) return null;

  return (
    <div className="digest-section">
      <p className="section-label">📌 今日のピックアップ</p>
      <article className="hero-card">
        {article.section_name && (
          <span className="article-section-tag">{article.section_name}</span>
        )}
        <h2 className="hero-title">{article.title}</h2>
        <p className="hero-summary">{article.summary}</p>
        <div className="article-meta">
          <span>出典</span>
          <a
            href={article.source_url}
            className="source-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {article.source_name} ↗
          </a>
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

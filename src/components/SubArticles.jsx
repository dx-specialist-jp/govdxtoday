export default function SubArticles({ articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="digest-section">
      <p className="section-label">その他の注目記事</p>
      <div className="sub-articles" role="list">
        {articles.map((article, i) => (
          <article key={i} className="sub-article" role="listitem">
            {article.section_name && (
              <span className="sub-article-tag">{article.section_name}</span>
            )}
            <h3 className="sub-article-title">{article.title}</h3>
            <p className="sub-article-summary">{article.summary}</p>
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
        ))}
      </div>
    </div>
  );
}

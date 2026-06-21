export default function SubArticles({ articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <div className="digest-section">
      <p className="section-label">その他の注目記事</p>
      <div className="sub-articles" role="list">
        {articles.map((article, i) => {
          const hasUrl = article.source_url && article.source_url.startsWith('http');
          return (
            <article key={i} className="sub-article" role="listitem">
              {article.section_name && (
                <span className="sub-article-tag">{article.section_name}</span>
              )}
              <h3>
                {hasUrl ? (
                  <a
                    href={article.source_url}
                    className="sub-article-title article-title-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${article.title}（外部サイトへ）`}
                  >
                    {article.title}
                  </a>
                ) : (
                  <span className="sub-article-title">{article.title}</span>
                )}
              </h3>
              <p className="sub-article-summary">{article.summary}</p>
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
          );
        })}
      </div>
    </div>
  );
}

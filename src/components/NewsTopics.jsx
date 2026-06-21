export default function NewsTopics({ topics }) {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="digest-section">
      <p className="section-label">🗞 今日のニューストピック</p>
      <div className="news-topics" role="list">
        {topics.map((topic, i) => (
          <article key={i} className="news-topic" role="listitem">
            <div className="news-topic-header">
              {topic.category && (
                <span className="category-tag">{topic.category}</span>
              )}
              <h3 className="news-topic-title">{topic.title}</h3>
            </div>
            {topic.summary && (
              <p className="news-topic-summary">{topic.summary}</p>
            )}
            {topic.relevance && (
              <p className="news-topic-relevance">▶ {topic.relevance}</p>
            )}
            <div className="news-topic-source">
              出典:{' '}
              <a href={topic.url} target="_blank" rel="noopener noreferrer">
                {topic.source}
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

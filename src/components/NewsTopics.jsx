import { useState } from 'react';
import { filterMeaningfulItems } from '../utils.js';

function NewsTopicsBrief({ actions }) {
  const items = filterMeaningfulItems(actions);
  if (items.length === 0) return null;
  return (
    <div className="news-topics-brief">
      <p className="ai-card-label">今日のニュースから PMO/PJMO が取るべきアクション</p>
      <ul className="news-topics-brief-list">
        {items.map((action, i) => (
          <li key={i} className="news-topics-brief-item">{action}</li>
        ))}
      </ul>
    </div>
  );
}

export default function NewsTopics({ topics, brief }) {
  const [activeCategory, setActiveCategory] = useState(null);

  if (!topics || topics.length === 0) return null;

  const categories = [...new Set(topics.map((t) => t.category).filter(Boolean))];
  const filtered = activeCategory
    ? topics.filter((t) => t.category === activeCategory)
    : topics;

  return (
    <div className="digest-section">
      <p className="section-label">今日のニューストピック</p>
      <NewsTopicsBrief actions={brief} />
      {categories.length > 1 && (
        <div className="topic-filter" role="group" aria-label="カテゴリフィルター">
          <button
            className={`topic-filter-btn${activeCategory === null ? ' active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            すべて <span className="topic-filter-count">{topics.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`topic-filter-btn${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            >
              {cat}{' '}
              <span className="topic-filter-count">
                {topics.filter((t) => t.category === cat).length}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="news-topics" role="list">
        {filtered.map((topic, i) => {
          const hasUrl = topic.url && topic.url.startsWith('http');
          return (
            <article
              key={topic.url || topic.title || i}
              className="news-topic"
              role="listitem"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="news-topic-header">
                {topic.category && (
                  <span className="category-tag">{topic.category}</span>
                )}
                <h3>
                  {hasUrl ? (
                    <a
                      href={topic.url}
                      className="news-topic-title article-title-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${topic.title}（外部サイトへ）`}
                    >
                      {topic.title}
                    </a>
                  ) : (
                    <span className="news-topic-title">{topic.title}</span>
                  )}
                </h3>
              </div>
              {topic.summary && (
                <p className="news-topic-summary">{topic.summary}</p>
              )}
              {topic.relevance && (
                <p className="news-topic-relevance">▶ {topic.relevance}</p>
              )}
              {hasUrl && (
                <div className="news-topic-source">
                  出典:{' '}
                  <a
                    href={topic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    {topic.source}
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';

// Gemini生成のrelevanceが欠落した場合でも、各カードのアクション欄を
// 必ず同じ構成で表示するための既定文言（日によって欄自体が出たり消えたりしないようにする）
const DEFAULT_ACTION = '元記事の内容を確認し、所管業務への影響・対応要否を確認すること。';

export default function NewsTopics({ topics }) {
  const [activeCategory, setActiveCategory] = useState(null);

  if (!topics || topics.length === 0) return null;

  const categories = [...new Set(topics.map((t) => t.category).filter(Boolean))];
  const filtered = activeCategory
    ? topics.filter((t) => t.category === activeCategory)
    : topics;

  return (
    <div className="digest-section">
      <p className="section-label">今日のニューストピック</p>
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
              <div className="news-topic-action">
                <p className="news-topic-action-label">PMO/PJMOが取るべきアクション</p>
                <p className="news-topic-action-text">{topic.relevance || DEFAULT_ACTION}</p>
              </div>
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

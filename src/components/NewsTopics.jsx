import { useState } from 'react';
import { isHttpUrl } from '../utils.js';

// Gemini生成のrelevanceが欠落した場合でも、各カードのアクション欄を
// 必ず同じ構成で表示するための既定文言（日によって欄自体が出たり消えたりしないようにする）
const DEFAULT_ACTION = '元記事の内容をご確認のうえ、所管業務への影響・対応要否のご検討をお願いします。';

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
          // sources配列（複数ソース統合済み）を優先し、旧形式（source/url単体）のデータも表示できるようにする
          const sources = topic.sources && topic.sources.length > 0
            ? topic.sources
            : (topic.source || topic.url) ? [{ name: topic.source, url: topic.url }] : [];
          const primaryUrl = sources.find((s) => isHttpUrl(s.url))?.url;
          const hasUrl = Boolean(primaryUrl);
          return (
            <article
              key={primaryUrl || topic.title || i}
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
                      href={primaryUrl}
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
                <p className="news-topic-action-label">PMO/PjMOが取るべきアクション</p>
                <p className="news-topic-action-text">{topic.relevance || DEFAULT_ACTION}</p>
              </div>
              {sources.length > 0 && (
                <div className="news-topic-source">
                  出典:{' '}
                  {sources.map((s, si) => (
                    <span key={s.url || s.name || si}>
                      {si > 0 && '、'}
                      {isHttpUrl(s.url) ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          tabIndex={-1}
                          aria-hidden="true"
                        >
                          {s.name}
                        </a>
                      ) : (
                        <span aria-hidden="true">{s.name}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

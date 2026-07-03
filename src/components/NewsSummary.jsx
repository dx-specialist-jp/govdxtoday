import { filterMeaningfulItems } from '../utils.js';

export default function NewsSummary({ points }) {
  const items = filterMeaningfulItems(points);
  if (items.length === 0) return null;

  return (
    <div id="sec-summary" className="digest-section">
      <p className="section-label">今日のポイント</p>
      <div className="news-summary-card">
        <ul className="news-summary-list">
          {items.map((point, i) => (
            <li key={i} className="news-summary-item">{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

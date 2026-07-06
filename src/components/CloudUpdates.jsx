import { Link } from 'react-router-dom';
import { isHttpUrl } from '../utils.js';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function CloudUpdates({ providers }) {
  if (!providers || providers.length === 0) return null;

  return (
    <div className="digest-section">
      <p className="section-label">クラウドサービスプロバイダー更新情報</p>
      <div className="cloud-updates-grid" role="list">
        {providers.map((p) => (
          <div className="cloud-updates-card" role="listitem" key={p.provider}>
            <h3 className="cloud-updates-provider">
              {p.provider}
              <Link to={`/tag/${encodeURIComponent(`${p.provider}最新情報`)}`} className="category-tag">
                {p.provider}最新情報
              </Link>
            </h3>
            <ul className="cloud-updates-list">
              {p.items.map((item, i) => (
                <li className="cloud-updates-item" key={item.url || item.title || i}>
                  {isHttpUrl(item.url) ? (
                    <a
                      href={item.url}
                      className="cloud-updates-title"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${item.title}（外部サイトへ）`}
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="cloud-updates-title">{item.title}</span>
                  )}
                  <div className="cloud-updates-meta">
                    {formatDate(item.pub_date)}
                    {item.pub_date && item.source && ' ・ '}
                    {item.source}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

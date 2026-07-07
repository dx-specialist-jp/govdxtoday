import { Link } from 'react-router-dom';
import { isHttpUrl } from '../utils.js';

// ロゴは使わず、プロバイダーごとにアクセントカラーの帯を添えるだけで
// 各社のブランド感をほのかに出す（配色は各社コーポレートカラーを想起させる
// トーンに寄せつつ、サイト全体の落ち着いたトーンと衝突しない彩度に抑えている）
const PROVIDER_ACCENT = {
  AWS: '#C77700',
  'Google Cloud': '#1E8E3E',
  'さくらのクラウド': '#C2185B',
};

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
      <p className="section-label">CSP更新情報</p>
      <div className="cloud-updates-grid" role="list">
        {providers.map((p) => (
          <div
            className="cloud-updates-card"
            role="listitem"
            key={p.provider}
            style={{ '--cloud-accent': PROVIDER_ACCENT[p.provider] || 'var(--accent)' }}
          >
            <h3 className="cloud-updates-provider">
              <Link to={`/tag/${encodeURIComponent(`${p.provider}最新情報`)}`} className="cloud-updates-provider-link">
                {p.provider}
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

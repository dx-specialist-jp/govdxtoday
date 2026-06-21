import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const BASE = import.meta.env.BASE_URL;

function ArchiveItem({ item }) {
  const d = new Date(item.date + 'T00:00:00+09:00');
  const month = `${d.getMonth() + 1}月`;
  const day = d.getDate();

  return (
    <Link to={`/day/${item.date}`} className="date-list-item">
      <div className="date-badge" aria-hidden="true">
        <div className="date-badge-month">{month}</div>
        <div className="date-badge-day">{day}</div>
      </div>
      <div className="date-list-body">
        <div className="date-list-title">{item.summary_short}</div>
        <div className="date-list-meta">
          {item.date}
          {item.article_count > 0 && ` · ${item.article_count}件の記事`}
        </div>
      </div>
      {item.has_security_alert && (
        <span className="security-pill" aria-label="セキュリティ速報あり">⚠ 速報</span>
      )}
      <span className="date-list-arrow" aria-hidden="true">›</span>
    </Link>
  );
}

export default function Archive() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE}data/index.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setIndex)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <>
        <div className="archive-header">
          <div className="archive-header-inner">
            <p className="archive-eyebrow">Archive</p>
            <h1 className="archive-title">アーカイブ</h1>
          </div>
        </div>
        <div className="main-content">
          <div className="error-box">読み込みエラー: {error}</div>
        </div>
      </>
    );
  }

  if (!index) return <div className="loading">読み込み中</div>;

  const dates = [...(index.dates || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className="archive-header">
        <div className="archive-header-inner">
          <p className="archive-eyebrow">Archive</p>
          <h1 className="archive-title">アーカイブ</h1>
          <p className="archive-count">{dates.length > 0 ? `過去 ${dates.length} 日分` : 'データなし'}</p>
        </div>
      </div>

      <div className="main-content">
        {dates.length === 0 ? (
          <div className="empty-state">
            <strong>まだコンテンツがありません</strong>
            <p>夜間バッチが実行されると、ここに日付が表示されます。</p>
          </div>
        ) : (
          <nav className="date-list" aria-label="日付一覧">
            {dates.map((item) => (
              <ArchiveItem key={item.date} item={item} />
            ))}
          </nav>
        )}
      </div>
    </>
  );
}

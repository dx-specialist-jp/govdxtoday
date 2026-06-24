import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';

const TAGS = [
  'AI活用',
  'セキュリティ',
  '行政AI',
  '行政DX',
  'クラウド/インフラ',
  '制度/ガイドライン',
  '自治体DX事例',
  '調達・契約',
  '働き方/業務改革',
];

export default function Sidebar({ open, onClose, tagCounts = {} }) {
  const sidebarRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      document.body.style.overflow = open ? 'hidden' : '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const linkClass = ({ isActive }) =>
    `sidebar-link${isActive ? ' active' : ''}`;

  return (
    <>
      <aside
        ref={sidebarRef}
        className={`sidebar${open ? ' open' : ''}`}
        aria-label="サイドバーナビゲーション"
        role="navigation"
        aria-modal={open ? 'true' : undefined}
        id="site-sidebar"
      >
        <div className="sidebar-inner">
          <button
            ref={closeRef}
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="サイドバーを閉じる"
          >
            ✕
          </button>

          <div className="sidebar-section">
            <p className="sidebar-section-label">ナビゲーション</p>
            <NavLink to="/" end className={linkClass} onClick={onClose}>
              今日のダイジェスト
            </NavLink>
            <NavLink to="/archive" className={linkClass} onClick={onClose}>
              アーカイブ
            </NavLink>
          </div>

          <hr className="sidebar-divider" />

          <div className="sidebar-section">
            <p className="sidebar-section-label">タグで絞り込む</p>
            {TAGS.map((label) => (
              <NavLink
                key={label}
                to={`/tag/${encodeURIComponent(label)}`}
                className={linkClass}
                onClick={onClose}
              >
                {label}
                {tagCounts[label] > 0 && (
                  <span className="sidebar-link-badge" aria-label={`${tagCounts[label]}件`}>
                    {tagCounts[label]}
                  </span>
                )}
              </NavLink>
            ))}
          </div>

          <hr className="sidebar-divider" />

          <div className="sidebar-section">
            <p className="sidebar-section-label">サイト情報</p>
            <NavLink to="/about" className={linkClass} onClick={onClose}>
              サイトについて
            </NavLink>
          </div>
        </div>
      </aside>

      <div
        className={`sidebar-overlay${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
    </>
  );
}

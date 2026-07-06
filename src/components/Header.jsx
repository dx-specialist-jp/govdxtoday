import { Link, NavLink } from 'react-router-dom';

export default function Header({ onMenuToggle, sidebarOpen }) {
  const navLinkClass = ({ isActive }) =>
    `header-nav-link${isActive ? ' active' : ''}`;

  return (
    <header className="site-header" role="banner">
      <div className="header-inner">
        <Link to="/" className="site-brand" aria-label="GovDX Today トップページ">
          <span className="site-brand-mark" aria-hidden="true">DX</span>
          <span className="site-brand-text">
            <span className="site-brand-name">GovDX Today</span>
            <span className="site-brand-tagline">行政DX・AI活用・クラウドダイジェスト</span>
          </span>
        </Link>

        <div className="header-right">
          {/* デスクトップ用テキストリンク */}
          <nav className="header-nav" aria-label="ヘッダーナビゲーション">
            <NavLink to="/" end className={navLinkClass}>今日</NavLink>
            <NavLink to="/archive" className={navLinkClass}>アーカイブ</NavLink>
            <NavLink to="/about" className={navLinkClass}>サイトについて</NavLink>
          </nav>

          {/* モバイル用ハンバーガーボタン */}
          <button
            className="menu-toggle-btn"
            onClick={onMenuToggle}
            aria-controls="site-sidebar"
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {sidebarOpen ? (
                <>
                  <line x1="3" y1="3" x2="15" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="15" y1="3" x2="3" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <line x1="3" y1="5"  x2="15" y2="5"  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="3" y1="9"  x2="15" y2="9"  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="3" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

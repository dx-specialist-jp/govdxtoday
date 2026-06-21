import { Link, NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="site-header" role="banner">
      <div className="header-inner">
        <Link to="/" className="site-title" aria-label="GovDX Today トップ">
          <span className="site-title-mark" aria-hidden="true" />
          GovDX Today
        </Link>
        <nav className="header-nav" aria-label="メインナビゲーション">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            今日
          </NavLink>
          <NavLink to="/archive" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            アーカイブ
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

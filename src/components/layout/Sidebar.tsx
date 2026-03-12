import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/sidebar.css';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { translations: t } = useLang();
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      {/* 顶部 Logo */}
      <div className="sidebar-header">
        <span className="sidebar-logo">🎓</span>
        <span className="sidebar-title">aIELTS</span>
      </div>

      {/* 导航项 */}
      <div className="sidebar-nav-label">{t.nav.practice ? 'Navigation' : 'Navigation'}</div>
      <nav className="sidebar-content">
        <Link to="/" className={`sidebar-item ${location.pathname === '/' ? 'active' : ''}`}>
          <span className="sidebar-icon">🏠</span>
          <span className="sidebar-text">{t.nav.home}</span>
        </Link>
        <Link to="/prompts" className={`sidebar-item ${location.pathname === '/prompts' ? 'active' : ''}`}>
          <span className="sidebar-icon">💡</span>
          <span className="sidebar-text">{t.nav.prompts}</span>
        </Link>
        {user && (
          <Link to="/practice" className={`sidebar-item ${location.pathname.startsWith('/practice') ? 'active' : ''}`}>
            <span className="sidebar-icon">📚</span>
            <span className="sidebar-text">{t.nav.practice}</span>
          </Link>
        )}
      </nav>

      {/* 左下角收起按钮 */}
      <button className="sidebar-collapse-btn" onClick={onToggle} title={t.nav.collapse}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>{t.nav.collapse}</span>
      </button>
    </div>
  );
}

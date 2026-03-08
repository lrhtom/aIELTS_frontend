import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import { useAuth } from '../contexts/AuthContext';
import '../styles/navbar.css'; // Assuming custom styles for navbar will be added or exist

export default function AppNavbar() {
    const { lang } = useLang();
    const nav = translations[lang].nav;
    const location = useLocation();
    const { user, logout } = useAuth();

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-logo"><span>aIELTS</span></Link>
            <div className="navbar-links">
                <Link to="/" className={location.pathname === '/' ? 'active' : ''}>{nav.home}</Link>
                <Link to="/prompts" className={location.pathname === '/prompts' ? 'active' : ''}>
                    {lang === 'zh' ? '💡 AI提示词' : '💡 Prompt Hub'}
                </Link>
                {user && (
                    <>
                        <Link to="/practice" className={location.pathname.startsWith('/practice') ? 'active' : ''}>{nav.practice}</Link>
                        <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>{nav.settings}</Link>
                    </>
                )}
            </div>

            <div className="navbar-auth">
                {user ? (
                    <div className="navbar-user-menu">
                        <span className="user-greeting">你好, {user.nickname || user.username}</span>
                        <button onClick={logout} className="auth-btn outline-btn">退出</button>
                    </div>
                ) : (
                    <div className="navbar-guest-actions">
                        <Link to="/login" className="auth-btn outline-btn">登录</Link>
                        <Link to="/register" className="auth-btn primary-btn">注册</Link>
                    </div>
                )}
            </div>
        </nav>
    );
}

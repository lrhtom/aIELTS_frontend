import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import { useAuth } from '../contexts/AuthContext';
import '../styles/navbar.css';


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
                    </>
                )}
            </div>

            <div className="navbar-auth">
                {user ? (
                    <Link to="/profile" className="user-avatar">
                        {user.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.username}
                                className="avatar-image"
                            />
                        ) : (
                            <div className="avatar-placeholder">
                                <span>{user.username.charAt(0).toUpperCase()}</span>
                            </div>
                        )}
                    </Link>
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

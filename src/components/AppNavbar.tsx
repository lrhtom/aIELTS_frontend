import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import '../styles/navbar.css';

interface AppNavbarProps {
    onToggleSidebar?: () => void;
}

export default function AppNavbar({ onToggleSidebar }: AppNavbarProps) {
    const { translations: t } = useLang();
    const { user } = useAuth();

    return (
        <nav className="navbar">
            <button className="sidebar-open-btn" onClick={onToggleSidebar}>
                <span className="hamburger-icon">
                    <span className="hamburger-line"></span>
                    <span className="hamburger-line"></span>
                    <span className="hamburger-line"></span>
                </span>
            </button>
            <Link to="/" className="navbar-logo"><span>aIELTS</span></Link>
            <div className="navbar-links">
                {/* 侧边栏中的导航项已移除，保留其他链接如果需要 */}
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
                        <Link to="/login" className="auth-btn outline-btn">{t.auth.loginBtn}</Link>
                        <Link to="/register" className="auth-btn primary-btn">{t.auth.registerBtn}</Link>
                    </div>
                )}
            </div>
        </nav>
    );
}

import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/navbar.css';

interface AppNavbarProps {
    onToggleSidebar?: () => void;
    pageTitle?: React.ReactNode;
    pageSubtitle?: React.ReactNode;
    backUrl?: string;
    onBack?: () => void;
    backText?: string;
    headerRight?: React.ReactNode;
}

export default function AppNavbar({ onToggleSidebar, pageTitle, pageSubtitle, backUrl, onBack, backText, headerRight }: AppNavbarProps) {
    const { translations: t } = useLang();
    const { user } = useAuth();
    const location = useLocation();
    const isHome = location.pathname === '/';

    return (
        <nav className="navbar" aria-label="Top navigation">
            <div className="navbar-left">
                <button className="sidebar-open-btn" onClick={onToggleSidebar}>
                    <span className="hamburger-icon">
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                    </span>
                </button>
                {!isHome && (
                    <Link to="/" className="navbar-logo navbar-logo-left"><span>aIELTS</span></Link>
                )}
            </div>
            
            <div className="navbar-center">
                {isHome ? (
                    <Link to="/" className="navbar-logo"><span>aIELTS</span></Link>
                ) : (
                    (pageTitle || backUrl || onBack) && (
                        <div className="navbar-page-header">
                            {onBack ? (
                                <button onClick={onBack} className="navbar-back-btn" style={{ border: 'none', cursor: 'pointer' }}>
                                    ← {backText || 'Back'}
                                </button>
                            ) : backUrl ? (
                                <Link to={backUrl} className="navbar-back-btn">← {backText || 'Back'}</Link>
                            ) : null}
                            {(pageTitle || pageSubtitle) && (
                                <div className="navbar-title-group">
                                    {pageTitle && <h1 className="navbar-page-title">{pageTitle}</h1>}
                                    {pageSubtitle && <span className="navbar-page-subtitle">{pageSubtitle}</span>}
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            <div className="navbar-right">
                {headerRight && <div className="navbar-header-right">{headerRight}</div>}
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
            </div>
        </nav>
    );
}

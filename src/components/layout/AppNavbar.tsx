import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
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


    const renderPersonalGoal = () => {
        if (!user) return null;
        if (!user.exam_date && !user.target_score) {
            return (
                <div style={{ marginRight: '1rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '0.4rem 0.8rem', background: 'var(--color-bg-alt)', borderRadius: '20px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center' }}>
                    {t.navbar.goals.noGoal}
                </div>
            );
        }

        let content = '';
        const score = user.target_score ? user.target_score.toString() : '';

        if (user.exam_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const target = new Date(user.exam_date);
            target.setHours(0, 0, 0, 0);
            const diffTime = target.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                content = t.navbar.goals.examDay.replace('{score}', score);
            } else if (diffDays < 0) {
                content = t.navbar.goals.examPassed.replace('{score}', score);
            } else {
                // Formatting date for zh vs en is tricky, but let's just use the raw YYYY-MM-DD for now
                content = t.navbar.goals.countdown.replace('{date}', user.exam_date).replace('{days}', diffDays.toString()).replace('{score}', score);
            }
        } else if (score) {
            // Just score
            content = `🎯 Target ${score}`;
        }
        
        // Remove trailing " | Target " or " | 目标 分" if score was empty
        if (!score) {
            content = content.replace(' | Target ', '').replace(' | 目标  分', '');
        }

        return (
            <div style={{ marginRight: '1rem', fontSize: '0.85rem', color: 'var(--color-primary-dark)', padding: '0.4rem 0.8rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                <span>{content}</span>
            </div>
        );
    };

    return (
        <nav className="navbar" aria-label="Top navigation">
            <div className="navbar-left">
                {!isHome && (
                    <Link to="/" className="navbar-logo navbar-logo-left"><span>aIELTS</span></Link>
                )}
                <button className="sidebar-open-btn" onClick={onToggleSidebar}>
                    <span className="hamburger-icon">
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                    </span>
                </button>
                
                {/* Back Button moved to the left side next to logo */}
                {!isHome && (backUrl || onBack) && (
                    <div className="navbar-back-section">
                        <div className="navbar-divider" />
                        {onBack ? (
                            <button onClick={onBack} className="navbar-back-btn">
                                <ArrowLeft size={16} />
                                <span>{backText || t.common.back}</span>
                            </button>
                        ) : backUrl ? (
                            <Link to={backUrl} className="navbar-back-btn">
                                <ArrowLeft size={16} />
                                <span>{backText || t.common.back}</span>
                            </Link>
                        ) : null}
                    </div>
                )}
            </div>
            
            <div className="navbar-center">
                {isHome ? (
                    <Link to="/" className="navbar-logo"><span>aIELTS</span></Link>
                ) : (
                    (pageTitle || pageSubtitle) && (
                        <div className="navbar-title-group">
                            {pageTitle && <h1 className="navbar-page-title">{pageTitle}</h1>}
                            {pageSubtitle && <span className="navbar-page-subtitle">{pageSubtitle}</span>}
                        </div>
                    )
                )}
            </div>


            <div className="navbar-right">
                {renderPersonalGoal()}

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

import Layout from '../components/layout/Layout';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import UserHome from '../components/profile/UserHome';
import UserSettings from '../components/profile/UserSettings';
import UserBackpack from '../components/profile/UserBackpack';
import UserFeedback from '../components/profile/UserFeedback';
import AdminFeedback from '../components/profile/AdminFeedback';
import AdminUserManagement from '../components/profile/AdminUserManagement';
import UserBackground from '../components/profile/UserBackground';
import UserManual from '../components/profile/UserManual';
import UserAnalytics from '../components/profile/UserAnalytics';
import RouteVisualization from '../components/admin/RouteVisualization';
import { formatATBalance } from '../utils/format';
import {
  LayoutDashboard,
  Backpack,
  Settings,
  MessageSquareText,
  BookOpen,
  Palette,
  Image,
  ShieldCheck,
  ShieldOff,
  Users,
  ClipboardList,
  ChevronDown,
  ArrowLeft,
  Coins,
  GitBranch,
  BarChart3,
} from 'lucide-react';
import '../styles/profile_page.css';

type Tab = 'home' | 'analytics' | 'settings' | 'backpack' | 'feedback' | 'background' | 'admin_feedback' | 'admin_users' | 'admin_routes' | 'manual';

/** Shown when a non-admin tries to access an admin tab via DevTools state manipulation */
function AccessDenied() {
    const { translations: t } = useLang();
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 16, padding: '80px 24px', color: 'var(--color-text-secondary)',
        }}>
            <ShieldOff size={48} strokeWidth={1.5} style={{ color: 'var(--color-danger, #ef4444)' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{t.profile.accessDeniedTitle}</div>
            <div style={{ fontSize: 14 }}>{t.profile.accessDeniedDesc}</div>
        </div>
    );
}

export default function ProfilePage() {
    const { user } = useAuth();
    const { translations: t } = useLang();
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [styleOpen, setStyleOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);

    if (!user) return null;

    const isAdmin = user.is_staff || user.is_superuser;

    const renderContent = () => {
        switch (activeTab) {
            case 'home': return <UserHome />;
            case 'analytics': return <UserAnalytics />;
            case 'settings': return <UserSettings />;
            case 'backpack': return <UserBackpack onBack={() => setActiveTab('home')} />;
            case 'feedback': return <UserFeedback />;
            case 'background': return <UserBackground />;
            case 'manual': return <UserManual />;
            // ── Admin-only tabs: double-checked here even if sidebar is hidden ──
            case 'admin_feedback': return isAdmin ? <AdminFeedback /> : <AccessDenied />;
            case 'admin_users':   return isAdmin ? <AdminUserManagement /> : <AccessDenied />;
            case 'admin_routes':  return isAdmin ? <RouteVisualization /> : <AccessDenied />;
            default: return <UserHome />;
        }
    };

    const iconCls = (tab: Tab) =>
        `menu-item-icon ${activeTab === tab ? 'active' : ''}`;

    const menuItems: { tab: Tab; Icon: typeof LayoutDashboard; label: string }[] = [
        { tab: 'home', Icon: LayoutDashboard, label: t.profile.menu.home },
        { tab: 'analytics', Icon: BarChart3, label: t.profile.menu.analytics },
        { tab: 'backpack', Icon: Backpack, label: t.profile.menu.backpack },
        { tab: 'settings', Icon: Settings, label: t.profile.menu.settings },
        { tab: 'feedback', Icon: MessageSquareText, label: t.profile.feedback.title },
    ];

    return (
        <Layout>
            <div className="profile-container">
                <div className="profile-content">
                    {/* Left sidebar */}
                    <aside className="profile-sidebar">
                        {/* User info header */}
                        <div className="profile-user-info">
                            <div className="profile-user-avatar">
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.username} className="profile-avatar-image" />
                                ) : (
                                    <div className="profile-avatar-placeholder">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="profile-user-details">
                                <div className="profile-user-name">{user.username}</div>
                                <div className="profile-user-email">{user.email}</div>
                                <div className="profile-user-balance">
                                    <Coins size={14} />
                                    <span>{formatATBalance(user.atBalance)} AT</span>
                                </div>
                            </div>
                        </div>

                        {/* Navigation menu */}
                        <nav className="profile-menu">
                            {menuItems.map(({ tab, Icon, label }) => (
                                <button
                                    key={tab}
                                    className={`profile-menu-item ${activeTab === tab ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    <Icon className={iconCls(tab)} size={18} />
                                    <span className="menu-item-text">{label}</span>
                                </button>
                            ))}

                            <button
                                className={`profile-menu-item ${activeTab === 'manual' ? 'active' : ''}`}
                                onClick={() => setActiveTab('manual')}
                            >
                                <BookOpen className={iconCls('manual')} size={18} />
                                <span className="menu-item-text">{t.profile.menu.manual}</span>
                            </button>

                            {/* Style accordion */}
                            <div className="profile-menu-accordion">
                                <button
                                    className={`profile-menu-item profile-accordion-trigger ${styleOpen ? 'open' : ''}`}
                                    onClick={() => setStyleOpen(o => !o)}
                                >
                                    <Palette size={18} className="menu-item-icon" />
                                    <span className="menu-item-text">{t.profile.menu.style}</span>
                                    <ChevronDown className={`accordion-chevron ${styleOpen ? 'open' : ''}`} size={16} />
                                </button>
                                <div className={`profile-accordion-body ${styleOpen ? 'open' : ''}`}>
                                    <button
                                        className={`profile-menu-item profile-sub-item ${activeTab === 'background' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('background')}
                                    >
                                        <Image size={16} className="menu-item-icon" />
                                        <span className="menu-item-text">{t.profile.menu.background}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Admin accordion */}
                            {(user.is_staff || user.is_superuser) && (
                                <div className="profile-menu-accordion">
                                    <button
                                        className={`profile-menu-item profile-accordion-trigger ${adminOpen ? 'open' : ''}`}
                                        onClick={() => setAdminOpen(o => !o)}
                                    >
                                        <ShieldCheck size={18} className="menu-item-icon" />
                                        <span className="menu-item-text">{t.profile.menu.admin}</span>
                                        <ChevronDown className={`accordion-chevron ${adminOpen ? 'open' : ''}`} size={16} />
                                    </button>
                                    <div className={`profile-accordion-body ${adminOpen ? 'open' : ''}`}>
                                        <button
                                            className={`profile-menu-item profile-sub-item ${activeTab === 'admin_users' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('admin_users')}
                                        >
                                            <Users size={16} className="menu-item-icon" />
                                            <span className="menu-item-text">{t.profile.admin.users.title}</span>
                                        </button>
                                        <button
                                            className={`profile-menu-item profile-sub-item ${activeTab === 'admin_feedback' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('admin_feedback')}
                                        >
                                            <ClipboardList size={16} className="menu-item-icon" />
                                            <span className="menu-item-text">{t.profile.admin.feedback.title}</span>
                                        </button>
                                        <button
                                            className={`profile-menu-item profile-sub-item ${activeTab === 'admin_routes' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('admin_routes')}
                                        >
                                            <GitBranch size={16} className="menu-item-icon" />
                                            <span className="menu-item-text">{t.profile.admin.routes.title}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </nav>

                        {/* Back to home link */}
                        <Link to="/" className="profile-back-link">
                            <ArrowLeft size={16} />
                            <span>{t.profile.backToHome}</span>
                        </Link>
                    </aside>

                    {/* Right content */}
                    <main className="profile-main">
                        {renderContent()}
                    </main>
                </div>
            </div>
        </Layout>
    );
}

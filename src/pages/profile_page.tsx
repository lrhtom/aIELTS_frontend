import Layout from '../components/Layout';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import UserHome from '../components/profile/UserHome';
import UserSettings from '../components/profile/UserSettings';
import UserBackpack from '../components/profile/UserBackpack';
import UserFeedback from '../components/profile/UserFeedback';
import AdminFeedback from '../components/profile/AdminFeedback';
import UserBackground from '../components/profile/UserBackground';
import UserManual from '../components/profile/UserManual';
import { formatATBalance } from '../utils/format';
import '../styles/profile_page.css';

type Tab = 'home' | 'settings' | 'backpack' | 'feedback' | 'background' | 'admin' | 'manual';

export default function ProfilePage() {
    const { user } = useAuth();
    const { translations: t } = useLang();
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [styleOpen, setStyleOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);

    if (!user) return null;

    const renderContent = () => {
        switch (activeTab) {
            case 'home': return <UserHome onNavigateToBackpack={() => setActiveTab('backpack')} />;
            case 'settings': return <UserSettings />;
            case 'backpack': return <UserBackpack onBack={() => setActiveTab('home')} />;
            case 'feedback': return <UserFeedback />;
            case 'background': return <UserBackground />;
            case 'admin': return <AdminFeedback />;
            case 'manual': return <UserManual />;
            default: return <UserHome onNavigateToBackpack={() => setActiveTab('backpack')} />;
        }
    };

    const menuItems: { tab: Tab; icon: string; label: string }[] = [
        { tab: 'home', icon: '🏠', label: t.profile.menu.home },
        { tab: 'backpack', icon: '🎒', label: t.profile.menu.backpack },
        { tab: 'settings', icon: '⚙️', label: t.profile.menu.settings },
        { tab: 'feedback', icon: '🐛', label: t.profile.feedback.title },
    ];

    return (
        <Layout>
            <div className="profile-container">
                <div className="profile-content">
                    {/* 左侧导航 */}
                    <aside className="profile-sidebar">
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
                                <div className="profile-user-at-balance">
                                    <span className="at-balance-icon">💰</span>
                                    <span className="at-balance-amount">{formatATBalance(user.atBalance)} AT</span>
                                </div>
                            </div>
                        </div>

                        <nav className="profile-menu">
                            {menuItems.map(({ tab, icon, label }) => (
                                <button
                                    key={tab}
                                    className={`profile-menu-item ${activeTab === tab ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    <span className="menu-item-icon">{icon}</span>
                                    <span className="menu-item-text">{label}</span>
                                </button>
                            ))}

                            <button
                                className={`profile-menu-item ${activeTab === 'manual' ? 'active' : ''}`}
                                onClick={() => setActiveTab('manual')}
                            >
                                <span className="menu-item-icon">📖</span>
                                <span className="menu-item-text">{t.profile.menu.manual}</span>
                            </button>

                            {/* 网站样式自定义 手风琴 */}
                            <div className="profile-menu-accordion">
                                <button
                                    className={`profile-menu-item profile-accordion-trigger ${styleOpen ? 'open' : ''}`}
                                    onClick={() => setStyleOpen(o => !o)}
                                >
                                    <span className="menu-item-icon">🎨</span>
                                    <span className="menu-item-text">{t.profile.menu.style}</span>
                                    <svg className="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                                <div className={`profile-accordion-body ${styleOpen ? 'open' : ''}`}>
                                    <button
                                        className={`profile-menu-item profile-sub-item ${activeTab === 'background' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('background')}
                                    >
                                        <span className="menu-item-icon">🖼</span>
                                        <span className="menu-item-text">{t.profile.menu.background}</span>
                                    </button>
                                </div>
                            </div>
                            {/* 管理后台 - 仅管理员可见 */}
                            {(user.is_staff || user.is_superuser) && (
                                <div className="profile-menu-accordion">
                                    <button
                                        className={`profile-menu-item profile-accordion-trigger ${adminOpen ? 'open' : ''}`}
                                        onClick={() => setAdminOpen(o => !o)}
                                    >
                                        <span className="menu-item-icon">🛠️</span>
                                        <span className="menu-item-text">{t.profile.menu.admin}</span>
                                        <svg className="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>
                                    <div className={`profile-accordion-body ${adminOpen ? 'open' : ''}`}>
                                        <button
                                            className={`profile-menu-item profile-sub-item ${activeTab === 'admin' ? 'active' : ''}`}
                                            onClick={() => setActiveTab('admin')}
                                        >
                                            <span className="menu-item-icon">📋</span>
                                            <span className="menu-item-text">{t.profile.admin.feedback.title}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </nav>
                    </aside>

                    {/* 右侧内容 */}
                    <main className="profile-main">
                        {renderContent()}
                    </main>
                </div>
            </div>
        </Layout>
    );
}

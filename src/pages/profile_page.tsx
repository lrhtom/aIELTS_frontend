import AppNavbar from '../components/AppNavbar';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import UserHome from '../components/profile/UserHome';
import UserSettings from '../components/profile/UserSettings';
import '../styles/profile_page.css';

export default function ProfilePage() {
    const { user } = useAuth();
    const { lang } = useLang();
    const t = translations[lang];
    const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');

    if (!user) {
        return null;
    }

    return (
        <div className="profile-page">
            <AppNavbar />

            <div className="profile-container">
                <div className="profile-content">
                    {/* 左侧导航菜单 */}
                    <aside className="profile-sidebar">
                        <div className="profile-user-info">
                            <div className="profile-user-avatar">
                                {user.avatar_url ? (
                                    <img
                                        src={user.avatar_url}
                                        alt={user.username}
                                        className="profile-avatar-image"
                                    />
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
                                    <span className="at-balance-amount">{user.atBalance || 0} AT</span>
                                </div>
                            </div>
                        </div>

                        <nav className="profile-menu">
                            <button
                                className={`profile-menu-item ${activeTab === 'home' ? 'active' : ''}`}
                                onClick={() => setActiveTab('home')}
                            >
                                <span className="menu-item-icon">🏠</span>
                                <span className="menu-item-text">{t.profile.menu.home}</span>
                            </button>
                            <button
                                className={`profile-menu-item ${activeTab === 'settings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <span className="menu-item-icon">⚙️</span>
                                <span className="menu-item-text">{t.profile.menu.settings}</span>
                            </button>
                        </nav>
                    </aside>

                    {/* 右侧内容区域 */}
                    <main className="profile-main">
                        {activeTab === 'home' ? <UserHome /> : <UserSettings />}
                    </main>
                </div>
            </div>
        </div>
    );
}
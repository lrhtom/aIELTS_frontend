import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { formatATBalance } from '../../utils/format';
import '../../styles/atBalanceCheck.css';

interface UserHomeProps {
    onNavigateToBackpack: () => void;
}

export default function UserHome({ onNavigateToBackpack }: UserHomeProps) {
    const { user } = useAuth();
    const { translations: t } = useLang();

    return (
        <div className="user-home">
            <div className="user-welcome">
                <div className="user-avatar-large">
                    <div className="avatar-static-container">
                        {user?.avatar_url ? (
                            <img
                                src={user.avatar_url}
                                alt={user.username}
                                className="avatar-image"
                            />
                        ) : (
                            <div className="avatar-placeholder-large">
                                <span>{user?.username.charAt(0).toUpperCase()}</span>
                            </div>
                        )}
                    </div>

                </div>
                <div className="user-welcome-text">
                    <h2>{t.profile.welcome}, {user?.username}</h2>
                    <p>{t.profile.welcomeDesc}</p>
                </div>
            </div>

            {/* AT币余额卡片 */}
            <div className="user-at-balance-card">
                <div className="user-balance-header">
                    <div className="user-balance-icon">💰</div>
                    <div className="user-balance-title">{t.profile.balance.title}</div>
                </div>
                <div className="user-balance-amount">
                    <span className="user-balance-value">{formatATBalance(user?.atBalance)}</span>
                    <span className="user-balance-unit">AT</span>
                </div>
                <div className="user-balance-description">
                    {t.profile.balance.description}
                </div>
                <div className="user-balance-actions">
                    <button className="primary-button">
                        {t.profile.balance.recharge}
                    </button>
                    <button className="secondary-button">
                        {t.profile.balance.history}
                    </button>
                </div>
            </div>

            {/* 用户信息卡片 */}
            <div className="user-info-card">
                <div className="user-info-header">
                    <div className="user-info-icon">👤</div>
                    <div className="user-info-title">{t.profile.info.title}</div>
                </div>
                <div className="user-info-grid">
                    <div className="user-info-item">
                        <div className="user-info-label">{t.profile.info.username}</div>
                        <div className="user-info-value">{user?.username}</div>
                    </div>
                    <div className="user-info-item">
                        <div className="user-info-label">{t.profile.info.email}</div>
                        <div className="user-info-value">{user?.email}</div>
                    </div>
                    <div className="user-info-item">
                        <div className="user-info-label">{t.profile.info.created}</div>
                        <div className="user-info-value">{new Date(user?.createdAt || '').toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

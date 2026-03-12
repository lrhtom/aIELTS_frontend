import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { formatATBalance } from '../../utils/format';

export default function UserHome() {
    const { user } = useAuth();
    const { translations: t } = useLang();

    const formatDate = (value?: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleString();
    };

    return (
        <div className="user-home">
            {/* 页面标题行 */}
            <div className="profile-home-header">
                <div>
                    <h2>{t.profile.welcome}, {user?.username}</h2>
                    <p>{t.profile.welcomeDesc}</p>
                </div>
            </div>

            {/* 双栏卡片 */}
            <div className="profile-home-grid">
                {/* AT 余额卡片 */}
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
                </div>

                {/* 账户信息卡片 */}
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
                        <div className="user-info-item">
                            <div className="user-info-label">{t.profile.info.lastLogin}</div>
                            <div className="user-info-value">{formatDate(user?.last_login)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

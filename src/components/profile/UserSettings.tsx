import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import AiModelSelector from '../common/AiModelSelector';
import AvatarUpload from './AvatarUpload';
import { authApi } from '../../api/auth';

export default function UserSettings() {
    const { user, logout, updateUser } = useAuth();
    const { lang, setLang, translations: t } = useLang();
    const [isDeleting, setIsDeleting] = useState(false);
    
    // 修改用户名状态
    const [newUsername, setNewUsername] = useState('');
    const [isChangingUsername, setIsChangingUsername] = useState(false);
    const [changeUsernameMsg, setChangeUsernameMsg] = useState('');
    const [changeUsernameError, setChangeUsernameError] = useState('');

    // AI生成重试次数状态
    const [aiRetryCount, setAiRetryCount] = useState(user?.aiGenerationRetryCount ?? 0);
    const [isUpdatingRetryCount, setIsUpdatingRetryCount] = useState(false);
    const [updateRetryCountMessage, setUpdateRetryCountMessage] = useState('');
    const [updateRetryCountError, setUpdateRetryCountError] = useState('');

    const handleChangeUsername = async () => {
        const trimmed = newUsername.trim();
        if (!trimmed || trimmed.length < 2) {
            setChangeUsernameError(t.profile.rename.errors.tooShort);
            return;
        }
        if (trimmed.length > 30) {
            setChangeUsernameError(t.profile.rename.errors.tooLong);
            return;
        }
        if (!/^[a-zA-Z0-9_\-一-鿿]+$/.test(trimmed)) {
            setChangeUsernameError(t.profile.rename.errors.invalidChars);
            return;
        }
        if (trimmed === user?.username) {
            setChangeUsernameError(t.profile.rename.errors.sameName);
            return;
        }
        if (!window.confirm(t.profile.rename.errors.confirmMsg.replace('{name}', trimmed))) return;

        setIsChangingUsername(true);
        setChangeUsernameMsg('');
        setChangeUsernameError('');

        try {
            const res = await authApi.changeUsername(trimmed);
            updateUser({ ...user!, username: res.username, atBalance: res.at_balance });
            setChangeUsernameMsg(res.message);
            setNewUsername('');
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            setChangeUsernameError(e.response?.data?.error || t.profile.rename.errors.fail);
        } finally {
            setIsChangingUsername(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm(t.profile.account.confirmDelete)) {
            return;
        }

        setIsDeleting(true);
        try {
            await authApi.deleteAccount();
            logout();
        } catch (error) {
            console.error('Failed to delete account:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleUpdateAiRetryCount = async () => {
        setIsUpdatingRetryCount(true);
        setUpdateRetryCountMessage('');
        setUpdateRetryCountError('');
        
        try {
            const updatedUser = await authApi.updateSettings({
                ai_generation_retry_count: aiRetryCount
            });
            updateUser(updatedUser);
            setUpdateRetryCountMessage(t.settings.aiRetry.saveSuccess);
            setTimeout(() => setUpdateRetryCountMessage(''), 3000);
        } catch (error) {
            console.error('Failed to update AI retry count:', error);
            setUpdateRetryCountError(t.settings.aiRetry.saveFailed);
        } finally {
            setIsUpdatingRetryCount(false);
        }
    };

    return (
        <div className="user-settings">
            <div className="user-settings-header">
                <h2>{t.settings.heading}</h2>
                <p>{t.settings.subheading}</p>
            </div>

            {/* 头像设置 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">📷</div>
                    <div className="user-settings-section-title">{t.settings.avatar.title}</div>
                </div>
                <div className="user-settings-section-description">
                    {t.settings.avatar.description}
                </div>
                <div className="avatar-upload-wrapper">
                    <AvatarUpload
                        size="medium"
                        disabled={false}
                    />
                </div>
            </div>

            {/* 语言设置 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">🌐</div>
                    <div className="user-settings-section-title">{t.settings.language.title}</div>
                </div>
                <div className="user-settings-section-description">
                    {t.settings.language.desc}
                </div>
                <div className="lang-selection">
                    <button
                        className={`lang-button ${lang === 'zh' ? 'active' : ''}`}
                        onClick={() => setLang('zh')}
                    >
                        简体中文
                    </button>
                    <button
                        className={`lang-button ${lang === 'en' ? 'active' : ''}`}
                        onClick={() => setLang('en')}
                    >
                        English
                    </button>
                </div>
            </div>

            {/* AI模型设置 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">🤖</div>
                    <div className="user-settings-section-title">{t.settings.model.title}</div>
                </div>
                <div className="user-settings-section-description">
                    {t.settings.model.desc}
                </div>
                <div className="ai-model-selector-wrapper">
                    <AiModelSelector label="" description="" />
                </div>
            </div>

            {/* AI生成重试次数设置 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">🔄</div>
                    <div className="user-settings-section-title">
                        {t.settings.aiRetry.aiRetryCount}
                    </div>
                </div>
                <div className="user-settings-section-description">
                    {t.settings.aiRetry.aiRetryDesc}
                </div>
                
                <div className="ai-retry-settings">
                    <div className="ai-retry-slider-container">
                        <label className="ai-retry-label" htmlFor="aiRetrySlider">
                            {t.settings.aiRetry.aiRetryLabel} 
                            <span className="ai-retry-value">{aiRetryCount} {t.settings.aiRetry.aiRetryUnit}</span>
                        </label>
                        <input
                            id="aiRetrySlider"
                            type="range"
                            min="0"
                            max="10"
                            value={aiRetryCount}
                            onChange={(e) => {
                                setAiRetryCount(parseInt(e.target.value));
                                setUpdateRetryCountMessage('');
                                setUpdateRetryCountError('');
                            }}
                            className="ai-retry-slider"
                            disabled={isUpdatingRetryCount}
                        />
                        <div className="ai-retry-range-labels">
                            <span className="min-label">0</span>
                            <span className="max-label">10</span>
                        </div>
                    </div>

                    <button
                        className="ai-retry-save-button"
                        onClick={handleUpdateAiRetryCount}
                        disabled={isUpdatingRetryCount || aiRetryCount === (user?.aiGenerationRetryCount ?? 0)}
                    >
                        {isUpdatingRetryCount ? t.common.saving : t.settings.aiRetry.saveBtn}
                    </button>

                    {updateRetryCountMessage && (
                        <div className="ai-retry-success-message">{updateRetryCountMessage}</div>
                    )}
                    {updateRetryCountError && (
                        <div className="ai-retry-error-message">{updateRetryCountError}</div>
                    )}
                </div>

                {/* 警告信息 */}
                <div className="ai-retry-warning-section">
                    <div className="ai-retry-warning-title">
                        ⚠️ {t.settings.aiRetry.importantNotice}
                    </div>
                    <div className="ai-retry-warning-content">
                        <p className="ai-retry-warning-text">
                            ⚠️ {t.settings.aiRetry.notice1}
                        </p>
                        <ul className="ai-retry-warning-list">
                            <li>{t.settings.aiRetry.notice2}</li>
                            <li>{t.settings.aiRetry.notice3}</li>
                            <li>{t.settings.aiRetry.notice4}</li>
                            <li>{t.settings.aiRetry.notice5}</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* 账户管理 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">🔐</div>
                    <div className="user-settings-section-title">{t.profile.account.title}</div>
                </div>
                <div className="user-settings-section-description">
                    {t.profile.account.description}
                </div>

                {/* 修改用户名 */}
                <div className="rename-section">
                    <div className="rename-header">
                        <span className="rename-label">{t.profile.rename.title}</span>
                        <span className="rename-cost">{t.profile.rename.cost}</span>
                    </div>
                    <div className="rename-input-row">
                        <input
                            type="text"
                            className="rename-input"
                            placeholder={t.profile.rename.placeholder}
                            value={newUsername}
                            onChange={(e) => { setNewUsername(e.target.value); setChangeUsernameError(''); setChangeUsernameMsg(''); }}
                            maxLength={30}
                            disabled={isChangingUsername}
                        />
                        <button
                            className="rename-btn"
                            onClick={handleChangeUsername}
                            disabled={isChangingUsername || !newUsername.trim()}
                        >
                            {isChangingUsername ? t.profile.rename.processing : t.profile.rename.confirmBtn}
                        </button>
                    </div>
                    {changeUsernameMsg && <div className="rename-success">{changeUsernameMsg}</div>}
                    {changeUsernameError && <div className="rename-error">{changeUsernameError}</div>}
                </div>

                <div className="account-actions">
                    <button
                        className="logout-button"
                        onClick={logout}
                    >
                        {t.profile.account.logout}
                    </button>
                    <button
                        className="delete-button"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                    >
                        {isDeleting ? t.profile.account.deleting : t.profile.account.delete}
                    </button>
                </div>
                <div className="account-warning">
                    {t.profile.account.warning}
                </div>
            </div>

            {/* 系统信息 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">📊</div>
                    <div className="user-settings-section-title">{t.settings.system.title}</div>
                </div>
                <div className="system-info-grid">
                    <div className="system-info-item">
                        <div className="system-info-label">{t.settings.system.userId}</div>
                        <div className="system-info-value">{user?.id}</div>
                    </div>
                    <div className="system-info-item">
                        <div className="system-info-label">{t.settings.system.registeredTime}</div>
                        <div className="system-info-value">{new Date(user?.createdAt || '').toLocaleDateString()}</div>
                    </div>
                    <div className="system-info-item">
                        <div className="system-info-label">{t.settings.system.emailVerify}</div>
                        <div className="system-info-value">
                            {user?.is_email_verified ? t.settings.system.verified : t.settings.system.notVerified}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

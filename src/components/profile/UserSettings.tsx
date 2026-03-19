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
    
    // AI生成重试次数状态
    const [aiRetryCount, setAiRetryCount] = useState(user?.aiGenerationRetryCount ?? 0);
    const [isUpdatingRetryCount, setIsUpdatingRetryCount] = useState(false);
    const [updateRetryCountMessage, setUpdateRetryCountMessage] = useState('');
    const [updateRetryCountError, setUpdateRetryCountError] = useState('');

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
            setUpdateRetryCountMessage(t.settings.aiRetry?.saveSuccess || '✓ 保存成功');
            setTimeout(() => setUpdateRetryCountMessage(''), 3000);
        } catch (error) {
            console.error('Failed to update AI retry count:', error);
            setUpdateRetryCountError(t.settings.aiRetry?.saveFailed || '✗ 保存失败');
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
                        {lang === 'zh' ? 'AI生成重试次数' : 'AI Generation Retry Count'}
                    </div>
                </div>
                <div className="user-settings-section-description">
                    {lang === 'zh' 
                        ? '当AI生成内容失败时，系统会自动重试指定的次数' 
                        : 'When AI content generation fails, the system will automatically retry the specified number of times'}
                </div>
                
                <div className="ai-retry-settings">
                    <div className="ai-retry-slider-container">
                        <label className="ai-retry-label" htmlFor="aiRetrySlider">
                            {lang === 'zh' ? '重试次数：' : 'Retry Count:'} 
                            <span className="ai-retry-value">{aiRetryCount} 次</span>
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
                        {isUpdatingRetryCount ? (lang === 'zh' ? '保存中...' : 'Saving...') : (lang === 'zh' ? '保存设置' : 'Save Settings')}
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
                        ⚠️ {lang === 'zh' ? '重要提示' : 'Important Notice'}
                    </div>
                    <div className="ai-retry-warning-content">
                        <p className="ai-retry-warning-text">
                            {lang === 'zh' 
                                ? '⚠️ 更多的重试次数会导致AT币消耗增加!'
                                : '⚠️ More retry attempts will result in increased AT coin consumption!'}
                        </p>
                        <ul className="ai-retry-warning-list">
                            <li>
                                {lang === 'zh' 
                                    ? '每次重试都会消耗AT币（按照您的会员等级计算）'
                                    : 'Each retry will consume AT coins (calculated according to your membership level)'}
                            </li>
                            <li>
                                {lang === 'zh' 
                                    ? '建议免费用户设置为0-2次，付费用户可设置为3-5次'
                                    : 'Free users are recommended to set 0-2 retries, paid users can set 3-5 retries'}
                            </li>
                            <li>
                                {lang === 'zh' 
                                    ? '过高的重试次数（8-10）可能导致费用快速增长'
                                    : 'High retry counts (8-10) may cause costs to increase rapidly'}
                            </li>
                            <li>
                                {lang === 'zh' 
                                    ? '请根据您的AT币余额谨慎设置此值'
                                    : 'Please set this value carefully based on your AT coin balance'}
                            </li>
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

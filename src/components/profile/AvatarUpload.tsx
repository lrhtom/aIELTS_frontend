import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { avatarApi } from '../../api/avatar';
import { showToast } from '../common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/avatarUpload.css';

interface AvatarUploadProps {
    onAvatarUpdate?: (avatarUrl: string | null) => void;
    className?: string;
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
}

export default function AvatarUpload({ onAvatarUpdate, className = '', size = 'medium', disabled = false }: AvatarUploadProps) {
    const { user, updateUser } = useAuth();
    const { lang } = useLang();
    const t = translations[lang].profile.avatarUpload;
    const [isUploading, setIsUploading] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sizeClasses = {
        small: 'avatar-upload-small',
        medium: 'avatar-upload-medium',
        large: 'avatar-upload-large'
    };

    useEffect(() => {
        if (user?.avatar_url) {
            setPreviewUrl(user.avatar_url);
        } else {
            setPreviewUrl(null);
        }
    }, [user?.avatar_url]);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 验证文件
        const validation = avatarApi.validateImageFile(file);
        if (!validation.isValid) {
            showToast(validation.error || t.fileValidationError, 'error');
            return;
        }

        try {
            // 生成预览
            const preview = await avatarApi.fileToBase64(file);
            setPreviewUrl(preview);

            // 上传文件
            setIsUploading(true);
            const response = await avatarApi.uploadAvatar(file);

            // 更新用户信息
            updateUser(response.user);
            onAvatarUpdate?.(response.user.avatar_url || null);

            showToast(t.uploadSuccess, 'success');
        } catch (error: unknown) {
            const e = error as { response?: { data?: { error?: string } } };
            console.error('头像上传失败:', error);
            showToast(e.response?.data?.error || t.uploadFailed, 'error');
            setPreviewUrl(user?.avatar_url || null);
        } finally {
            setIsUploading(false);
            // 清除文件输入
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteAvatar = async () => {
        if (!user?.avatar_url) return;

        if (!window.confirm(t.deleteConfirm)) {
            return;
        }

        try {
            setIsUploading(true);
            const response = await avatarApi.deleteAvatar();

            // 更新用户信息
            updateUser(response.user);
            onAvatarUpdate?.(null);
            setPreviewUrl(null);

            showToast(t.deleteSuccess, 'success');
        } catch (error: unknown) {
            const e = error as { response?: { data?: { error?: string } } };
            console.error('删除头像失败:', error);
            showToast(e.response?.data?.error || t.deleteFailed, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleClick = () => {
        if (isUploading || disabled) return;
        fileInputRef.current?.click();
    };

    const getAvatarContent = () => {
        if (previewUrl) {
            return <img src={previewUrl} alt={t.avatarAlt} className="avatar-image" />;
        } else if (user) {
            return (
                <div className="avatar-placeholder">
                    <span>{user.username.charAt(0).toUpperCase()}</span>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={`avatar-upload ${sizeClasses[size]} ${className}`}>
            <div
                className={`avatar-container ${isHovering && !disabled ? 'hovering' : ''} ${isUploading ? 'uploading' : ''} ${disabled ? 'disabled' : ''}`}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onClick={handleClick}
            >
                {getAvatarContent()}

                {isUploading && (
                    <div className="avatar-upload-overlay">
                        <div className="avatar-upload-spinner"></div>
                        <span>{t.uploading}</span>
                    </div>
                )}

                {!isUploading && isHovering && !disabled && (
                    <div className="avatar-upload-overlay">
                        <span>{t.clickToChange}</span>
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleFileSelect}
                className="avatar-file-input"
            />

            {user?.avatar_url && !isUploading && (
                <button
                    type="button"
                    className="avatar-delete-btn"
                    onClick={handleDeleteAvatar}
                    disabled={isUploading}
                >
                    {t.deleteBtn}
                </button>
            )}

            <div className="avatar-upload-hint">
                {t.hint}
            </div>
        </div>
    );
}

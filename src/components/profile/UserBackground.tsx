import React, { useState, useRef, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { applyUserBackground } from '../../contexts/AuthContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/user_background.css';

export default function UserBackground() {
    const { user, updateUser } = useAuth();
    const { translations: t } = useLang();

    const COLOR_PRESETS = useMemo(() => [
        { label: t.profile.background.presets.white, value: '#ffffff' },
        { label: t.profile.background.presets.beige, value: '#fdf8f3' },
        { label: t.profile.background.presets.mint, value: '#f0faf4' },
        { label: t.profile.background.presets.blue, value: '#f0f4f8' },
        { label: t.profile.background.presets.violet, value: '#f5f0ff' },
        { label: t.profile.background.presets.morning, value: 'linear-gradient(135deg,#fdf9f0 0%,#e8f4f8 100%)' },
        { label: t.profile.background.presets.green, value: 'linear-gradient(135deg,#f0fff4 0%,#e6f7f1 100%)' },
        { label: t.profile.background.presets.dusk, value: 'linear-gradient(135deg,#f5f0ff 0%,#fde8f8 100%)' },
        { label: t.profile.background.presets.sky, value: 'linear-gradient(135deg,#e0f2fe 0%,#bfdbfe 100%)' },
        { label: t.profile.background.presets.coral, value: 'linear-gradient(135deg,#fff1f2 0%,#fde8b2 100%)' },
    ], [t]);

    const [bgColor, setBgColor] = useState(user?.bg_color || '');
    const [bgImageUrl, setBgImageUrl] = useState(user?.bg_image_url || '');
    const [bgBlur, setBgBlur] = useState<number>(typeof user?.bg_blur === 'number' ? user.bg_blur : 2);
    const [customColor, setCustomColor] = useState('#ffffff');
    const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
    const [imageUrlInput, setImageUrlInput] = useState(user?.bg_image_url || '');

    // 上传状态
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState('');

    // 保存状态
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const fileRef = useRef<HTMLInputElement>(null);

    // ── 本地预览颜色（不保存）──
    const previewColor = (value: string) => {
        applyUserBackground({ ...user, bg_color: value, bg_image_url: null } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        setBgColor(value);
        setBgImageUrl('');
        setImageUrlInput('');
    };

    // ── 本地预览 URL 图片（不保存）──
    const previewImageUrl = (url: string) => {
        if (!url) return;
        applyUserBackground({ ...user, bg_color: null, bg_image_url: url, bg_blur: bgBlur } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        setBgImageUrl(url);
        setBgColor('');
    };

    // ── 实时预览模糊度变化 ──
    const handleBlurChange = (val: number) => {
        setBgBlur(val);
        const layer = document.getElementById('bg-image-layer') as HTMLDivElement | null;
        if (layer) layer.style.filter = `blur(${val}px)`;
    };

    // ── 上传图片文件到服务器 ──
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 先本地预览
        const localUrl = URL.createObjectURL(file);
        applyUserBackground({ ...user!, bg_color: null, bg_image_url: localUrl });
        setBgImageUrl(localUrl);
        setBgColor('');

        // 上传到服务器
        setUploading(true);
        setUploadMsg('');
        try {
            const formData = new FormData();
            formData.append('image', file);
            const resp = await apiClient.post('/auth/background/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const serverUrl: string = resp.data.image_url;
            setBgImageUrl(serverUrl);
            setImageUrlInput(serverUrl);
            // 已自动写入数据库，直接更新本地用户状态
            updateUser(resp.data.user);
            setUploadMsg(`✅ ${t.profile.background.uploadSuccess}`);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            const msg = e.response?.data?.error || t.common.error;
            setUploadMsg(`❌ ${msg}`);
        } finally {
            setUploading(false);
            URL.revokeObjectURL(localUrl);
            setTimeout(() => setUploadMsg(''), 4000);
        }
    };

    const handleClear = async () => {
        setBgColor('');
        setBgImageUrl('');
        setImageUrlInput('');
        applyUserBackground({ ...user!, bg_color: null, bg_image_url: null });

        setSaving(true);
        setSaveMsg('');
        try {
            const resp = await apiClient.patch('/auth/background', {
                bg_color: '',
                bg_image_url: '',
                bg_blur: bgBlur,
            });
            updateUser(resp.data.user);
            setSaveMsg(`✅ ${t.common.saved}`);
        } catch {
            setSaveMsg(`❌ ${t.common.error}`);
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(''), 3000);
        }
    };

    // ── 手动保存颜色/URL 设置（图片上传已自动保存）──
    const handleSave = async () => {
        setSaving(true);
        setSaveMsg('');
        try {
            const payload = {
                bg_color: bgColor,
                bg_image_url: bgImageUrl,
                bg_blur: bgBlur,
            };
            const resp = await apiClient.patch('/auth/background', payload);
            updateUser(resp.data.user);
            setSaveMsg(`✅ ${t.common.saved}`);
        } catch {
            setSaveMsg(`❌ ${t.common.error}`);
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMsg(''), 3000);
        }
    };

    return (
        <div className="ub-page">
            <div className="ub-header">
                <h2>🎨 {t.profile.background.title}</h2>
                <p className="ub-desc">{t.profile.background.desc}</p>
            </div>

            {/* ── 颜色自定义 ── */}
            <section className="ub-section">
                <div className="ub-section-title">🎨 {t.profile.background.colorSection}</div>
                <p className="ub-section-desc">{t.profile.background.colorDesc}</p>
                <div className="ub-color-grid">
                    {COLOR_PRESETS.map(p => (
                        <button
                            key={p.value}
                            className={`ub-swatch ${bgColor === p.value ? 'selected' : ''}`}
                            style={{ background: p.value }}
                            title={p.label}
                            onClick={() => previewColor(p.value)}
                        >
                            {bgColor === p.value && <span className="ub-swatch-check">✓</span>}
                        </button>
                    ))}
                    {/* 自定义颜色拾取 */}
                    <label className="ub-swatch ub-custom-swatch" title={t.profile.background.colorSection}>
                        <input
                            type="color"
                            value={customColor}
                            onChange={e => { setCustomColor(e.target.value); previewColor(e.target.value); }}
                        />
                        <span>＋</span>
                    </label>
                </div>
            </section>

            {/* ── 背景图片自定义 ── */}
            <section className="ub-section">
                <div className="ub-section-title">🖼 {t.profile.background.imageSection}</div>
                <p className="ub-section-desc">{t.profile.background.imageDesc}</p>
                <div className="ub-image-tabs">
                    <button className={`ub-tab ${imageInputMode === 'url' ? 'active' : ''}`} onClick={() => setImageInputMode('url')}>{t.profile.background.tabUrl}</button>
                    <button className={`ub-tab ${imageInputMode === 'upload' ? 'active' : ''}`} onClick={() => setImageInputMode('upload')}>{t.profile.background.tabUpload}</button>
                </div>

                {imageInputMode === 'url' ? (
                    <div className="ub-url-input-row">
                        <input
                            type="url"
                            className="ub-url-input"
                            placeholder={t.profile.background.urlPlaceholder}
                            value={imageUrlInput}
                            onChange={e => setImageUrlInput(e.target.value)}
                            onBlur={() => imageUrlInput && previewImageUrl(imageUrlInput)}
                        />
                        <button className="ub-preview-btn" onClick={() => previewImageUrl(imageUrlInput)}>{t.profile.background.preview}</button>
                    </div>
                ) : (
                    <>
                        <div
                            className={`ub-upload-area ${uploading ? 'uploading' : ''}`}
                            onClick={() => !uploading && fileRef.current?.click()}
                        >
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            {uploading ? (
                                <>
                                    <span className="ub-upload-icon">⏳</span>
                                    <span>{t.profile.background.uploading}</span>
                                </>
                            ) : (
                                <>
                                    <span className="ub-upload-icon">📁</span>
                                    <span>{t.profile.background.uploadPlaceholder}</span>
                                </>
                            )}
                        </div>
                        {uploadMsg && <div className="ub-upload-msg">{uploadMsg}</div>}
                    </>
                )}

                {bgImageUrl && !bgImageUrl.startsWith('blob:') && (
                    <div className="ub-image-preview">
                        <img src={bgImageUrl} alt={t.profile.background.preview} />
                    </div>
                )}
            </section>

            {/* ── 模糊度调节 ── */}
            <section className="ub-section">
                <div className="ub-section-title">🌫 {t.profile.background.blurSection}</div>
                <p className="ub-section-desc">{t.profile.background.blurDesc}</p>
                <div className="ub-blur-row">
                    <span className="ub-blur-label">{t.profile.background.blurClear}</span>
                    <input
                        type="range"
                        min={0} max={20} step={0.5}
                        value={bgBlur}
                        onChange={e => handleBlurChange(Number(e.target.value))}
                        className="ub-blur-slider"
                    />
                    <span className="ub-blur-value">{bgBlur}px</span>
                    <span className="ub-blur-label">{t.profile.background.blurBlurry}</span>
                </div>
            </section>

            {/* ── 底部操作栏 ── */}
            <div className="ub-actions">
                <button className="ub-clear-btn" onClick={handleClear} disabled={saving || uploading}>{t.profile.background.clearBtn}</button>
                <div className="ub-actions-right">
                    {saveMsg && <span className="ub-save-msg">{saveMsg}</span>}
                    <button
                        className="ub-save-btn"
                        onClick={handleSave}
                        disabled={saving || uploading}
                        title={imageInputMode === 'upload' ? t.profile.background.saveAutoHint : ''}
                    >
                        {saving ? t.common.saving : `💾 ${t.profile.background.saveTitle}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api/auth';
import { listCustomModels, type CustomModel } from '../../api/custom_model';
import CustomModelModal from './CustomModelModal';

export type AIProvider =
    | 'deepseek' | 'deepseek_flash' | 'gemini' | 'gpt5_4' | 'gpt5_mini'
    | `custom:${number}`;

/** Sentinel value for the top "+ add custom model" option — never persisted. */
const ADD_SENTINEL = '__add_custom__';

const BUILTIN_OPTIONS: { value: AIProvider; label: string }[] = [
    { value: 'deepseek', label: 'DeepSeek v4 Pro' },
    { value: 'deepseek_flash', label: 'DeepSeek v4 Flash' },
    { value: 'gemini', label: 'Gemini 3.0 Flash' },
    { value: 'gpt5_4', label: 'GPT-5.4' },
    { value: 'gpt5_mini', label: 'GPT-5.4 Mini' },
];

interface AiModelSelectorProps {
    onModelChange?: (provider: AIProvider) => void;
    label?: string;
    description?: string;
    variant?: 'default' | 'minimal';
}

export default function AiModelSelector({ onModelChange, label, description, variant = 'default' }: AiModelSelectorProps) {
    const { translations: t } = useLang();
    const cmT = t.components.customModel;
    const resolvedLabel = label ?? t.components.aiModel.label;
    const resolvedDesc = description ?? t.components.aiModel.desc;
    const { user, updateUser } = useAuth();
    const [provider, setProvider] = useState<string>(() => {
        return (user?.aiProvider as string) || localStorage.getItem('ai_provider') || 'deepseek';
    });
    const [customModels, setCustomModels] = useState<CustomModel[]>([]);
    const [modalOpen, setModalOpen] = useState(false);

    const onModelChangeRef = useRef(onModelChange);
    useEffect(() => {
        onModelChangeRef.current = onModelChange;
    }, [onModelChange]);

    const loadCustom = () => {
        listCustomModels().then(setCustomModels).catch(() => { /* non-fatal */ });
    };
    useEffect(() => { loadCustom(); }, []);

    // Sync from server → local only when the server value changes externally.
    // provider is intentionally NOT a dependency — including it would cause the
    // effect to revert user selections before the persist API call completes.
    useEffect(() => {
        if (user?.aiProvider && user.aiProvider !== provider) {
            const nextProvider = user.aiProvider as string;
            setProvider(nextProvider);
            localStorage.setItem('ai_provider', nextProvider);
            onModelChangeRef.current?.(nextProvider as AIProvider);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.aiProvider]);

    const handleProviderChange = (p: string) => {
        if (p === ADD_SENTINEL) {
            setModalOpen(true);
            return;
        }
        setProvider(p);
        localStorage.setItem('ai_provider', p);
        if (user) {
            authApi.updateSettings({ ai_provider: p }).then(u => updateUser(u)).catch(console.error);
        }
        onModelChangeRef.current?.(p as AIProvider);
    };

    const handleSaved = (m: CustomModel) => {
        loadCustom();
        handleProviderChange(m.provider_id);   // auto-select the newly added/edited model
    };

    const renderOptions = () => (
        <>
            <option value={ADD_SENTINEL}>{cmT.addOption}</option>
            {BUILTIN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            {customModels.map(m => (
                <option key={m.id} value={m.provider_id}>★ {m.name}（{cmT.customTag}）</option>
            ))}
        </>
    );

    if (variant === 'minimal') {
        return (
            <>
                <select
                    style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s',
                        width: 'auto',
                        height: '28px'
                    }}
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    onMouseOver={(e) => {
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                >
                    {renderOptions()}
                </select>
                <CustomModelModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
            </>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {resolvedLabel && <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{resolvedLabel} 🧠</div>}
            {resolvedDesc && <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{resolvedDesc}</div>}
            <select
                style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: '15px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    width: '100%',
                    maxWidth: '300px'
                }}
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
            >
                {renderOptions()}
            </select>
            <CustomModelModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
        </div>
    );
}

import { useState, useEffect, useRef } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api/auth';

export type AIProvider = 'deepseek' | 'gemini' | 'gpt5_4' | 'gpt5_mini';

interface AiModelSelectorProps {
    onModelChange?: (provider: AIProvider) => void;
    label?: string;
    description?: string;
}

export default function AiModelSelector({ onModelChange, label, description }: AiModelSelectorProps) {
    const { translations: t } = useLang();
    const resolvedLabel = label ?? t.components.aiModel.label;
    const resolvedDesc = description ?? t.components.aiModel.desc;
    const { user, updateUser } = useAuth();
    const [provider, setProvider] = useState<AIProvider>(() => {
        return (user?.aiProvider as AIProvider) || (localStorage.getItem('ai_provider') as AIProvider) || 'deepseek';
    });

    const onModelChangeRef = useRef(onModelChange);
    useEffect(() => {
        onModelChangeRef.current = onModelChange;
    }, [onModelChange]);

    // Sync from server → local only when the server value changes externally.
    // provider is intentionally NOT a dependency — including it would cause the
    // effect to revert user selections before the persist API call completes.
    useEffect(() => {
        if (user?.aiProvider && user.aiProvider !== provider) {
            const nextProvider = user.aiProvider as AIProvider;
            setProvider(nextProvider);
            localStorage.setItem('ai_provider', nextProvider);
            onModelChangeRef.current?.(nextProvider);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.aiProvider]);

    const handleProviderChange = (p: AIProvider) => {
        setProvider(p);
        localStorage.setItem('ai_provider', p);
        if (user) {
            authApi.updateSettings({ ai_provider: p }).then(u => updateUser(u)).catch(console.error);
        }
        onModelChangeRef.current?.(p);
    };

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
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
            >
                <option value="deepseek">DeepSeek v3.2</option>
                <option value="gemini">Gemini 3.0 Flash</option>
                <option value="gpt5_4">GPT-5.4</option>
                <option value="gpt5_mini">GPT-5.4 Mini</option>
            </select>
        </div>
    );
}

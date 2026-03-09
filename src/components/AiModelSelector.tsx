import { useState } from 'react';
import { useLang } from '../i18n/LanguageContext';

type AIProvider = 'deepseek' | 'gemini' | 'gpt5';

interface AiModelSelectorProps {
    onModelChange?: (provider: AIProvider) => void;
    label?: string;
    description?: string;
}

export default function AiModelSelector({ onModelChange, label, description }: AiModelSelectorProps) {
    const { translations: t } = useLang();
    const resolvedLabel = label ?? t.components.aiModel.label;
    const resolvedDesc = description ?? t.components.aiModel.desc;
    const [provider, setProvider] = useState<AIProvider>(() => {
        const saved = localStorage.getItem('ai_provider');
        return (saved as AIProvider) || 'deepseek';
    });

    const handleProviderChange = (p: AIProvider) => {
        setProvider(p);
        localStorage.setItem('ai_provider', p);
        if (onModelChange) {
            onModelChange(p);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {resolvedLabel && <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{resolvedLabel} 🧠</div>}
            {resolvedDesc && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{resolvedDesc}</div>}
            <select
                style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
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
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Gemini 3.0 Flash</option>
                <option value="gpt5">GPT-5.3 Chat</option>
            </select>
        </div>
    );
}

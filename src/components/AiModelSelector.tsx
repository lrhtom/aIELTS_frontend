import { useState, useEffect } from 'react';

type AIProvider = 'deepseek' | 'gemini' | 'doubao' | 'qwen';

interface AiModelSelectorProps {
    onModelChange?: (provider: AIProvider) => void;
    label?: string;
    description?: string;
}

export default function AiModelSelector({ onModelChange, label = "AI 模型", description = "选择后台出题和批改所使用的引擎" }: AiModelSelectorProps) {
    const [provider, setProvider] = useState<AIProvider>('deepseek');

    useEffect(() => {
        const saved = localStorage.getItem('ai_provider') as AIProvider;
        if (saved) setProvider(saved);
    }, []);

    const handleProviderChange = (p: AIProvider) => {
        setProvider(p);
        localStorage.setItem('ai_provider', p);
        if (onModelChange) {
            onModelChange(p);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {label && <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label} 🧠</div>}
            {description && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{description}</div>}
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
                <option value="doubao">doubao-seed-2.0-lite</option>
                <option value="qwen">qwen3.5-397b-a17b</option>
            </select>
        </div>
    );
}

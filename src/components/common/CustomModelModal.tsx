import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import {
    createCustomModel, updateCustomModel, testCustomModel, testCustomModelConfig,
    type CustomModel, type ModelTestResult,
} from '../../api/custom_model';
import '../../styles/custom_model.css';

interface Props {
    open: boolean;
    editing?: CustomModel | null;
    onClose: () => void;
    onSaved: (model: CustomModel) => void;
}

/** Fill-in examples for common OpenAI-compatible providers (values are language-neutral). */
const HELP_EXAMPLES = [
    { key: 'ollama',     labelKey: 'pOllama',     name: 'llama3.2',            url: 'http://localhost:11434/v1/chat/completions',                    sk: 'ollama' },
    { key: 'openai',     labelKey: 'pOpenai',     name: 'gpt-4o-mini',         url: 'https://api.openai.com/v1/chat/completions',                    sk: 'sk-...' },
    //two templates each taking what they need, so the results page does not need its own i18n key
    // For reasoning models (gpt-5.x and the o family) the backend automatically omits temperature and uses
    { key: 'gpt56',      labelKey: 'pGpt56',      name: 'gpt-5.6-sol',         url: 'https://api.openai.com/v1/chat/completions',                    sk: 'sk-...' },
    { key: 'deepseek',   labelKey: 'pDeepseek',   name: 'deepseek-chat',       url: 'https://api.deepseek.com/v1/chat/completions',                  sk: 'sk-...' },
    { key: 'qwen',       labelKey: 'pQwen',       name: 'qwen-plus',           url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', sk: 'sk-...' },
    { key: 'openrouter', labelKey: 'pOpenrouter', name: 'openai/gpt-4o-mini',  url: 'https://openrouter.ai/api/v1/chat/completions',                 sk: 'sk-or-...' },
] as const;

/** Screen-centered popup to add/edit a bring-your-own model. Shared by the model
 *  selector's "+" option and the settings manager panel. */
export default function CustomModelModal({ open, editing, onClose, onSaved }: Props) {
    const { t } = useLang();

    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<ModelTestResult | null>(null);
    const [error, setError] = useState('');
    const [showHelp, setShowHelp] = useState(false);

    // Reset fields whenever the modal (re)opens or the edit target changes.
    useEffect(() => {
        if (open) {
            setName(editing?.name ?? '');
            setBaseUrl(editing?.base_url ?? '');
            setApiKey('');
            setTestResult(null);
            setError('');
            setShowHelp(false);
        }
    }, [open, editing]);

    const fillExample = (ex: typeof HELP_EXAMPLES[number]) => {
        setName(ex.name);
        setBaseUrl(ex.url);
        if (ex.key === 'ollama') setApiKey('ollama');
        setTestResult(null);
        setError('');
    };

    if (!open) return null;

    const statusText = (r: ModelTestResult): string => {
        switch (r.status) {
            case 'ok': return t('components.customModel.testOk');
            case 'auth': return t('components.customModel.testAuth');
            case 'ratelimited': return t('components.customModel.testRateLimited');
            case 'reqerror': return t('components.customModel.testReqError');
            case 'unconfigured': return t('components.customModel.testUnconfigured');
            default: return t('components.customModel.testError');
        }
    };

    const checkNameUrl = (): string => {
        if (!name.trim()) return t('components.customModel.errName');
        if (!/^https?:\/\//i.test(baseUrl.trim())) return t('components.customModel.errUrl');
        return '';
    };

    const handleTest = async () => {
        setError('');
        setTestResult(null);
        const nu = checkNameUrl();
        if (nu) { setError(nu); return; }
        const hasTypedKey = apiKey.trim() !== '';
        if (!hasTypedKey && !editing) { setError(t('components.customModel.errKey')); return; }
        setTesting(true);
        try {
            const r = hasTypedKey
                ? await testCustomModelConfig({ name: name.trim(), base_url: baseUrl.trim(), api_key: apiKey.trim() })
                : await testCustomModel(editing!.id);
            setTestResult(r);
        } catch {
            setTestResult({ status: 'error', http: null, body: null, error: null, tokens: null });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        const nu = checkNameUrl();
        if (nu) { setError(nu); return; }
        if (!editing && !apiKey.trim()) { setError(t('components.customModel.errKey')); return; }
        setSaving(true);
        setError('');
        try {
            const model = editing
                ? await updateCustomModel(editing.id, {
                    name: name.trim(),
                    base_url: baseUrl.trim(),
                    ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
                })
                : await createCustomModel({ name: name.trim(), base_url: baseUrl.trim(), api_key: apiKey.trim() });
            onSaved(model);
            onClose();
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg || t('components.customModel.saveFail'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="cm-modal-overlay" onClick={onClose}>
            <div className="cm-modal" onClick={e => e.stopPropagation()}>
                <div className="cm-modal-titlerow">
                    <h3 className="cm-modal-title">{editing ? t('components.customModel.editTitle') : t('components.customModel.addTitle')}</h3>
                    <button
                        type="button"
                        className={`cm-help-btn${showHelp ? ' cm-help-active' : ''}`}
                        aria-label={t('components.customModel.helpAria')}
                        title={t('components.customModel.helpAria')}
                        onClick={() => setShowHelp(v => !v)}
                    >
                        <HelpCircle size={18} />
                    </button>
                </div>

                {showHelp && (
                    <div className="cm-help-panel">
                        <p className="cm-help-intro">{t('components.customModel.helpIntro')}</p>
                        <div className="cm-help-list">
                            {HELP_EXAMPLES.map(ex => (
                                <div key={ex.key} className="cm-help-item">
                                    <div className="cm-help-item-head">
                                        <span className="cm-help-provider">{t(`components.customModel.${ex.labelKey}`)}</span>
                                        <button type="button" className="cm-help-fill" onClick={() => fillExample(ex)}>
                                            {t('components.customModel.helpFill')}
                                        </button>
                                    </div>
                                    <div className="cm-help-kv"><span>{t('components.customModel.nameLabel')}</span><code>{ex.name}</code></div>
                                    <div className="cm-help-kv"><span>{t('components.customModel.urlLabel')}</span><code>{ex.url}</code></div>
                                    <div className="cm-help-kv"><span>{t('components.customModel.keyLabel')}</span><code>{ex.sk}</code></div>
                                </div>
                            ))}
                        </div>
                        <p className="cm-help-note">{t('components.customModel.helpNote')}</p>
                        <p className="cm-help-note">{t('components.customModel.helpReasoningNote')}</p>
                        <p className="cm-help-note">{t('components.customModel.helpOllamaNote')}</p>
                    </div>
                )}

                <label className="cm-field">
                    <span className="cm-field-label">{t('components.customModel.nameLabel')}</span>
                    <input className="cm-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('components.customModel.namePlaceholder')} />
                </label>

                <label className="cm-field">
                    <span className="cm-field-label">{t('components.customModel.urlLabel')}</span>
                    <input className="cm-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={t('components.customModel.urlPlaceholder')} />
                </label>

                <label className="cm-field">
                    <span className="cm-field-label">{t('components.customModel.keyLabel')}</span>
                    <input
                        className="cm-input"
                        type="password"
                        autoComplete="off"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder={editing ? editing.key_masked : t('components.customModel.keyPlaceholder')}
                    />
                    {editing && <span className="cm-hint">{t('components.customModel.keyKeepHint')}</span>}
                </label>

                {error && <div className="cm-error">{error}</div>}
                {testResult && (
                    <div className={`cm-test-result cm-test-${testResult.status}`}>
                        <span className="cm-test-dot" />
                        {statusText(testResult)}{testResult.http ? ` (HTTP ${testResult.http})` : ''}
                    </div>
                )}

                <div className="cm-modal-actions">
                    <button className="cm-btn cm-btn-ghost" onClick={handleTest} disabled={testing || saving}>
                        {testing ? t('components.customModel.testing') : t('components.customModel.test')}
                    </button>
                    <div className="cm-modal-actions-right">
                        <button className="cm-btn cm-btn-ghost" onClick={onClose} disabled={saving}>{t('components.customModel.cancel')}</button>
                        <button className="cm-btn cm-btn-primary" onClick={handleSave} disabled={saving || testing}>{t('components.customModel.save')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import {
    listCustomModels, deleteCustomModel, testCustomModel, testOfficialModel,
    type CustomModel, type ModelTestResult, type OfficialModelTestResult,
} from '../../api/custom_model';
import CustomModelModal from '../common/CustomModelModal';
import { BUILTIN_OPTIONS } from '../common/AiModelSelector';
import '../../styles/custom_model.css';

/** Settings-page panel: list the user's custom models with test / edit / delete + add. */
export default function CustomModelManager() {
    const { t } = useLang();

    const [models, setModels] = useState<CustomModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<CustomModel | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [testResults, setTestResults] = useState<Record<number, ModelTestResult>>({});
    const [officialTesting, setOfficialTesting] = useState<string | null>(null);
    const [officialResults, setOfficialResults] = useState<Record<string, OfficialModelTestResult>>({});
    const [officialErrors, setOfficialErrors] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setModels(await listCustomModels());
        } catch {
            /* non-fatal */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

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

    const handleTest = async (m: CustomModel) => {
        setTestingId(m.id);
        try {
            const r = await testCustomModel(m.id);
            setTestResults(prev => ({ ...prev, [m.id]: r }));
        } catch {
            setTestResults(prev => ({ ...prev, [m.id]: { status: 'error', http: null, body: null, error: null, tokens: null } }));
        } finally {
            setTestingId(null);
        }
    };

    const handleOfficialTest = async (provider: string) => {
        setOfficialTesting(provider);
        setOfficialErrors(prev => ({ ...prev, [provider]: '' }));
        try {
            const r = await testOfficialModel(provider);
            setOfficialResults(prev => ({ ...prev, [provider]: r }));
        } catch (e) {
            // On 400 (insufficient balance) or 429 (rate limited) the backend returns {error: message}; show it directly
            const msg = axios.isAxiosError(e)
                ? (e.response?.data as { error?: string } | undefined)?.error
                : undefined;
            setOfficialErrors(prev => ({ ...prev, [provider]: msg || t('components.customModel.testError') }));
            setOfficialResults(prev => {
                const next = { ...prev };
                delete next[provider];
                return next;
            });
        } finally {
            setOfficialTesting(null);
        }
    };

    const handleDelete = async (m: CustomModel) => {
        if (!window.confirm(t('components.customModel.deleteConfirm'))) return;
        try {
            await deleteCustomModel(m.id);
            setModels(prev => prev.filter(x => x.id !== m.id));
        } catch {
            window.alert(t('components.customModel.deleteFail'));
        }
    };

    const openAdd = () => { setEditing(null); setModalOpen(true); };
    const openEdit = (m: CustomModel) => { setEditing(m); setModalOpen(true); };

    const handleSaved = (saved: CustomModel) => {
        setModels(prev => {
            const idx = prev.findIndex(x => x.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [saved, ...prev];
        });
    };

    return (
        <div className="cm-manager">
            <div className="cm-manager-head">
                <div>
                    <h4 className="cm-manager-title">{t('components.customModel.managerTitle')}</h4>
                    <p className="cm-manager-desc">{t('components.customModel.managerDesc')}</p>
                </div>
                <button className="cm-add-btn" onClick={openAdd}>
                    <Plus size={15} /> {t('components.customModel.addBtn')}
                </button>
            </div>

            {!loading && models.length === 0 && <div className="cm-empty">{t('components.customModel.empty')}</div>}

            {models.length > 0 && (
                <div className="cm-list">
                    {models.map(m => {
                        const r = testResults[m.id];
                        return (
                            <div key={m.id} className="cm-row">
                                <div className="cm-row-info">
                                    <div className="cm-row-name">{m.name}</div>
                                    <div className="cm-row-key">{m.key_masked} · {m.base_url}</div>
                                    {r && (
                                        <span className={`cm-row-status cm-test-${r.status}`}>
                                            <span className="cm-test-dot" /> {statusText(r)}
                                        </span>
                                    )}
                                </div>
                                <div className="cm-row-actions">
                                    <button className="cm-row-btn" onClick={() => handleTest(m)} disabled={testingId === m.id}>
                                        {testingId === m.id ? t('components.customModel.testing') : t('components.customModel.test')}
                                    </button>
                                    <button className="cm-row-btn" onClick={() => openEdit(m)}>{t('components.customModel.edit')}</button>
                                    <button className="cm-row-btn cm-row-danger" onClick={() => handleDelete(m)}>{t('components.customModel.delete')}</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="cm-manager-head cm-official-head">
                <div>
                    <h4 className="cm-manager-title">{t('components.customModel.officialTitle')}</h4>
                    <p className="cm-manager-desc">{t('components.customModel.officialDesc')}</p>
                </div>
            </div>
            <div className="cm-list">
                {BUILTIN_OPTIONS.map(o => {
                    const r = officialResults[o.value];
                    const err = officialErrors[o.value];
                    return (
                        <div key={o.value} className="cm-row">
                            <div className="cm-row-info">
                                <div className="cm-row-name">{o.label}</div>
                                {r && (
                                    <span className={`cm-row-status cm-test-${r.status}`}>
                                        <span className="cm-test-dot" /> {statusText(r)}
                                        {r.status === 'ok' && ` · ${t('components.customModel.officialCostNote').replace('{n}', String(r.at_cost))}`}
                                    </span>
                                )}
                                {!r && err && (
                                    <span className="cm-row-status cm-test-error">
                                        <span className="cm-test-dot" /> {err}
                                    </span>
                                )}
                            </div>
                            <div className="cm-row-actions">
                                <button
                                    className="cm-row-btn"
                                    onClick={() => handleOfficialTest(o.value)}
                                    disabled={officialTesting !== null}
                                >
                                    {officialTesting === o.value ? t('components.customModel.testing') : t('components.customModel.test')}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <CustomModelModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSaved={handleSaved} />
        </div>
    );
}

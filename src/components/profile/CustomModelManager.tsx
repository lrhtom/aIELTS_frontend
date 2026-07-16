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
    const { translations } = useLang();
    const t = translations.components.customModel;

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
            case 'ok': return t.testOk;
            case 'auth': return t.testAuth;
            case 'ratelimited': return t.testRateLimited;
            case 'reqerror': return t.testReqError;
            case 'unconfigured': return t.testUnconfigured;
            default: return t.testError;
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
            // 400（余额不足）/ 429（限流）时后端返回 {error: 文案}，直接展示
            const msg = axios.isAxiosError(e)
                ? (e.response?.data as { error?: string } | undefined)?.error
                : undefined;
            setOfficialErrors(prev => ({ ...prev, [provider]: msg || t.testError }));
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
        if (!window.confirm(t.deleteConfirm)) return;
        try {
            await deleteCustomModel(m.id);
            setModels(prev => prev.filter(x => x.id !== m.id));
        } catch {
            window.alert(t.deleteFail);
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
                    <h4 className="cm-manager-title">{t.managerTitle}</h4>
                    <p className="cm-manager-desc">{t.managerDesc}</p>
                </div>
                <button className="cm-add-btn" onClick={openAdd}>
                    <Plus size={15} /> {t.addBtn}
                </button>
            </div>

            {!loading && models.length === 0 && <div className="cm-empty">{t.empty}</div>}

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
                                        {testingId === m.id ? t.testing : t.test}
                                    </button>
                                    <button className="cm-row-btn" onClick={() => openEdit(m)}>{t.edit}</button>
                                    <button className="cm-row-btn cm-row-danger" onClick={() => handleDelete(m)}>{t.delete}</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="cm-manager-head cm-official-head">
                <div>
                    <h4 className="cm-manager-title">{t.officialTitle}</h4>
                    <p className="cm-manager-desc">{t.officialDesc}</p>
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
                                        {r.status === 'ok' && ` · ${t.officialCostNote.replace('{n}', String(r.at_cost))}`}
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
                                    {officialTesting === o.value ? t.testing : t.test}
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

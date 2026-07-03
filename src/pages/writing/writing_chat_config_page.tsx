import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { getInitialVocabInput } from '../../store/word_selection_store';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { listPlans, getPlanDetail, type LearningPlan } from '../../api/learning_plan';
import { showToast } from '../../components/common/Toast';
import AiModelSelector from '../../components/common/AiModelSelector';
import '../../styles/practice_page.css';

export default function WritingChatConfigPage() {
    const { lang } = useLang();
    const t = translations[lang].writingChatConfig;
    const tAll = translations[lang];

    const [vocabInput, setVocabInput] = useState(() => getInitialVocabInput());
    const [useCustomVocab, setUseCustomVocab] = useState(false);

    // Plan Import State
    const [plans, setPlans] = useState<LearningPlan[]>([]);
    const [importPlanId, setImportPlanId] = useState(0);
    const [importingPlan, setImportingPlan] = useState(false);

    useEffect(() => {
        listPlans().then(({ plans: ps }) => {
            setPlans(ps);
            if (ps.length > 0) setImportPlanId(ps[0].id);
        }).catch(() => {});
    }, []);

    const navigate = useNavigate();

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
    };

    const handleImportPlan = async () => {
        if (!importPlanId) return;
        setImportingPlan(true);
        try {
            const { plan: detail } = await getPlanDetail(importPlanId);
            const todayWords = detail.today_words || [];
            if (todayWords.length === 0) {
                showToast(t.planNoWords, 'error');
                return;
            }
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            handleVocabChange(lines);
            if (skipped > 0) {
                showToast(t.planImportSkipped.replace('{n}', String(validWords.length)).replace('{s}', String(skipped)), 'error');
            } else {
                showToast(t.planImportSuccess.replace('{n}', String(validWords.length)), 'success');
            }
        } catch {
            showToast(t.planImportFailed, 'error');
        } finally {
            setImportingPlan(false);
        }
    };

    const handleStart = () => {
        navigate('/writing/chat', {
            state: {
                vocabInput: useCustomVocab ? vocabInput : '',
            },
        });
    };

    return (
        <Layout
            pageTitle={'💬 ' + t.heading}
            pageSubtitle={t.subheading}
            backUrl='/writing'
            backText={t.backToWriting}
        >
            <div className="uc-console">
                <div className="uc-main-content" style={{ borderLeft: 'none' }}>
                    <div className="uc-main-header">
                        <h2>{t.heading}</h2>
                        <p>{t.subheading}</p>
                    </div>

                    <div className="uc-settings-list">
                        <div className="uc-card-group">
                            {/* AI Model */}
                            <div className="uc-list-row">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>🤖</span>
                                        <span className="row-title">{tAll.components.aiModel.label}</span>
                                    </div>
                                </div>
                                <div className="uc-row-control console-model-selector">
                                    <AiModelSelector label="" description="" />
                                </div>
                            </div>
                        </div>

                        <div className="uc-card-group">
                            {/* Vocab Accordion */}
                            <div className={`uc-list-group uc-vocab-group ${useCustomVocab ? 'expanded' : ''}`} style={{ marginTop: 0, borderTop: 'none' }}>
                                <div className="uc-list-row" style={{ borderBottom: 'none' }}>
                                    <div className="uc-row-label">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#f43f5e', background: '#ffe4e6' }}>📚</span>
                                            <span className="row-title">{t.vocabSettings.title}</span>
                                        </div>
                                        <span className="row-desc" style={{ marginLeft: '40px' }}>{t.vocabSettings.desc}</span>
                                    </div>
                                    <div className="uc-row-control">
                                        <label className="toggle-switch-console">
                                            <input
                                                type="checkbox"
                                                checked={useCustomVocab}
                                                onChange={(e) => setUseCustomVocab(e.target.checked)}
                                            />
                                            <span className="toggle-slider-console" />
                                        </label>
                                    </div>
                                </div>
                                {useCustomVocab && (
                                    <div className="uc-vocab-body">
                                        {plans.length > 0 && (
                                            <div className="uc-vocab-toolbar">
                                                <select
                                                    className="console-select"
                                                    value={importPlanId}
                                                    onChange={e => setImportPlanId(Number(e.target.value))}
                                                >
                                                    <option value={0} disabled>{t.planImportPlaceholder}</option>
                                                    {plans.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="console-import-btn"
                                                    onClick={handleImportPlan}
                                                    disabled={importingPlan || !importPlanId}
                                                >
                                                    {importingPlan ? t.planImporting : t.planImportBtn}
                                                </button>
                                            </div>
                                        )}
                                        <VocabInput value={vocabInput} onChange={handleVocabChange} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="uc-console-footer">
                        <button className="uc-console-start-btn" onClick={handleStart}>
                            💬 {t.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

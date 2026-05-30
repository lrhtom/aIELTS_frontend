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
import '../../styles/speaking_page.css'; // Reusing some CSS for cards

export default function WritingChatConfigPage() {
    const { lang } = useLang();
    const t = translations[lang].writingChatConfig;

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
            <div className="practice-container">
                <div className="config-card">
                    <AiModelSelector />
                </div>

                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t.vocabSettings.title}</div>
                            <div className="label-desc">{t.vocabSettings.desc}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={useCustomVocab}
                                onChange={(e) => setUseCustomVocab(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                    {useCustomVocab && (
                        <>
                            {plans.length > 0 && (
                                <div className="plan-import-row">
                                    <select
                                        value={importPlanId}
                                        onChange={e => setImportPlanId(Number(e.target.value))}
                                        className="plan-import-select"
                                    >
                                        <option value={0} disabled>{t.planImportPlaceholder}</option>
                                        {plans.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        className="plan-import-btn"
                                        onClick={handleImportPlan}
                                        disabled={importingPlan || !importPlanId}
                                    >
                                        {importingPlan ? t.planImporting : t.planImportBtn}
                                    </button>
                                </div>
                            )}
                            <VocabInput
                                value={vocabInput}
                                onChange={handleVocabChange}
                            />
                        </>
                    )}
                </div>

                <div className="config-card">
                    <button
                        className="skill-btn" style={{ width: '100%' }}
                        onClick={handleStart}
                    >
                        {t.startBtn}
                    </button>
                </div>
            </div>
        </Layout>
    );
}

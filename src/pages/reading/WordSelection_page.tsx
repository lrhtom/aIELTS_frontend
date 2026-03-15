import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import VocabInput from '../../components/VocabInput';
import AiModelSelector from '../../components/common/AiModelSelector';
import { listPlans, listPlanWords, type LearningPlan } from '../../api/learning_plan';
import '../../styles/practice_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

export default function WordSelection_page() {
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState(() => localStorage.getItem('ielts_target_vocab') || '');
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');
    const [absurdMode, setAbsurdMode] = useState(false);
    const [plans, setPlans] = useState<LearningPlan[]>([]);
    const [importPlanId, setImportPlanId] = useState(0);
    const [importingPlan, setImportingPlan] = useState(false);

    const { lang } = useLang();
    const t = translations[lang].readingConfig;

    useEffect(() => {
        listPlans().then(({ plans: ps }) => {
            setPlans(ps);
            if (ps.length > 0) setImportPlanId(ps[0].id);
        }).catch(() => {});
    }, []);

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
        localStorage.setItem('ielts_target_vocab', val);
    };

    const handleImportPlan = async () => {
        if (!importPlanId) return;
        setImportingPlan(true);
        try {
            const plan = plans.find(p => p.id === importPlanId);
            const daily = plan?.daily_count ?? 20;
            const { entries } = await listPlanWords(importPlanId);
            const now = Date.now();
            // 到期（含已复习过的历史到期词）优先，其次新词，总量不超过 daily_count
            const dueWords  = entries.filter(e => e.fsrs_due && new Date(e.fsrs_due).getTime() <= now);
            const newWords  = entries.filter(e => !e.fsrs_due && e.fsrs_state === 0);
            const todayWords = [...dueWords, ...newWords].slice(0, daily);
            const lines = todayWords.map(e => `${e.word} - ${e.zh}`).join('\n');
            handleVocabChange(lines);
            showToast(`已导入 ${todayWords.length} 个单词`, 'success');
        } catch {
            showToast('导入失败', 'error');
        } finally {
            setImportingPlan(false);
        }
    };

    const handleStart = () => {
        if (useCustomVocab && !vocabInput.trim()) {
            showToast(t.toast.noVocab, 'error');
            return;
        }
        sessionStorage.removeItem('reading_session_cache');
        navigate('/reading', {
            state: {
                vocabInput: useCustomVocab ? vocabInput : '',
                difficulty,
                useCustomVocab,
                absurdMode,
            },
        });
    };

    return (
        <Layout>
            <div className="config-page-wrap reading-config">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">{t.backToAI}</Link>
                    <h1>{t.heading}</h1>
                    <p>{t.subheading}</p>
                </div>

                {/* AI Model Selector */}
                <div className="config-card">
                    <AiModelSelector />
                </div>

                {/* Difficulty */}
                <div className="config-card">
                    <h3>{t.targetScore}</h3>
                    <div className="difficulty-options">
                        {DIFFICULTIES.map(d => (
                            <button
                                key={d}
                                className={`difficulty-btn ${difficulty === d ? 'selected' : ''}`}
                                onClick={() => setDifficulty(d)}
                            >
                                Band {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Vocab Toggle */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t.customVocab.label}</div>
                            <div className="label-desc">{t.customVocab.desc}</div>
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
                                        className="plan-import-select"
                                        value={importPlanId}
                                        onChange={e => setImportPlanId(Number(e.target.value))}
                                    >
                                        {plans.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        className="plan-import-btn"
                                        onClick={handleImportPlan}
                                        disabled={importingPlan}
                                    >
                                        {importingPlan ? '导入中…' : '⬇ 导入今日单词'}
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

                {/* Absurd Mode Toggle */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t.absurdMode.label}</div>
                            <div className="label-desc">{t.absurdMode.desc}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={absurdMode}
                                onChange={(e) => setAbsurdMode(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Start Button */}
                <div className="config-card">
                    <button className="skill-btn reading" style={{ width: '100%' }} onClick={handleStart}>
                        <span className="btn-icon">📖</span> {t.startBtn}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
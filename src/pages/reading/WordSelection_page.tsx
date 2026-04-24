import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import VocabInput from '../../components/VocabInput';
import AiModelSelector from '../../components/common/AiModelSelector';
import { listPlans, getPlanDetail, type LearningPlan } from '../../api/learning_plan';
import '../../styles/practice_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];
type ReadingQuestionType = 'multiple_choice' | 'true_false';
type ReadingJudgementMode = 'easy' | 'normal';

export default function WordSelection_page() {
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState('');
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');
    const [questionType, setQuestionType] = useState<ReadingQuestionType>('multiple_choice');
    const [judgementMode, setJudgementMode] = useState<ReadingJudgementMode>('normal');
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
    };

    const handleImportPlan = async () => {
        if (!importPlanId) return;
        setImportingPlan(true);
        try {
            // 调用计划详情接口，获取后端 FSRS 精确计算的今日词汇队列
            const { plan: detail } = await getPlanDetail(importPlanId);
            const todayWords = detail.today_words || [];
            if (todayWords.length === 0) {
                showToast('该计划今日暂无待学单词', 'error');
                return;
            }
            // 过滤掉中文释义为空的单词（VocabInput 要求每行必须包含中文）
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            handleVocabChange(lines);
            if (skipped > 0) {
                showToast(`已导入 ${validWords.length} 个单词，${skipped} 个因缺少中文释义被跳过`, 'error');
            } else {
                showToast(`已导入 ${validWords.length} 个单词`, 'success');
            }
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
                questionType,
                judgementMode,
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

                {/* Question Type */}
                <div className="config-card">
                    <h3>{t.questionType.label}</h3>
                    <div className="reading-mode-grid">
                        <button
                            type="button"
                            className={`reading-mode-card ${questionType === 'multiple_choice' ? 'active' : ''}`}
                            onClick={() => setQuestionType('multiple_choice')}
                        >
                            <div className="reading-mode-card-title">{t.questionType.multipleChoice.title}</div>
                            <div className="reading-mode-card-desc">{t.questionType.multipleChoice.desc}</div>
                        </button>
                        <button
                            type="button"
                            className={`reading-mode-card ${questionType === 'true_false' ? 'active' : ''}`}
                            onClick={() => setQuestionType('true_false')}
                        >
                            <div className="reading-mode-card-title">{t.questionType.trueFalse.title}</div>
                            <div className="reading-mode-card-desc">{t.questionType.trueFalse.desc}</div>
                        </button>
                    </div>
                </div>

                {questionType === 'true_false' && (
                    <div className="config-card">
                        <h3>{t.judgementMode.label}</h3>
                        <div className="reading-mode-grid">
                            <button
                                type="button"
                                className={`reading-mode-card ${judgementMode === 'easy' ? 'active' : ''}`}
                                onClick={() => setJudgementMode('easy')}
                            >
                                <div className="reading-mode-card-title">{t.judgementMode.easy.title}</div>
                                <div className="reading-mode-card-desc">{t.judgementMode.easy.desc}</div>
                            </button>
                            <button
                                type="button"
                                className={`reading-mode-card ${judgementMode === 'normal' ? 'active' : ''}`}
                                onClick={() => setJudgementMode('normal')}
                            >
                                <div className="reading-mode-card-title">{t.judgementMode.normal.title}</div>
                                <div className="reading-mode-card-desc">{t.judgementMode.normal.desc}</div>
                            </button>
                        </div>
                    </div>
                )}

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
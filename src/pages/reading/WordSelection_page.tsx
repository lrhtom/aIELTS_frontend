import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const tAll = translations[lang];

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
                showToast(tAll.common.planImport.noWords, 'error');
                return;
            }
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            handleVocabChange(lines);
            if (skipped > 0) {
                showToast(tAll.common.planImport.skipped.replace('{n}', String(validWords.length)).replace('{s}', String(skipped)), 'error');
            } else {
                showToast(tAll.common.planImport.success.replace('{n}', String(validWords.length)), 'success');
            }
        } catch {
            showToast(tAll.common.planImport.failed, 'error');
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
        <Layout
    pageTitle={t.heading}
    pageSubtitle={t.subheading}
    backUrl='/practice/ai'
    backText={t.backToAI}
>
            <div className="uc-console">
                {/* ── 1. 左侧：模式切换列 (Sidebar) ── */}
                <div className="uc-sidebar">
                    <div className="uc-sidebar-title">{t.questionType.label}</div>
                    <nav className="uc-sidebar-nav">
                        <button
                            type="button"
                            className={`uc-nav-item ${questionType === 'multiple_choice' ? 'active' : ''}`}
                            onClick={() => setQuestionType('multiple_choice')}
                        >
                            <span className="nav-icon">🎯</span>
                            <span className="nav-text">{t.questionType.multipleChoice.title}</span>
                        </button>
                        <button
                            type="button"
                            className={`uc-nav-item ${questionType === 'true_false' ? 'active' : ''}`}
                            onClick={() => setQuestionType('true_false')}
                        >
                            <span className="nav-icon">✅</span>
                            <span className="nav-text">{t.questionType.trueFalse.title}</span>
                        </button>
                    </nav>
                </div>

                {/* ── 2. 右侧：配置明细区 (Main Content) ── */}
                <div className="uc-main-content">
                    <div className="uc-main-header">
                        <h2>{questionType === 'multiple_choice' ? t.questionType.multipleChoice.title : t.questionType.trueFalse.title}</h2>
                        <p>{questionType === 'multiple_choice' ? t.questionType.multipleChoice.desc : t.questionType.trueFalse.desc}</p>
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

                            {/* Difficulty */}
                            <div className="uc-list-row">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📊</span>
                                        <span className="row-title">{t.targetScore}</span>
                                    </div>
                                </div>
                                <div className="uc-row-control">
                                    <div className="uc-segmented-control">
                                        {DIFFICULTIES.map(d => (
                                            <button
                                                key={d}
                                                className={`seg-btn ${difficulty === d ? 'active' : ''}`}
                                                onClick={() => setDifficulty(d)}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Judgement Mode (only for true_false) */}
                            {questionType === 'true_false' && (
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>⚖️</span>
                                            <span className="row-title">{t.judgementMode.label}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <div className="uc-segmented-control">
                                            <button
                                                className={`seg-btn ${judgementMode === 'easy' ? 'active' : ''}`}
                                                onClick={() => setJudgementMode('easy')}
                                            >
                                                {t.judgementMode.easy.title}
                                            </button>
                                            <button
                                                className={`seg-btn ${judgementMode === 'normal' ? 'active' : ''}`}
                                                onClick={() => setJudgementMode('normal')}
                                            >
                                                {t.judgementMode.normal.title}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="uc-card-group">
                            {/* Absurd Mode Toggle */}
                            <div className="uc-list-row">
                                <div className="uc-row-label">
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#ec4899', background: '#fce7f3' }}>🎲</span>
                                        <span className="row-title">{t.absurdMode.label}</span>
                                    </div>
                                    <span className="row-desc" style={{ marginLeft: '40px' }}>{t.absurdMode.desc}</span>
                                </div>
                                <div className="uc-row-control">
                                    <label className="toggle-switch-console">
                                        <input type="checkbox" checked={absurdMode} onChange={e => setAbsurdMode(e.target.checked)} />
                                        <span className="toggle-slider-console" />
                                    </label>
                                </div>
                            </div>

                            {/* Vocab Accordion */}
                            <div className={`uc-list-group uc-vocab-group ${useCustomVocab ? 'expanded' : ''}`} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 0 }}>
                                <div className="uc-list-row" style={{ borderBottom: 'none' }}>
                                    <div className="uc-row-label">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#f43f5e', background: '#ffe4e6' }}>📚</span>
                                            <span className="row-title">{t.customVocab.label}</span>
                                        </div>
                                        <span className="row-desc" style={{ marginLeft: '40px' }}>{t.customVocab.desc}</span>
                                    </div>
                                    <div className="uc-row-control">
                                        <label className="toggle-switch-console">
                                            <input type="checkbox" checked={useCustomVocab} onChange={e => setUseCustomVocab(e.target.checked)} />
                                            <span className="toggle-slider-console" />
                                        </label>
                                    </div>
                                </div>
                                {useCustomVocab && (
                                    <div className="uc-vocab-body">
                                        {plans.length > 0 && (
                                            <div className="uc-vocab-toolbar">
                                                <select className="console-select" value={importPlanId} onChange={e => setImportPlanId(Number(e.target.value))}>
                                                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                                <button className="console-import-btn" onClick={handleImportPlan} disabled={importingPlan}>
                                                    {importingPlan ? tAll.common.planImport.importing : tAll.common.planImport.btn}
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
                        <button
                            className="uc-console-start-btn"
                            onClick={handleStart}
                        >
                            📖 {t.startBtn}
                        </button>
                    </div>
                </div>
            </div>
    </Layout>
    );
}
 
// force reload


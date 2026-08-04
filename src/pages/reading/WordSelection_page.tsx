import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import VocabInput from '../../components/VocabInput';
import AiModelSelector from '../../components/common/AiModelSelector';
import CustomPromptField from '../../components/common/CustomPromptField';
import { listPlans, getPlanDetail, sortPlansByFavorite, type LearningPlan } from '../../api/learning_plan';
import type { ReadingQuestionTypeKey, ReadingJudgementMode } from '../../api/reading';
import '../../styles/practice_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];
type PracticeMode = 'single' | 'full';

type GroupKey = 'choice' | 'judgement' | 'matching' | 'completion';

const QT_GROUPS: Record<GroupKey, ReadingQuestionTypeKey[]> = {
    choice: ['multiple_choice'],
    judgement: ['true_false', 'yes_no'],
    matching: ['matching_headings', 'matching_info', 'matching_features', 'matching_sentence'],
    completion: ['sentence_completion', 'summary_completion', 'note_completion', 'short_answer'],
};

const QT_ICON: Record<ReadingQuestionTypeKey, string> = {
    multiple_choice: '🎯',
    true_false: '✅',
    yes_no: '💭',
    matching_headings: '🏷️',
    matching_info: '🔍',
    matching_features: '🗂️',
    matching_sentence: '🔗',
    sentence_completion: '✏️',
    summary_completion: '📋',
    note_completion: '📝',
    short_answer: '❓',
};

const QT_KEY_TO_I18N: Record<ReadingQuestionTypeKey, keyof ReturnType<typeof getQTMap>> = {
    multiple_choice: 'multipleChoice',
    true_false: 'trueFalse',
    yes_no: 'yesNo',
    matching_headings: 'matchingHeadings',
    matching_info: 'matchingInfo',
    matching_features: 'matchingFeatures',
    matching_sentence: 'matchingSentence',
    sentence_completion: 'sentenceCompletion',
    summary_completion: 'summaryCompletion',
    note_completion: 'noteCompletion',
    short_answer: 'shortAnswer',
};

// Types whose answer word-limit slider should show
const COMPLETION_TYPES: ReadingQuestionTypeKey[] = ['sentence_completion', 'summary_completion', 'note_completion', 'short_answer'];

function getQTMap(t: ReturnType<typeof pickReading>['questionType']) {
    return {
        multipleChoice: t.multipleChoice,
        trueFalse: t.trueFalse,
        yesNo: t.yesNo,
        matchingHeadings: t.matchingHeadings,
        matchingInfo: t.matchingInfo,
        matchingFeatures: t.matchingFeatures,
        matchingSentence: t.matchingSentence,
        sentenceCompletion: t.sentenceCompletion,
        summaryCompletion: t.summaryCompletion,
        noteCompletion: t.noteCompletion,
        shortAnswer: t.shortAnswer,
    };
}

function pickReading(langObj: (typeof translations)['zh']) {
    return langObj.readingConfig;
}

export default function WordSelection_page() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<PracticeMode>('single');
    const [vocabInput, setVocabInput] = useState('');
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');
    const [questionType, setQuestionType] = useState<ReadingQuestionTypeKey>('multiple_choice');
    const [judgementMode, setJudgementMode] = useState<ReadingJudgementMode>('normal');
    const [topic, setTopic] = useState('random');
    const [wordCountMin, setWordCountMin] = useState(1);
    const [wordCountMax, setWordCountMax] = useState(3);
    const [absurdMode, setAbsurdMode] = useState(false);
    const [plans, setPlans] = useState<LearningPlan[]>([]);
    const [importPlanId, setImportPlanId] = useState(0);
    const [importingPlan, setImportingPlan] = useState(false);
    const [openGroup, setOpenGroup] = useState<GroupKey>('choice');
    // Full-test scope controls
    const [fullScope, setFullScope] = useState<'all' | 'single'>('all');
    const [passageNum, setPassageNum] = useState<1 | 2 | 3>(1);
    const [singleMix, setSingleMix] = useState<ReadingQuestionTypeKey[]>([]);
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');

    const { t } = useLang();
    const qtMap = useMemo(() => getQTMap(t('readingConfig.questionType', { returnObjects: true }) as ReturnType<typeof pickReading>['questionType']), [t]);

    useEffect(() => {
        listPlans().then(({ plans: ps }) => {
            setPlans(ps);
            if (ps.length > 0) setImportPlanId(ps[0].id);
        }).catch(() => {});
    }, []);

    // Keep open group in sync with selected type
    useEffect(() => {
        for (const [g, list] of Object.entries(QT_GROUPS) as [GroupKey, ReadingQuestionTypeKey[]][]) {
            if (list.includes(questionType)) {
                setOpenGroup(g);
                return;
            }
        }
    }, [questionType]);

    const currentQtCopy = qtMap[QT_KEY_TO_I18N[questionType]];

    const handleImportPlan = async () => {
        if (!importPlanId) return;
        setImportingPlan(true);
        try {
            const { plan: detail } = await getPlanDetail(importPlanId);
            const todayWords = detail.today_words || [];
            if (todayWords.length === 0) {
                showToast(t('common.planImport.noWords'), 'error');
                return;
            }
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            setVocabInput(lines);
            if (skipped > 0) {
                showToast(t('common.planImport.skipped').replace('{n}', String(validWords.length)).replace('{s}', String(skipped)), 'error');
            } else {
                showToast(t('common.planImport.success').replace('{n}', String(validWords.length)), 'success');
            }
        } catch {
            showToast(t('common.planImport.failed'), 'error');
        } finally {
            setImportingPlan(false);
        }
    };

    const handleMinChange = (v: number) => {
        setWordCountMin(v);
        if (v > wordCountMax) setWordCountMax(v);
    };
    const handleMaxChange = (v: number) => {
        setWordCountMax(v);
        if (v < wordCountMin) setWordCountMin(v);
    };

    const handleStart = () => {
        if (mode === 'single' && useCustomVocab && !vocabInput.trim()) {
            showToast(t('readingConfig.toast.noVocab'), 'error');
            return;
        }
        sessionStorage.removeItem('reading_session_cache');
        navigate('/reading', {
            state: {
                mode,
                vocabInput: useCustomVocab && mode === 'single' ? vocabInput : '',
                difficulty,
                useCustomVocab,
                absurdMode,
                questionType,
                judgementMode,
                topic,
                wordCountMin,
                wordCountMax,
                // Full-test scope
                fullScope: mode === 'full' ? fullScope : undefined,
                passageNum: mode === 'full' && fullScope === 'single' ? passageNum : undefined,
                mixTypes: mode === 'full' && fullScope === 'single' && singleMix.length > 0 ? singleMix : undefined,
                customName: customName.trim(),
                customDescription: customDescription.trim(),
                customPrompt: customPrompt.trim(),
            },
        });
    };

    const toggleMixType = (k: ReadingQuestionTypeKey) => {
        setSingleMix(prev => {
            if (prev.includes(k)) return prev.filter(x => x !== k);
            if (prev.length >= 3) return prev; // Keep polling while any child is still generating; the card flips itself to 'start'
            return [...prev, k];
        });
    };

    const showWordCount = mode === 'single' && COMPLETION_TYPES.includes(questionType);
    const showJudgement = mode === 'single' && questionType === 'true_false';

    return (
        <Layout
            pageTitle={t('readingConfig.heading')}
            pageSubtitle={t('readingConfig.subheading')}
            backUrl='/practice/ai'
            backText={t('readingConfig.backToAI')}
        >
            <div className="uc-console">
                {/* ── Sidebar ── */}
                <div className="uc-sidebar">
                    {/* Mode toggle */}
                    <div className="uc-sidebar-title" style={{ marginBottom: 8 }}>{t('readingConfig.modeToggle.label')}</div>
                    <div className="uc-segmented-control" style={{ marginBottom: 20 }}>
                        <button className={`seg-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>{t('readingConfig.modeToggle.single')}</button>
                        <button className={`seg-btn ${mode === 'full' ? 'active' : ''}`} onClick={() => setMode('full')}>{t('readingConfig.modeToggle.full')}</button>
                    </div>

                    {mode === 'single' && (
                        <>
                            <div className="uc-sidebar-title">{t('readingConfig.questionType.label')}</div>
                            <nav className="uc-sidebar-nav">
                                {(Object.entries(QT_GROUPS) as [GroupKey, ReadingQuestionTypeKey[]][]).map(([g, keys]) => (
                                    <div key={g} className="uc-nav-group">
                                        <button
                                            type="button"
                                            className={`uc-nav-group-header ${openGroup === g ? 'open' : ''}`}
                                            onClick={() => setOpenGroup(openGroup === g ? 'choice' : g)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'transparent', border: 'none', width: '100%', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}
                                        >
                                            <span>{openGroup === g ? '▾' : '▸'}</span>
                                            <span>{t(`readingConfig.questionType.groups.${g}`)}</span>
                                        </button>
                                        {openGroup === g && keys.map(k => (
                                            <button
                                                key={k}
                                                type="button"
                                                className={`uc-nav-item ${questionType === k ? 'active' : ''}`}
                                                onClick={() => setQuestionType(k)}
                                            >
                                                <span className="nav-icon">{QT_ICON[k]}</span>
                                                <span className="nav-text">{qtMap[QT_KEY_TO_I18N[k]].title}</span>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </nav>
                        </>
                    )}
                </div>

                {/* ── Main Content ── */}
                <div className="uc-main-content">
                    <div className="uc-main-header">
                        {mode === 'single' ? (
                            <>
                                <h2>{currentQtCopy.title}</h2>
                                <p>{currentQtCopy.desc}</p>
                            </>
                        ) : (
                            <>
                                <h2>{t('readingConfig.fullTest.title')}</h2>
                                <p>{t('readingConfig.fullTest.desc')} · {t('readingConfig.fullTest.summary')}</p>
                            </>
                        )}
                    </div>

                    <div className="uc-settings-list">
                        {/* Custom name + description (both optional) */}
                        <div className="uc-card-group">
                            <div className="uc-list-row uc-row-vertical">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>🏷️</span>
                                        <span className="row-title">{t('common.customQuestion.sectionTitle')}</span>
                                    </div>
                                    <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        {t('common.customQuestion.sectionDesc')}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                    <input
                                        type="text"
                                        maxLength={80}
                                        placeholder={t('common.customQuestion.namePlaceholder')}
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-surface)',
                                            color: 'var(--color-text)',
                                            fontSize: 14,
                                        }}
                                        aria-label={t('common.customQuestion.nameLabel')}
                                    />
                                    <textarea
                                        maxLength={300}
                                        rows={2}
                                        placeholder={t('common.customQuestion.descPlaceholder')}
                                        value={customDescription}
                                        onChange={e => setCustomDescription(e.target.value)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-surface)',
                                            color: 'var(--color-text)',
                                            fontSize: 14,
                                            resize: 'vertical',
                                            fontFamily: 'inherit',
                                        }}
                                        aria-label={t('common.customQuestion.descLabel')}
                                    />
                                </div>
                            </div>
                        </div>
                        {/* at most 3 types*/}
                        <div className="uc-card-group">
                            <CustomPromptField value={customPrompt} onChange={setCustomPrompt} />
                        </div>
                        {/* Full-test scope controls */}
                        {mode === 'full' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#0d9488', background: '#ccfbf1' }}>🎛️</span>
                                            <span className="row-title">{t('readingConfig.fullTest.scope.label')}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <div className="uc-segmented-control">
                                            <button className={`seg-btn ${fullScope === 'all' ? 'active' : ''}`} onClick={() => setFullScope('all')}>{t('readingConfig.fullTest.scope.all')}</button>
                                            <button className={`seg-btn ${fullScope === 'single' ? 'active' : ''}`} onClick={() => setFullScope('single')}>{t('readingConfig.fullTest.scope.single')}</button>
                                        </div>
                                    </div>
                                </div>
                                {fullScope === 'single' && (
                                    <>
                                        <div className="uc-list-row">
                                            <div className="uc-row-label-flex">
                                                <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>📑</span>
                                                    <span className="row-title">{t('readingConfig.fullTest.singlePassage.label')}</span>
                                                </div>
                                            </div>
                                            <div className="uc-row-control">
                                                <div className="uc-segmented-control">
                                                    {([1, 2, 3] as const).map(n => (
                                                        <button key={n} className={`seg-btn ${passageNum === n ? 'active' : ''}`} onClick={() => setPassageNum(n)}>
                                                            {t(`readingConfig.fullTest.singlePassage.p${n}`)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="uc-list-row uc-row-vertical">
                                            <div className="uc-row-label-flex">
                                                <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>🧩</span>
                                                    <span className="row-title">{t('readingConfig.fullTest.singleMix.label')} ({singleMix.length}/3)</span>
                                                </div>
                                                <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('readingConfig.fullTest.singleMix.desc')}</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                                {(Object.keys(QT_KEY_TO_I18N) as ReadingQuestionTypeKey[]).map(k => {
                                                    const active = singleMix.includes(k);
                                                    const disabled = !active && singleMix.length >= 3;
                                                    return (
                                                        <button
                                                            key={k}
                                                            type="button"
                                                            onClick={() => toggleMixType(k)}
                                                            disabled={disabled}
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: 20,
                                                                border: '1px solid',
                                                                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                                                                background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                                                                color: active ? 'white' : 'var(--color-text)',
                                                                fontSize: 13,
                                                                cursor: disabled ? 'not-allowed' : 'pointer',
                                                                opacity: disabled ? 0.4 : 1,
                                                            }}
                                                        >
                                                            {QT_ICON[k]} {qtMap[QT_KEY_TO_I18N[k]].title}
                                                        </button>
                                                    );
                                                })}
                                                {singleMix.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSingleMix([])}
                                                        style={{ padding: '6px 12px', borderRadius: 20, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer' }}
                                                    >
                                                        ✕ {t('readingConfig.fullTest.singleMix.clear')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="uc-card-group">
                            {/* AI Model */}
                            <div className="uc-list-row">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>🤖</span>
                                        <span className="row-title">{t('components.aiModel.label')}</span>
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
                                        <span className="row-title">{t('readingConfig.targetScore')}</span>
                                    </div>
                                </div>
                                <div className="uc-row-control">
                                    <div className="uc-segmented-control">
                                        {DIFFICULTIES.map(d => (
                                            <button key={d} className={`seg-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Topic dropdown */}
                            <div className="uc-list-row">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#10b981', background: '#d1fae5' }}>🏷️</span>
                                        <span className="row-title">{t('readingConfig.topic.label')}</span>
                                    </div>
                                    <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('readingConfig.topic.desc')}</span>
                                </div>
                                <div className="uc-row-control">
                                    <select className="console-select" value={topic} onChange={e => setTopic(e.target.value)}>
                                        <option value="random">{t('readingConfig.topic.random')}</option>
                                        {Object.entries(t('readingConfig.topic.list', { returnObjects: true }) as Record<string, string>).map(([key, name]) => (
                                            <option key={key} value={key}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Judgement Mode (TFNG only) */}
                            {showJudgement && (
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>⚖️</span>
                                            <span className="row-title">{t('readingConfig.judgementMode.label')}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <div className="uc-segmented-control">
                                            <button className={`seg-btn ${judgementMode === 'easy' ? 'active' : ''}`} onClick={() => setJudgementMode('easy')}>
                                                {t('readingConfig.judgementMode.easy.title')}
                                            </button>
                                            <button className={`seg-btn ${judgementMode === 'normal' ? 'active' : ''}`} onClick={() => setJudgementMode('normal')}>
                                                {t('readingConfig.judgementMode.normal.title')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Word Count (completion types only) */}
                            {showWordCount && (
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#6366f1', background: '#eef2ff' }}>🔢</span>
                                            <span className="row-title">{t('readingConfig.wordCount.label')}</span>
                                        </div>
                                        <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                            {wordCountMin === wordCountMax
                                                ? t('readingConfig.wordCount.hintExact').replace('{n}', String(wordCountMin))
                                                : t('readingConfig.wordCount.hintRange').replace('{min}', String(wordCountMin)).replace('{max}', String(wordCountMax))}
                                        </span>
                                    </div>
                                    <div className="wc-dual-sliders" style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
                                        <div className="wc-slider-row">
                                            <span className="wc-slider-label">{t('readingConfig.wordCount.min')}</span>
                                            <input type="range" min={1} max={4} step={1} value={wordCountMin} onChange={e => handleMinChange(Number(e.target.value))} />
                                            <span className="wc-val-badge">{wordCountMin}</span>
                                        </div>
                                        <div className="wc-slider-row" style={{ marginTop: 12 }}>
                                            <span className="wc-slider-label">{t('readingConfig.wordCount.max')}</span>
                                            <input type="range" min={1} max={4} step={1} value={wordCountMax} onChange={e => handleMaxChange(Number(e.target.value))} />
                                            <span className="wc-val-badge">{wordCountMax}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="uc-card-group">
                            {/* Absurd Mode */}
                            <div className="uc-list-row">
                                <div className="uc-row-label">
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#ec4899', background: '#fce7f3' }}>🎲</span>
                                        <span className="row-title">{t('readingConfig.absurdMode.label')}</span>
                                    </div>
                                    <span className="row-desc" style={{ marginLeft: 40 }}>{t('readingConfig.absurdMode.desc')}</span>
                                </div>
                                <div className="uc-row-control">
                                    <label className="toggle-switch-console">
                                        <input type="checkbox" checked={absurdMode} onChange={e => setAbsurdMode(e.target.checked)} />
                                        <span className="toggle-slider-console" />
                                    </label>
                                </div>
                            </div>

                            {/* Vocab (single mode only) */}
                            {mode === 'single' && (
                                <div className={`uc-list-group uc-vocab-group ${useCustomVocab ? 'expanded' : ''}`} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 0 }}>
                                    <div className="uc-list-row" style={{ borderBottom: 'none' }}>
                                        <div className="uc-row-label">
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#f43f5e', background: '#ffe4e6' }}>📚</span>
                                                <span className="row-title">{t('readingConfig.customVocab.label')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: 40 }}>{t('readingConfig.customVocab.desc')}</span>
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
                                                        {sortPlansByFavorite(plans).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                    <button className="console-import-btn" onClick={handleImportPlan} disabled={importingPlan}>
                                                        {importingPlan ? t('common.planImport.importing') : t('common.planImport.btn')}
                                                    </button>
                                                </div>
                                            )}
                                            <VocabInput value={vocabInput} onChange={setVocabInput} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="uc-console-footer">
                        <button className="uc-console-start-btn" onClick={handleStart}>
                            📖 {mode === 'full' ? t('readingConfig.fullTest.startBtn') : t('readingConfig.startBtn')}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

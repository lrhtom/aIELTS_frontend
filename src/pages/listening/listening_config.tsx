import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import VocabInput from '../../components/VocabInput';
import AiModelSelector from '../../components/common/AiModelSelector';
import { listPlans, getPlanDetail, sortPlansByFavorite, type LearningPlan } from '../../api/learning_plan';
import type { ListeningQuestionTypeKey, ListeningSectionKey } from '../../api/listening';
import '../../styles/practice_page.css';
import '../../styles/listening_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];
type PracticeMode = 'single' | 'full';
type GroupKey = 'completion' | 'choice' | 'matching' | 'other';

const QT_GROUPS: Record<GroupKey, ListeningQuestionTypeKey[]> = {
    completion: ['article', 'sentence', 'form', 'table', 'flowchart'],
    choice: ['multiple_choice'],
    matching: ['matching', 'map'],
    other: ['short_answer'],
};

const QT_ICON: Record<ListeningQuestionTypeKey, string> = {
    article: '📄',
    sentence: '✏️',
    multiple_choice: '🎯',
    map: '🗺️',
    form: '📋',
    table: '📊',
    flowchart: '🔀',
    matching: '🔗',
    short_answer: '❓',
};

const QT_KEY_TO_I18N: Record<ListeningQuestionTypeKey, 'article'|'sentence'|'multipleChoice'|'mapLabelling'|'form'|'table'|'flowchart'|'matching'|'shortAnswer'> = {
    article: 'article',
    sentence: 'sentence',
    multiple_choice: 'multipleChoice',
    map: 'mapLabelling',
    form: 'form',
    table: 'table',
    flowchart: 'flowchart',
    matching: 'matching',
    short_answer: 'shortAnswer',
};

const NO_WC_TYPES: ListeningQuestionTypeKey[] = ['multiple_choice', 'map', 'matching'];
// Which section pool each single-type belongs to (matches backend _default_section_for_type)
const QT_TO_SECTION: Record<ListeningQuestionTypeKey, ListeningSectionKey> = {
    form: 's1', table: 's1', short_answer: 's1',
    article: 's4', sentence: 's4', flowchart: 's4',
    map: 's2',
    multiple_choice: 's3', matching: 's3',
};

export default function ListeningConfig() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<PracticeMode>('single');
    const [vocabInput, setVocabInput] = useState('');
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');
    const [wordCountMin, setWordCountMin] = useState(1);
    const [wordCountMax, setWordCountMax] = useState(2);
    const [practiceType, setPracticeType] = useState<ListeningQuestionTypeKey>('article');
    const [absurdMode, setAbsurdMode] = useState(false);
    const [scenario, setScenario] = useState('random');
    const [scenarioS1, setScenarioS1] = useState('random');
    const [scenarioS2, setScenarioS2] = useState('random');
    const [scenarioS3, setScenarioS3] = useState('random');
    const [scenarioS4, setScenarioS4] = useState('random');
    const [plans, setPlans] = useState<LearningPlan[]>([]);
    const [importPlanId, setImportPlanId] = useState(0);
    const [importingPlan, setImportingPlan] = useState(false);
    const [openGroup, setOpenGroup] = useState<GroupKey>('completion');
    // Full-test scope controls
    const [fullScope, setFullScope] = useState<'all' | 'single'>('all');
    const [sectionNum, setSectionNum] = useState<1 | 2 | 3 | 4>(1);
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');

    const { lang } = useLang();
    const t = translations[lang].listeningConfig;
    const tAll = translations[lang];
    const qtMap = useMemo(() => ({
        article: t.practiceType.article,
        sentence: t.practiceType.sentence,
        multipleChoice: t.practiceType.multipleChoice,
        mapLabelling: t.practiceType.mapLabelling,
        form: t.practiceType.form,
        table: t.practiceType.table,
        flowchart: t.practiceType.flowchart,
        matching: t.practiceType.matching,
        shortAnswer: t.practiceType.shortAnswer,
    }), [t]);

    useEffect(() => {
        listPlans().then(({ plans: ps }) => {
            setPlans(ps);
            if (ps.length > 0) setImportPlanId(ps[0].id);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        for (const [g, list] of Object.entries(QT_GROUPS) as [GroupKey, ListeningQuestionTypeKey[]][]) {
            if (list.includes(practiceType)) {
                setOpenGroup(g);
                return;
            }
        }
    }, [practiceType]);

    // Reset scenario when practice type switches to a different section bucket
    useEffect(() => {
        setScenario('random');
    }, [practiceType]);

    const handleImportPlan = async () => {
        if (!importPlanId) return;
        setImportingPlan(true);
        try {
            const { plan: detail } = await getPlanDetail(importPlanId);
            const todayWords = detail.today_words || [];
            if (todayWords.length === 0) {
                showToast(tAll.common.planImport.noWords, 'error');
                return;
            }
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            setVocabInput(lines);
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
            showToast(t.toast.noVocab, 'error');
            return;
        }
        sessionStorage.removeItem('listening_session_cache');
        navigate('/listening', {
            state: {
                mode,
                vocabInput: useCustomVocab && mode === 'single' ? vocabInput : '',
                difficulty,
                useCustomVocab,
                wordCountMin,
                wordCountMax,
                practiceType,
                absurdMode,
                scenario,
                scenarioS1,
                scenarioS2,
                scenarioS3,
                scenarioS4,
                // Full-test scope
                fullScope: mode === 'full' ? fullScope : undefined,
                sectionNum: mode === 'full' && fullScope === 'single' ? sectionNum : undefined,
                customName: customName.trim(),
                customDescription: customDescription.trim(),
            },
        });
    };

    const currentCopy = qtMap[QT_KEY_TO_I18N[practiceType]];
    const showWordCount = mode === 'single' && !NO_WC_TYPES.includes(practiceType);
    const activeSectionKey = QT_TO_SECTION[practiceType];
    const scenarioListForType = t.scenario.list;
    const scenariosBySection: Record<ListeningSectionKey, [string, string][]> = {
        s1: ['accommodation','job_enquiry','gym_signup','travel_booking','library_signup','event_booking','restaurant_booking','phone_survey'].map(k => [k, scenarioListForType[k as keyof typeof scenarioListForType]]),
        s2: ['museum_tour','campus_orientation','park_intro','facility_opening','radio_show','event_announcement'].map(k => [k, scenarioListForType[k as keyof typeof scenarioListForType]]),
        s3: ['tutorial_discussion','group_project','thesis_meeting','assignment_review','research_planning'].map(k => [k, scenarioListForType[k as keyof typeof scenarioListForType]]),
        s4: ['history_lecture','science_lecture','social_science_lecture','business_lecture','health_lecture'].map(k => [k, scenarioListForType[k as keyof typeof scenarioListForType]]),
    };

    return (
        <Layout
            pageTitle={t.heading}
            pageSubtitle={t.subheading}
            backUrl='/practice/ai'
            backText={t.backToAI}
        >
            <div className="uc-console">
                {/* ── Sidebar ── */}
                <div className="uc-sidebar">
                    <div className="uc-sidebar-title" style={{ marginBottom: 8 }}>{t.modeToggle.label}</div>
                    <div className="uc-segmented-control" style={{ marginBottom: 20 }}>
                        <button className={`seg-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>{t.modeToggle.single}</button>
                        <button className={`seg-btn ${mode === 'full' ? 'active' : ''}`} onClick={() => setMode('full')}>{t.modeToggle.full}</button>
                    </div>

                    {mode === 'single' && (
                        <>
                            <div className="uc-sidebar-title">{t.practiceType.label}</div>
                            <nav className="uc-sidebar-nav">
                                {(Object.entries(QT_GROUPS) as [GroupKey, ListeningQuestionTypeKey[]][]).map(([g, keys]) => (
                                    <div key={g} className="uc-nav-group">
                                        <button
                                            type="button"
                                            className={`uc-nav-group-header ${openGroup === g ? 'open' : ''}`}
                                            onClick={() => setOpenGroup(openGroup === g ? 'completion' : g)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'transparent', border: 'none', width: '100%', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}
                                        >
                                            <span>{openGroup === g ? '▾' : '▸'}</span>
                                            <span>{t.practiceType.groups[g]}</span>
                                        </button>
                                        {openGroup === g && keys.map(k => (
                                            <button
                                                key={k}
                                                type="button"
                                                className={`uc-nav-item ${practiceType === k ? 'active' : ''}`}
                                                onClick={() => setPracticeType(k)}
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
                                <h2>{currentCopy.title}</h2>
                                <p>{currentCopy.desc}</p>
                            </>
                        ) : (
                            <>
                                <h2>{t.fullTest.title}</h2>
                                <p>{t.fullTest.desc} · {t.fullTest.summary}</p>
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
                                        <span className="row-title">{tAll.common.customQuestion.sectionTitle}</span>
                                    </div>
                                    <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        {tAll.common.customQuestion.sectionDesc}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                    <input
                                        type="text"
                                        maxLength={80}
                                        placeholder={tAll.common.customQuestion.namePlaceholder}
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
                                        aria-label={tAll.common.customQuestion.nameLabel}
                                    />
                                    <textarea
                                        maxLength={300}
                                        rows={2}
                                        placeholder={tAll.common.customQuestion.descPlaceholder}
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
                                        aria-label={tAll.common.customQuestion.descLabel}
                                    />
                                </div>
                            </div>
                        </div>
                        {/* Full-test scope controls */}
                        {mode === 'full' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#0d9488', background: '#ccfbf1' }}>🎛️</span>
                                            <span className="row-title">{t.fullTest.scope.label}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <div className="uc-segmented-control">
                                            <button className={`seg-btn ${fullScope === 'all' ? 'active' : ''}`} onClick={() => setFullScope('all')}>{t.fullTest.scope.all}</button>
                                            <button className={`seg-btn ${fullScope === 'single' ? 'active' : ''}`} onClick={() => setFullScope('single')}>{t.fullTest.scope.single}</button>
                                        </div>
                                    </div>
                                </div>
                                {fullScope === 'single' && (
                                    <div className="uc-list-row">
                                        <div className="uc-row-label-flex">
                                            <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>📑</span>
                                                <span className="row-title">{t.fullTest.singleSection.label}</span>
                                            </div>
                                        </div>
                                        <div className="uc-row-control">
                                            <select className="console-select" value={sectionNum} onChange={e => setSectionNum(Number(e.target.value) as 1 | 2 | 3 | 4)}>
                                                {([1, 2, 3, 4] as const).map(n => (
                                                    <option key={n} value={n}>
                                                        {t.fullTest.singleSection[`s${n}` as 's1' | 's2' | 's3' | 's4']}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

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
                                            <button key={d} className={`seg-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Scenario — single mode: one dropdown; full mode: 4 dropdowns */}
                            {mode === 'single' ? (
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#10b981', background: '#d1fae5' }}>🏷️</span>
                                            <span className="row-title">{t.scenario.label}</span>
                                        </div>
                                        <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t.scenario.desc}</span>
                                    </div>
                                    <div className="uc-row-control">
                                        <select className="console-select" value={scenario} onChange={e => setScenario(e.target.value)}>
                                            <option value="random">{t.scenario.random}</option>
                                            {scenariosBySection[activeSectionKey].map(([k, name]) => (
                                                <option key={k} value={k}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#10b981', background: '#d1fae5' }}>🏷️</span>
                                            <span className="row-title">{t.scenario.label}</span>
                                        </div>
                                        <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t.scenario.desc}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: fullScope === 'single' ? '1fr' : '1fr 1fr', gap: 12, marginTop: 12 }}>
                                        {(fullScope === 'single'
                                            ? ([`s${sectionNum}` as ListeningSectionKey])
                                            : (['s1','s2','s3','s4'] as ListeningSectionKey[])
                                        ).map(sk => {
                                            const val = sk === 's1' ? scenarioS1 : sk === 's2' ? scenarioS2 : sk === 's3' ? scenarioS3 : scenarioS4;
                                            const setter = sk === 's1' ? setScenarioS1 : sk === 's2' ? setScenarioS2 : sk === 's3' ? setScenarioS3 : setScenarioS4;
                                            return (
                                                <div key={sk}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{t.scenario.sectionLabels[sk]}</div>
                                                    <select className="console-select" value={val} onChange={e => setter(e.target.value)} style={{ width: '100%' }}>
                                                        <option value="random">{t.scenario.random}</option>
                                                        {scenariosBySection[sk].map(([k, name]) => (
                                                            <option key={k} value={k}>{name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Word Count */}
                            {showWordCount && (
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#6366f1', background: '#eef2ff' }}>🔢</span>
                                            <span className="row-title">{t.wordCount.label}</span>
                                        </div>
                                        <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                            {wordCountMin === wordCountMax
                                                ? t.wordCount.hintExact.replace('{n}', String(wordCountMin))
                                                : t.wordCount.hintRange.replace('{min}', String(wordCountMin)).replace('{max}', String(wordCountMax))}
                                        </span>
                                    </div>
                                    <div className="wc-dual-sliders" style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
                                        <div className="wc-slider-row">
                                            <span className="wc-slider-label">{t.wordCount.min}</span>
                                            <div className="wc-slider-track-wrap">
                                                <input type="range" className="wc-single-range" min={1} max={3} step={1} value={wordCountMin}
                                                    style={{ '--pct': `${((wordCountMin - 1) / 2) * 100}%` } as React.CSSProperties}
                                                    onChange={e => handleMinChange(Number(e.target.value))} />
                                                <div className="wc-ticks">
                                                    {[1, 2, 3].map(n => <span key={n} className={`wc-tick${n <= wordCountMin ? ' active' : ''}`}>{n}</span>)}
                                                </div>
                                            </div>
                                            <span className="wc-val-badge">{wordCountMin}</span>
                                        </div>
                                        <div className="wc-slider-row" style={{ marginTop: 12 }}>
                                            <span className="wc-slider-label">{t.wordCount.max}</span>
                                            <div className="wc-slider-track-wrap">
                                                <input type="range" className="wc-single-range" min={1} max={3} step={1} value={wordCountMax}
                                                    style={{ '--pct': `${((wordCountMax - 1) / 2) * 100}%` } as React.CSSProperties}
                                                    onChange={e => handleMaxChange(Number(e.target.value))} />
                                                <div className="wc-ticks">
                                                    {[1, 2, 3].map(n => <span key={n} className={`wc-tick${n <= wordCountMax ? ' active' : ''}`}>{n}</span>)}
                                                </div>
                                            </div>
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
                                        <span className="row-title">{t.absurdMode.label}</span>
                                    </div>
                                    <span className="row-desc" style={{ marginLeft: 40 }}>{t.absurdMode.desc}</span>
                                </div>
                                <div className="uc-row-control">
                                    <label className="toggle-switch-console">
                                        <input type="checkbox" checked={absurdMode} onChange={e => setAbsurdMode(e.target.checked)} />
                                        <span className="toggle-slider-console" />
                                    </label>
                                </div>
                            </div>

                            {mode === 'single' && (
                                <div className={`uc-list-group uc-vocab-group ${useCustomVocab ? 'expanded' : ''}`} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 0 }}>
                                    <div className="uc-list-row" style={{ borderBottom: 'none' }}>
                                        <div className="uc-row-label">
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#f43f5e', background: '#ffe4e6' }}>📚</span>
                                                <span className="row-title">{t.customVocab.label}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: 40 }}>{t.customVocab.desc}</span>
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
                                                        {importingPlan ? tAll.common.planImport.importing : tAll.common.planImport.btn}
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
                            🎧 {mode === 'full' ? t.fullTest.startBtn : t.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

// Full mock, generation config page - same sidebar layout as the other question editors:
// the left sidebar navigates listening -> reading -> writing -> speaking -> start, the right edits that skill's detail,
// and the last step (start) shows global settings + exam rules + the generate button. Submitting returns 202 and the bank's 'full mock' tab shows progress.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { generateMock } from '../../api/mock';
import { getReadingMeta, type ReadingMeta } from '../../api/reading';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

// Scenario pool per section (same as listening_config.tsx; labels come from listeningConfig.scenario.list)
const SCENARIOS_BY_SECTION: Record<1 | 2 | 3 | 4, string[]> = {
    1: ['accommodation', 'job_enquiry', 'gym_signup', 'travel_booking', 'library_signup', 'event_booking', 'restaurant_booking', 'phone_survey'],
    2: ['museum_tour', 'campus_orientation', 'park_intro', 'facility_opening', 'radio_show', 'event_announcement'],
    3: ['tutorial_discussion', 'group_project', 'thesis_meeting', 'assignment_review', 'research_planning'],
    4: ['history_lecture', 'science_lecture', 'social_science_lecture', 'business_lecture', 'health_lecture'],
};

const TASK1_TYPES = ['random', 'line', 'bar', 'pie', 'horizontal', 'table', 'mixed', 'flowchart', 'map'] as const;
const TASK2_TYPES = ['opinion', 'report', 'mixed', 'random', 'innovation'] as const;
const TASK2_TOPICS = ['all', 'education', 'technology', 'culture', 'urbanization', 'government', 'environment', 'media', 'society', 'abstract', 'random', 'innovation'] as const;

const STEPS = ['listening', 'reading', 'writing', 'speaking', 'overview'] as const;
type Step = typeof STEPS[number];
const STEP_ICON: Record<Step, string> = {
    listening: '🎧', reading: '📖', writing: '✍️', speaking: '🗣️', overview: '🚀',
};

/** The random Task 2 essay type is settled on the client (same draw logic as task2_selection_page) */
function resolveTask2Type(selected: string): string {
    if (selected !== 'random') return selected;
    const mainPool = ['opinion', 'report', 'mixed', 'innovation'];
    const main = mainPool[Math.floor(Math.random() * mainPool.length)];
    if (main === 'opinion') {
        const opinionPool = ['opinion_agree', 'opinion_discuss', 'opinion_advantages'];
        return opinionPool[Math.floor(Math.random() * opinionPool.length)];
    }
    return main;
}

export default function MockConfigPage() {
    const navigate = useNavigate();
    const { t } = useLang();

    const [step, setStep] = useState<Step>('listening');
    const [difficulty, setDifficulty] = useState('7.0');
    const [absurdMode, setAbsurdMode] = useState(false);
    const [customName, setCustomName] = useState('');
    const [scenarios, setScenarios] = useState<Record<1 | 2 | 3 | 4, string>>({ 1: 'random', 2: 'random', 3: 'random', 4: 'random' });
    const [readingTopic, setReadingTopic] = useState('random');
    const [task1Type, setTask1Type] = useState<string>('random');
    const [task2Type, setTask2Type] = useState<string>('opinion');
    const [task2Topic, setTask2Topic] = useState<string>('all');
    const [readingMeta, setReadingMeta] = useState<ReadingMeta | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getReadingMeta().then(setReadingMeta).catch(() => {});
    }, []);

    const scenarioLabels = t('listeningConfig.scenario.list', { returnObjects: true }) as Record<string, string>;
    const sectionLabels = t('listeningConfig.scenario.sectionLabels', { returnObjects: true }) as Record<string, string>;

    const task1Label = (key: string): string => {
        if (key === 'random') return t('mock.config.writing.task1Random');
        if (key === 'flowchart') return t('task1Selection.types.flowchart.title');
        if (key === 'map') return t('task1Selection.types.map.title');
        const chartTypes = t('chartSelection.types', { returnObjects: true }) as Record<string, { title: string }>;
        return chartTypes[key]?.title ?? key;
    };
    const task2Label = (key: string): string => {
        const types = t('task2Selection.types', { returnObjects: true }) as Record<string, { title: string }>;
        return types[key]?.title ?? key;
    };
    const task2TopicLabel = (key: string): string => {
        const topics = t('task2Selection.topics', { returnObjects: true }) as Record<string, string>;
        return topics[key] ?? key;
    };

    const stepIndex = STEPS.indexOf(step);
    const isLast = stepIndex === STEPS.length - 1;

    const headerCopy = useMemo(() => {
        switch (step) {
            case 'listening': return { title: t('mock.config.listening.title'), desc: t('mock.config.listening.desc') };
            case 'reading': return { title: t('mock.config.reading.title'), desc: t('mock.config.reading.desc') };
            case 'writing': return { title: t('mock.config.writing.title'), desc: t('mock.config.writing.desc') };
            case 'speaking': return { title: t('mock.config.speaking.title'), desc: t('mock.config.speaking.desc') };
            case 'overview': return { title: t('mock.config.overview.title'), desc: t('mock.config.overview.desc') };
        }
    }, [step, t]);

    const handleGenerate = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const resp = await generateMock({
                difficulty,
                absurdMode,
                customName: customName.trim(),
                scenarioS1: scenarios[1],
                scenarioS2: scenarios[2],
                scenarioS3: scenarios[3],
                scenarioS4: scenarios[4],
                readingTopic,
                task1Type,
                task2Type: resolveTask2Type(task2Type),
                task2TopicCategory: task2Topic,
            });
            showToast(t('mock.config.toastCreated'), 'success');
            navigate(`/practice/ai/bank?skill=mock&just=${resp.mockId}`);
        } catch (err) {
            showToast(t('mock.config.toastFail').replace('{msg}', (err as Error).message ?? ''), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout
            pageTitle={t('mock.config.pageTitle')}
            pageSubtitle={t('mock.config.pageSubtitle')}
            backUrl="/practice/ai"
            backText={t('mock.config.backToAI')}
        >
            <div className="uc-console">
                {/* ── Sidebar ── */}
                <div className="uc-sidebar">
                    <div className="uc-sidebar-title" style={{ marginBottom: 8 }}>{t('mock.config.nav.sectionTitle')}</div>
                    <nav className="uc-sidebar-nav">
                        {STEPS.map((s, i) => (
                            <button
                                key={s}
                                type="button"
                                className={`uc-nav-item ${step === s ? 'active' : ''}`}
                                onClick={() => setStep(s)}
                            >
                                <span className="nav-icon">{STEP_ICON[s]}</span>
                                <span className="nav-text">{`${i + 1}. ${t(`mock.config.nav.${s}`)}`}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ── Main Content ── */}
                <div className="uc-main-content">
                    <div className="uc-main-header">
                        <h2>{headerCopy.title}</h2>
                        <p>{headerCopy.desc}</p>
                    </div>

                    <div className="uc-settings-list">
                        {/* -- Listening -- */}
                        {step === 'listening' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#10b981', background: '#d1fae5' }}>🏷️</span>
                                            <span className="row-title">{t('listeningConfig.scenario.label')}</span>
                                        </div>
                                        <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t('listeningConfig.scenario.desc')}</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
                                        {([1, 2, 3, 4] as const).map(n => (
                                            <div key={n}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                                                    {sectionLabels[`s${n}` as keyof typeof sectionLabels]}
                                                </div>
                                                <select
                                                    className="console-select"
                                                    value={scenarios[n]}
                                                    onChange={e => setScenarios(prev => ({ ...prev, [n]: e.target.value }))}
                                                    style={{ width: '100%' }}
                                                >
                                                    <option value="random">{t('mock.config.listening.random')}</option>
                                                    {SCENARIOS_BY_SECTION[n].map(key => (
                                                        <option key={key} value={key}>{scenarioLabels[key] ?? key}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* -- Reading -- */}
                        {step === 'reading' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📚</span>
                                            <span className="row-title">{t('mock.config.reading.topicLabel')}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <select className="console-select" value={readingTopic} onChange={e => setReadingTopic(e.target.value)}>
                                            <option value="random">{t('mock.config.reading.random')}</option>
                                            {(readingMeta?.topics ?? []).filter(x => x.key !== 'random').map(x => (
                                                <option key={x.key} value={x.key}>{x.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* -- Writing -- */}
                        {step === 'writing' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>📊</span>
                                            <span className="row-title">{t('mock.config.writing.task1Label')}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <select className="console-select" value={task1Type} onChange={e => setTask1Type(e.target.value)}>
                                            {TASK1_TYPES.map(key => <option key={key} value={key}>{task1Label(key)}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>🖋️</span>
                                            <span className="row-title">{t('mock.config.writing.task2Label')}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <select className="console-select" value={task2Type} onChange={e => setTask2Type(e.target.value)}>
                                            {TASK2_TYPES.map(key => <option key={key} value={key}>{task2Label(key)}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="uc-list-row">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#ec4899', background: '#fce7f3' }}>🗂️</span>
                                            <span className="row-title">{t('mock.config.writing.task2TopicLabel')}</span>
                                        </div>
                                    </div>
                                    <div className="uc-row-control">
                                        <select className="console-select" value={task2Topic} onChange={e => setTask2Topic(e.target.value)}>
                                            {TASK2_TOPICS.map(key => <option key={key} value={key}>{task2TopicLabel(key)}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* -- Speaking -- */}
                        {step === 'speaking' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#0d9488', background: '#ccfbf1' }}>🎤</span>
                                            <span className="row-title">{t('mock.hub.parts.speaking')}</span>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{t('mock.config.speaking.noConfig')}</div>
                                </div>
                            </div>
                        )}

                        {/* -- Start (global settings + rules + generate) -- */}
                        {step === 'overview' && (
                            <>
                                <div className="uc-card-group">
                                    {/* Difficulty */}
                                    <div className="uc-list-row">
                                        <div className="uc-row-label-flex">
                                            <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📊</span>
                                                <span className="row-title">{t('mock.config.global.difficulty')}</span>
                                            </div>
                                        </div>
                                        <div className="uc-row-control">
                                            <div className="uc-segmented-control">
                                                {DIFFICULTIES.map(d => (
                                                    <button key={d} className={`seg-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>{d}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Custom name */}
                                    <div className="uc-list-row uc-row-vertical">
                                        <div className="uc-row-label-flex">
                                            <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#6366f1', background: '#eef2ff' }}>🏷️</span>
                                                <span className="row-title">{t('mock.config.global.customName')}</span>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            maxLength={80}
                                            placeholder={t('mock.config.global.customNamePlaceholder')}
                                            value={customName}
                                            onChange={e => setCustomName(e.target.value)}
                                            style={{
                                                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                                                border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                                                color: 'var(--color-text)', fontSize: 14,
                                            }}
                                        />
                                    </div>
                                    {/* Absurd mode */}
                                    <div className="uc-list-row">
                                        <div className="uc-row-label">
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#ec4899', background: '#fce7f3' }}>🎲</span>
                                                <span className="row-title">{t('mock.config.global.absurdMode')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: 40 }}>{t('mock.config.global.absurdModeDesc')}</span>
                                        </div>
                                        <div className="uc-row-control">
                                            <label className="toggle-switch-console">
                                                <input type="checkbox" checked={absurdMode} onChange={e => setAbsurdMode(e.target.checked)} />
                                                <span className="toggle-slider-console" />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* exam rules */}
                                <div className="uc-card-group" style={{ border: '1px solid var(--color-primary)' }}>
                                    <div className="uc-list-row uc-row-vertical">
                                        <span className="row-title" style={{ fontSize: 15, fontWeight: 700 }}>{t('mock.config.rules.title')}</span>
                                        <ul style={{ margin: '10px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {(t('mock.config.rules.items', { returnObjects: true }) as string[]).map((item, i) => (
                                                <li key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="uc-console-footer" style={{ justifyContent: 'space-between', gap: 12 }}>
                        <button
                            type="button"
                            className="uc-console-prev-btn"
                            onClick={() => setStep(STEPS[stepIndex - 1])}
                            style={{ visibility: stepIndex === 0 ? 'hidden' : 'visible' }}
                        >
                            ← {t('mock.config.prev')}
                        </button>
                        {isLast ? (
                            <button
                                className={`uc-console-start-btn ${submitting ? 'disabled' : ''}`}
                                onClick={handleGenerate}
                                disabled={submitting}
                            >
                                {submitting ? t('mock.config.generating') : t('mock.config.startBtn')}
                            </button>
                        ) : (
                            <button
                                className="uc-console-start-btn"
                                onClick={() => setStep(STEPS[stepIndex + 1])}
                            >
                                {t('mock.config.next')} →
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

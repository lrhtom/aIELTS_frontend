// 全套模拟 · 生成配置页 — 听/读/写/说四科全套配置的集合体。
// 提交后 202 返回，跳转题库「全套模拟」tab 查看生成进度。
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { generateMock } from '../../api/mock';
import { getReadingMeta, type ReadingMeta } from '../../api/reading';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

// 各 Section 的场景池（与 listening_config.tsx 一致，label 走 listeningConfig.scenario.list）
const SCENARIOS_BY_SECTION: Record<1 | 2 | 3 | 4, string[]> = {
    1: ['accommodation', 'job_enquiry', 'gym_signup', 'travel_booking', 'library_signup', 'event_booking', 'restaurant_booking', 'phone_survey'],
    2: ['museum_tour', 'campus_orientation', 'park_intro', 'facility_opening', 'radio_show', 'event_announcement'],
    3: ['tutorial_discussion', 'group_project', 'thesis_meeting', 'assignment_review', 'research_planning'],
    4: ['history_lecture', 'science_lecture', 'social_science_lecture', 'business_lecture', 'health_lecture'],
};

const TASK1_TYPES = ['random', 'line', 'bar', 'pie', 'horizontal', 'table', 'mixed', 'flowchart', 'map'] as const;
const TASK2_TYPES = ['opinion', 'report', 'mixed', 'random', 'innovation'] as const;
const TASK2_TOPICS = ['all', 'education', 'technology', 'culture', 'urbanization', 'government', 'environment', 'media', 'society', 'abstract', 'random', 'innovation'] as const;

/** random 大作文题型在前端定型（与 task2_selection_page 的抽取逻辑一致） */
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

const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 14,
    minWidth: 200,
};

export default function MockConfigPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const tAll = translations[lang];
    const t = tAll.mock.config;

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

    const scenarioLabels = tAll.listeningConfig.scenario.list;
    const sectionLabels = tAll.listeningConfig.scenario.sectionLabels;

    const task1Label = (key: string): string => {
        if (key === 'random') return t.writing.task1Random;
        if (key === 'flowchart') return tAll.task1Selection.types.flowchart.title;
        if (key === 'map') return tAll.task1Selection.types.map.title;
        const chartTypes = tAll.chartSelection.types as Record<string, { title: string }>;
        return chartTypes[key]?.title ?? key;
    };
    const task2Label = (key: string): string => {
        const types = tAll.task2Selection.types as Record<string, { title: string }>;
        return types[key]?.title ?? key;
    };
    const task2TopicLabel = (key: string): string => {
        const topics = tAll.task2Selection.topics as Record<string, string>;
        return topics[key] ?? key;
    };

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
            showToast(t.toastCreated, 'success');
            navigate(`/practice/ai/bank?skill=mock&just=${resp.mockId}`);
        } catch (err) {
            showToast(t.toastFail.replace('{msg}', (err as Error).message ?? ''), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const sectionCard = (title: string, desc: string, body: React.ReactNode) => (
        <div className="uc-card-group" style={{ marginBottom: 16 }}>
            <div className="uc-list-row uc-row-vertical">
                <div className="uc-row-label-flex">
                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <span className="row-title" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
                    </div>
                    <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{desc}</span>
                </div>
                <div style={{ marginTop: 12 }}>{body}</div>
            </div>
        </div>
    );

    return (
        <Layout
            pageTitle={t.pageTitle}
            pageSubtitle={t.pageSubtitle}
            backUrl="/practice/ai"
            backText={t.backToAI}
        >
            <div className="uc-console" style={{ display: 'block', maxWidth: 860, margin: '0 auto' }}>
                <div className="uc-main-content" style={{ width: '100%' }}>
                    <div className="uc-settings-list">

                        {/* ── 考试规则 ── */}
                        <div className="uc-card-group" style={{ marginBottom: 16, border: '1px solid var(--color-primary)', borderRadius: 12 }}>
                            <div className="uc-list-row uc-row-vertical">
                                <span className="row-title" style={{ fontSize: 15, fontWeight: 700 }}>{t.rules.title}</span>
                                <ul style={{ margin: '10px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {t.rules.items.map((item, i) => (
                                        <li key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* ── 全局设置 ── */}
                        {sectionCard(`⚙️ ${t.global.title}`, '', (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, minWidth: 160 }}>{t.global.difficulty}</span>
                                    <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={selectStyle}>
                                        {DIFFICULTIES.map(d => <option key={d} value={d}>Band {d}</option>)}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, minWidth: 160 }}>{t.global.customName}</span>
                                    <input
                                        type="text"
                                        maxLength={80}
                                        placeholder={t.global.customNamePlaceholder}
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        style={{ ...selectStyle, flex: 1, minWidth: 240 }}
                                    />
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, minWidth: 160 }}>{t.global.absurdMode}</span>
                                    <input type="checkbox" checked={absurdMode} onChange={e => setAbsurdMode(e.target.checked)} />
                                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{t.global.absurdModeDesc}</span>
                                </label>
                            </div>
                        ))}

                        {/* ── 听力 ── */}
                        {sectionCard(t.listening.title, t.listening.desc, (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                                {([1, 2, 3, 4] as const).map(n => (
                                    <label key={n} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                            {sectionLabels[`s${n}` as keyof typeof sectionLabels]}
                                        </span>
                                        <select
                                            value={scenarios[n]}
                                            onChange={e => setScenarios(prev => ({ ...prev, [n]: e.target.value }))}
                                            style={selectStyle}
                                        >
                                            <option value="random">{t.listening.random}</option>
                                            {SCENARIOS_BY_SECTION[n].map(key => (
                                                <option key={key} value={key}>{scenarioLabels[key] ?? key}</option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </div>
                        ))}

                        {/* ── 阅读 ── */}
                        {sectionCard(t.reading.title, t.reading.desc, (
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14, minWidth: 160 }}>{t.reading.topicLabel}</span>
                                <select value={readingTopic} onChange={e => setReadingTopic(e.target.value)} style={selectStyle}>
                                    <option value="random">{t.reading.random}</option>
                                    {(readingMeta?.topics ?? []).filter(x => x.key !== 'random').map(x => (
                                        <option key={x.key} value={x.key}>{x.name}</option>
                                    ))}
                                </select>
                            </label>
                        ))}

                        {/* ── 写作 ── */}
                        {sectionCard(t.writing.title, t.writing.desc, (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, minWidth: 160 }}>{t.writing.task1Label}</span>
                                    <select value={task1Type} onChange={e => setTask1Type(e.target.value)} style={selectStyle}>
                                        {TASK1_TYPES.map(key => <option key={key} value={key}>{task1Label(key)}</option>)}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, minWidth: 160 }}>{t.writing.task2Label}</span>
                                    <select value={task2Type} onChange={e => setTask2Type(e.target.value)} style={selectStyle}>
                                        {TASK2_TYPES.map(key => <option key={key} value={key}>{task2Label(key)}</option>)}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 14, minWidth: 160 }}>{t.writing.task2TopicLabel}</span>
                                    <select value={task2Topic} onChange={e => setTask2Topic(e.target.value)} style={selectStyle}>
                                        {TASK2_TOPICS.map(key => <option key={key} value={key}>{task2TopicLabel(key)}</option>)}
                                    </select>
                                </label>
                            </div>
                        ))}

                        {/* ── 口语 ── */}
                        {sectionCard(t.speaking.title, t.speaking.desc, (
                            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{t.speaking.noConfig}</div>
                        ))}

                        <button
                            className="start-practice-btn"
                            onClick={handleGenerate}
                            disabled={submitting}
                            style={{
                                width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 700,
                                borderRadius: 12, border: 'none', cursor: submitting ? 'wait' : 'pointer',
                                background: 'var(--color-primary)', color: '#fff', marginTop: 8,
                            }}
                        >
                            {submitting ? t.generating : t.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

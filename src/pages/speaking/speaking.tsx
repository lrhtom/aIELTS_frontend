import Layout from '../../components/layout/Layout';
import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { getInitialVocabInput } from '../../store/word_selection_store';
import { speakingStore } from '../../store/speaking_page_store';
import { useLang } from '../../i18n/LanguageContext';
import { listPlans, getPlanDetail, sortPlansByFavorite, type LearningPlan } from '../../api/learning_plan';
import { ATInterceptor } from '../../api/atInterceptor';
import { showToast } from '../../components/common/Toast';
import AiModelSelector from '../../components/common/AiModelSelector';
import '../../styles/practice_page.css';
import '../../styles/speaking_page.css';

export type IeltsPart = 'part1' | 'part2' | 'part3';
export type SpeakingMode = 'chat' | 'call' | 'exam' | 'scenario' | 'fullTest' | 'part1' | 'part2' | 'part3';
// 2026-07-07 起全套考试并入全真模拟：Part 选择器多一档 'full'，
// 选中后仍走 mode='fullTest' 的既有聊天页机器（fullTestPhase 自动过渡等零改动）
type ExamScope = IeltsPart | 'full';

interface PartInfo {
    id: ExamScope;
    emoji: string;
    title: string;
    desc: string;
}

interface ModeInfo {
    id: SpeakingMode;
    emoji: string;
    title: string;
    desc: string;
    color: string;
}

// 场景干扰选项（真实难度增强）——键须与后端 INTERFERENCE_KEYS / INTERFERENCE_SUBOPTIONS 一致
export type ScenarioModifierKey = 'accent' | 'crosstalk' | 'noise' | 'audioquality' | 'smalltalk';
const SCENARIO_MODIFIERS: { key: ScenarioModifierKey; icon: string; color: string; bg: string }[] = [
    { key: 'accent', icon: '🗣️', color: '#ef4444', bg: '#fee2e2' },
    { key: 'crosstalk', icon: '💬', color: '#f59e0b', bg: '#fef3c7' },
    { key: 'noise', icon: '🔊', color: '#0ea5e9', bg: '#e0f2fe' },
    { key: 'audioquality', icon: '📻', color: '#6366f1', bg: '#e0e7ff' },
    { key: 'smalltalk', icon: '🫖', color: '#10b981', bg: '#d1fae5' },
];
// 每个干扰项可再多选的子选项（键须与后端 INTERFERENCE_SUBOPTIONS 一致）
const SCENARIO_SUBOPTIONS: Record<ScenarioModifierKey, string[]> = {
    accent: ['brummie', 'eastmidlands', 'scouse', 'geordie', 'cockney'],
    crosstalk: ['fast', 'interrupt', 'overlap'],
    noise: ['pub', 'canteen', 'office', 'street'],
    audioquality: ['phone', 'muffled', 'radio'],  // 音质干扰：对 AI 语音加滤波
    smalltalk: [],  // 仅开关，无子选项
};

export default function Speaking() {
    const { t } = useLang();

    const PARTS: PartInfo[] = [
        { id: 'part1', emoji: '💬', title: t('speakingConfig.ieltsPart.parts.part1.title'), desc: t('speakingConfig.ieltsPart.parts.part1.desc') },
        { id: 'part2', emoji: '🗣️', title: t('speakingConfig.ieltsPart.parts.part2.title'), desc: t('speakingConfig.ieltsPart.parts.part2.desc') },
        { id: 'part3', emoji: '🧠', title: t('speakingConfig.ieltsPart.parts.part3.title'), desc: t('speakingConfig.ieltsPart.parts.part3.desc') },
        { id: 'full', emoji: '📋', title: t('speakingConfig.ieltsPart.parts.full.title'), desc: t('speakingConfig.ieltsPart.parts.full.desc') },
    ];

    // 2026-07-07 起 call（通话）模式并入 chat：唯一差异只是隐藏键盘，
    // 降级为"纯语音模式"开关；旧 call 会话在题库恢复时自动映射。
    const MODES: ModeInfo[] = [
        {
            id: 'chat',
            emoji: '💬',
            title: t('speakingConfig.modes.items.chat.title'),
            desc: t('speakingConfig.modes.items.chat.desc'),
            color: 'mode-chat',
        },
        {
            id: 'exam',
            emoji: '🎓',
            title: t('speakingConfig.modes.items.exam.title'),
            desc: t('speakingConfig.modes.items.exam.desc'),
            color: 'mode-exam',
        },
        {
            id: 'scenario',
            emoji: '🎭',
            title: t('speakingConfig.modes.items.scenario.title'),
            desc: t('speakingConfig.modes.items.scenario.desc'),
            color: 'mode-scenario',
        },
    ];

    const [vocabInput, setVocabInput] = useState(() => getInitialVocabInput());
    const [useCustomVocab, setUseCustomVocab] = useState(false);
    const [selectedPart, setSelectedPart] = useState<ExamScope>('part1');
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [selectedMode, setSelectedMode] = useState<SpeakingMode>('chat');
    const [scenarioInput, setScenarioInput] = useState('');
    const [scenarioFiles, setScenarioFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
    // 自定义题库卡片标题/简介（留空 = 自动用话题名，卡片无简介）
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    // 纯语音模式（原通话模式）：隐藏键盘输入，仅 chat 模式生效
    const [voiceOnly, setVoiceOnly] = useState(false);
    // 场景干扰选项（真实难度增强）：{ 选项key: [已选子选项] }，可多选、每项可再细选，仅 scenario 模式生效
    const [scenarioModifiers, setScenarioModifiers] = useState<Record<string, string[]>>({});
    const optionOn = (key: ScenarioModifierKey) => key in scenarioModifiers;
    const toggleOption = (key: ScenarioModifierKey) =>
        setScenarioModifiers(prev => {
            const next = { ...prev };
            if (key in next) delete next[key]; else next[key] = [];
            return next;
        });
    const toggleSub = (key: ScenarioModifierKey, sub: string) =>
        setScenarioModifiers(prev => {
            const cur = prev[key] ?? [];
            const nextSubs = cur.includes(sub) ? cur.filter(s => s !== sub) : [...cur, sub];
            return { ...prev, [key]: nextSubs };
        });

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length === 0) return;
        const total = scenarioFiles.length + selected.length;
        if (total > 3) {
            showToast(t('speakingConfig.toastMaxFiles'));
            return;
        }
        const oversized = selected.filter(f => f.size > 5 * 1024 * 1024);
        if (oversized.length > 0) {
            showToast(t('speakingConfig.toastFileTooBig'));
            return;
        }
        setScenarioFiles(prev => [...prev, ...selected]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRandomScenario = async () => {
        try {
            setIsGeneratingScenario(true);
            const res = await ATInterceptor.generateRandomScenario();
            if (res.data.scenario) {
                setScenarioInput(res.data.scenario);
            }
        } catch (err: unknown) {
            showToast(t('speakingConfig.toastRandomScenarioFail').replace('{msg}', (err as { message?: string }).message ?? ''));
        } finally {
            setIsGeneratingScenario(false);
        }
    };

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
                showToast(t('common.planImport.noWords'), 'error');
                return;
            }
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            handleVocabChange(lines);
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

    const isExamPart1 = selectedMode === 'exam' && selectedPart === 'part1';
    const isExamPart2 = selectedMode === 'exam' && selectedPart === 'part2';
    const isExamPart3 = selectedMode === 'exam' && selectedPart === 'part3';
    const isFullTest = selectedMode === 'exam' && selectedPart === 'full';
    const isStartDisabled = isChecking || isGeneratingScenario;

    const handleStart = async () => {
        if (selectedMode === 'scenario' && !scenarioInput.trim()) {
            showToast(t('speakingConfig.toastEnterScenario'));
            return;
        }

        if (selectedMode === 'scenario') {
            try {
                setIsChecking(true);
                const checkRes = await ATInterceptor.checkScenario(scenarioInput.trim());
                if (!checkRes.data.valid) {
                    showToast(t('speakingConfig.toastScenarioBlocked').replace('{reason}', checkRes.data.reason || t('speakingConfig.toastScenarioBlockedFallback')));
                    setIsChecking(false);
                    return;
                }
            } catch (err: unknown) {
                showToast(t('speakingConfig.toastSafetyFail').replace('{msg}', (err as { message?: string }).message ?? ''));
                setIsChecking(false);
                return;
            } finally {
                setIsChecking(false);
            }
        }

        if (selectedMode === 'chat' || selectedMode === 'scenario') {
            speakingStore.isChatAllowed = true;
            navigate('/speaking/chat', {
                state: {
                    vocabInput: useCustomVocab ? vocabInput : '',
                    mode: selectedMode,
                    showSubtitles,
                    part: selectedPart === 'full' ? 'part1' : selectedPart,
                    scenarioInput: scenarioInput.trim(),
                    scenarioFiles: selectedMode === 'scenario' ? scenarioFiles : undefined,
                    customTitle: customName.trim(),
                    customDesc: customDescription.trim(),
                    voiceOnly: selectedMode === 'chat' ? voiceOnly : false,
                    scenarioModifiers: selectedMode === 'scenario' ? scenarioModifiers : {},
                },
            });
        } else if (isExamPart1) {
            try {
                setIsChecking(true);
                const res = await ATInterceptor.bankGeneratePart1();
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'part1',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part1',
                        bankSource: res.data.source,
                        customTitle: customName.trim(),
                        customDesc: customDescription.trim(),
                    }
                });
            } catch (err: unknown) {
                showToast(t('speakingConfig.toastPart1Fail').replace('{msg}', (err as { message?: string }).message ?? ''));
            } finally {
                setIsChecking(false);
            }
        } else if (isExamPart2) {
            try {
                setIsChecking(true);
                const res = await ATInterceptor.bankGeneratePart2();
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'part2',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part2',
                        bankSource: res.data.source,
                        customTitle: customName.trim(),
                        customDesc: customDescription.trim(),
                    }
                });
            } catch (err: unknown) {
                showToast(t('speakingConfig.toastPart2Fail').replace('{msg}', (err as { message?: string }).message ?? ''));
            } finally {
                setIsChecking(false);
            }
        } else if (isExamPart3) {
            try {
                setIsChecking(true);
                const res = await ATInterceptor.bankGeneratePart3('');
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'part3',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part3',
                        bankSource: res.data.source,
                        customTitle: customName.trim(),
                        customDesc: customDescription.trim(),
                    }
                });
            } catch (err: unknown) {
                showToast(t('speakingConfig.toastPart3Fail').replace('{msg}', (err as { message?: string }).message ?? ''));
            } finally {
                setIsChecking(false);
            }
        } else if (isFullTest) {
            // Full Test: start from Part 1 → will auto-continue to Part 2 → Part 3
            try {
                setIsChecking(true);
                const res = await ATInterceptor.bankGeneratePart1();
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'fullTest',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part1',
                        bankSource: res.data.source,
                        customTitle: customName.trim(),
                        customDesc: customDescription.trim(),
                    }
                });
            } catch (err: unknown) {
                showToast(t('speakingConfig.toastFullTestFail').replace('{msg}', (err as { message?: string }).message ?? ''));
            } finally {
                setIsChecking(false);
            }
        } else {
            showToast(t('speakingConfig.comingSoon'), 'info');
        }
    };

    return (
        <Layout
            pageTitle={t('speakingConfig.heading')}
            pageSubtitle={t('speakingConfig.subheading')}
            backUrl='/practice/ai'
            backText={t('speakingConfig.backToAI')}
        >
            <div className="uc-console">
                {/* ── 1. 左侧：模式切换列 (Sidebar) ── */}
                <div className="uc-sidebar">
                        <div className="uc-sidebar-title">{t('speakingConfig.modes.title')}</div>
                        <nav className="uc-sidebar-nav">
                            {MODES.map(m => (
                                <button
                                    key={m.id}
                                    className={`uc-nav-item ${selectedMode === m.id ? 'active' : ''}`}
                                    onClick={() => setSelectedMode(m.id)}
                                >
                                    <span className="nav-icon">{m.emoji}</span>
                                    <span className="nav-text">{m.title}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* ── 2. 右侧：配置明细区 (Main Content) ── */}
                    <div className="uc-main-content">
                        <div className="uc-main-header">
                            <h2>{MODES.find(m => m.id === selectedMode)?.title}</h2>
                            <p>{t(`speakingConfig.modes.items.${selectedMode}.desc`)}</p>
                        </div>

                        <div className="uc-settings-list">
                            <div className="uc-card-group">
                                {/* IELTS Part Segmented Control（含"全套"档 = 原全套考试模式） */}
                                {selectedMode === 'exam' && (
                                    <div className="uc-list-row">
                                        <div className="uc-row-label-flex">
                                            <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📝</span>
                                                <span className="row-title">{t('speakingConfig.ieltsPart.title')}</span>
                                            </div>
                                        </div>
                                    <div className="uc-row-control" style={selectedPart === 'full' ? { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 } : undefined}>
                                        <div className="uc-segmented-control">
                                            {PARTS.map(p => (
                                                <button
                                                    key={p.id}
                                                    className={`seg-btn ${selectedPart === p.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedPart(p.id)}
                                                >
                                                    {p.title}
                                                </button>
                                            ))}
                                        </div>
                                        {selectedPart === 'full' && (
                                            <span className="ft-inline-text">📋 {t('speakingConfig.ieltsPart.fullTestHint')}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                                {/* Scenario */}
                                {selectedMode === 'scenario' && (
                                    <div className="uc-list-group">
                                        <div className="uc-list-row uc-row-vertical">
                                            <div className="uc-row-label-flex">
                                                <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>🎭</span>
                                                    <span className="row-title">{t('speakingConfig.scenarioSettings.title')}</span>
                                                </div>
                                                <button className="secondary-btn-console" onClick={handleRandomScenario} disabled={isGeneratingScenario}>
                                                    {isGeneratingScenario ? t('speakingConfig.scenarioSettings.generating') : t('speakingConfig.scenarioSettings.randomBtn')}
                                                </button>
                                            </div>
                                        <textarea
                                            className="uc-console-textarea"
                                            rows={3}
                                            placeholder={t('speakingConfig.scenarioSettings.placeholder')}
                                            value={scenarioInput}
                                            onChange={e => setScenarioInput(e.target.value)}
                                        />
                                    </div>
                                    <div className="uc-list-row">
                                        <div className="uc-row-label">
                                            <span className="row-title">{t('speakingConfig.attachmentLabel')}</span>
                                            <span className="row-desc">{t('speakingConfig.attachmentDesc')}</span>
                                        </div>
                                        <div className="uc-row-control">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*,.pdf,.txt,.doc,.docx,.csv,.json,.md"
                                                multiple
                                                onChange={handleFileSelect}
                                                style={{ display: 'none' }}
                                            />
                                            <button className="secondary-btn-console" onClick={() => fileInputRef.current?.click()}>
                                                {t('speakingConfig.attachmentSelectBtn')}
                                            </button>
                                        </div>
                                    </div>
                                    {scenarioFiles.length > 0 && (
                                        <div className="uc-list-row" style={{ borderTop: 'none', paddingTop: 0 }}>
                                            <div className="uc-file-previews-console">
                                                {scenarioFiles.map((f, i) => (
                                                    <div key={i} className="uc-file-chip-console">
                                                        <span>{f.type.startsWith('image/') ? '🖼️' : '📄'} {f.name}</span>
                                                        <button onClick={(e) => { e.stopPropagation(); setScenarioFiles(prev => prev.filter((_, j) => j !== i)); }}>×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

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
                            </div>

                            <div className="uc-card-group">
                                {/* Subtitles */}
                                <div className="uc-list-row">
                                    <div className="uc-row-label">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#10b981', background: '#d1fae5' }}>👁️</span>
                                            <span className="row-title">{t('speakingConfig.subtitles.title')}</span>
                                        </div>
                                        <span className="row-desc" style={{ marginLeft: '40px' }}>{t('speakingConfig.subtitles.desc')}</span>
                                    </div>
                                <div className="uc-row-control">
                                    <label className="toggle-switch-console">
                                        <input type="checkbox" checked={showSubtitles} onChange={e => setShowSubtitles(e.target.checked)} />
                                        <span className="toggle-slider-console" />
                                    </label>
                                </div>
                            </div>

                                {/* 纯语音模式（原通话模式）：只在自由对话下显示 */}
                                {selectedMode === 'chat' && (
                                    <div className="uc-list-row">
                                        <div className="uc-row-label">
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#6366f1', background: '#e0e7ff' }}>📞</span>
                                                <span className="row-title">{t('speakingConfig.voiceOnly.title')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>{t('speakingConfig.voiceOnly.desc')}</span>
                                        </div>
                                        <div className="uc-row-control">
                                            <label className="toggle-switch-console">
                                                <input type="checkbox" checked={voiceOnly} onChange={e => setVoiceOnly(e.target.checked)} />
                                                <span className="toggle-slider-console" />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 场景干扰选项（真实难度增强）：只在场景对话下显示，可选择性开启 */}
                                {selectedMode === 'scenario' && (
                                    <>
                                        <div className="uc-list-row uc-row-vertical" style={{ paddingBottom: 4 }}>
                                            <div className="uc-row-label-flex">
                                                <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <span className="uc-row-icon" style={{ color: '#ef4444', background: '#fee2e2' }}>🎚️</span>
                                                    <span className="row-title">{t('speakingConfig.scenarioModifiers.sectionTitle')}</span>
                                                </div>
                                            </div>
                                            <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                {t('speakingConfig.scenarioModifiers.sectionDesc')}
                                            </span>
                                        </div>
                                        {SCENARIO_MODIFIERS.map(m => (
                                            <div key={m.key}>
                                                <div className="uc-list-row">
                                                    <div className="uc-row-label">
                                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                                            <span className="uc-row-icon" style={{ color: m.color, background: m.bg }}>{m.icon}</span>
                                                            <span className="row-title">{t(`speakingConfig.scenarioModifiers.${m.key}.title`)}</span>
                                                        </div>
                                                        <span className="row-desc" style={{ marginLeft: '40px' }}>{t(`speakingConfig.scenarioModifiers.${m.key}.desc`)}</span>
                                                    </div>
                                                    <div className="uc-row-control">
                                                        <label className="toggle-switch-console">
                                                            <input type="checkbox" checked={optionOn(m.key)} onChange={() => toggleOption(m.key)} />
                                                            <span className="toggle-slider-console" />
                                                        </label>
                                                    </div>
                                                </div>
                                                {/* 细选：开启后展开可多选的子选项（无子选项的如 Small talk 不展开）*/}
                                                {optionOn(m.key) && SCENARIO_SUBOPTIONS[m.key].length > 0 && (
                                                    <div className="scenario-suboptions">
                                                        {SCENARIO_SUBOPTIONS[m.key].map(sub => {
                                                            const on = (scenarioModifiers[m.key] ?? []).includes(sub);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={sub}
                                                                    className={`scenario-subchip ${on ? 'active' : ''}`}
                                                                    onClick={() => toggleSub(m.key, sub)}
                                                                >
                                                                    {t(`speakingConfig.scenarioModifiers.${m.key}.subs.${sub}`)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}

                                {/* Vocab Accordion */}
                                <div className={`uc-list-group uc-vocab-group ${useCustomVocab ? 'expanded' : ''}`} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 0 }}>
                                    <div className="uc-list-row" style={{ borderBottom: 'none' }}>
                                        <div className="uc-row-label">
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#f43f5e', background: '#ffe4e6' }}>📚</span>
                                                <span className="row-title">{t('speakingConfig.vocabSettings.title')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>{t('speakingConfig.vocabSettings.desc')}</span>
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
                                        <VocabInput value={vocabInput} onChange={handleVocabChange} />
                                    </div>
                                )}
                            </div>
                            </div>

                            {/* 自定义题库卡片标题/简介（与听/读/写配置页同一套 customQuestion 文案） */}
                            <div className="uc-card-group">
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>🏷️</span>
                                            <span className="row-title">{t('common.customQuestion.sectionTitle')}</span>
                                        </div>
                                    </div>
                                    <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        {t('common.customQuestion.sectionDesc')}
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, width: '100%' }}>
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
                        </div>

                        <div className="uc-console-footer">
                            <button
                                className={`uc-console-start-btn ${isStartDisabled ? 'disabled' : ''}`}
                                onClick={handleStart}
                                disabled={isStartDisabled}
                            >
                                {isChecking ? t('speakingConfig.startPreparing') : t('speakingConfig.startPractice')}
                            </button>
                        </div>
                    </div>
                </div>
        </Layout>
    );
}

import Layout from '../../components/layout/Layout';
import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { getInitialVocabInput } from '../../store/word_selection_store';
import { speakingStore } from '../../store/speaking_page_store';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { listPlans, getPlanDetail, type LearningPlan } from '../../api/learning_plan';
import { ATInterceptor } from '../../api/atInterceptor';
import { showToast } from '../../components/common/Toast';
import AiModelSelector from '../../components/common/AiModelSelector';
import '../../styles/practice_page.css';
import '../../styles/speaking_page.css';

export type IeltsPart = 'part1' | 'part2' | 'part3';
export type SpeakingMode = 'chat' | 'call' | 'exam' | 'scenario' | 'fullTest' | 'part1' | 'part2' | 'part3';

interface PartInfo {
    id: IeltsPart;
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

export default function Speaking() {
    const { lang } = useLang();
    const sc = translations[lang].speakingConfig;

    const PARTS: PartInfo[] = [
        { id: 'part1', emoji: '💬', title: sc.ieltsPart.parts.part1.title, desc: sc.ieltsPart.parts.part1.desc },
        { id: 'part2', emoji: '🗣️', title: sc.ieltsPart.parts.part2.title, desc: sc.ieltsPart.parts.part2.desc },
        { id: 'part3', emoji: '🧠', title: sc.ieltsPart.parts.part3.title, desc: sc.ieltsPart.parts.part3.desc },
    ];

    const MODES: ModeInfo[] = [
        {
            id: 'chat',
            emoji: '💬',
            title: sc.modes.items.chat.title,
            desc: sc.modes.items.chat.desc,
            color: 'mode-chat',
        },
        {
            id: 'call',
            emoji: '📞',
            title: sc.modes.items.call.title,
            desc: sc.modes.items.call.desc,
            color: 'mode-call',
        },
        {
            id: 'exam',
            emoji: '🎓',
            title: sc.modes.items.exam.title,
            desc: sc.modes.items.exam.desc,
            color: 'mode-exam',
        },
        {
            id: 'scenario',
            emoji: '🎭',
            title: sc.modes.items.scenario.title,
            desc: sc.modes.items.scenario.desc,
            color: 'mode-scenario',
        },
        {
            id: 'fullTest',
            emoji: '📋',
            title: sc.modes.items.fullTest.title,
            desc: sc.modes.items.fullTest.desc,
            color: 'mode-fulltest',
        },
    ];

    const [vocabInput, setVocabInput] = useState(() => getInitialVocabInput());
    const [useCustomVocab, setUseCustomVocab] = useState(false);
    const [selectedPart, setSelectedPart] = useState<IeltsPart>('part1');
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [selectedMode, setSelectedMode] = useState<SpeakingMode>('chat');
    const [scenarioInput, setScenarioInput] = useState('');
    const [scenarioFiles, setScenarioFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
    
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
            alert('最多上传 3 个文件');
            return;
        }
        const oversized = selected.filter(f => f.size > 5 * 1024 * 1024);
        if (oversized.length > 0) {
            alert('单个文件不能超过 5MB');
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
            alert('生成随机场景失败: ' + (err as { message?: string }).message);
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
                showToast('该计划今日暂无待学单词', 'error');
                return;
            }
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

    const isExamPart1 = selectedMode === 'exam' && selectedPart === 'part1';
    const isExamPart2 = selectedMode === 'exam' && selectedPart === 'part2';
    const isExamPart3 = selectedMode === 'exam' && selectedPart === 'part3';
    const isFullTest = selectedMode === 'fullTest';
    const isStartDisabled = isChecking || isGeneratingScenario;

    const handleStart = async () => {
        if (selectedMode === 'scenario' && !scenarioInput.trim()) {
            alert('请输入您想设定的场景内容');
            return;
        }

        if (selectedMode === 'scenario') {
            try {
                setIsChecking(true);
                const checkRes = await ATInterceptor.checkScenario(scenarioInput.trim());
                if (!checkRes.data.valid) {
                    alert('场景检测不通过：' + (checkRes.data.reason || '包含不适宜的话题，请重新修改。'));
                    setIsChecking(false);
                    return;
                }
            } catch (err: unknown) {
                alert('安全性测算失败或余额不足: ' + (err as { message?: string }).message);
                setIsChecking(false);
                return;
            } finally {
                setIsChecking(false);
            }
        }

        if (selectedMode === 'chat' || selectedMode === 'call' || selectedMode === 'scenario') {
            speakingStore.isChatAllowed = true;
            navigate('/speaking/chat', {
                state: {
                    vocabInput: useCustomVocab ? vocabInput : '',
                    mode: selectedMode,
                    showSubtitles,
                    part: selectedPart,
                    scenarioInput: scenarioInput.trim(),
                    scenarioFiles: selectedMode === 'scenario' ? scenarioFiles : undefined,
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
                    }
                });
            } catch (err: unknown) {
                alert('获取Part1题目失败: ' + (err as { message?: string }).message);
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
                    }
                });
            } catch (err: unknown) {
                alert('获取Part2题目失败: ' + (err as { message?: string }).message);
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
                    }
                });
            } catch (err: unknown) {
                alert('获取Part3题目失败: ' + (err as { message?: string }).message);
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
                    }
                });
            } catch (err: unknown) {
                alert('获取Full Test题目失败: ' + (err as { message?: string }).message);
            } finally {
                setIsChecking(false);
            }
        } else {
            alert(sc.comingSoon);
        }
    };

    const getSummaryText = () => {
        const mode = MODES.find(m => m.id === selectedMode);
        let text = `${mode?.emoji} ${mode?.title}`;
        if (selectedMode === 'exam' || selectedMode === 'fullTest') {
            const part = PARTS.find(p => p.id === selectedPart);
            if (selectedMode === 'exam') {
                text += ` · ${part?.title}`;
            }
        }
        return text;
    };

    return (
        <Layout
            pageTitle={sc.heading}
            pageSubtitle={sc.subheading}
            backUrl='/practice/ai'
            backText={sc.backToAI}
        >
            <div className="uc-console">
                {/* ── 1. 左侧：模式切换列 (Sidebar) ── */}
                <div className="uc-sidebar">
                        <div className="uc-sidebar-title">{sc.modes.title}</div>
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
                            <p>{sc.modes.items?.[selectedMode as keyof typeof sc.modes.items]?.desc}</p>
                        </div>

                        <div className="uc-settings-list">
                            <div className="uc-card-group">
                                {/* IELTS Part Segmented Control */}
                                {(selectedMode === 'exam' || selectedMode === 'fullTest') && (
                                    <div className="uc-list-row">
                                        <div className="uc-row-label-flex">
                                            <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📝</span>
                                                <span className="row-title">{sc.ieltsPart.title}</span>
                                            </div>
                                        </div>
                                    <div className="uc-row-control">
                                        {selectedMode === 'fullTest' ? (
                                            <span className="ft-inline-text">📋 {sc.ieltsPart.fullTestHint}</span>
                                        ) : (
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
                                                    <span className="row-title">{sc.scenarioSettings.title}</span>
                                                </div>
                                                <button className="secondary-btn-console" onClick={handleRandomScenario} disabled={isGeneratingScenario}>
                                                    {isGeneratingScenario ? sc.scenarioSettings.generating : sc.scenarioSettings.randomBtn}
                                                </button>
                                            </div>
                                        <textarea
                                            className="uc-console-textarea"
                                            rows={3}
                                            placeholder={sc.scenarioSettings.placeholder}
                                            value={scenarioInput}
                                            onChange={e => setScenarioInput(e.target.value)}
                                        />
                                    </div>
                                    <div className="uc-list-row">
                                        <div className="uc-row-label">
                                            <span className="row-title">参考附件</span>
                                            <span className="row-desc">上传图片或文档 (选做)</span>
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
                                                📎 选择文件
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
                                            <span className="row-title">AI 模型</span>
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
                                            <span className="row-title">{sc.subtitles.title}</span>
                                        </div>
                                        <span className="row-desc" style={{ marginLeft: '40px' }}>{sc.subtitles.desc}</span>
                                    </div>
                                <div className="uc-row-control">
                                    <label className="toggle-switch-console">
                                        <input type="checkbox" checked={showSubtitles} onChange={e => setShowSubtitles(e.target.checked)} />
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
                                                <span className="row-title">{sc.vocabSettings.title}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>{sc.vocabSettings.desc}</span>
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
                                                    {importingPlan ? '导入中…' : '⬇ 导入今日单词'}
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
                                className={`uc-console-start-btn ${isStartDisabled ? 'disabled' : ''}`}
                                onClick={handleStart}
                                disabled={isStartDisabled}
                            >
                                {isChecking ? '⏳ 正在准备...' : `🗣️ 开始练习`}
                            </button>
                        </div>
                    </div>
                </div>
        </Layout>
    );
}

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

    return (
        <Layout
    pageTitle={sc.heading}
    pageSubtitle={sc.subheading}
    backUrl='/practice/ai'
    backText={sc.backToAI}
>
            <div className="practice-container">
                {/* ── Board 0: AI Model ── */}
                <div className="config-card">
                    <AiModelSelector />
                </div>

                {/* ── Board 1: Vocabulary ── */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{sc.vocabSettings.title}</div>
                            <div className="label-desc">{sc.vocabSettings.desc}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={useCustomVocab}
                                onChange={e => setUseCustomVocab(e.target.checked)}
                            />
                            <span className="toggle-slider" />
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

                {/* ── Board 2: IELTS Part + Subtitles ── */}
                <div className="config-card">
                    <div className="sp-section-header">
                        <h3>{sc.ieltsPart.title}</h3>
                        {selectedMode !== 'exam' && (
                            <span className="sp-locked-hint">{sc.ieltsPart.lockedHint}</span>
                        )}
                    </div>
                    <div className={`speaking-parts${(selectedMode !== 'exam' && selectedMode !== 'fullTest') ? ' parts-disabled' : ''}`}>
                        {selectedMode === 'fullTest' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'linear-gradient(135deg, #f0fdf4, #ecfeff)', borderRadius: '10px', border: '1.5px solid #86efac' }}>
                                <span style={{ fontSize: '20px' }}>📋</span>
                                <span style={{ fontWeight: 600, color: '#166534' }}>Part 1 → Part 2 → Part 3 连续进行</span>
                            </div>
                        ) : (
                        PARTS.map(p => (
                            <button
                                key={p.id}
                                className={`speaking-part-card${selectedPart === p.id && selectedMode === 'exam' ? ' selected' : ''}`}
                                onClick={() => selectedMode === 'exam' && setSelectedPart(p.id)}
                                disabled={selectedMode !== 'exam'}
                            >
                                <span className="sp-emoji">{p.emoji}</span>
                                <span className="sp-title">{p.title}</span>
                                <span className="sp-desc">{p.desc}</span>
                            </button>
                        ))
                        )}
                    </div>

                    <div className="speaking-divider" />

                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{sc.subtitles.title}</div>
                            <div className="label-desc">{sc.subtitles.desc}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={showSubtitles}
                                onChange={e => setShowSubtitles(e.target.checked)}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>

                {/* ── Board 3: Mode ── */}
                <div className="config-card">
                    <h3>{sc.modes.title}</h3>
                    <div className="speaking-modes">
                        {MODES.map(m => (
                            <button
                                key={m.id}
                                className={`speaking-mode-card ${m.color}${selectedMode === m.id ? ' selected' : ''}`}
                                onClick={() => setSelectedMode(m.id)}
                            >
                                <span className="sm-emoji">{m.emoji}</span>
                                <span className="sm-title">{m.title}</span>
                                <span className="sm-desc">{m.desc}</span>
                                {selectedMode === m.id && (
                                    <span className="sm-check">✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Board 4: Scenario Settings (Only for scenario mode) ── */}
                {selectedMode === 'scenario' && (
                    <div className="config-card fadeIn">
                        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div className="label-text">{sc.scenarioSettings.title}</div>
                                <div className="label-desc">{sc.scenarioSettings.desc}</div>
                            </div>
                            <button
                                className="secondary-btn"
                                onClick={handleRandomScenario}
                                disabled={isGeneratingScenario}
                                style={{ flexShrink: 0, marginLeft: '16px', fontSize: '0.9rem', padding: '6px 12px' }}
                            >
                                {isGeneratingScenario ? sc.scenarioSettings.generating : sc.scenarioSettings.randomBtn}
                            </button>
                        </div>
                        <textarea
                            className="vocab-textarea"
                            rows={3}
                            placeholder={sc.scenarioSettings.placeholder}
                            value={scenarioInput}
                            onChange={e => setScenarioInput(e.target.value)}
                            style={{ width: '100%', resize: 'vertical' }}
                        />

                        <div className="sp-attachment-area">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.pdf,.txt,.doc,.docx,.csv,.json,.md"
                                multiple
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                            <button
                                className="sp-attach-btn"
                                onClick={() => fileInputRef.current?.click()}
                                type="button"
                                title="上传图片或文件作为场景参考"
                            >
                                📎 上传参考文件/图片
                            </button>
                            <span className="sp-attach-hint">选做 — 可上传图片或文档帮助 AI 理解场景</span>
                            {scenarioFiles.length > 0 && (
                                <div className="sp-file-previews">
                                    {scenarioFiles.map((f, i) => (
                                        <div key={i} className="sp-file-chip">
                                            <span className="sp-file-chip-name">
                                                {f.type.startsWith('image/') ? '🖼️' : '📄'} {f.name}
                                            </span>
                                            <button
                                                className="sp-file-chip-remove"
                                                onClick={() => setScenarioFiles(prev => prev.filter((_, j) => j !== i))}
                                                type="button"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Start Button ── */}
                <div className="config-card">
                    <button
                        className="skill-btn speaking-start-btn"
                        style={{ width: '100%', opacity: (isStartDisabled) ? 0.6 : 1 }}
                        onClick={handleStart}
                        disabled={isStartDisabled}
                    >
                        <span className="btn-icon">{isChecking ? '⏳' : '🗣️'}</span>
                        {isChecking ? '正在准备...' : sc.startBtn}
                    </button>
                </div>
            </div>
        </Layout>
    );
}

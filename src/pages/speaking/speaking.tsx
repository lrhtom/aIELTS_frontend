import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { getInitialVocabInput } from '../../store/word_selection_store';
import { speakingStore } from '../../store/speaking_page_store';
import { useLang } from '../../i18n/LanguageContext';
import { ATInterceptor } from '../../api/atInterceptor';
import '../../styles/practice_page.css';
import '../../styles/speaking_page.css';

export type IeltsPart = 'part1' | 'part2' | 'part3';
export type SpeakingMode = 'chat' | 'call' | 'exam' | 'scenario' | 'part1' | 'part2' | 'part3';

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
    const { translations: t } = useLang();
    const sc = t.speakingConfig;

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
    ];

    const [vocabInput, setVocabInput] = useState(() => getInitialVocabInput());
    const [useCustomVocab, setUseCustomVocab] = useState(false);
    const [selectedPart, setSelectedPart] = useState<IeltsPart>('part1');
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [selectedMode, setSelectedMode] = useState<SpeakingMode>('chat');
    const [scenarioInput, setScenarioInput] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    const navigate = useNavigate();

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
    };

    const isExamPart1 = selectedMode === 'exam' && selectedPart === 'part1';
    const isExamPart2 = selectedMode === 'exam' && selectedPart === 'part2';
    const isExamPart3 = selectedMode === 'exam' && selectedPart === 'part3';
    const isStartDisabled = isChecking;

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
            } catch (err: any) {
                alert('安全性测算失败或余额不足: ' + err.message);
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
                    scenarioInput: scenarioInput.trim()
                },
            });
        } else if (isExamPart1) {
            try {
                setIsChecking(true);
                const res = await ATInterceptor.generatePart1();
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'part1',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part1'
                    }
                });
            } catch (err: any) {
                alert('获取Part1题目失败或余额不足: ' + err.message);
            } finally {
                setIsChecking(false);
            }
        } else if (isExamPart2) {
            try {
                setIsChecking(true);
                const res = await ATInterceptor.generatePart2();
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'part2',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part2'
                    }
                });
            } catch (err: any) {
                alert('获取Part2题目失败或余额不足: ' + err.message);
            } finally {
                setIsChecking(false);
            }
        } else if (isExamPart3) {
            try {
                setIsChecking(true);
                const res = await ATInterceptor.generatePart3();
                speakingStore.isChatAllowed = true;
                navigate('/speaking/chat', {
                    state: {
                        mode: 'part3',
                        questions: res.data.questions,
                        showSubtitles,
                        part: 'part3'
                    }
                });
            } catch (err: any) {
                alert('获取Part3题目失败或余额不足: ' + err.message);
            } finally {
                setIsChecking(false);
            }
        } else {
            alert(sc.comingSoon);
        }
    };

    return (
        <Layout>
<div className=".*">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">{sc.backToAI}</Link>
                    <h1>{sc.heading}</h1>
                    <p>{sc.subheading}</p>
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
                        <VocabInput
                            value={vocabInput}
                            onChange={handleVocabChange}
                        />
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
                    <div className={`speaking-parts${selectedMode !== 'exam' ? ' parts-disabled' : ''}`}>
                        {PARTS.map(p => (
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
                        ))}
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
                        <div style={{ marginBottom: '12px' }}>
                            <div className="label-text">{sc.scenarioSettings.title}</div>
                            <div className="label-desc">{sc.scenarioSettings.desc}</div>
                        </div>
                        <textarea
                            className="vocab-textarea"
                            rows={3}
                            placeholder={sc.scenarioSettings.placeholder}
                            value={scenarioInput}
                            onChange={e => setScenarioInput(e.target.value)}
                            style={{ width: '100%', resize: 'vertical' }}
                        />
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

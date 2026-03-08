import AppNavbar from '../components/AppNavbar';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import VocabInput from '../components/VocabInput';
import { getInitialVocabInput } from '../store/word_selection_store';
import { speakingStore } from '../store/speaking_page_store';
import '../styles/practice_page.css';
import '../styles/speaking_page.css';

type IeltsPart = 'part1' | 'part2' | 'part3';
type SpeakingMode = 'chat' | 'call' | 'exam';

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

const PARTS: PartInfo[] = [
    { id: 'part1', emoji: '💬', title: 'Part 1', desc: '个人话题问答' },
    { id: 'part2', emoji: '🗣️', title: 'Part 2', desc: '2分钟主题演讲' },
    { id: 'part3', emoji: '🧠', title: 'Part 3', desc: '深度讨论分析' },
];

const MODES: ModeInfo[] = [
    {
        id: 'chat',
        emoji: '💬',
        title: '聊天模式',
        desc: 'AI 文字对话，轻松练习',
        color: 'mode-chat',
    },
    {
        id: 'call',
        emoji: '📞',
        title: '通话模式',
        desc: '语音通话，沉浸式练习',
        color: 'mode-call',
    },
    {
        id: 'exam',
        emoji: '🎓',
        title: '考试模式',
        desc: '模拟真实雅思考试环境',
        color: 'mode-exam',
    },
];

export default function Speaking() {
    const [vocabInput, setVocabInput] = useState(() => getInitialVocabInput());
    const [useCustomVocab, setUseCustomVocab] = useState(false);
    const [selectedPart, setSelectedPart] = useState<IeltsPart>('part1');
    const [showSubtitles, setShowSubtitles] = useState(true);
    const [selectedMode, setSelectedMode] = useState<SpeakingMode>('chat');

    const navigate = useNavigate();

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
    };

    const handleStart = () => {
        if (selectedMode === 'chat' || selectedMode === 'call') {
            speakingStore.isChatAllowed = true;
            navigate('/speaking/chat', {
                state: {
                    vocabInput: useCustomVocab ? vocabInput : '',
                    mode: selectedMode,
                    showSubtitles,
                    part: selectedPart,
                },
            });
        } else {
            alert('考试模式即将上线！');
        }
    };

    return (
        <div className="practice-page">
            <AppNavbar />

            <div className="practice-container">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">← 返回 AI 练习</Link>
                    <h1>🗣️ 口语练习配置</h1>
                    <p>选择题型、模式，AI 为你模拟雅思口语考官</p>
                </div>

                {/* ── Board 1: Vocabulary ── */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">📝 自选词汇</div>
                            <div className="label-desc">关闭后 AI 根据题型自动选择话题词汇</div>
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
                        <h3>🎯 雅思题型</h3>
                        {selectedMode !== 'exam' && (
                            <span className="sp-locked-hint">🔒 仅考试模式可选</span>
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
                            <div className="label-text">📄 显示字幕</div>
                            <div className="label-desc">通话/考试模式下显示 AI 的文字内容</div>
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
                    <h3>⚡ 练习模式</h3>
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

                {/* ── Start Button ── */}
                <div className="config-card">
                    <button
                        className="skill-btn speaking-start-btn"
                        style={{ width: '100%' }}
                        onClick={handleStart}
                    >
                        <span className="btn-icon">🗣️</span>
                        开始口语练习
                    </button>
                </div>
            </div>
        </div>
    );
}

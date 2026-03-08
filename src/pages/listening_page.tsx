// ListeningPractice.tsx
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createListeningState } from '../store/listen_page_store';
import type { VocabItem, ListeningData } from '../store/listen_page_store';
import { api } from '../api/client';
import { showToast } from '../components/Toast';
import '../styles/listening_page.css';
import '../styles/reading_page.css';

// 数字英文映射（用于答案比对）
const numberWords: Record<string, string> = {
    '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
    '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
    '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
    '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
    '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
    '30': 'thirty', '40': 'forty', '50': 'fifty', '60': 'sixty',
    '70': 'seventy', '80': 'eighty', '90': 'ninety', '100': 'hundred',
    '1000': 'thousand',
};

function normalizeAnswer(ans: string): string {
    let s = ans.trim().toLowerCase().replace(/\s+/g, ' ');
    Object.entries(numberWords).forEach(([num, word]) => {
        s = s.replace(new RegExp(`\\b${num}\\b`, 'g'), word);
    });
    return s;
}

function checkAnswer(userAns: string, acceptableAnswers: string[]): boolean {
    const norm = normalizeAnswer(userAns);
    return acceptableAnswers.some(a => normalizeAnswer(a) === norm);
}

export default function ListeningPage() {
    const { state } = useLocation();
    const vocabInput: string = state?.vocabInput ?? '';
    const difficulty: string = state?.difficulty ?? '7.0';
    const wordCountMin: number = state?.wordCountMin ?? 1;
    const wordCountMax: number = state?.wordCountMax ?? 2;
    const practiceType: 'article' | 'sentence' = state?.practiceType ?? 'article';
    const navigate = useNavigate();
    const onReturnHome = () => navigate('/');

    const [st, setSt] = useState(createListeningState);
    const set = <K extends keyof typeof st>(k: K, v: typeof st[K]) =>
        setSt(s => ({ ...s, [k]: v }));

    const [renderTick, setRenderTick] = useState(0);

    const userAnswersRef = useRef<Record<number, string>>({});
    const hasRequested = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const [ttsStarted, setTtsStarted] = useState(false);
    const [ttsSpeaking, setTtsSpeaking] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);

    // 清理 URL 对象
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;
        setSt(createListeningState());
        generateListening();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const formatHighlight = (text: string): string => {
        if (!text) return '';
        return text.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
    };

    // 去掉 ** 标记用于 TTS
    const stripMarkers = (text: string): string => {
        return text.replace(/\*\*/g, '');
    };

    const generateListening = async () => {
        const parsedList: VocabItem[] = vocabInput.trim().split('\n').map(line => {
            const parts = line.split(/[-:]/);
            return {
                word: parts[0] ? parts[0].trim() : '',
                meaning: parts[1] ? parts[1].trim() : ''
            };
        }).filter(item => item.word).sort((a, b) => a.word.localeCompare(b.word));

        set('vocabList', parsedList);
        const words = parsedList.map(v => v.word);

        try {
            const parsedData = await api<ListeningData>('/listening/generate', {
                method: 'POST',
                body: { words, difficulty, wordCountMin, wordCountMax, practiceType },
            });

            // 获取文本之后立马生成音频
            const passageText = stripMarkers(parsedData.passage);
            const introText = 'The IELTS listening test is about to begin. Please listen carefully.';
            const fullText = `${introText}\n\n\n\n${passageText}`;

            // Show audio loading indicator
            setAudioLoading(true);
            set('isLoading', false); // Show content but with audio spinner

            const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/listening/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: fullText })

            });

            if (!res.ok) {
                console.warn(`Failed to generate audio: ${res.statusText}`);
                // 即使音频生成失败，也把题目展示出来，但不打断流程
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                const audio = new Audio(url);
                audioRef.current = audio;

                audio.onended = () => {
                    setTtsSpeaking(false);
                    setTtsStarted(false); // 允许重播
                };

                audio.onerror = () => {
                    console.error("Audio playback error");
                    setTtsSpeaking(false);
                    setTtsStarted(false);
                };
            }
            setAudioLoading(false);

            set('listeningData', parsedData);
            // 前端防御：确保 questions 存在
            if (!parsedData.questions || parsedData.questions.length === 0) {
                showToast('AI 未能生成题目，请重试', 'error');
                onReturnHome();
                return;
            }
            userAnswersRef.current = {};
            if (practiceType === 'article') {
                set('isRightOpen', true);
            }
        } catch (err: unknown) {
            console.error("API Error:", err);
            const error = err as { message?: string, status?: number };
            showToast(error.message || '请求失败', 'error', error.status);
            onReturnHome();
        } finally {
            set('isLoading', false);
        }
    };

    const submitQuiz = () => {
        if (!st.listeningData) return;
        const totalQuestions = st.listeningData.questions.length;
        const answeredQuestions = Object.keys(userAnswersRef.current).length;
        if (answeredQuestions < totalQuestions) {
            if (!window.confirm('You have unanswered questions. Submit anyway?')) return;
        }
        // 停止 TTS
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setTtsSpeaking(false);
        set('step', 3);
    };

    // 播放已经预提取的音频
    const startTTS = async () => {
        if (!audioRef.current || ttsStarted) return;
        setTtsStarted(true);
        setTtsSpeaking(true);

        try {
            // 从头开始播放
            audioRef.current.currentTime = 0;
            await audioRef.current.play();
        } catch (err: unknown) {
            console.error("Audio playback error:", err);
            setTtsSpeaking(false);
            setTtsStarted(false);
            showToast('播放音频时出错，系统可能限制了自动播放', 'error');
        }
    };

    // Resizer logic (REMOVED: The layout is now single-column with inline inputs)

    // Resizer for results page passage sidebar
    useEffect(() => {
        const sidebar = document.getElementById('listeningPassageSidebar');
        if (!st.isPassageOpen) {
            if (sidebar) sidebar.style.width = '';
            return;
        }
        if (st.step !== 3) return;
        const resizer = document.getElementById('listeningResizerPassage');
        const layout = document.getElementById('listeningResultsLayout');
        if (!resizer || !sidebar || !layout) return;

        let isResizing = false, startX = 0, startWidth = 0;

        const onMouseDown = (e: MouseEvent) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.getBoundingClientRect().width;
            layout.classList.add('is-resizing');
            resizer.classList.add('resizing');
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth > 200 && newWidth < window.innerWidth * 0.55) {
                sidebar.style.width = newWidth + 'px';
            }
        };
        const onMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                layout.classList.remove('is-resizing');
                resizer.classList.remove('resizing');
            }
        };

        resizer.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            resizer.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [st.step, st.isPassageOpen]);

    // Loading — two distinct phases
    if (st.isLoading) {
        return (
            <div className="container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">
                        🧠 AI is writing your IELTS {difficulty} level listening passage... Please wait.
                    </div>
                </div>
            </div>
        );
    }

    if (audioLoading) {
        return (
            <div className="container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">
                        🔊 Generating audio... Please wait.
                    </div>
                </div>
            </div>
        );
    }

    // Practice Page
    if (st.step === 2 && st.listeningData) {
        const isArticleMode = st.listeningData.type === 'article';
        const isMultipleChoiceMode = st.listeningData.type === 'multiple_choice';

        // 去除原文所有的 ** 标记（考试呈现时不需要加粗高亮）
        const removeMarkdown = (text: string) => {
            if (!text) return '';
            return text.replace(/\*\*/g, '');
        };

        // 辅助渲染内联填空
        const renderInlineInput = (qId: number, idx: number) => {
            return (
                <input
                    key={`input-${qId}-${idx}`}
                    type="text"
                    className="inline-answer-input"
                    placeholder={qId.toString()}
                    defaultValue={userAnswersRef.current[qId] || ''}
                    onChange={(e) => { userAnswersRef.current[qId] = e.target.value; }}
                />
            );
        };

        const renderSentenceMode = () => {
            if (st.listeningData?.type !== 'sentence') return null;
            return st.listeningData.questions.slice(0, 10).map(q => {
                const parts = q.question.split('_____');
                return (
                    <div key={q.id} className="inline-q-block">
                        <span className="q-number">{q.id}.</span>
                        {parts.map((p: string, i: number) => (
                            <span key={i}>
                                <span>{removeMarkdown(p)}</span>
                                {i < parts.length - 1 && renderInlineInput(q.id, i)}
                            </span>
                        ))}
                    </div>
                );
            });
        };

        const renderArticleMode = () => {
            if (st.listeningData?.type !== 'article') return null;
            const textToSplit = st.listeningData.blanked_passage || st.listeningData.passage;
            const paragraphs = textToSplit.split('\n\n');
            let blankCounter = 1;

            return (
                <div className="listening-article-inline">
                    <h2 style={{ marginTop: 0 }}>{removeMarkdown(st.listeningData.title)}</h2>
                    {paragraphs.map((p: string, pIdx: number) => {
                        const parts = p.split('_____');
                        return (
                            <p key={pIdx} style={{ lineHeight: 2.2 }}>
                                {parts.map((partText: string, i: number) => (
                                    <span key={i}>
                                        <span>{removeMarkdown(partText)}</span>
                                        {i < parts.length - 1 && renderInlineInput(blankCounter++, i)}
                                    </span>
                                ))}
                            </p>
                        );
                    })}
                </div>
            );
        };

        const renderMultipleChoiceMode = () => {
            if (st.listeningData?.type !== 'multiple_choice') return null;
            return (
                <div className="listening-mc-mode" key={`tick-${renderTick}`}>
                    {st.listeningData.questions.map((q: any) => (
                        <div key={q.id} className="mc-q-block" style={{ marginBottom: '24px' }}>
                            <div className="q-number" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                                {q.id}. {removeMarkdown(q.question)}
                            </div>
                            <div className="mc-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.entries(q.options || {}).map(([key, optText]) => (
                                    <label key={key} className="mc-option-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name={`q-${q.id}`}
                                            value={key}
                                            checked={userAnswersRef.current[q.id] === key}
                                            onChange={(e) => {
                                                userAnswersRef.current[q.id] = e.target.value;
                                                // 触发重渲染以更新选中状态
                                                setRenderTick(t => t + 1);
                                            }}
                                        />
                                        <span style={{ fontWeight: 600 }}>{key}.</span> <span>{optText as string}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div className="container">
                <div className="page listening-page">
                    <div className="toolbar-area">
                        <div>
                            {!ttsStarted ? (
                                <button className="tts-start-btn" onClick={startTTS}>
                                    🔊 开始播放
                                </button>
                            ) : (
                                <span className={`tts-status ${ttsSpeaking ? 'speaking' : 'done'}`}>
                                    {ttsSpeaking ? '🔊 正在朗读...' : '✅ 朗读结束'}
                                </span>
                            )}
                        </div>
                        <div className="toolbar-info-badges">
                            <span className="toolbar-badge mode-badge">
                                {isArticleMode ? '📄 文章填空' : isMultipleChoiceMode ? '🎯 选择题' : '✏️ 句子填空'}
                            </span>
                            {!isMultipleChoiceMode && (
                                <span className="toolbar-badge limit-badge">
                                    ✍️ 每空不超过 {wordCountMax === wordCountMin
                                        ? `${wordCountMax} 个词`
                                        : `${wordCountMin}–${wordCountMax} 个词`}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="listening-content-area">
                        {isArticleMode ? renderArticleMode() : isMultipleChoiceMode ? renderMultipleChoiceMode() : renderSentenceMode()}

                        <div className="submit-quiz-container" style={{ marginTop: '40px', paddingBottom: '40px' }}>
                            <button onClick={submitQuiz}>Submit Answers</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Results Page
    if (st.step === 3 && st.listeningData) {
        let score = 0;
        const isMultipleChoiceMode = st.listeningData.type === 'multiple_choice';

        st.listeningData.questions.forEach((q: any) => {
            const userAns = userAnswersRef.current[q.id] || '';
            if (isMultipleChoiceMode) {
                if (userAns.trim().toUpperCase() === q.answer?.trim().toUpperCase()) score++;
            } else {
                if (checkAnswer(userAns, q.answers)) score++;
            }
        });
        const total = st.listeningData.questions.length;
        const pct = Math.round((score / total) * 100);
        const passageParagraphs = st.listeningData.passage.split('\n\n');

        return (
            <div className="container results-container">
                {/* Results Header */}
                <div className="results-header">
                    <div className="results-header-left">
                        <h1>Analysis & Explanations</h1>
                    </div>
                    <div className="results-header-right">
                        <div className="score-card">
                            <div className="score-number">{score}<span className="score-total">/{total}</span></div>
                            <div className="score-pct">{pct}%</div>
                        </div>
                        <button onClick={() => set('isPassageOpen', !st.isPassageOpen)} className="toggle-passage-btn">
                            {st.isPassageOpen ? '✕ Hide Passage' : '📖 Show Passage'}
                        </button>
                        <button onClick={onReturnHome} className="tool-btn">🏠 Home</button>
                    </div>
                </div>

                {/* Results Body */}
                <div className="results-layout" id="listeningResultsLayout">
                    {/* Passage Sidebar */}
                    <div className={`passage-sidebar ${st.isPassageOpen ? 'open' : ''}`} id="listeningPassageSidebar">
                        <h3>Original Passage</h3>
                        <h4 dangerouslySetInnerHTML={{ __html: formatHighlight(st.listeningData.title) }}></h4>
                        <div className="passage-text">
                            {passageParagraphs.map((p, idx) => (
                                <p key={idx} dangerouslySetInnerHTML={{ __html: formatHighlight(p) }}></p>
                            ))}
                        </div>
                        {st.vocabList.length > 0 && (
                            <div className="result-vocab-list" style={{ marginTop: '24px' }}>
                                <h3>📖 Target Vocabulary</h3>
                                <div className="vocab-chips">
                                    {st.vocabList.map((v, i) => (
                                        <span key={i} className="vocab-chip">
                                            <strong>{v.word}</strong> {v.meaning && `— ${v.meaning}`}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Resizer */}
                    <div className={`resizer ${st.isPassageOpen ? 'active' : ''}`} id="listeningResizerPassage"></div>

                    {/* Analysis Content */}
                    <div className="results-content">
                        {st.listeningData.questions.map((q: any) => {
                            const userAns = userAnswersRef.current[q.id] || 'None';
                            let isCorrect = false;

                            if (isMultipleChoiceMode) {
                                isCorrect = userAns.trim().toUpperCase() === q.answer?.trim().toUpperCase();
                                return (
                                    <div key={q.id} className="result-block">
                                        <div className="question-text">{q.id}. {q.question.replace(/\*\*/g, '')}</div>
                                        {q.options && Object.entries(q.options).map(([k, v]) => (
                                            <div key={k} style={{
                                                marginLeft: '12px',
                                                color: k === q.answer ? '#16a34a' : (k === userAns && !isCorrect ? '#dc2626' : 'inherit'),
                                                fontWeight: k === q.answer ? 'bold' : 'normal'
                                            }}>
                                                {k}. {v as string} {k === q.answer ? ' ✓' : (k === userAns && !isCorrect ? ' ✗' : '')}
                                            </div>
                                        ))}
                                        <p style={{ marginTop: '12px' }}>
                                            Your Answer: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | Correct: <strong>{q.answer}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                        </p>
                                        <div className="explanation">
                                            <strong>解析:</strong> {q.explanation}
                                        </div>
                                    </div>
                                );
                            } else {
                                isCorrect = checkAnswer(userAns, q.answers);
                                return (
                                    <div key={q.id} className="result-block">
                                        <div className="question-text">{q.id}. {q.question.replace(/\*\*/g, '')}</div>
                                        <p>Your Answer: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | Acceptable: <strong>{q.answers.join(' / ')}</strong></p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                        </p>
                                        <div className="explanation">
                                            <strong>解析:</strong> {q.explanation}
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

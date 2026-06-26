import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createListeningState } from '../../store/listen_page_store';
import type { VocabItem, ListeningData, MapLandmark, MapDecoration } from '../../store/listen_page_store';
import { api } from '../../api/client';
import { showToast } from '../../components/common/Toast';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import { sanitize } from '../../utils/safe_html';
import '../../styles/listening_page.css';
import '../../styles/reading_page.css';

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
    const [searchParams] = useSearchParams();
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    const vocabInput: string = state?.vocabInput ?? '';
    const difficulty: string = state?.difficulty ?? '7.0';
    const wordCountMin: number = state?.wordCountMin ?? 1;
    const wordCountMax: number = state?.wordCountMax ?? 2;
    const practiceType: 'article' | 'sentence' | 'multiple_choice' | 'map' = state?.practiceType ?? 'article';
    const navigate = useNavigate();
    const onReturnHome = () => navigate(bankId ? '/practice/ai/bank' : '/');
    const { translations: t } = useLang();
    const [absurdMode] = useState<boolean>(Boolean(state?.absurdMode));

    const [st, setSt] = useState(createListeningState);
    const set = <K extends keyof typeof st>(k: K, v: typeof st[K]) =>
        setSt(s => ({ ...s, [k]: v }));

    const [renderTick, setRenderTick] = useState(0);

    const userAnswersRef = useRef<Record<number, string>>({});
    const hasRequested = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const floatBtnRef = useRef<HTMLDivElement | null>(null);
    const activeEditorRef = useRef<HTMLElement | null>(null);
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

    const CACHE_KEY = 'listening_session_cache';

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;

        // 题库模式：按 bankId 拉取题目，不调用 AI 生成
        if (bankId) {
            sessionStorage.removeItem(CACHE_KEY);
            setSt(createListeningState());
            loadFromBank(bankId);
            return;
        }

        // 刷新恢复：优先从 sessionStorage 读取缓存数据
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { listeningData: cachedData, vocabList: cachedVocab } = JSON.parse(cached);
                setSt(s => ({
                    ...s,
                    listeningData: cachedData,
                    vocabList: cachedVocab,
                    isLoading: false,
                }));
                // 音频不可持久化，刷新后无音频但题目保留
                return;
            } catch {
                sessionStorage.removeItem(CACHE_KEY);
            }
        }

        setSt(createListeningState());
        generateListening();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAudioForPassage = async (passage: string) => {
        const introText = 'The IELTS listening test is about to begin. Please listen carefully.';
        const fullText = `${introText}\n\n\n\n${stripMarkers(passage)}`;
        // Auth travels via httpOnly cookie now → credentials: 'include' instead of Bearer header.
        const csrf = document.cookie.split('; ').find(c => c.startsWith('aielts_csrf='))?.split('=')[1];
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/listening/audio`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
            },
            body: JSON.stringify({ text: fullText }),
        });
        if (!res.ok) {
            console.warn(`Failed to generate audio: ${res.statusText}`);
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setTtsSpeaking(false); setTtsStarted(false); };
        audio.onerror = () => { console.error('Audio playback error'); setTtsSpeaking(false); setTtsStarted(false); };
    };

    const loadFromBank = async (id: number) => {
        set('isLoading', true);
        try {
            const detail = await getAIQuestion(id);
            const content = (detail.content || {}) as Partial<ListeningData>;
            if (!content.passage || !Array.isArray(content.questions)) {
                showToast('题目内容缺失，已删除或损坏', 'error');
                navigate('/practice/ai/bank');
                return;
            }
            const listeningData = content as ListeningData;
            setSt(s => ({
                ...s,
                listeningData,
                vocabList: [],
                isLoading: false,
                isRightOpen: listeningData.type === 'article',
                step: 2,
            }));

            const saved = (detail.userAnswer || null) as Record<number, string> | null;
            if (saved && typeof saved === 'object') {
                userAnswersRef.current = { ...saved };
                setSt(s => ({ ...s, step: 3 }));
            } else {
                userAnswersRef.current = {};
            }

            setAudioLoading(true);
            await fetchAudioForPassage(listeningData.passage);
            setAudioLoading(false);
        } catch (err: unknown) {
            console.error('Bank load error:', err);
            showToast('题库加载失败', 'error');
            navigate('/practice/ai/bank');
        } finally {
            set('isLoading', false);
            setAudioLoading(false);
        }
    };

    const formatHighlight = (text: string): string => {
        if (!text) return '';
        return text.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
    };

    // 去掉 ** 标记用于 TTS
    const stripMarkers = (text: string): string => {
        return text.replace(/\*\*/g, '');
    };

    const generateListening = async () => {
        set('isLoading', true);
        setAudioLoading(false);
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
            const parsedData = await api<ListeningData & { aiQuestionId?: number | null }>('/listening/generate', {
                method: 'POST',
                body: { words, difficulty, wordCountMin, wordCountMax, practiceType, absurdMode },
            });

            // 前端防御：确保 questions 存在
            if (!parsedData.questions || parsedData.questions.length === 0) {
                showToast(t.listeningDetails.noQuestions, 'error');
                onReturnHome();
                return;
            }

            // 生成成功后跳转到 AI 题库，由用户在题库内挑题作答
            sessionStorage.removeItem(CACHE_KEY);
            const justId = parsedData.aiQuestionId ?? null;
            showToast('题目已生成并保存到 AI 题库', 'success');
            navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            return;
        } catch (err: unknown) {
            console.error("API Error:", err);
            const error = err as { message?: string, status?: number };
            showToast(error.message || t.common.error, 'error', error.status);
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
            if (!window.confirm(t.readingDetails.submitConfirm)) return;
        }
        // 停止 TTS
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setTtsSpeaking(false);
        if (bankId) {
            submitAIQuestion(bankId, { ...userAnswersRef.current }).catch(err => {
                console.error('submit to bank failed:', err);
                showToast('保存作答失败，但本次成绩已显示', 'error');
            });
        }
        set('step', 3);
    };

    const restartFromBank = () => {
        userAnswersRef.current = {};
        setSt(s => ({ ...s, step: 2 }));
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
            showToast(t.listeningDetails.audioError, 'error');
        }
    };

    // Resizer logic (REMOVED: The layout is now single-column with inline inputs)

    // 浮动下划线
    const executeUnderline = () => {
        if (!activeEditorRef.current) return;
        activeEditorRef.current.contentEditable = 'true';
        document.execCommand('underline', false, '');
        activeEditorRef.current.contentEditable = 'false';
        if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
        window.getSelection()?.removeAllRanges();
    };

    useEffect(() => {
        if (st.step !== 2 || st.isLoading) return;
        const handleGlobalMouseUp = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isContent = target.closest('#listeningContent');
            if (!isContent) {
                if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
                return;
            }
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim() || '';
            if (selectedText.length > 0) {
                activeEditorRef.current = document.getElementById('listeningContent') as HTMLElement;
                if (floatBtnRef.current) {
                    floatBtnRef.current.classList.add('visible');
                    floatBtnRef.current.style.left = (e.pageX + 15) + 'px';
                    floatBtnRef.current.style.top = (e.pageY - 40) + 'px';
                }
            } else {
                if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
            }
        };
        const handleGlobalMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (floatBtnRef.current && !floatBtnRef.current.contains(target)) {
                floatBtnRef.current.classList.remove('visible');
            }
        };
        document.body.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('mousedown', handleGlobalMouseDown);
        return () => {
            document.body.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('mousedown', handleGlobalMouseDown);
        };
    }, [st.step, st.isLoading]);

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
            <div className="reading-container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">
                        🧠 {t.listeningDetails.writingPassage}
                    </div>
                </div>
            </div>
        );
    }

    if (audioLoading) {
        return (
            <div className="reading-container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">
                        🔊 {t.listeningDetails.generatingAudio}
                    </div>
                </div>
            </div>
        );
    }

    // Practice Page
    if (st.step === 2 && st.listeningData) {
        const isArticleMode = st.listeningData.type === 'article';
        const isMultipleChoiceMode = st.listeningData.type === 'multiple_choice';
        const isMapMode = st.listeningData.type === 'map';

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
                    {st.listeningData.questions.map((q: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
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
                                        <span style={{ fontWeight: 600 }}>{key}.</span> <span>{removeMarkdown(optText as string)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            );
        };

        // ─── 地图题模式 ─────────────────────────────────────
        const renderMapMode = () => {
            if (st.listeningData?.type !== 'map') return null;
            const mapData = st.listeningData.map;
            const options = st.listeningData.options;
            const questions = st.listeningData.questions;
            const vw = mapData.width || 600;
            const vh = mapData.height || 400;

            const renderDecoration = (d: MapDecoration, i: number) => {
                const dw = d.w || 40;
                const dh = d.h || 40;
                switch (d.type) {
                    case 'tree':
                        return <g key={`dec-${i}`}><circle cx={d.x} cy={d.y - 8} r={12} fill="#22c55e" opacity={0.6} /><rect x={d.x - 2} y={d.y} width={4} height={10} fill="#a16207" /></g>;
                    case 'lake':
                        return <ellipse key={`dec-${i}`} cx={d.x + dw / 2} cy={d.y + dh / 2} rx={dw / 2} ry={dh / 2} fill="#93c5fd" opacity={0.5} stroke="#60a5fa" strokeWidth={1} />;
                    case 'garden':
                        return <rect key={`dec-${i}`} x={d.x} y={d.y} width={dw} height={dh} fill="#86efac" opacity={0.4} rx={6} stroke="#4ade80" strokeWidth={1} />;
                    case 'parking':
                        return <g key={`dec-${i}`}><rect x={d.x} y={d.y} width={dw} height={dh} fill="#e5e7eb" rx={4} stroke="#9ca3af" strokeWidth={1} /><text x={d.x + dw / 2} y={d.y + dh / 2 + 4} textAnchor="middle" fontSize={10} fill="#6b7280">P</text></g>;
                    case 'fountain':
                        return <g key={`dec-${i}`}><circle cx={d.x} cy={d.y} r={15} fill="#bfdbfe" stroke="#60a5fa" strokeWidth={1} /><circle cx={d.x} cy={d.y} r={6} fill="#93c5fd" /></g>;
                    default:
                        return null;
                }
            };

            const renderLandmark = (lm: MapLandmark) => {
                const isQuestion = lm.questionId != null;
                if (isQuestion) {
                    // 编号红色标记圆圈
                    return (
                        <g key={lm.id}>
                            <circle cx={lm.x} cy={lm.y} r={16} fill="#ef4444" opacity={0.9} />
                            <text x={lm.x} y={lm.y + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="white">{lm.questionId}</text>
                        </g>
                    );
                }
                // 已标注地标
                if (lm.shape === 'circle') {
                    const r = lm.r || 25;
                    return (
                        <g key={lm.id}>
                            <circle cx={lm.x} cy={lm.y} r={r} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />
                            <text x={lm.x} y={lm.y + 4} textAnchor="middle" fontSize={10} fontWeight="600" fill="#334155">{lm.label}</text>
                        </g>
                    );
                }
                const w = lm.w || 70;
                const h = lm.h || 45;
                return (
                    <g key={lm.id}>
                        <rect x={lm.x - w / 2} y={lm.y - h / 2} width={w} height={h} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} rx={4} />
                        <text x={lm.x} y={lm.y + 4} textAnchor="middle" fontSize={10} fontWeight="600" fill="#334155">{lm.label}</text>
                    </g>
                );
            };

            return (
                <div className="map-layout">
                    <div className="map-svg-container">
                        <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>🗺️ {mapData.name}</h3>
                        <svg viewBox={`0 0 ${vw} ${vh}`} className="map-svg">
                            {/* Background */}
                            <rect width={vw} height={vh} fill="#fefce8" rx={8} />
                            {/* Grid */}
                            {Array.from({ length: Math.floor(vw / 50) }, (_, i) => (
                                <line key={`gv-${i}`} x1={(i + 1) * 50} y1={0} x2={(i + 1) * 50} y2={vh} stroke="#e5e7eb" strokeWidth={0.5} />
                            ))}
                            {Array.from({ length: Math.floor(vh / 50) }, (_, i) => (
                                <line key={`gh-${i}`} x1={0} y1={(i + 1) * 50} x2={vw} y2={(i + 1) * 50} stroke="#e5e7eb" strokeWidth={0.5} />
                            ))}
                            {/* Decorations */}
                            {mapData.decorations?.map((d, i) => renderDecoration(d, i))}
                            {/* Paths */}
                            {mapData.paths?.map((p, i) => (
                                <g key={`path-${i}`}>
                                    <polyline
                                        points={p.points.map(pt => pt.join(',')).join(' ')}
                                        fill="none" stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                                    />
                                    {p.label && p.points.length >= 2 && (
                                        <text
                                            x={(p.points[0][0] + p.points[1][0]) / 2}
                                            y={(p.points[0][1] + p.points[1][1]) / 2 - 6}
                                            textAnchor="middle" fontSize={9} fill="#6b7280" fontStyle="italic"
                                        >{p.label}</text>
                                    )}
                                </g>
                            ))}
                            {/* Landmarks */}
                            {mapData.landmarks?.map(lm => renderLandmark(lm))}
                        </svg>
                    </div>
                    <div className="map-options-panel">
                        <h3 style={{ margin: '0 0 12px 0' }}>{t.listeningDetails.mapInstructions}</h3>
                        <div className="map-options-list">
                            {options.map((opt, i) => (
                                <div key={i} className="map-option-item">{opt}</div>
                            ))}
                        </div>
                        <div className="map-questions-list">
                            {questions.map(q => (
                                <div key={q.id} className="map-q-row">
                                    <span className="map-q-number">{q.id}.</span>
                                    <select
                                        className="map-select"
                                        defaultValue={userAnswersRef.current[q.id] || ''}
                                        onChange={e => { userAnswersRef.current[q.id] = e.target.value; setRenderTick(t => t + 1); }}
                                    >
                                        <option value="">{t.listeningDetails.selectOption}</option>
                                        {options.map((opt, i) => {
                                            const letter = opt.split('.')[0]?.trim();
                                            return <option key={i} value={letter}>{opt}</option>;
                                        })}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="reading-container">
                <div id="floatUnderlineBtn" ref={floatBtnRef} onMouseDown={(e) => e.preventDefault()} onClick={executeUnderline}>
                    <u>U</u> {t.readingDetails.underline}
                </div>
                <div className="page listening-page">
                    <div className="toolbar-area">
                        <div className="toolbar-left-group">
                            {!ttsStarted ? (
                                <button className="toolbar-btn toolbar-btn-primary" onClick={startTTS}>
                                    <span className="btn-icon">🔊</span> {t.listeningDetails.startAudio}
                                </button>
                            ) : (
                                <span className={`tts-status ${ttsSpeaking ? 'speaking' : 'done'}`}>
                                    {ttsSpeaking ? `🔊 ${t.listeningDetails.speaking}` : `✅ ${t.listeningDetails.audioDone}`}
                                </span>
                            )}
                        </div>
                        <div className="toolbar-info-badges">
                            <span className="toolbar-badge mode-badge">
                                {isMapMode ? `🗺️ ${t.listeningDetails.typeMap}` : isArticleMode ? `📄 ${t.listeningDetails.typeArticle}` : isMultipleChoiceMode ? `🎯 ${t.listeningDetails.typeMC}` : `✏️ ${t.listeningDetails.typeSentence}`}
                            </span>
                            {!isMultipleChoiceMode && !isMapMode && (
                                <span className="toolbar-badge limit-badge">
                                    ✍️ {t.listeningDetails.wordLimit} {wordCountMax === wordCountMin
                                        ? `${wordCountMax} ${t.listeningDetails.wordUnit}`
                                        : `${wordCountMin}–${wordCountMax} ${t.listeningDetails.wordUnit}`}
                                </span>
                            )}
                        </div>
                        <div className="toolbar-right-group">
                            <button className="toolbar-btn toolbar-btn-danger" onClick={() => {
                                if (window.confirm('确定要退出练习吗？未提交的进度可能会丢失。')) {
                                    if (audioRef.current) audioRef.current.pause();
                                    onReturnHome();
                                }
                            }}>
                                <span className="btn-icon">🚪</span> 退出练习
                            </button>
                        </div>
                    </div>

                    <div className="listening-content-area" id="listeningContent">
                        {isMapMode ? renderMapMode() : isArticleMode ? renderArticleMode() : isMultipleChoiceMode ? renderMultipleChoiceMode() : renderSentenceMode()}

                        <div className="submit-quiz-container" style={{ marginTop: '40px', paddingBottom: '40px' }}>
                            <button onClick={submitQuiz}>{t.readingDetails.submitBtn}</button>
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
        const isMapMode = st.listeningData.type === 'map';

        st.listeningData.questions.forEach((q: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const userAns = userAnswersRef.current[q.id] || '';
            if (isMapMode || isMultipleChoiceMode) {
                if (userAns.trim().toUpperCase() === q.answer?.trim().toUpperCase()) score++;
            } else {
                if (checkAnswer(userAns, q.answers)) score++;
            }
        });
        const total = st.listeningData.questions.length;
        const pct = Math.round((score / total) * 100);
        const passageParagraphs = st.listeningData.passage.split('\n\n');

        return (
            <div className="results-container">
                {/* Results Header */}
                <div className="results-header">
                    <div className="results-header-left">
                        <h1>{t.results.analysis}</h1>
                    </div>
                    <div className="results-header-right">
                        <div className="score-card">
                            <div className="score-number">{score}<span className="score-total">/{total}</span></div>
                            <div className="score-pct">{pct}%</div>
                        </div>
                        <button onClick={() => set('isPassageOpen', !st.isPassageOpen)} className={`toolbar-btn ${st.isPassageOpen ? 'active' : 'toolbar-btn-outline'}`}>
                            <span className="btn-icon">{st.isPassageOpen ? '✕' : '📖'}</span> {st.isPassageOpen ? t.results.hidePassage : t.results.showPassage}
                        </button>
                        {bankId && (
                            <button onClick={restartFromBank} className="toolbar-btn toolbar-btn-outline"><span className="btn-icon">🔁</span> 重新作答</button>
                        )}
                        <button onClick={onReturnHome} className="toolbar-btn"><span className="btn-icon">{bankId ? '📚' : '🏠'}</span> {bankId ? '返回题库' : t.common.home}</button>
                    </div>
                </div>

                {/* Results Body */}
                <div className="results-layout" id="listeningResultsLayout">
                    {/* Passage Sidebar */}
                    <div className={`passage-sidebar ${st.isPassageOpen ? 'open' : ''}`} id="listeningPassageSidebar">
                        <h3>{t.results.originalPassage}</h3>
                        <h4 dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(st.listeningData.title)) }}></h4>
                        <div className="passage-text">
                            {passageParagraphs.map((p, idx) => (
                                <p key={idx} dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(p)) }}></p>
                            ))}
                        </div>
                        {st.vocabList.length > 0 && (
                            <div className="result-vocab-list" style={{ marginTop: '24px' }}>
                                <h3>📖 {t.results.targetVocab}</h3>
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
                        {st.listeningData.questions.map((q: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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
                                            {t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {t.results.correctAnswer}: <strong>{q.answer}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t.results.statusCorrect}` : `✗ ${t.results.statusIncorrect}`}
                                        </p>
                                        <div className="explanation">
                                            <strong>{t.results.explanation}:</strong> {q.explanation}
                                        </div>
                                    </div>
                                );
                            } else if (isMapMode) {
                                isCorrect = userAns.trim().toUpperCase() === q.answer?.trim().toUpperCase();
                                // 找到对应的选项文字
                                const mapOptions = st.listeningData && st.listeningData.type === 'map' ? st.listeningData.options : [];
                                const correctOptText = mapOptions.find((o: string) => o.startsWith(q.answer)) || q.answer;
                                const userOptText = mapOptions.find((o: string) => o.startsWith(userAns)) || userAns;
                                return (
                                    <div key={q.id} className="result-block">
                                        <div className="question-text">📍 Location {q.id}</div>
                                        <p>
                                            {t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userOptText || 'None'}</strong> | {t.results.correctAnswer}: <strong>{correctOptText}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t.results.statusCorrect}` : `✗ ${t.results.statusIncorrect}`}
                                        </p>
                                        <div className="explanation">
                                            <strong>{t.results.explanation}:</strong> {q.explanation}
                                        </div>
                                    </div>
                                );
                            } else {
                                isCorrect = checkAnswer(userAns, q.answers);
                                return (
                                    <div key={q.id} className="result-block">
                                        <div className="question-text">{q.id}. {q.question.replace(/\*\*/g, '')}</div>
                                        <p>{t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {t.results.acceptableAnswers}: <strong>{q.answers.join(' / ')}</strong></p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t.results.statusCorrect}` : `✗ ${t.results.statusIncorrect}`}
                                        </p>
                                        <div className="explanation">
                                            <strong>{t.results.explanation}:</strong> {q.explanation}
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

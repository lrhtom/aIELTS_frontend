import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createListeningState } from '../../store/listen_page_store';
import type {
    VocabItem,
    ListeningData,
    LegacyListeningData,
    MapData,
    MapLandmark,
    MapDecoration,
    FormListeningData,
    TableListeningData,
    FlowchartListeningData,
    ShortAnswerListeningData,
    MatchingListeningData,
    FullListeningData,
} from '../../store/listen_page_store';
import { api } from '../../api/client';
import { showToast } from '../../components/common/Toast';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import { sanitize } from '../../utils/safe_html';
import { mapImageSrc } from '../../utils/media';
import {
    FormRenderer,
    TableRenderer,
    FlowchartRenderer,
    ShortAnswerRenderer,
    MatchingRenderer,
    NoteRenderer,
    scoreListeningQuestions,
} from '../../components/listening/ListeningQuestionRenderer';
import ListeningMapSVG from '../../components/listening/ListeningMapSVG';
import MatchingLetterGrid from '../../components/common/MatchingLetterGrid';
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

function checkAnswer(userAns: string, acceptableAnswers: unknown): boolean {
    if (!Array.isArray(acceptableAnswers)) return false;
    const norm = normalizeAnswer(userAns);
    return acceptableAnswers.some(a => normalizeAnswer(String(a ?? '')) === norm);
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
    const practiceType: string = state?.practiceType ?? 'article';
    const mode: 'single' | 'full' = state?.mode === 'full' ? 'full' : 'single';
    const scenario: string = state?.scenario ?? 'random';
    const scenarioS1: string = state?.scenarioS1 ?? 'random';
    const scenarioS2: string = state?.scenarioS2 ?? 'random';
    const scenarioS3: string = state?.scenarioS3 ?? 'random';
    const scenarioS4: string = state?.scenarioS4 ?? 'random';
    const fullScope: 'all' | 'single' = state?.fullScope === 'single' ? 'single' : 'all';
    const sectionNum: number | undefined = state?.sectionNum;
    const customName: string = typeof state?.customName === 'string' ? state.customName.trim() : '';
    const customDescription: string = typeof state?.customDescription === 'string' ? state.customDescription.trim() : '';
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

    // Playback controls — persisted across sessions so the user's speed
    // preference and hidden-controls choice survive a page refresh.
    const PLAYBACK_RATE_KEY = 'listening_playback_rate';
    const CONTROLS_HIDDEN_KEY = 'listening_controls_hidden';
    const [playbackTime, setPlaybackTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState<number>(() => {
        const stored = Number(localStorage.getItem(PLAYBACK_RATE_KEY));
        return stored > 0 ? stored : 1;
    });
    const [controlsHidden, setControlsHidden] = useState<boolean>(
        () => localStorage.getItem(CONTROLS_HIDDEN_KEY) === 'true',
    );

    // ── Answer helpers for v2 renderers (must be declared BEFORE any early
    // return so the hook order stays stable across renders — see Rules of Hooks). ──
    const getAnswer = useCallback((qid: number) => userAnswersRef.current[qid] || '', []);
    const setAnswerV2 = useCallback((qid: number, value: string) => {
        userAnswersRef.current[qid] = value;
        setRenderTick(t => t + 1);
    }, []);

    const formatAudioTime = (secs: number): string => {
        if (!isFinite(secs) || secs < 0) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSeek = (value: number) => {
        if (!audioRef.current || !isFinite(value)) return;
        audioRef.current.currentTime = value;
        setPlaybackTime(value);
    };

    const handleRateChange = (rate: number) => {
        setPlaybackRate(rate);
        localStorage.setItem(PLAYBACK_RATE_KEY, String(rate));
        if (audioRef.current) audioRef.current.playbackRate = rate;
    };

    const togglePlayPause = async () => {
        const a = audioRef.current;
        if (!a) return;
        try {
            if (a.paused || a.ended) {
                if (a.ended) a.currentTime = 0;
                await a.play();
            } else {
                a.pause();
            }
        } catch (err) {
            console.error('togglePlayPause error:', err);
        }
    };

    const skipSeconds = (delta: number) => {
        const a = audioRef.current;
        if (!a) return;
        const next = Math.max(0, Math.min(a.duration || 0, a.currentTime + delta));
        a.currentTime = next;
        setPlaybackTime(next);
    };

    const toggleControlsHidden = () => {
        setControlsHidden((prev) => {
            const next = !prev;
            localStorage.setItem(CONTROLS_HIDDEN_KEY, String(next));
            return next;
        });
    };

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
        audio.playbackRate = playbackRate;
        audioRef.current = audio;
        audio.onended = () => { setTtsSpeaking(false); };
        audio.onerror = () => { console.error('Audio playback error'); setTtsSpeaking(false); setTtsStarted(false); };
        audio.onloadedmetadata = () => setAudioDuration(audio.duration || 0);
        audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
        audio.onplay = () => setTtsSpeaking(true);
        audio.onpause = () => setTtsSpeaking(false);
    };

    const loadFromBank = async (id: number) => {
        set('isLoading', true);
        try {
            const detail = await getAIQuestion(id);
            const content = (detail.content || {}) as Partial<ListeningData> & Partial<FullListeningData>;
            const isFull = content.type === 'full' || Array.isArray((content as FullListeningData).sections);
            if (isFull) {
                const fullContent = content as FullListeningData;
                if (!Array.isArray(fullContent.sections) || fullContent.sections.length === 0) {
                    showToast(t.listeningDetails.toastContentMissing, 'error');
                    navigate('/practice/ai/bank');
                    return;
                }
                setSt(s => ({
                    ...s,
                    listeningData: fullContent,
                    activeSection: (fullContent.sections[0]?.sectionNum || 1) as 1 | 2 | 3 | 4,
                    vocabList: [],
                    isLoading: false,
                    isRightOpen: true,
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
                await fetchAudioForPassage(fullContent.sections[0]?.passage || '');
                setAudioLoading(false);
                return;
            }
            const singleContent = content as { passage?: string; questions?: unknown };
            if (!singleContent.passage || !Array.isArray(singleContent.questions)) {
                showToast(t.listeningDetails.toastContentMissing, 'error');
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
            await fetchAudioForPassage((listeningData as LegacyListeningData).passage || '');
            setAudioLoading(false);
        } catch (err: unknown) {
            console.error('Bank load error:', err);
            showToast(t.aiBank.loadFail, 'error');
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
            // Backend now returns 202 { aiQuestionId, status: 'generating', title } instantly.
            // We navigate straight to the AI bank; the "generating" card shows there until
            // the background thread flips status → 'ready'.
            let parsedData: { aiQuestionId?: number | null; status?: string };
            if (mode === 'full') {
                const body: Record<string, unknown> = {
                    difficulty,
                    absurdMode,
                    scenarioS1,
                    scenarioS2,
                    scenarioS3,
                    scenarioS4,
                };
                if (fullScope === 'single' && sectionNum) body.sectionNum = sectionNum;
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                parsedData = await api('/listening/full', { method: 'POST', body });
            } else {
                const body: Record<string, unknown> = {
                    words, difficulty, wordCountMin, wordCountMax, practiceType, absurdMode, scenario,
                };
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                parsedData = await api('/listening/generate', {
                    method: 'POST',
                    body,
                });
            }

            sessionStorage.removeItem(CACHE_KEY);
            const justId = parsedData.aiQuestionId ?? null;
            showToast(t.aiBank.toastGeneratedSaved, 'success');
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
        // Total question count spans full-test sections OR single quiz.
        let totalQuestions = 0;
        if (st.listeningData.type === 'full') {
            for (const sec of st.listeningData.sections) totalQuestions += sec.questions.length;
        } else {
            totalQuestions = st.listeningData.questions.length;
        }
        const answeredQuestions = Object.values(userAnswersRef.current).filter(v => String(v).trim().length > 0).length;
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
                showToast(t.listeningDetails.toastSaveFail, 'error');
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
        if (!ttsStarted) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
            e.preventDefault();
            togglePlayPause();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [st.step, st.isLoading, ttsStarted]);

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

    // Fetch a new audio for the given passage (used when full-test section changes)
    const switchFullSection = async (sn: 1 | 2 | 3 | 4) => {
        if (!st.listeningData || st.listeningData.type !== 'full') return;
        const sec = st.listeningData.sections.find(s => s.sectionNum === sn);
        if (!sec) return;
        set('activeSection', sn);
        setTtsStarted(false);
        setTtsSpeaking(false);
        if (audioRef.current) audioRef.current.pause();
        setAudioLoading(true);
        try {
            await fetchAudioForPassage(sec.passage);
        } finally {
            setAudioLoading(false);
        }
    };

    // Practice Page
    if (st.step === 2 && st.listeningData) {
        const isFull = st.listeningData.type === 'full';
        const isArticleMode = st.listeningData.type === 'article';
        const isMultipleChoiceMode = st.listeningData.type === 'multiple_choice';
        const isMapMode = st.listeningData.type === 'map';
        // v2 new types
        const isFormMode = st.listeningData.type === 'form';
        const isTableMode = st.listeningData.type === 'table';
        const isFlowchartMode = st.listeningData.type === 'flowchart';
        const isShortAnswerMode = st.listeningData.type === 'short_answer';
        const isMatchingMode = st.listeningData.type === 'matching';

        // 去除原文所有的 ** 标记（考试呈现时不需要加粗高亮）
        const removeMarkdown = (text: string) => {
            if (!text) return '';
            return text.replace(/\*\*/g, '');
        };

        // 辅助渲染内联填空
        const renderInlineInput = (qId: number, idx: number) => {
            // 与阅读 note/summary/sentence completion 共用 .rd-blank-input 样式
            return (
                <input
                    key={`input-${qId}-${idx}`}
                    type="text"
                    className="rd-blank-input"
                    placeholder={qId.toString()}
                    defaultValue={userAnswersRef.current[qId] || ''}
                    onChange={(e) => { userAnswersRef.current[qId] = e.target.value; }}
                />
            );
        };

        const renderSentenceMode = () => {
            if (st.listeningData?.type !== 'sentence') return null;
            // 与阅读 sentence_completion 共用 .rd-inline-q-block / .rd-blank-* 样式
            const qs = Array.isArray(st.listeningData.questions) ? st.listeningData.questions : [];
            return qs.slice(0, 10).map(q => {
                const parts = q.question.split('_____');
                return (
                    <div key={q.id} className="rd-inline-q-block">
                        <span className="rd-blank-num">{q.id}.</span>{' '}
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
            const textToSplit = st.listeningData.blanked_passage || st.listeningData.passage || '';
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
            // 与阅读 MCQ 共用 .question-block / .question-text / .option-label 样式
            const qs = Array.isArray(st.listeningData.questions) ? st.listeningData.questions : [];
            return (
                <div className="listening-mc-mode" key={`tick-${renderTick}`}>
                    {qs.map((q: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                        <div key={q.id} className="question-block">
                            <div className="question-text">
                                {q.id}. {removeMarkdown(q.question)}
                            </div>
                            {Object.entries(q.options || {}).map(([key, optText]) => (
                                <label key={key} className="option-label">
                                    <input
                                        type="radio"
                                        name={`q-${q.id}`}
                                        value={key}
                                        defaultChecked={userAnswersRef.current[q.id] === key}
                                        onChange={(e) => {
                                            userAnswersRef.current[q.id] = e.target.value;
                                        }}
                                    />
                                    <strong>{key}.</strong>{' '}
                                    <span>{removeMarkdown(optText as string)}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                </div>
            );
        };

        // ─── 地图题模式 ─────────────────────────────────────
        const renderMapMode = () => {
            if (st.listeningData?.type !== 'map') return null;
            const mapData = st.listeningData.map || ({} as MapData);
            const options = Array.isArray(st.listeningData.options) ? st.listeningData.options : [];
            const questions = Array.isArray(st.listeningData.questions) ? st.listeningData.questions : [];
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

            // Reference IELTS format: buildings labelled with letters A-J directly,
            // no numbered red markers. Legacy questionId falls through to the label
            // path so old records still render cleanly.
            const renderLandmark = (lm: MapLandmark) => {
                const label = String(lm.label ?? '');
                const isLetter = label.length === 1 && /^[A-Z]$/.test(label);
                const fontSize = isLetter ? 22 : 11;
                const fontWeight = isLetter ? 800 : 600;
                if (lm.shape === 'circle') {
                    const r = lm.r || 25;
                    return (
                        <g key={lm.id}>
                            <circle cx={lm.x} cy={lm.y} r={r} fill="white" stroke="#1f2937" strokeWidth={1.5} />
                            <text x={lm.x} y={lm.y + fontSize / 3} textAnchor="middle" fontSize={fontSize} fontWeight={fontWeight} fill="#1f2937">{label}</text>
                        </g>
                    );
                }
                const w = lm.w || 70;
                const h = lm.h || 45;
                return (
                    <g key={lm.id}>
                        <rect x={lm.x - w / 2} y={lm.y - h / 2} width={w} height={h} fill="white" stroke="#1f2937" strokeWidth={1.5} rx={2} />
                        <text x={lm.x} y={lm.y + fontSize / 3} textAnchor="middle" fontSize={fontSize} fontWeight={fontWeight} fill="#1f2937">{label}</text>
                    </g>
                );
            };

            return (
                <div className="map-layout">
                    <div className="map-svg-container">
                        <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>🗺️ {mapData.name}</h3>
                        {(() => {
                            const resolvedSrc = mapImageSrc(mapData.imagePath, mapData.imageUrl);
                            return resolvedSrc ? (
                                // FLUX.2-pro rendered map — bypass the SVG landmark
                                // render entirely so users see the real map image.
                                <img
                                    src={resolvedSrc}
                                    alt={mapData.name || 'Listening map'}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: 'block',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        background: '#fefce8',
                                    }}
                                />
                            ) : null;
                        })() || (
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
                            {mapData.paths?.map((p, i) => {
                                const pts = Array.isArray(p?.points) ? p.points : [];
                                if (pts.length === 0) return null;
                                // Points can be [[x,y],...] (spec), ["x,y",...] (AI drift → string), or
                                // [{x,y},...]. Coerce every shape to "x,y" so .join never hits a non-array.
                                const ptToStr = (pt: unknown): string => {
                                    if (Array.isArray(pt)) return pt.join(',');
                                    if (typeof pt === 'string') return pt;
                                    if (pt && typeof pt === 'object') {
                                        const o = pt as { x?: unknown; y?: unknown };
                                        if (typeof o.x === 'number' && typeof o.y === 'number') return `${o.x},${o.y}`;
                                    }
                                    return '';
                                };
                                return (
                                    <g key={`path-${i}`}>
                                        <polyline
                                            points={pts.map(ptToStr).filter(Boolean).join(' ')}
                                            fill="none" stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                                        />
                                        {p.label && pts.length >= 2 && Array.isArray(pts[0]) && Array.isArray(pts[1]) && (
                                            <text
                                                x={(pts[0][0] + pts[1][0]) / 2}
                                                y={(pts[0][1] + pts[1][1]) / 2 - 6}
                                                textAnchor="middle" fontSize={9} fill="#6b7280" fontStyle="italic"
                                            >{p.label}</text>
                                        )}
                                    </g>
                                );
                            })}
                            {/* Landmarks */}
                            {mapData.landmarks?.map(lm => renderLandmark(lm))}
                        </svg>
                        )}
                    </div>
                    <div className="map-options-panel">
                        <h3 style={{ margin: '0 0 12px 0' }}>{t.listeningDetails.mapInstructions}</h3>
                        {(() => {
                            const letters: string[] = [];
                            const titles: Record<string, string> = {};
                            options.forEach((opt, i) => {
                                const optStr = typeof opt === 'string' ? opt : String(opt ?? '');
                                const [rawLetter, ...rest] = optStr.split('.');
                                const letter = (rawLetter?.trim() || String(i)).toUpperCase();
                                letters.push(letter);
                                titles[letter] = rest.join('.').trim() || optStr;
                            });
                            const rows = questions.map(q => {
                                const qText = (q as { question?: string }).question;
                                return {
                                    id: q.id,
                                    label: qText
                                        ? <span><strong>{q.id}</strong> {qText}</span>
                                        : <strong>{q.id}</strong>,
                                };
                            });
                            return (
                                <MatchingLetterGrid
                                    rows={rows}
                                    letters={letters}
                                    letterTitles={titles}
                                    getAnswer={id => userAnswersRef.current[Number(id)] || ''}
                                    onAnswer={(id, letter) => {
                                        userAnswersRef.current[Number(id)] = letter;
                                        setRenderTick(t => t + 1);
                                    }}
                                />
                            );
                        })()}
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
                                <button
                                    className={`aielts-player-play ${ttsSpeaking ? 'is-playing' : 'is-paused'}`}
                                    onClick={togglePlayPause}
                                    title={ttsSpeaking ? t.listeningDetails.player.pause : t.listeningDetails.player.play}
                                    aria-label={ttsSpeaking ? t.listeningDetails.player.pause : t.listeningDetails.player.play}
                                >
                                    {ttsSpeaking ? '⏸' : '▶'}
                                </button>
                            )}
                            {/* Player controls: progress + speed. Hidden together via the 👁 toggle. */}
                            {ttsStarted && !controlsHidden && (
                                <div className="aielts-player-controls">
                                    <button
                                        className="aielts-player-skip"
                                        onClick={() => skipSeconds(-5)}
                                        title={t.listeningDetails.player.back5}
                                        aria-label={t.listeningDetails.player.back5}
                                    >⏪</button>
                                    <div
                                        className="aielts-player-progress"
                                        style={{
                                            ['--progress' as string]:
                                                `${audioDuration > 0 ? (playbackTime / audioDuration) * 100 : 0}%`,
                                        }}
                                    >
                                        <input
                                            type="range"
                                            min={0}
                                            max={audioDuration || 0.1}
                                            step={0.1}
                                            value={playbackTime}
                                            onChange={(e) => handleSeek(Number(e.target.value))}
                                            className="aielts-player-range"
                                            aria-label={t.listeningDetails.player.progress}
                                        />
                                    </div>
                                    <button
                                        className="aielts-player-skip"
                                        onClick={() => skipSeconds(5)}
                                        title={t.listeningDetails.player.fwd5}
                                        aria-label={t.listeningDetails.player.fwd5}
                                    >⏩</button>
                                    <span className="aielts-player-time">
                                        {formatAudioTime(playbackTime)} / {formatAudioTime(audioDuration)}
                                    </span>
                                    <select
                                        value={playbackRate}
                                        onChange={(e) => handleRateChange(Number(e.target.value))}
                                        className="aielts-player-rate"
                                        title={t.listeningDetails.player.speed}
                                    >
                                        <option value={0.75}>0.75×</option>
                                        <option value={1}>1×</option>
                                        <option value={1.25}>1.25×</option>
                                        <option value={1.5}>1.5×</option>
                                        <option value={2}>2×</option>
                                    </select>
                                </div>
                            )}
                            {ttsStarted && (
                                <button
                                    className="toolbar-btn toolbar-btn-outline"
                                    onClick={toggleControlsHidden}
                                    style={{ marginLeft: '8px' }}
                                    title={controlsHidden ? t.listeningDetails.player.showControls : t.listeningDetails.player.hideControls}
                                >
                                    <span className="btn-icon">{controlsHidden ? '👁' : '🙈'}</span>
                                    {controlsHidden ? t.listeningDetails.player.showBtn : t.listeningDetails.player.hideBtn}
                                </button>
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
                                if (window.confirm(t.listeningDetails.exitConfirm)) {
                                    if (audioRef.current) audioRef.current.pause();
                                    onReturnHome();
                                }
                            }}>
                                <span className="btn-icon">🚪</span> {t.listeningDetails.exitBtn}
                            </button>
                        </div>
                    </div>

                    <div className="listening-content-area" id="listeningContent">
                        {/* Full-test: section tabs + delegate rendering per section */}
                        {isFull && (() => {
                            const fullData = st.listeningData as FullListeningData;
                            const sections = fullData.sections || [];
                            if (sections.length === 0) return null;
                            const activeSec = sections.find(s => s.sectionNum === st.activeSection) || sections[0];
                            if (!activeSec) return null;
                            const offset = ((activeSec.sectionNum || 1) - 1) * 10;
                            return (
                                <>
                                    {sections.length > 1 && (
                                        <div className="passage-tabs">
                                            {sections.map(sec => (
                                                <button
                                                    key={sec.sectionNum}
                                                    className={`passage-tab ${st.activeSection === sec.sectionNum ? 'active' : ''}`}
                                                    onClick={() => switchFullSection(sec.sectionNum)}
                                                >
                                                    Section {sec.sectionNum}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="full-section-block">
                                        <h4 className="full-section-heading">Section {activeSec.sectionNum} — {activeSec.title}</h4>
                                        {activeSec.sectionType === 'form' && (
                                            <FormRenderer
                                                data={{ form_intro: activeSec.form_intro, form_content: activeSec.form_content || '', questions: activeSec.questions as { id: number; answers?: string[]; explanation?: string }[] }}
                                                getAnswer={getAnswer}
                                                onAnswer={setAnswerV2}
                                                sectionOffset={offset}
                                            />
                                        )}
                                        {activeSec.sectionType === 'note' && (
                                            <NoteRenderer
                                                data={{ note_intro: activeSec.note_intro, note_content: activeSec.note_content || '', questions: activeSec.questions as { id: number; answers?: string[] }[] }}
                                                getAnswer={getAnswer}
                                                onAnswer={setAnswerV2}
                                                sectionOffset={offset}
                                            />
                                        )}
                                        {activeSec.sectionType === 'mixed' && (activeSec.subsections || []).map((sub, i) => (
                                            <div key={i} className="mixed-subsection">
                                                {sub.instructions && <p className="section-instructions">{sub.instructions}</p>}
                                                {sub.type === 'multiple_choice' && (sub.questions || []).map(q => {
                                                    const mcq = q as { id: number; question: string; options: Record<string, string>; answer: string };
                                                    return (
                                                        <div key={mcq.id} className="question-block">
                                                            <div className="question-text">{mcq.id}. {mcq.question}</div>
                                                            {mcq.options && Object.entries(mcq.options).map(([k, v]) => (
                                                                <label key={k} className="option-label">
                                                                    <input
                                                                        type="radio"
                                                                        name={`q-${mcq.id}`}
                                                                        value={k}
                                                                        defaultChecked={getAnswer(mcq.id) === k}
                                                                        onChange={() => setAnswerV2(mcq.id, k)}
                                                                    />
                                                                    <strong>{k}.</strong> <span>{v}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                                {sub.type === 'matching' && (
                                                    <MatchingRenderer
                                                        data={{
                                                            type: 'matching',
                                                            title: '',
                                                            passage: '',
                                                            options_bank: sub.options_bank || {},
                                                            questions: sub.questions as MatchingListeningData['questions'],
                                                        }}
                                                        getAnswer={getAnswer}
                                                        onAnswer={setAnswerV2}
                                                    />
                                                )}
                                                {sub.type === 'map' && (() => {
                                                    const mapQs = (sub.questions || []) as { id: number; question?: string; answer: string }[];
                                                    const letters: string[] = [];
                                                    const titles: Record<string, string> = {};
                                                    (sub.options || []).forEach((opt, i) => {
                                                        const optStr = typeof opt === 'string' ? opt : String(opt ?? '');
                                                        const [rawLetter, ...rest] = optStr.split('.');
                                                        const letter = (rawLetter?.trim() || String(i)).toUpperCase();
                                                        letters.push(letter);
                                                        titles[letter] = rest.join('.').trim() || optStr;
                                                    });
                                                    const rows = mapQs.map(mq => ({
                                                        id: mq.id,
                                                        label: mq.question
                                                            ? <span><strong>{mq.id}</strong> {mq.question}</span>
                                                            : <span>Location <strong>{mq.id}</strong></span>,
                                                    }));
                                                    const correctById: Record<number, string> = {};
                                                    for (const mq of mapQs) correctById[mq.id] = mq.answer;
                                                    return (
                                                        // Layout rule: image LEFT, questions (grid + legend) RIGHT
                                                        <div className="section-map-block-v2">
                                                            <div className="section-map-image">
                                                                {sub.map && (
                                                                    <ListeningMapSVG
                                                                        map={sub.map}
                                                                        questionIdOffset={sub.startId - 1}
                                                                        maxWidth={720}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="section-map-questions">
                                                                <MatchingLetterGrid
                                                                    rows={rows}
                                                                    letters={letters}
                                                                    letterTitles={titles}
                                                                    getAnswer={id => getAnswer(Number(id))}
                                                                    onAnswer={(id, letter) => setAnswerV2(Number(id), letter)}
                                                                    correctById={correctById}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                                {sub.type !== 'multiple_choice' && sub.type !== 'matching' && sub.type !== 'map' && (sub.questions || []).length > 0 && (
                                                    // Fallback: unknown subsection type (e.g. 'note', 'short_answer' from legacy
                                                    // bank data). Render text inputs so the questions aren't silently dropped.
                                                    <div className="section-fallback-block" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {(sub.questions || []).map(q => {
                                                            const fq = q as { id: number; question?: string };
                                                            return (
                                                                <div key={fq.id} className="question-block">
                                                                    <div className="question-text">{fq.id}. {fq.question || ''}</div>
                                                                    <input
                                                                        type="text"
                                                                        className="rd-blank-input"
                                                                        defaultValue={getAnswer(fq.id)}
                                                                        onChange={e => setAnswerV2(fq.id, e.target.value)}
                                                                        placeholder="Type your answer…"
                                                                        style={{ maxWidth: 320 }}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}

                        {/* Legacy 4 types (unchanged) */}
                        {!isFull && (isMapMode ? renderMapMode() : isArticleMode ? renderArticleMode() : isMultipleChoiceMode ? renderMultipleChoiceMode() :
                            /* v2 new types */
                            isFormMode ? <FormRenderer data={st.listeningData as FormListeningData} getAnswer={getAnswer} onAnswer={setAnswerV2} /> :
                            isTableMode ? <TableRenderer data={st.listeningData as TableListeningData} getAnswer={getAnswer} onAnswer={setAnswerV2} /> :
                            isFlowchartMode ? <FlowchartRenderer data={st.listeningData as FlowchartListeningData} getAnswer={getAnswer} onAnswer={setAnswerV2} /> :
                            isShortAnswerMode ? <ShortAnswerRenderer data={st.listeningData as ShortAnswerListeningData} getAnswer={getAnswer} onAnswer={setAnswerV2} /> :
                            isMatchingMode ? <MatchingRenderer data={st.listeningData as MatchingListeningData} getAnswer={getAnswer} onAnswer={setAnswerV2} /> :
                            renderSentenceMode())}

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
        const isFullResults = st.listeningData.type === 'full';
        const isMultipleChoiceMode = st.listeningData.type === 'multiple_choice';
        const isMapMode = st.listeningData.type === 'map';

        // Collect all questions from either legacy single or full sections
        const allResultQuestions: { id: number; question?: string; answer?: string; answers?: string[]; options?: Record<string, string>; explanation?: string; sectionType?: string; sectionNum?: number }[] = [];
        if (isFullResults) {
            const full = st.listeningData as FullListeningData;
            for (const sec of (full.sections || [])) {
                for (const q of (sec.questions || [])) {
                    const qq = q as { id: number; question?: string; answer?: string; answers?: string[]; options?: Record<string, string>; explanation?: string };
                    allResultQuestions.push({ ...qq, sectionType: sec.sectionType, sectionNum: sec.sectionNum });
                }
            }
        } else {
            for (const q of ((st.listeningData as LegacyListeningData).questions || [])) {
                allResultQuestions.push(q as { id: number; question?: string; answer?: string; answers?: string[]; options?: Record<string, string>; explanation?: string });
            }
        }

        // Score all types
        const { correct: score } = scoreListeningQuestions(allResultQuestions, id => userAnswersRef.current[id] || '');
        const total = allResultQuestions.length;
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        // Concatenate passages for the "show passage" sidebar
        const passageText = isFullResults
            ? ((st.listeningData as FullListeningData).sections || []).map(s => `[Section ${s.sectionNum}] ${s.title || ''}\n\n${s.passage || ''}`).join('\n\n---\n\n')
            : ((st.listeningData as LegacyListeningData).passage || '');
        const passageParagraphs = passageText.split('\n\n');

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
                            <button onClick={restartFromBank} className="toolbar-btn toolbar-btn-outline"><span className="btn-icon">🔁</span> {t.aiBank.redoBtn}</button>
                        )}
                        <button onClick={onReturnHome} className="toolbar-btn"><span className="btn-icon">{bankId ? '📚' : '🏠'}</span> {bankId ? t.aiBank.backToBank : t.common.home}</button>
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
                        {allResultQuestions.map(q => {
                            const userAns = userAnswersRef.current[q.id] || 'None';
                            const hasOptions = Boolean(q.options && Object.keys(q.options).length > 0);
                            const hasLetterAnswer = q.answer !== undefined && q.answer !== null && q.answers === undefined;
                            const hasTextAnswers = Array.isArray(q.answers) && q.answers.length > 0;

                            let isCorrect = false;
                            if (hasLetterAnswer) {
                                isCorrect = userAns.trim().toUpperCase() === String(q.answer).trim().toUpperCase();
                            } else if (hasTextAnswers) {
                                isCorrect = checkAnswer(userAns, q.answers as string[]);
                            }

                            // Legacy MCQ / Map special renderings preserved
                            if ((isMultipleChoiceMode || q.sectionType === 'mixed') && hasOptions) {
                                return (
                                    <div key={q.id} className="result-block">
                                        <div className="question-text">
                                            {q.id}. {(q.question || '').replace(/\*\*/g, '')}
                                            {q.sectionNum !== undefined && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>[Section {q.sectionNum}]</span>}
                                        </div>
                                        {q.options && Object.entries(q.options).map(([k, v]) => (
                                            <div key={k} style={{
                                                marginLeft: '12px',
                                                color: k === q.answer ? '#16a34a' : (k === userAns && !isCorrect ? '#dc2626' : 'inherit'),
                                                fontWeight: k === q.answer ? 'bold' : 'normal',
                                            }}>
                                                {k}. {v} {k === q.answer ? ' ✓' : (k === userAns && !isCorrect ? ' ✗' : '')}
                                            </div>
                                        ))}
                                        <p style={{ marginTop: '12px' }}>
                                            {t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {t.results.correctAnswer}: <strong>{q.answer}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t.results.statusCorrect}` : `✗ ${t.results.statusIncorrect}`}
                                        </p>
                                        {q.explanation && (
                                            <div className="explanation">
                                                <strong>{t.results.explanation}:</strong> {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            if (isMapMode) {
                                const rawOpts = st.listeningData && st.listeningData.type === 'map' ? st.listeningData.options : [];
                                const mapOptions = Array.isArray(rawOpts) ? rawOpts.filter((o: unknown): o is string => typeof o === 'string') : [];
                                const correctOptText = mapOptions.find(o => o.startsWith(String(q.answer || ''))) || q.answer;
                                const userOptText = mapOptions.find(o => o.startsWith(userAns)) || userAns;
                                return (
                                    <div key={q.id} className="result-block">
                                        <div className="question-text">📍 Location {q.id}</div>
                                        <p>
                                            {t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userOptText || 'None'}</strong> | {t.results.correctAnswer}: <strong>{correctOptText}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t.results.statusCorrect}` : `✗ ${t.results.statusIncorrect}`}
                                        </p>
                                        {q.explanation && (
                                            <div className="explanation">
                                                <strong>{t.results.explanation}:</strong> {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            // Default renderer: text answers OR letter matching / summary etc.
                            return (
                                <div key={q.id} className="result-block">
                                    <div className="question-text">
                                        {q.id}. {(q.question || '').replace(/\*\*/g, '')}
                                        {q.sectionNum !== undefined && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>[Section {q.sectionNum}]</span>}
                                    </div>
                                    <p>
                                        {t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {hasTextAnswers ? t.results.acceptableAnswers : t.results.correctAnswer}: <strong>{hasTextAnswers ? (q.answers as unknown[]).map(a => (a == null ? '' : String(a))).join(' / ') : (q.answer || '—')}</strong>
                                    </p>
                                    <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                        {isCorrect ? `✓ ${t.results.statusCorrect}` : `✗ ${t.results.statusIncorrect}`}
                                    </p>
                                    {q.explanation && (
                                        <div className="explanation">
                                            <strong>{t.results.explanation}:</strong> {q.explanation}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

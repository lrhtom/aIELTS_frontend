/**
 * SpeakingChatPage — Speaking chat practice
 *
 * Architecture:
 *  1. Frontend SpeechRecognition API → transcribe user speech to text
 *  2. Text → POST /api/speaking/chat → AI reply text
 *  3. AI text → POST /api/listening/audio (edge-tts) → audio blob
 *  4. Frontend plays audio → on playback end → unlock the record button
 *
 * State machine:
 *  idle       — recording button clickable
 *  listening  — actively recording (SpeechRecognition running)
 *  speaking   — playing AI voice (button disabled)
 *  loading    — welcome message loading on entry (button disabled)
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { speakingStore } from '../../store/speaking_page_store';
import AiModelSelector from '../../components/common/AiModelSelector';
import { ATInterceptor } from '../../api/atInterceptor';
import { startSpeakingSession, getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { showToast } from '../../components/common/Toast';
import { devLog } from '../../utils/devLog';
import type { SpeakingMode, IeltsPart } from './speaking';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/speaking_chat.css';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// ── Types ──────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant' | 'system';
interface ChatMessage {
    role: Role;
    content: string;
    correctedText?: string;
    scores?: {
        grammar?: number;
        vocab?: number;
        relevance?: number;
        coherence?: number;
        depth?: number;
        feedback?: string;
        accuracy?: number;
        pronunciation?: number;
        completeness?: number;
        fluency?: number;
        // Part 1 ARE specific
        are_a?: number;
        are_r?: number;
        are_e?: number;
        are_feedback?: string;
        length_feedback?: string;
        word_count?: number;
        duration?: number;
        weighted_total_score?: number;
    };
}

type Status = 'loading' | 'mic_loading' | 'idle' | 'listening' | 'processing' | 'speaking' | 'finished';

interface ExamQuestion {
    topic: string;
    question: string;
}

interface Word {
    en: string;
    zh?: string;
    count: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parseWords(raw: string): Word[] {
    if (!raw.trim()) return [];
    return raw.split('\n')
        .map(l => l.trim())
        .filter(l => l)
        .map(l => {
            const m = l.match(/^([a-zA-Z\s-]+)(.*)$/);
            if (!m) return null;
            return { en: m[1].trim(), zh: m[2].trim(), count: 0 };
        })
        .filter(Boolean) as Word[];
}

function countMatches(text: string, word: string): number {
    const rx = new RegExp(`\\b${word}\\b`, 'gi');
    return (text.match(rx) || []).length;
}

// 欢迎语是对话内容（英文），不走 i18n —— 与 AI 回复同语言
function buildWelcome(mode: SpeakingMode, isFullTest: boolean, questions: ExamQuestion[], scenario: string): string {
    if (mode === 'scenario') {
        return `Acting for scenario: "${scenario}". I am ready to start. What would you like to say first?`;
    }
    if (isFullTest && questions.length > 0) {
        return `Welcome to the IELTS Full Speaking Test. We will go through Part 1, Part 2, and Part 3 consecutively. Let's begin with Part 1. Our first topic is ${questions[0].topic}. ${questions[0].question}`;
    }
    if ((mode === 'part1' || mode === 'part2' || mode === 'part3') && questions.length > 0) {
        const partLabel = mode === 'part1' ? 'Part 1' : mode === 'part2' ? 'Part 2' : 'Part 3';
        return `Welcome to IELTS Speaking ${partLabel}. Our first topic is ${questions[0].topic}. ${questions[0].question}`;
    }
    return "Welcome to IELTS speaking practice. Tell me when you are ready.";
}

// 题库卡片标题是落库数据（同 AI 生成的英文题目名），不走 i18n
function buildSessionTitle(mode: SpeakingMode, questions: ExamQuestion[], scenario: string): string {
    const topic = questions[0]?.topic || '';
    if (mode === 'fullTest') return topic ? `IELTS Full Test · ${topic}` : 'IELTS Full Speaking Test';
    if (mode === 'part1' || mode === 'part2' || mode === 'part3') {
        const label = mode === 'part1' ? 'Part 1' : mode === 'part2' ? 'Part 2' : 'Part 3';
        return topic ? `IELTS ${label} · ${topic}` : `IELTS Speaking ${label}`;
    }
    if (mode === 'scenario') return scenario ? `Scenario · ${scenario.slice(0, 60)}` : 'Scenario Role-play';
    if (mode === 'call') return 'Phone Call Practice';
    return 'Free Talk';
}

function MarkdownBubble({ content, className = 'sc-markdown' }: { content: string; className?: string }) {
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ children, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer">
                            {children}
                        </a>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

// SpeechRecognition cross-browser factory (avoids TypeScript global type issues)
const getSRConstructor = (): unknown =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

export default function SpeakingChatPageWrapper() {
  return (
    <ErrorBoundary>
            <SpeakingChatPage />
    </ErrorBoundary>
  );
}

function SpeakingChatPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { translations: t } = useLang();
    const state = location.state as {
        vocabInput?: string,
        mode?: SpeakingMode,
        scenarioInput?: string,
        part?: IeltsPart,
        questions?: ExamQuestion[],
        bankSource?: string,
        scenarioFiles?: File[],
        customTitle?: string,
        customDesc?: string,
        voiceOnly?: boolean,
    };
    // 从 AI 题库恢复会话：/speaking/chat?bankId=123
    const [searchParams] = useSearchParams();
    const bankIdRaw = searchParams.get('bankId');
    const resumeId = bankIdRaw && !Number.isNaN(Number(bankIdRaw)) ? Number(bankIdRaw) : null;

    const vocabRaw: string = state?.vocabInput ?? '';
    const initialMode: SpeakingMode = state?.mode ?? 'chat';
    // rootMode/scenarioPrompt 需要在恢复会话时被覆写，所以是 state 而不是 const
    const [rootMode, setRootMode] = useState<SpeakingMode>(initialMode);
    const [scenarioPrompt, setScenarioPrompt] = useState<string>(state?.scenarioInput ?? '');
    // 纯语音模式（原 call 模式并入 chat 后的开关）：隐藏键盘输入
    const [voiceOnly, setVoiceOnly] = useState<boolean>(state?.voiceOnly ?? false);
    const [activeMode, setActiveMode] = useState<SpeakingMode>(initialMode);
    const [activeExamQuestions, setActiveExamQuestions] = useState<ExamQuestion[]>(state?.questions ?? []);
    const isFullTestMode = rootMode === 'fullTest';
    const isExamMode = activeMode === 'part1' || activeMode === 'part2' || activeMode === 'part3' || isFullTestMode;

    // ── 路由守卫：防止刷新或直接跳转进来（带 bankId 的恢复入口放行）─────────
    useEffect(() => {
        if (!speakingStore.isChatAllowed && !resumeId) {
            navigate('/speaking', { replace: true });
            return;
        }

        return () => {
            // component unmount
            setTimeout(() => {
                speakingStore.isChatAllowed = false;
            }, 0);
        };
    }, [navigate]);

    // ── State ──
    const [words, setWords] = useState<Word[]>(() => parseWords(vocabRaw));
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [expandedMsgs, setExpandedMsgs] = useState<Set<number>>(new Set());
    const [status, setStatus] = useState<Status>('loading');
    const [liveTranscript, setLiveTranscript] = useState('');
    const [recError, setRecError] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);
    const [recordingTime, setRecordingTime] = useState(0);
    // Exam states
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [, setExamHistory] = useState<Array<any>>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [showTimer, setShowTimer] = useState(false);
    const [showPart3ContinuePrompt, setShowPart3ContinuePrompt] = useState(false);
    const [loadingPart3, setLoadingPart3] = useState(false);
    const [_loadingNextPart, setLoadingNextPart] = useState(false);
    // Full Test: track which part we're currently in
    const [fullTestPhase, setFullTestPhase] = useState<'part1' | 'part2' | 'part3'>('part1');
    const [prepTimeLeft, setPrepTimeLeft] = useState(0);

    // Initial effect for part 2 prep timer
    useEffect(() => {
        if (initialMode === 'part2') {
            setPrepTimeLeft(60);
        }
    }, [initialMode]);

    // Timer effect
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (prepTimeLeft > 0) {
            timer = setTimeout(() => setPrepTimeLeft(prev => prev - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [prepTimeLeft]);

    // Manual input states
    const [textInput, setTextInput] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);
    const [isMicUnusable, setIsMicUnusable] = useState(false);
    // Files from scenario config (passed via nav state, used in scenario mode only)
    const pendingScenarioFilesRef = useRef<File[]>(state?.scenarioFiles ?? []);

    // ── Refs (never stale inside callbacks) ──
    const wordsRef = useRef<Word[]>(parseWords(vocabRaw));
    const contextRef = useRef<ChatMessage[]>([]);
    const statusRef = useRef<Status>('loading');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recStartTimeRef = useRef<number>(0);
    const lastRecordingTimeRef = useRef<number>(0);
    // Prevent concurrent handleSend calls
    const pendingRef = useRef(false);

    // ── 会话持久化（AI 题库）──
    const sessionIdRef = useRef<number | null>(null);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSyncRef = useRef<Record<string, unknown> | null>(null);
    // Prevent double session creation from React StrictMode double-mount.
    // NOTE: never reset in a cleanup — StrictMode's synthetic unmount would re-arm it.
    const sessionCreateFiredRef = useRef(false);

    // Audio & STT refs
    const micStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const recorderRef = useRef<RecordRTC | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const srRef = useRef<any>(null);
    const ttsAbortControllerRef = useRef<AbortController | null>(null);

    const setStatusSync = (s: Status) => { statusRef.current = s; setStatus(s); };
    const setWordsSync = (fn: (p: Word[]) => Word[]) => {
        setWords(prev => { const n = fn(prev); wordsRef.current = n; return n; });
    };

    // ── Init: play welcome then unlock mic ─────────────────────────────────
    useEffect(() => {
        // 重置所有状态到初始值，防止从其他页面返回时残留旧数据
        setStatusSync('loading');
        setChatHistory([]);
        setLiveTranscript('');
        setRecError('');
        setAudioLevel(0);
        setRecordingTime(0);
        pendingRef.current = false;
        setTextInput('');
        setShowTextInput(false);
        setIsMicUnusable(false);

        // 不做预请求——新?Chrome 要求 getUserMedia 必须由用户手势触发，
        // useEffect 中调用会被拦截并返回 NotFoundError
        // 麦克风权限在实际点击录音按钮时（toggleRecording）申请。
        // 后端各端点已通过 skills.py 注入正确?system prompt，前端不再硬编码
        let isUnmounted = false;
        const controller = new AbortController();

        if (resumeId) {
            // ── 从 AI 题库恢复会话：取回落库状态；已有总结报告则直接看结果 ──
            (async () => {
                try {
                    const detail = await getAIQuestion(resumeId);
                    if (isUnmounted) return;
                    if (detail.aiFeedback) {
                        navigate(`/speaking/summary?bankId=${resumeId}`, { replace: true });
                        return;
                    }
                    const content = (detail.content || {}) as Record<string, unknown>;
                    const ua = (detail.userAnswer || {}) as Record<string, unknown>;
                    let mode = ((content.mode as SpeakingMode) || (detail.subtype as SpeakingMode) || 'chat');
                    if (mode === 'call') {
                        // 旧"通话模式"会话 → 自由对话 + 纯语音
                        mode = 'chat';
                        setVoiceOnly(true);
                    } else {
                        setVoiceOnly(Boolean(content.voiceOnly));
                    }
                    sessionIdRef.current = resumeId;
                    setRootMode(mode);
                    const savedScenario = String(content.scenarioPrompt || '');
                    setScenarioPrompt(savedScenario);
                    setActiveMode((ua.activeMode as SpeakingMode) || mode);
                    const savedQuestions = (ua.examQuestions ?? content.questions ?? []) as ExamQuestion[];
                    setActiveExamQuestions(savedQuestions);
                    setCurrentQuestionIndex(Number(ua.currentQuestionIndex ?? 0));
                    const savedPhase = ua.fullTestPhase;
                    if (savedPhase === 'part1' || savedPhase === 'part2' || savedPhase === 'part3') {
                        setFullTestPhase(savedPhase);
                    }
                    const savedWords = Array.isArray(ua.words) && ua.words.length > 0
                        ? (ua.words as Word[])
                        : parseWords(String(content.vocabInput || ''));
                    setWordsSync(() => savedWords);
                    const savedHistory = Array.isArray(ua.chatHistory) ? (ua.chatHistory as ChatMessage[]) : [];
                    if (savedHistory.length > 0) {
                        setChatHistory(savedHistory);
                        // 恢复 AI 上下文：只取正文对话（system 提示与评分面板不进上下文）
                        contextRef.current = savedHistory
                            .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
                            .map(m => ({ role: m.role, content: m.content }));
                    } else {
                        contextRef.current = [];
                        setChatHistory([{ role: 'assistant', content: buildWelcome(mode, mode === 'fullTest', savedQuestions, savedScenario) }]);
                    }
                    setStatusSync(ua.finished === true ? 'finished' : 'idle');
                } catch {
                    if (!isUnmounted) {
                        showToast(t.speakingChat.errLoadSession, 'error');
                        navigate('/practice/ai/bank?skill=speaking', { replace: true });
                    }
                }
            })();

            const resumeTtsTimer = ttsTimerRef.current;
            return () => {
                isUnmounted = true;
                controller.abort();
                stopAudio();
                if (srRef.current) {
                    try { srRef.current.abort(); } catch { /* ignore */ }
                }
                if (recorderRef.current) {
                    recorderRef.current.destroy();
                    recorderRef.current = null;
                }
                micStreamRef.current?.getTracks().forEach(t => t.stop());
                if (recTimerRef.current) clearInterval(recTimerRef.current);
                if (resumeTtsTimer) clearTimeout(resumeTtsTimer);
            };
        }

        const welcomeMsg = buildWelcome(activeMode, isFullTestMode, activeExamQuestions, scenarioPrompt);
        contextRef.current = [];
        setChatHistory([{ role: 'assistant', content: welcomeMsg }]);

        // 开局建会话行（不调 AI、不扣 AT）；失败不阻塞练习，仅本次不落库。
        // sessionCreateFiredRef 挡掉 StrictMode 第二次 effect，避免生成重复 session。
        if (!sessionCreateFiredRef.current) {
            sessionCreateFiredRef.current = true;
            const customTitle = (state?.customTitle ?? '').trim();
            startSpeakingSession(
                initialMode,
                customTitle || buildSessionTitle(initialMode, state?.questions ?? [], state?.scenarioInput ?? ''),
                {
                    part: state?.part ?? '',
                    questions: state?.questions ?? [],
                    scenarioPrompt: state?.scenarioInput ?? '',
                    vocabInput: vocabRaw,
                    bankSource: state?.bankSource ?? '',
                    voiceOnly: state?.voiceOnly ?? false,
                    // 题库卡片简介从 content.description 读取（与听/读/写一致）
                    description: (state?.customDesc ?? '').trim(),
                },
            ).then(res => { sessionIdRef.current = res.id; }).catch(() => {});
        }

        (async () => {
            try {
                let finalWelcome = welcomeMsg;

                // For scenario mode, replace hardcoded welcome with AI-generated opening
                if (activeMode === 'scenario') {
                    try {
                        const filesForOpening = [...pendingScenarioFilesRef.current];
                        const openingRes = await ATInterceptor.scenarioOpening(scenarioPrompt, filesForOpening);
                        if (openingRes.data.opening && !isUnmounted) {
                            finalWelcome = openingRes.data.opening;
                            setChatHistory([{ role: 'assistant', content: finalWelcome }]);
                        }
                    } catch {
                        // Fallback to default welcomeMsg (already in chat history)
                    }
                }

                // Initial TTS welcome
                const csrfWelcome = document.cookie.split('; ').find(c => c.startsWith('aielts_csrf='))?.split('=')[1];
                const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/listening/audio`, {
                    method: 'POST',
                    credentials: 'include',
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(csrfWelcome ? { 'X-CSRF-Token': decodeURIComponent(csrfWelcome) } : {}),
                    },
                    body: JSON.stringify({
                        text: finalWelcome,
                        voice: 'en-US-AriaNeural'
                    })
                });

                if (!res.ok) throw new Error('Audio logic failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = new Audio(url);
                audioRef.current = a;

                a.onended = () => {
                    if (!isUnmounted) setStatusSync('idle');
                };

                a.onerror = () => {
                    if (!isUnmounted) setStatusSync('idle');
                };

                // The second strict mode unmount will call stopAudio, meaning play() here might get aborted.
                if (!isUnmounted) setStatusSync('speaking');
                await a.play().catch(e => {
                    devLog("Welcome TTS aborted", e);
                    if (!isUnmounted) setStatusSync('idle');
                });
            } catch (err: unknown) {
                const e = err as { name?: string };
                if (e.name !== 'AbortError') {
                    console.error("Welcome TTS error:", err);
                    if (!isUnmounted) setStatusSync('idle');
                }
            }
        })();

        const currentTtsTimer = ttsTimerRef.current;

        return () => {
            isUnmounted = true;
            controller.abort();
            stopAudio();
            if (srRef.current) {
                try { srRef.current.abort(); } catch { /* ignore */ }
            }
            if (recorderRef.current) {
                recorderRef.current.destroy();
                recorderRef.current = null;
            }
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            if (recTimerRef.current) clearInterval(recTimerRef.current);
            if (currentTtsTimer) clearTimeout(currentTtsTimer);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, liveTranscript]);

    // Because uploading transcript takes time, use refs
    const liveTranscriptRef = useRef('');
    useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript]);

    // ── 会话同步：每次对话/进度变化后防抖 800ms 覆盖式写回 AI 题库 ──────────
    // 载荷包含恢复会话所需的全部动态状态；分数（含异步并入的 Azure 发音分）
    // 已经在 chatHistory 消息体里，随之一起落库。
    useEffect(() => {
        if (!sessionIdRef.current) return;
        if (chatHistory.length <= 1) return; // 只有欢迎语时不同步
        const payload: Record<string, unknown> = {
            chatHistory,
            words: wordsRef.current,
            currentQuestionIndex,
            examQuestions: activeExamQuestions,
            fullTestPhase,
            activeMode,
            scenarioPrompt,
            finished: status === 'finished',
        };
        pendingSyncRef.current = payload;
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
            const sid = sessionIdRef.current;
            const body = pendingSyncRef.current;
            pendingSyncRef.current = null;
            if (sid && body) submitAIQuestion(sid, body).catch(() => {});
        }, 800);
    }, [chatHistory, status, currentQuestionIndex, activeExamQuestions, fullTestPhase, activeMode, scenarioPrompt]);

    // 卸载时冲刷最后一次未发出的同步，避免丢最后一轮
    useEffect(() => () => {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        const sid = sessionIdRef.current;
        const body = pendingSyncRef.current;
        if (sid && body) {
            pendingSyncRef.current = null;
            submitAIQuestion(sid, body).catch(() => {});
        }
    }, []);

    // ── Audio visualizer ──────────────────────────────────────────────────
    const setupAudioVisualizer = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            analyser.getByteFrequencyData(buf);
            setAudioLevel(Math.min(100, (buf.reduce((a, b) => a + b, 0) / buf.length) * 2.5));
            animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
    };
    const stopAudioVisualizer = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        setAudioLevel(0);
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
        }
        analyserRef.current = null;
    };

    // ── Recording timer ───────────────────────────────────────────────────
    const startRecTimer = () => {
        setRecordingTime(0);
        recTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    };
    const stopRecTimer = () => {
        if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecordingTime(0);
    };

    // ── RecordRTC upload logic (Background Debug Only) ───────────────────
    const uploadRecording = async (blob: Blob, text: string) => {
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'speaking.wav');
            if (text) {
                formData.append('reference_text', text);
            }

            const csrfTrans = document.cookie.split('; ').find(c => c.startsWith('aielts_csrf='))?.split('=')[1];
            const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/speaking/transcribe`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    ...(csrfTrans ? { 'X-CSRF-Token': decodeURIComponent(csrfTrans) } : {}),
                },
                body: formData,
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.scores || null;
        } catch (err) {
            console.error('上传录音进行评估失败', err);
            return null;
        }
    };

    // ── Toggle recording ──────────────────────────────────────────────────
    const toggleRecording = async () => {
        const s = statusRef.current;
        if (s === 'loading' || s === 'mic_loading' || s === 'processing' || s === 'speaking') return;

        if (s === 'idle') {
            // Start
            setStatusSync('mic_loading');
            setRecError('');
            setLiveTranscript('');
            liveTranscriptRef.current = '';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const SR = getSRConstructor() as any;
            if (!SR) {
                setRecError(t.speakingChat.errBrowserNoSpeech);
                setStatusSync('idle');
                setIsMicUnusable(true);
                setShowTextInput(true);
                return;
            }
            const sr = new SR();
            sr.lang = 'en-US';
            sr.continuous = true;
            sr.interimResults = true;
            sr.maxAlternatives = 1;

            let accumulatedFinal = '';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sr.onresult = (e: any) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) {
                        accumulatedFinal += e.results[i][0].transcript + ' ';
                    } else {
                        interim += e.results[i][0].transcript;
                    }
                }
                const t = (accumulatedFinal + interim).trim();
                setLiveTranscript(t);
                liveTranscriptRef.current = t;
            };

            // Guard: onend fires only once
            let onendHandled = false;
            sr.onend = () => {
                if (onendHandled) return;
                if (statusRef.current !== 'listening' && statusRef.current !== 'processing') return;
                onendHandled = true;

                // Capture precise duration using Date.now()
                lastRecordingTimeRef.current = Math.max(0, Math.round((Date.now() - recStartTimeRef.current) / 1000));

                const text = liveTranscriptRef.current.trim();
                setLiveTranscript('');
                liveTranscriptRef.current = '';

                // Stop the background WAV recorder FIRST before killing tracks
                if (recorderRef.current) {
                    recorderRef.current.stopRecording(() => {
                        const blob = recorderRef.current!.getBlob();
                        recorderRef.current!.reset();
                        recorderRef.current!.destroy();
                        recorderRef.current = null;

                        // Kill tracks now that blob is secured
                        stopAudioVisualizer();
                        stopRecTimer();

                        if (text) {
                            handleSend(text, blob.size > 1000 ? blob : undefined);
                        } else {
                            setRecError(t.speakingChat.errNoSpeech);
                            setStatusSync('idle');
                        }
                    });
                } else {
                    stopAudioVisualizer();
                    stopRecTimer();

                    if (text) {
                        handleSend(text);
                    } else {
                        setRecError(t.speakingChat.errNoSpeech);
                        setStatusSync('idle');
                    }
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sr.onerror = (e: any) => {
                devLog('sr.onerror', e);
                if (e.error === 'aborted') return;
                if (e.error === 'network' && statusRef.current === 'processing') return;

                stopAudioVisualizer();
                stopRecTimer();
                if (e.error === 'no-speech') {
                    setRecError(t.speakingChat.errNoDetectSpeech);
                } else if (e.error === 'network') {
                    setRecError(t.speakingChat.errNetworkNeeded);
                } else if (e.error === 'not-allowed') {
                    setRecError(t.speakingChat.errMicDenied);
                    setIsMicUnusable(true);
                    setShowTextInput(true);
                } else {
                    setRecError(t.speakingChat.errUnknown.replace('{msg}', String(e.error)));
                    setIsMicUnusable(true);
                    setShowTextInput(true);
                }
                setStatusSync('idle');

                // Clear the background recorder if SR fails early
                if (recorderRef.current) {
                    recorderRef.current.stopRecording();
                    recorderRef.current.destroy();
                    recorderRef.current = null;
                }
            };

            srRef.current = sr;

            try {
                // 1. 获取麦克风权限
                await setupAudioVisualizer();
                if (!micStreamRef.current) throw new Error('No stream');

                // 2. 准备后台纯正 WAV 录音器
                const recorder = new RecordRTC(micStreamRef.current, {
                    type: 'audio',
                    mimeType: 'audio/wav',
                    recorderType: StereoAudioRecorder,
                    numberOfAudioChannels: 1,
                    desiredSampRate: 16000,
                });

                // 3. 当浏览器前端 STT 连通时触发
                sr.onstart = () => {
                    if (statusRef.current === 'mic_loading') {
                        recorder.startRecording();
                        recorderRef.current = recorder;
                        recStartTimeRef.current = Date.now();
                        setStatusSync('listening');
                        startRecTimer();
                    }
                };

                sr.start();
            } catch (e: unknown) {
                const err = e as DOMException | Error;
                const name = (err as DOMException).name || '';
                if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                    setRecError(t.speakingChat.errMicDeniedLong);
                } else if (name === 'NotFoundError') {
                    setRecError(t.speakingChat.errMicNotFound);
                } else if (name === 'NotReadableError') {
                    setRecError(t.speakingChat.errMicBusy);
                } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setRecError(t.speakingChat.errMicUnsupported);
                } else {
                    setRecError(t.speakingChat.errMicStartFail);
                }
                setIsMicUnusable(true);
                setShowTextInput(true);
                setStatusSync('idle');
            }

        } else if (s === 'listening') {
            // Stop manually
            setStatusSync('processing');
            // This implicitly calls sr.onend
            try { srRef.current?.stop(); } catch { /* ignore */ }
        }
    };

    // ── TTS for AI Response ───────────────────────────────────────────────
    const playTTS = async (text: string, isFinished: boolean = false) => {
        try {
            stopAudio(); // Release any playing audio AND abort any ongoing fetch

            setStatusSync('speaking');

            const controller = new AbortController();
            ttsAbortControllerRef.current = controller;

            const csrfTts = document.cookie.split('; ').find(c => c.startsWith('aielts_csrf='))?.split('=')[1];
            const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/listening/audio`, {
                method: 'POST',
                credentials: 'include',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfTts ? { 'X-CSRF-Token': decodeURIComponent(csrfTts) } : {}),
                },
                body: JSON.stringify({
                    text: text,
                    voice: 'en-US-AriaNeural'
                })
            });

            if (!res.ok) throw new Error('Audio logic failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            // Just in case another request was fired while we were awaiting
            if (ttsAbortControllerRef.current !== controller) return;

            const a = new Audio(url);
            audioRef.current = a;

            a.onended = () => {
                setStatusSync(isFinished ? 'finished' : 'idle');
                pendingRef.current = false;
            };

            a.onerror = () => {
                console.error("TTS playback error");
                setStatusSync(isFinished ? 'finished' : 'idle');
                pendingRef.current = false;
            };

            await a.play();
        } catch (err: unknown) {
            const e = err as { name?: string };
            if (e.name !== 'AbortError') {
                console.error("TTS error:", err);
                setStatusSync(isFinished ? 'finished' : 'idle');
                pendingRef.current = false;
            }
        }
    };

    // ── Send text to AI ───────────────────────────────────────────────────
    const handleSend = async (text: string, audioBlob?: Blob) => {
        if (!text) { setStatusSync('idle'); return; }
        // Prevent concurrent requests (e.g. double onend firing)
        if (pendingRef.current) return;
        pendingRef.current = true;

        // Capture and clear pending scenario files for this send (one-shot)
        const filesToSend = [...pendingScenarioFilesRef.current];
        pendingScenarioFilesRef.current = [];

        const userMsg: ChatMessage = { role: 'user', content: text };
        setChatHistory(h => [...h, userMsg]);
        setWordsSync(prev => prev.map(w => ({ ...w, count: w.count + countMatches(text, w.en) })));
        setStatusSync('processing');

        const unusedWords = wordsRef.current.filter(w => w.count === 0).map(w => w.en);
        const messages: ChatMessage[] = [...contextRef.current, userMsg];
        if (unusedWords.length > 0) {
            messages.push({
                role: 'system',
                content: `[Reminder] User hasn't used: "${unusedWords.slice(0, 4).join(', ')}". Use 1-2 naturally.`,
            });
        }

        try {
            let chatPromise;
            let currentExamQ = '';
            // Determine which evaluator to use: for fullTest, use fullTestPhase
            const effectiveMode = isFullTestMode ? fullTestPhase : activeMode;
            const currentExamItem = isExamMode ? activeExamQuestions[currentQuestionIndex] : null;
            if (isExamMode && !currentExamItem) {
                pendingRef.current = false;
                setStatusSync('idle');
                setChatHistory(h => [...h, { role: 'system', content: t.speakingChat.sysMissingQuestion }]);
                return;
            }
            if (activeMode === 'scenario') {
                if (filesToSend.length > 0) {
                    chatPromise = ATInterceptor.scenarioChatWithFiles(
                        scenarioPrompt,
                        messages as unknown as Array<Record<string, unknown>>,
                        filesToSend,
                        { conversationLength: 1 }
                    );
                } else {
                    chatPromise = ATInterceptor.scenarioChat(
                        scenarioPrompt,
                        messages as unknown as Array<Record<string, unknown>>,
                        { conversationLength: 1 }
                    );
                }
            } else if (effectiveMode === 'part1') {
                currentExamQ = currentExamItem!.question;
                const nextIndex = currentQuestionIndex + 1;
                let nextPlan = undefined;
                if (nextIndex < activeExamQuestions.length) {
                    nextPlan = activeExamQuestions[nextIndex];
                }
                chatPromise = ATInterceptor.evaluatePart1(
                    currentExamQ,
                    text,
                    lastRecordingTimeRef.current,
                    nextPlan
                );
            } else if (effectiveMode === 'part2') {
                currentExamQ = currentExamItem!.question;
                chatPromise = ATInterceptor.evaluatePart2(
                    currentExamQ,
                    text,
                    lastRecordingTimeRef.current
                );
            } else if (effectiveMode === 'part3') {
                currentExamQ = currentExamItem!.question;
                chatPromise = ATInterceptor.evaluatePart3(
                    currentExamQ,
                    text,
                    lastRecordingTimeRef.current
                );
            } else {
                chatPromise = ATInterceptor.speakingChat(
                    messages as unknown as Array<Record<string, unknown>>,
                    { conversationLength: 1 }
                );
            }

            const uploadPromise = audioBlob ? uploadRecording(audioBlob, text) : Promise.resolve(null);

            const [chatResponse, audioScores] = await Promise.all([chatPromise, uploadPromise]);

            const chatRes = chatResponse.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any

            let isContinue = 1;
            let nextReply = chatRes.reply || '';

            if (isExamMode) {
                const nextIndex = currentQuestionIndex + 1;
                const effectiveMode = isFullTestMode ? fullTestPhase : activeMode;
                
                // Add to history for summary
                setExamHistory(h => {
                    const newH = [...h, { question: currentExamQ, answer: text, scores: chatRes }];
                    return newH;
                });

                if (isFullTestMode) {
                    // Full Test mode: auto-transition between Parts
                    setCurrentQuestionIndex(nextIndex);
                    if (nextIndex < activeExamQuestions.length) {
                        // More questions in current Part
                        const nextQ = activeExamQuestions[nextIndex];
                        const isTopicChange = nextQ.topic !== activeExamQuestions[currentQuestionIndex].topic;
                        
                        if (effectiveMode === 'part1' && chatRes.next_question_dynamic) {
                            nextReply = chatRes.next_question_dynamic;
                            setActiveExamQuestions(prev => {
                                const newArr = [...prev];
                                newArr[nextIndex] = { ...newArr[nextIndex], question: chatRes.next_question_dynamic };
                                return newArr;
                            });
                        } else if (isTopicChange) {
                            nextReply = `Let's move on to the topic of ${nextQ.topic}. ${nextQ.question}`;
                        } else {
                            nextReply = nextQ.question;
                        }
                    } else {
                        // Current Part finished ?auto-load next Part
                        if (fullTestPhase === 'part1') {
                            nextReply = 'Excellent. That is the end of Part 1. Now we will move on to Part 2. Please wait while I prepare your topic card...';
                            isContinue = 0;
                            // Schedule Part 2 auto-load
                            setTimeout(() => handleFullTestTransition('part2'), 100);
                        } else if (fullTestPhase === 'part2') {
                            nextReply = 'Thank you. That is the end of Part 2. Let me prepare the Part 3 discussion questions...';
                            isContinue = 0;
                            setTimeout(() => handleFullTestTransition('part3'), 100);
                        } else {
                            nextReply = 'That is the end of Part 3 and the end of the full speaking test. Excellent work! I will now process your complete results.';
                            isContinue = 0;
                        }
                    }
                } else if (effectiveMode === 'part2') {
                    // 连续联动：Part2 固定只问 1 个大问题，然后弹出是否进入 Part3
                    setCurrentQuestionIndex(nextIndex);
                    nextReply = 'That is the end of Part 2. Would you like to continue with Part 3 practice?';
                    isContinue = 0;
                    setShowPart3ContinuePrompt(true);
                } else {
                    setCurrentQuestionIndex(nextIndex);
                    if (nextIndex < activeExamQuestions.length) {
                        const nextQ = activeExamQuestions[nextIndex];
                        const isTopicChange = nextQ.topic !== activeExamQuestions[currentQuestionIndex].topic;
                        
                        if (effectiveMode === 'part1' && chatRes.next_question_dynamic) {
                            nextReply = chatRes.next_question_dynamic;
                            setActiveExamQuestions(prev => {
                                const newArr = [...prev];
                                newArr[nextIndex] = { ...newArr[nextIndex], question: chatRes.next_question_dynamic };
                                return newArr;
                            });
                        } else if (isTopicChange) {
                            nextReply = `Let's move on to the topic of ${nextQ.topic}. ${nextQ.question}`;
                        } else {
                            nextReply = nextQ.question;
                        }
                    } else {
                        const partLabel = effectiveMode === 'part1' ? 'Part 1' : 'Part 3';
                        nextReply = `That is the end of ${partLabel}. I will now process your overall results. Good job!`;
                        isContinue = 0;
                    }
                }
            } else {
                isContinue = activeMode === 'scenario' ? chatRes.is_continue : 1;
            }

            const aiMsg: ChatMessage = {
                role: 'assistant',
                content: nextReply,
                correctedText: chatRes.corrected_text || '',
                scores: {
                    grammar: chatRes.grammar_score,
                    vocab: chatRes.vocab_score,
                    relevance: chatRes.relevance_score,
                    coherence: chatRes.coherence_score,
                    depth: chatRes.depth_score,
                    feedback: chatRes.feedback,
                    are_a: chatRes.are_a_score,
                    are_r: chatRes.are_r_score,
                    are_e: chatRes.are_e_score,
                    are_feedback: chatRes.are_feedback,
                    length_feedback: chatRes.length_feedback,
                    word_count: chatRes.word_count,
                    duration: chatRes.duration_seconds,
                    weighted_total_score: chatRes.weighted_total_score,
                    ...(audioScores || {})
                }
            };

            // 处理结束逻辑
            setChatHistory(h => {
                const newHistory = [...h, aiMsg];
                if (isContinue === 0) {
                    if (isFullTestMode) {
                        if (fullTestPhase === 'part3' && currentQuestionIndex + 1 >= activeExamQuestions.length) {
                            newHistory.push({ role: 'system', content: t.speakingChat.sysFullTestDone });
                        }
                    } else if (isExamMode) {
                        const effectiveMode = isFullTestMode ? fullTestPhase : activeMode;
                        const partLabel = effectiveMode === 'part1' ? 'Part 1' : effectiveMode === 'part2' ? 'Part 2' : 'Part 3';
                        if (effectiveMode === 'part2') {
                            newHistory.push({ role: 'system', content: t.speakingChat.sysPart2Done });
                        } else {
                            newHistory.push({ role: 'system', content: t.speakingChat.sysPartDone.replace('{label}', partLabel) });
                        }
                    } else {
                        newHistory.push({ role: 'system', content: t.speakingChat.sysPracticeDone });
                    }
                }
                return newHistory;
            });

            contextRef.current = [...contextRef.current, userMsg, { role: 'assistant', content: nextReply }];
            setWordsSync(prev => prev.map(w => ({ ...w, count: w.count + countMatches(nextReply, w.en) })));

            // Play AI response audio
            playTTS(nextReply, isContinue === 0);

        } catch (error: unknown) {
            pendingRef.current = false;

            if (typeof error === 'object' && error !== null && ('name' in error && (error as { name: string }).name === 'ATBalanceError' || 'message' in error && (error as { message: string }).message === t.speakingChat.errATInsufficient)) {
                showToast((error as { message: string }).message, 'error', t.speakingChat.errATInsufficientTitle);
                setChatHistory(h => [...h, { role: 'system', content: t.speakingChat.errATInsufficientBody }]);
            } else {
                setChatHistory(h => [...h, { role: 'system', content: t.speakingChat.errAIFail }]);
            }
            setStatusSync('idle');
        }
    };

    // ── TTS: remove functionality ─────────────────────────
    const stopAudio = () => {
        if (ttsAbortControllerRef.current) {
            ttsAbortControllerRef.current.abort();
            ttsAbortControllerRef.current = null;
        }

        const timer = ttsTimerRef.current;
        if (timer) clearTimeout(timer);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
    };

    // ── UI helpers ─────────────────────────────────────────────────────────
    const STATUS_LABEL: Record<Status, string> = {
        loading: t.speakingChat.statusLoading,
        mic_loading: t.speakingChat.statusMicLoading,
        idle: t.speakingChat.statusIdle,
        listening: t.speakingChat.statusListening,
        processing: t.speakingChat.statusProcessing,
        speaking: t.speakingChat.statusSpeaking,
        finished: t.speakingChat.statusFinished,
    };
    const MIC_LABEL: Record<Status, string> = {
        loading: t.speakingChat.hintLoading,
        mic_loading: t.speakingChat.micLoadingLabel,
        idle: t.speakingChat.idleLabel,
        listening: t.speakingChat.listeningLabel,
        processing: t.speakingChat.processingLabel,
        speaking: t.speakingChat.speakingLabel,
        finished: t.speakingChat.finishedLabel,
    };
    const formatTime = (s: number) =>
        `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const BAR_COUNT = 12;
    const isDisabled = status === 'loading' || status === 'mic_loading' || status === 'processing' || status === 'speaking' || status === 'finished' || prepTimeLeft > 0;

    const handleGoSummary = () => {
        navigate('/speaking/summary', {
            state: {
                chatHistory,
                scenarioPrompt,
                words,
                mode: isFullTestMode ? 'fullTest' : activeMode,
                sessionId: sessionIdRef.current,
            }
        });
    };

    // ── Full Test: auto-transition to next Part ──────────────────────────
    const handleFullTestTransition = async (nextPhase: 'part2' | 'part3') => {
        setLoadingNextPart(true);
        setStatusSync('processing');
        try {
            const res = nextPhase === 'part2'
                ? await ATInterceptor.bankGeneratePart2()
                : await ATInterceptor.bankGeneratePart3(activeExamQuestions[0]?.topic || '');
            const nextQuestions = (res.data?.questions ?? []) as ExamQuestion[];
            if (!nextQuestions.length) {
                throw new Error(t.speakingChat.errFetchPartFail.replace('{label}', nextPhase === 'part2' ? 'Part 2' : 'Part 3'));
            }

            const first = nextQuestions[0];
            const partNum = nextPhase === 'part2' ? '2' : '3';
            const transitionMsg = `Great. Let's continue with IELTS Speaking Part ${partNum}. Topic: ${first.topic}. ${first.question}`;

            setFullTestPhase(nextPhase);
            setActiveExamQuestions(nextQuestions);
            setCurrentQuestionIndex(0);
            if (nextPhase === 'part2') {
                setPrepTimeLeft(60);
            }
            
            setChatHistory(h => [
                ...h,
                { role: 'system', content: t.speakingChat.sysEnterPart.replace('{n}', String(partNum)) },
                { role: 'assistant', content: transitionMsg }
            ]);
            contextRef.current = [...contextRef.current, { role: 'assistant', content: transitionMsg }];

            // Play TTS for the transition message
            playTTS(transitionMsg, false);
        } catch (error: unknown) {
            const msg = (error as { message?: string })?.message || t.speakingChat.errLoadNextPartFail;
            showToast(msg, 'error');
            setChatHistory(h => [...h, { role: 'system', content: t.speakingChat.sysWarn.replace('{msg}', msg) }]);
            setStatusSync('finished');
        } finally {
            setLoadingNextPart(false);
        }
    };

    const handleContinueToPart3 = async () => {
        if (loadingPart3) return;

        setLoadingPart3(true);
        setStatusSync('processing');
        try {
            const res = await ATInterceptor.bankGeneratePart3(activeExamQuestions[0]?.topic || '');
            const nextQuestions = (res.data?.questions ?? []) as ExamQuestion[];
            if (!nextQuestions.length) {
                throw new Error(t.speakingChat.errPart3Fetch);
            }

            const first = nextQuestions[0];
            const part3Welcome = `Great. Let's continue with IELTS Speaking Part 3. Topic: ${first.topic}. ${first.question}`;

            setActiveMode('part3');
            setActiveExamQuestions(nextQuestions);
            setCurrentQuestionIndex(0);
            setShowPart3ContinuePrompt(false);
            setChatHistory(h => [...h, { role: 'assistant', content: part3Welcome }]);
            contextRef.current = [...contextRef.current, { role: 'assistant', content: part3Welcome }];
            setStatusSync('idle');
            showToast(t.speakingChat.toastPart3Enter, 'success');
        } catch (error: unknown) {
            const msg = (error as { message?: string })?.message || t.speakingChat.toastPart3Fail;
            showToast(msg, 'error');
            setStatusSync('finished');
        } finally {
            setLoadingPart3(false);
        }
    };

    return (
        <div className="sc-root">
            {/* ── Sidebar: Word Basket & Ai Settings ── */}
            <aside className="sc-sidebar">
                <div className="sc-sidebar-header">
                    <button className="sc-back-btn" onClick={() => navigate('/practice/ai/bank?skill=speaking')}>{t.speakingChat.backBtn}</button>
                    <h3>{t.speakingChat.vocabHeading}</h3>
                </div>

                <div style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
                    <div className="control-group">
                        <AiModelSelector label={t.components.aiModel.label} description="" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
                        <input type="checkbox" checked={showTimer} onChange={e => setShowTimer(e.target.checked)} />
                        {t.speakingChat.showTimer}
                    </label>
                </div>

                <div className="sc-word-list">
                    {words.length === 0 && <p className="sc-no-words">{t.speakingChat.noWords}</p>}
                    {words.map((w, i) => (
                        <div key={i} className={`sc-word-item${w.count > 0 ? ' used' : ''}`}>
                            <div className="sc-word-text">
                                <span className="sc-word-en">{w.en}</span>
                                {w.zh && <span className="sc-word-zh">{w.zh}</span>}
                            </div>
                            {w.count > 0 && <span className="sc-word-count">{w.count}</span>}
                        </div>
                    ))}
                </div>
            </aside>

            {/* ── Chat Area ── */}
            <main className="sc-main">
                <div className="sc-messages">
                    {chatHistory.map((msg, i) => (
                        <div key={i} className={`sc-bubble-wrapper ${msg.role}`}>
                            <div className={`sc-bubble sc-bubble-${msg.role}`}>
                                {msg.role === 'assistant' ? (
                                    <>
                                        <button
                                            className="sc-toggle-text-btn"
                                            onClick={() => setExpandedMsgs(prev => {
                                                const next = new Set(prev);
                                                if (next.has(i)) {
                                                    next.delete(i);
                                                } else {
                                                    next.add(i);
                                                }
                                                return next;
                                            })}
                                        >
                                            {expandedMsgs.has(i) ? t.speakingChat.hideText : t.speakingChat.showText}
                                        </button>
                                        {expandedMsgs.has(i) && (
                                            <MarkdownBubble content={msg.content} />
                                        )}
                                    </>
                                ) : msg.role === 'system' ? (
                                    <MarkdownBubble content={msg.content} className="sc-markdown sc-system-msg" />
                                ) : (
                                    <MarkdownBubble content={msg.content} />
                                )}
                            </div>

                            {msg.scores && (
                                <details className="sc-score-panel">
                                    <summary>
                                        {t.speakingChat.viewMultiScore}
                                    </summary>
                                    <div className="sc-score-details">
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scoreAccuracy}</span>
                                            <span className="sc-score-value">{msg.scores.accuracy != null ? (Math.round(msg.scores.accuracy * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scorePronunciation}</span>
                                            <span className="sc-score-value">{msg.scores.pronunciation != null ? (Math.round(msg.scores.pronunciation * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scoreFluency}</span>
                                            <span className="sc-score-value">{msg.scores.fluency != null ? (Math.round(msg.scores.fluency * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scoreCompleteness}</span>
                                            <span className="sc-score-value">{msg.scores.completeness != null ? (Math.round(msg.scores.completeness * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-divider" />
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scoreGrammar}</span>
                                            <span className="sc-score-value">{msg.scores.grammar ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scoreRelevance}</span>
                                            <span className="sc-score-value">{msg.scores.relevance ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">{t.speakingChat.scoreVocab}</span>
                                            <span className="sc-score-value">{msg.scores.vocab ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        {(msg.scores.coherence !== undefined || msg.scores.depth !== undefined) && (
                                            <>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label">{t.speakingChat.scoreCoherence}</span>
                                                    <span className="sc-score-value">{msg.scores.coherence ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label">{t.speakingChat.scoreDepth}</span>
                                                    <span className="sc-score-value">{msg.scores.depth ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                {msg.scores.feedback && (
                                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#4b5563', backgroundColor: '#f3f4f6', padding: '6px', borderRadius: '4px' }}>
                                                        💡 {msg.scores.feedback}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {msg.scores.are_a !== undefined && (
                                            <>
                                                <div className="sc-score-divider" />
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label" title={t.speakingChat.areAnswerTitle}>{t.speakingChat.areAnswer}</span>
                                                    <span className="sc-score-value">{msg.scores.are_a} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label" title={t.speakingChat.areReasonTitle}>{t.speakingChat.areReason}</span>
                                                    <span className="sc-score-value">{msg.scores.are_r} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label" title={t.speakingChat.areExampleTitle}>{t.speakingChat.areExample}</span>
                                                    <span className="sc-score-value">{msg.scores.are_e} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                {msg.scores.are_feedback && (
                                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#4b5563', backgroundColor: '#f3f4f6', padding: '6px', borderRadius: '4px' }}>
                                                        💡 {msg.scores.are_feedback}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {msg.scores.duration !== undefined && (
                                            <>
                                                <div className="sc-score-divider" />
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label">{t.speakingChat.durationChars}</span>
                                                    <span className="sc-score-value" style={{ fontSize: '12px' }}>
                                                        {msg.scores.duration}s | {msg.scores.word_count} words
                                                    </span>
                                                </div>
                                                {msg.scores.weighted_total_score !== undefined && (
                                                    <div className="sc-score-item" style={{ marginTop: '6px', backgroundColor: '#ecfeff', padding: '6px', borderRadius: '4px' }}>
                                                        <span className="sc-score-label" style={{ color: '#0891b2', fontWeight: 600 }}>{t.speakingChat.weightedAvg}</span>
                                                        <span className="sc-score-value" style={{ color: '#0891b2', fontWeight: 600 }}>
                                                            {msg.scores.weighted_total_score.toFixed(1)} <span style={{ fontSize: '11px', color: '#67e8f9' }}>/ 9.0</span>
                                                        </span>
                                                    </div>
                                                )}
                                                {msg.scores.length_feedback && (
                                                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
                                                        {msg.scores.length_feedback}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {msg.correctedText && (
                                            <>
                                                <div className="sc-score-divider" />
                                                <div className="sc-corrected-block">
                                                    <span className="sc-corrected-label">{t.speakingChat.correctedLabel}</span>
                                                    <p className="sc-corrected-text">{msg.correctedText}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    ))}

                    {/* Live transcript bubble while listening */}
                    {status === 'listening' && liveTranscript && (
                        <div className="sc-bubble sc-bubble-user sc-bubble-live">
                            <span className="sc-live-dot" />
                            <MarkdownBubble content={liveTranscript} />
                        </div>
                    )}

                    {/* Thinking bubble while AI processes */}
                    {status === 'processing' && (
                        <div className="sc-bubble sc-bubble-assistant sc-bubble-thinking">
                            <span className="sc-thinking-dot" />
                            <span className="sc-thinking-dot" />
                            <span className="sc-thinking-dot" />
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ── Controls ── */}
                <footer className="sc-footer">
                    <div className="sc-status-bar">
                        {/* Status indicator */}
                        <div className={`sc-status-indicator sc-status-${status}`}>
                            <span className="sc-dot" />
                            <span>{STATUS_LABEL[status]} {status === 'listening' && showTimer ? `(${formatTime(recordingTime)})` : ''}</span>
                        </div>


                        {/* Waveform during recording */}
                        {status === 'listening' && (
                            <div className="sc-waveform">
                                {Array.from({ length: BAR_COUNT }).map((_, i) => {
                                    const h = Math.max(4, audioLevel * (Math.sin(i * 2.4) * 0.5 + 0.5));
                                    return <div key={i} className="sc-waveform-bar" style={{ height: `${h}%` }} />;
                                })}
                            </div>
                        )}

                        {/* Hint / error */}
                        <div className="sc-transcript-hint">
                            {recError
                                ? <span className="sc-rec-error">⚠️ {recError}</span>
                                : status === 'idle' ? t.speakingChat.hintIdle
                                    : status === 'mic_loading' ? t.speakingChat.hintMicLoading
                                        : status === 'listening' ? t.speakingChat.hintListening
                                            : status === 'processing' ? t.speakingChat.hintProcessing
                                                : status === 'speaking' ? t.speakingChat.hintSpeaking
                                                    : status === 'finished' ? t.speakingChat.hintFinished
                                                        : t.speakingChat.hintLoading}
                        </div>
                    </div>

                    <div className="sc-controls">
                        {prepTimeLeft > 0 && (
                            <div className="sc-prep-timer" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    {t.speakingChat.prepTimeLabel.replace('{n}', String(prepTimeLeft))}
                                </div>
                                <button className="sc-skip-btn" onClick={() => setPrepTimeLeft(0)} style={{ padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                    {t.speakingChat.skipPrep}
                                </button>
                            </div>
                        )}

                        {/* [New] 结束时的总结按钮 */}
                        {status === 'finished' && (
                            <div className="sc-finish-overlay">
                                {showPart3ContinuePrompt ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                        <div style={{ fontSize: '14px', color: '#374151', textAlign: 'center' }}>
                                            {t.speakingChat.part2Ended}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            <button
                                                className="sc-summary-btn"
                                                onClick={handleContinueToPart3}
                                                disabled={loadingPart3}
                                            >
                                                {loadingPart3 ? t.speakingChat.preparingPart3 : t.speakingChat.yesContinuePart3}
                                            </button>
                                            <button
                                                className="sc-summary-btn"
                                                onClick={handleGoSummary}
                                            >
                                                {t.speakingChat.noViewSummary}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="sc-summary-btn"
                                        onClick={handleGoSummary}
                                    >
                                        {t.speakingConfig.scenarioSummary.viewReport}
                                    </button>
                                )}
                            </div>
                        )}

                        <button
                            id="sc-mic-button"
                            className={`sc-mic-btn sc-mic-${status}`}
                            onClick={toggleRecording}
                            disabled={isDisabled}
                            title={status === 'finished' ? 'Conversation finished' : 'Click to speak'}
                        >
                            {MIC_LABEL[status]}
                        </button>

                        {/* Text Input Toggle & Area（纯语音模式隐藏键盘；麦克风不可用时始终降级显示） */}
                        {((activeMode === 'chat' && !voiceOnly) || isMicUnusable) && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {!showTextInput ? (
                                    <button 
                                        className="sc-back-btn" 
                                        onClick={() => setShowTextInput(true)}
                                        title={t.speakingChat.useKeyboardTitle}
                                    >
                                        {t.speakingChat.useKeyboardBtn}
                                    </button>
                                ) : (
                                    <div className="sc-manual-input" style={{ width: '100%', maxWidth: '400px' }}>
                                        <input
                                            className="sc-text-input"
                                            type="text"
                                            value={textInput}
                                            onChange={e => setTextInput(e.target.value)}
                                            placeholder={t.speakingChat.replyPlaceholder}
                                            disabled={isDisabled}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && textInput.trim() && !isDisabled) {
                                                    handleSend(textInput.trim());
                                                    setTextInput('');
                                                }
                                            }}
                                        />
                                        <button
                                            className="sc-send-btn"
                                            onClick={() => {
                                                if (textInput.trim() && !isDisabled) {
                                                    handleSend(textInput.trim());
                                                    setTextInput('');
                                                }
                                            }}
                                            disabled={!textInput.trim() || isDisabled}
                                        >
                                            {t.speakingChat.sendBtn}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </footer>
            </main>
        </div>
    );
}


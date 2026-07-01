/**
 * SpeakingChatPage ?口语聊天练习? *
 * 架构:
 *  1. 前端 SpeechRecognition API  ?识别用户说的话（文本? *  2. 文本 ?POST /api/speaking/chat ?AI 回复文本
 *  3. AI 文本 ?POST /api/listening/audio (edge-tts) ?音频 blob
 *  4. 前端播放音频 ?播放完毕 ?解锁录音按钮
 *
 * 状态机:
 *  idle       ?可以点击录音
 *  listening  ?正在录音（SpeechRecognition 运行中）
 *  speaking   ?播放 AI 语音（禁用按钮）
 *  loading    ?进入页面时欢迎语加载（禁用按钮）
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { speakingStore } from '../../store/speaking_page_store';
import AiModelSelector from '../../components/common/AiModelSelector';
import { ATInterceptor } from '../../api/atInterceptor';
import { showToast } from '../../components/common/Toast';
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
    };
    const vocabRaw: string = state?.vocabInput ?? '';
    const initialMode: SpeakingMode = state?.mode ?? 'chat';
    const scenarioPrompt: string = state?.scenarioInput ?? '';
    const [activeMode, setActiveMode] = useState<SpeakingMode>(initialMode);
    const [activeExamQuestions, setActiveExamQuestions] = useState<ExamQuestion[]>(state?.questions ?? []);
    const isFullTestMode = initialMode === 'fullTest';
    const isExamMode = activeMode === 'part1' || activeMode === 'part2' || activeMode === 'part3' || isFullTestMode;

    // ── 路由守卫：防止刷新或直接跳转进来 ────────────────────────────────────
    useEffect(() => {
        if (!speakingStore.isChatAllowed) {
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
        let welcomeMsg = '';

        if (activeMode === 'scenario') {
            // Fallback welcome ?will be replaced by AI-generated opening below
            welcomeMsg = `Acting for scenario: "${scenarioPrompt}". I am ready to start. What would you like to say first?`;
        } else if (isFullTestMode && activeExamQuestions.length > 0) {
            // Full Test mode: start with Part 1
            welcomeMsg = `Welcome to the IELTS Full Speaking Test. We will go through Part 1, Part 2, and Part 3 consecutively. Let's begin with Part 1. Our first topic is ${activeExamQuestions[0].topic}. ${activeExamQuestions[0].question}`;
        } else if (isExamMode && activeExamQuestions.length > 0) {
            const partLabel = activeMode === 'part1' ? 'Part 1' : activeMode === 'part2' ? 'Part 2' : 'Part 3';
            welcomeMsg = `Welcome to IELTS Speaking ${partLabel}. Our first topic is ${activeExamQuestions[0].topic}. ${activeExamQuestions[0].question}`;
        } else {
            welcomeMsg = "Welcome to IELTS speaking practice. Tell me when you are ready.";
        }

        contextRef.current = [];
        setChatHistory([{ role: 'assistant', content: welcomeMsg }]);

        let isUnmounted = false;
        const controller = new AbortController();

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
                    console.log("Welcome TTS aborted", e);
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
                setRecError('浏览器不支持语音识别，请使用 Chrome 浏览器或 Edge');
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
                            setRecError('未能识别到语音，请大声重试');
                            setStatusSync('idle');
                        }
                    });
                } else {
                    stopAudioVisualizer();
                    stopRecTimer();

                    if (text) {
                        handleSend(text);
                    } else {
                        setRecError('未能识别到语音，请大声重试');
                        setStatusSync('idle');
                    }
                }
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sr.onerror = (e: any) => {
                console.log('sr.onerror', e);
                if (e.error === 'aborted') return;
                if (e.error === 'network' && statusRef.current === 'processing') return;

                stopAudioVisualizer();
                stopRecTimer();
                if (e.error === 'no-speech') {
                    setRecError('没有检测到语音，请重试');
                } else if (e.error === 'network') {
                    setRecError('语音识别需要网络，请检查连接');
                } else if (e.error === 'not-allowed') {
                    setRecError('麦克风权限被拒绝，请允许后刷新');
                    setIsMicUnusable(true);
                    setShowTextInput(true);
                } else {
                    setRecError(`识别错误: ${e.error}`);
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
                    setRecError('麦克风权限已被禁止。请在浏览器地址栏左侧点击锁图标 🔒，将麦克风权限改为"允许"，然后刷新页面。');
                } else if (name === 'NotFoundError') {
                    setRecError('未检测到麦克风设备，请确认麦克风已正确连接。');
                } else if (name === 'NotReadableError') {
                    setRecError('麦克风被其他应用占用，请关闭其他使用麦克风的程序后重试。');
                } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    setRecError('当前环境不支持麦克风。请使用 HTTPS 或 localhost 访问，并使用 Chrome/Edge/Firefox 浏览器。');
                } else {
                    setRecError('麦克风启动失败，请检查浏览器设置后刷新重试。');
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
                setChatHistory(h => [...h, { role: 'system', content: '⚠️ 题目数据缺失，请返回口语页重新开始。' }]);
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
                            newHistory.push({ role: 'system', content: '🏁 全套口语考试已完成！点击下方按钮查看完整评估报告。' });
                        }
                        // For part1→part2 and part2→part3 transitions, the loading message is added by handleFullTestTransition
                    } else if (isExamMode) {
                        const effectiveMode = isFullTestMode ? fullTestPhase : activeMode;
                        const partLabel = effectiveMode === 'part1' ? 'Part 1' : effectiveMode === 'part2' ? 'Part 2' : 'Part 3';
                        if (effectiveMode === 'part2') {
                            newHistory.push({ role: 'system', content: '🏁 Part 2 练习已完成。你可以继续 Part 3，或直接查看当前总结报告。' });
                        } else {
                            newHistory.push({ role: 'system', content: `🏁 ${partLabel} 练习已完成，点击下方按钮查看最终评估报告。` });
                        }
                    } else {
                        newHistory.push({ role: 'system', content: '🎭 本次练习已结束，查看得分总结。' });
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

            if (typeof error === 'object' && error !== null && ('name' in error && (error as { name: string }).name === 'ATBalanceError' || 'message' in error && (error as { message: string }).message === 'AT币余额不足')) {
                showToast((error as { message: string }).message, 'error', 'AT币不足');
                setChatHistory(h => [...h, { role: 'system', content: '⚠️ AT币余额不足，请充值或联系管理员' }]);
            } else {
                setChatHistory(h => [...h, { role: 'system', content: '⚠️ AI 连接失败，请检查网络后重试' }]);
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
        loading: '加载?..',
        mic_loading: '请求麦克风权?..',
        idle: '可以说话了',
        listening: '录音?..',
        processing: 'AI 思考中...',
        speaking: 'AI 说话?..',
        finished: '对话已结束',
    };
    const MIC_LABEL: Record<Status, string> = {
        loading: '加载中，请稍?..',
        mic_loading: '🎙?加载麦克?..',
        idle: '🎙️ 按下开始说话',
        listening: '🔴 点击结束说话',
        processing: '?AI 思考中...',
        speaking: '🔊 AI 说话?..',
        finished: '🏁 已结束',
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
                throw new Error(`未获取到 ${nextPhase === 'part2' ? 'Part 2' : 'Part 3'} 题目`);
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
                { role: 'system', content: `📍 进入 Part ${partNum}` },
                { role: 'assistant', content: transitionMsg }
            ]);
            contextRef.current = [...contextRef.current, { role: 'assistant', content: transitionMsg }];

            // Play TTS for the transition message
            playTTS(transitionMsg, false);
        } catch (error: unknown) {
            const msg = (error as { message?: string })?.message || '加载下一部分失败';
            showToast(msg, 'error');
            setChatHistory(h => [...h, { role: 'system', content: `⚠️ ${msg}，请点击下方按钮查看已完成部分的报告。` }]);
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
                throw new Error('未获取到 Part 3 题目，请稍后重试。');
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
            showToast('已继续进入 Part 3 练习。', 'success');
        } catch (error: unknown) {
            const msg = (error as { message?: string })?.message || '进入 Part 3 失败，请稍后重试。';
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
                    <button className="sc-back-btn" onClick={() => navigate('/speaking')}>?返回</button>
                    <h3>📚 词汇 & 设置</h3>
                </div>

                <div style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
                    <div className="control-group">
                        <AiModelSelector label={t.components.aiModel.label} description="" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
                        <input type="checkbox" checked={showTimer} onChange={e => setShowTimer(e.target.checked)} />
                        在录音时显示计时?                    </label>
                </div>

                <div className="sc-word-list">
                    {words.length === 0 && <p className="sc-no-words">暂无目标词汇</p>}
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
                                            {expandedMsgs.has(i) ? '🔽 隐藏文本' : '▶️ 显示文本'}
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
                                        🌟 查看本轮口语多维评分详情
                                    </summary>
                                    <div className="sc-score-details">
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">🎯 准确?(Accuracy):</span>
                                            <span className="sc-score-value">{msg.scores.accuracy != null ? (Math.round(msg.scores.accuracy * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">👄 发音 (Pronunciation):</span>
                                            <span className="sc-score-value">{msg.scores.pronunciation != null ? (Math.round(msg.scores.pronunciation * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">🌊 流利?(Fluency):</span>
                                            <span className="sc-score-value">{msg.scores.fluency != null ? (Math.round(msg.scores.fluency * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">🧩 完整?(Completeness):</span>
                                            <span className="sc-score-value">{msg.scores.completeness != null ? (Math.round(msg.scores.completeness * 9 / 100 * 2) / 2).toFixed(1) : '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-divider" />
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">📝 语法得分 (Grammar):</span>
                                            <span className="sc-score-value">{msg.scores.grammar ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">🎓 切题?(Relevance):</span>
                                            <span className="sc-score-value">{msg.scores.relevance ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        <div className="sc-score-item">
                                            <span className="sc-score-label">📚 词汇运用 (Vocabulary):</span>
                                            <span className="sc-score-value">{msg.scores.vocab ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                        </div>
                                        {(msg.scores.coherence !== undefined || msg.scores.depth !== undefined) && (
                                            <>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label">🧭 连贯?(Coherence):</span>
                                                    <span className="sc-score-value">{msg.scores.coherence ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label">🧠 思维深度 (Depth):</span>
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
                                                    <span className="sc-score-label" title="Answer: 第一句话是否直接回答了问题">🇦 Answer (直接作答):</span>
                                                    <span className="sc-score-value">{msg.scores.are_a} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label" title="Reason: 是否给出了合理的解释">🇷 Reason (给出原因):</span>
                                                    <span className="sc-score-value">{msg.scores.are_r} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 9.0</span></span>
                                                </div>
                                                <div className="sc-score-item">
                                                    <span className="sc-score-label" title="Example: 是否给出了具体的例子">🇪 Example (给出例子):</span>
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
                                                    <span className="sc-score-label">⏱️ 时长与字?</span>
                                                    <span className="sc-score-value" style={{ fontSize: '12px' }}>
                                                        {msg.scores.duration}s | {msg.scores.word_count} words
                                                    </span>
                                                </div>
                                                {msg.scores.weighted_total_score !== undefined && (
                                                    <div className="sc-score-item" style={{ marginTop: '6px', backgroundColor: '#ecfeff', padding: '6px', borderRadius: '4px' }}>
                                                        <span className="sc-score-label" style={{ color: '#0891b2', fontWeight: 600 }}>🌟 加权平均总分:</span>
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
                                                    <span className="sc-corrected-label">✍️ AI 修正后的表达</span>
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
                                : status === 'idle' ? '轮到你说话啦，按下绿色按钮开始'
                                    : status === 'mic_loading' ? '请在浏览器弹窗中允许麦克风权?..'
                                        : status === 'listening' ? '正在录音，说完后点击红色按钮停止'
                                            : status === 'processing' ? 'AI 正在生成回复，请稍?..'
                                                : status === 'speaking' ? '正在播放，播完后按钮变绿可继续'
                                                    : status === 'finished' ? '对话已结束，请点击上方查看总结报告'
                                                        : '正在加载，请稍?..'}
                        </div>
                    </div>

                    <div className="sc-controls">
                        {prepTimeLeft > 0 && (
                            <div className="sc-prep-timer" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                    ⏱️ 准备时间：{prepTimeLeft}s
                                </div>
                                <button className="sc-skip-btn" onClick={() => setPrepTimeLeft(0)} style={{ padding: '6px 16px', borderRadius: '20px', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                    跳过准备
                                </button>
                            </div>
                        )}

                        {/* [New] 结束时的总结按钮 */}
                        {status === 'finished' && (
                            <div className="sc-finish-overlay">
                                {showPart3ContinuePrompt ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                                        <div style={{ fontSize: '14px', color: '#374151', textAlign: 'center' }}>
                                            Part 2 已结束，是否继续 Part 3 练习?                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            <button
                                                className="sc-summary-btn"
                                                onClick={handleContinueToPart3}
                                                disabled={loadingPart3}
                                            >
                                                {loadingPart3 ? '正在准备 Part 3...' : '是，继续 Part 3'}
                                            </button>
                                            <button
                                                className="sc-summary-btn"
                                                onClick={handleGoSummary}
                                            >
                                                否，查看总结
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

                        {/* Text Input Toggle & Area */}
                        {(activeMode === 'chat' || isMicUnusable) && (
                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {!showTextInput ? (
                                    <button 
                                        className="sc-back-btn" 
                                        onClick={() => setShowTextInput(true)}
                                        title="使用键盘输入"
                                    >
                                        ⌨️ 使用键盘输入
                                    </button>
                                ) : (
                                    <div className="sc-manual-input" style={{ width: '100%', maxWidth: '400px' }}>
                                        <input
                                            className="sc-text-input"
                                            type="text"
                                            value={textInput}
                                            onChange={e => setTextInput(e.target.value)}
                                            placeholder="输入回复内容..."
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
                                            发?                                        </button>
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

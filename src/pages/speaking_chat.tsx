/**
 * SpeakingChatPage — 口语聊天练习页
 *
 * 架构:
 *  1. 前端 SpeechRecognition API  → 识别用户说的话（文本）
 *  2. 文本 → POST /api/speaking/chat → AI 回复文本
 *  3. AI 文本 → POST /api/listening/audio (edge-tts) → 音频 blob
 *  4. 前端播放音频 → 播放完毕 → 解锁录音按钮
 *
 * 状态机:
 *  idle       → 可以点击录音
 *  listening  → 正在录音（SpeechRecognition 运行中）
 *  processing → AI 思考 + 生成 TTS（禁用按钮，显示 Thinking 气泡）
 *  speaking   → 播放 AI 语音（禁用按钮）
 *  loading    → 进入页面时欢迎语加载（禁用按钮）
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RecordRTC, { StereoAudioRecorder } from 'recordrtc';
import { api } from '../api/client';
import { speakingStore } from '../store/speaking_page_store';
import AiModelSelector from '../components/AiModelSelector';
import '../styles/speaking_chat.css';

// ── Types ──────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant' | 'system';
interface ChatMessage {
    role: Role;
    content: string;
    scores?: {
        grammar?: number;
        vocab?: number;
        relevance?: number;
        accuracy?: number;
        pronunciation?: number;
        completeness?: number;
        fluency?: number;
    };
}

type Status = 'loading' | 'mic_loading' | 'idle' | 'listening' | 'processing' | 'speaking';

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
            const m = l.match(/^([a-zA-Z\s\-]+)(.*)$/);
            if (!m) return null;
            return { en: m[1].trim(), zh: m[2].trim(), count: 0 };
        })
        .filter(Boolean) as Word[];
}

function countMatches(text: string, word: string): number {
    const rx = new RegExp(`\\b${word}\\b`, 'gi');
    return (text.match(rx) || []).length;
}

function highlightWords(text: string, words: Word[]): string {
    let out = text;
    words.forEach(w => {
        if (!w.en) return;
        const rx = new RegExp(`\\b(${w.en})\\b`, 'gi');
        out = out.replace(rx, '<span class="sc-highlight">$1</span>');
    });
    return out;
}

// SpeechRecognition cross-browser factory (avoids TypeScript global type issues)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSRConstructor = (): any =>
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

export default function SpeakingChatPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const vocabRaw: string = (location.state as { vocabInput?: string })?.vocabInput ?? '';

    // ── 路由守卫：防止刷新或直接跳转进来 ────────────────────────────────────
    useEffect(() => {
        if (!speakingStore.isChatAllowed) {
            navigate('/speaking', { replace: true });
            return;
        }

        return () => {
            // 组件卸载时，无论是由于 React v18 开发模式严苛双重调用，还是真的离开路由
            // 都在事件循环后置空合规性变量。这样外部跳转返回时就被封禁了。
            setTimeout(() => {
                speakingStore.isChatAllowed = false;
            }, 0);
        };
    }, [navigate]);

    // ── State ──
    const [words, setWords] = useState<Word[]>(() => parseWords(vocabRaw));
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<Status>('loading');
    const [liveTranscript, setLiveTranscript] = useState('');
    const [recError, setRecError] = useState('');
    const [audioLevel, setAudioLevel] = useState(0);
    const [recordingTime, setRecordingTime] = useState(0);

    // ── Refs (never stale inside callbacks) ──
    const wordsRef = useRef<Word[]>(parseWords(vocabRaw));
    const contextRef = useRef<ChatMessage[]>([]);
    const statusRef = useRef<Status>('loading');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Prevent concurrent handleSend calls
    const pendingRef = useRef(false);

    // AudioContext for volume visualizer
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // Frontend live transcript engine
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const srRef = useRef<any>(null);
    // Background WAV engine for backend debug
    const recorderRef = useRef<RecordRTC | null>(null);

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

        // 【新增】进页面立刻索要麦克风权限
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                // 成功授权后，立刻释放掉这些轨道，免得浏览器右上角一直有个红点（真正用的时候会再次请求）
                stream.getTracks().forEach(track => track.stop());
            })
            .catch(err => {
                console.warn('初次请求麦克风权限被拒或出错:', err);
                // 此时并不强行报错中断流程（因为用户点按钮时还会再次申请并抛错）
            });

        const wordList = wordsRef.current.map(w => w.en).join(', ');
        const systemPrompt = `You are an IELTS speaking practice AI examiner.
Target vocabulary: [${wordList}].
Rules:
1. Always reply in English only.
2. Use the target vocabulary naturally in your responses.
3. Keep replies concise (1-3 sentences).
4. No markdown symbols.
5. Encourage the user to use the target words.`;

        const welcome = wordsRef.current.length > 0
            ? `Hello! Today's vocabulary: ${wordsRef.current.slice(0, 3).map(w => w.en).join(', ')}${wordsRef.current.length > 3 ? ', and more' : ''}. When you're ready, press the button and start speaking!`
            : `Hello! I'm your IELTS speaking partner. Press the button when you're ready to begin.`;

        contextRef.current = [{ role: 'system', content: systemPrompt }];

        let isUnmounted = false;

        (async () => {
            const url = await prepareTTSAudio(welcome);
            if (isUnmounted) return;
            setChatHistory([{ role: 'assistant', content: welcome }]);
            playTTSAudio(url, welcome, () => {
                if (!isUnmounted) setStatusSync('idle');
            });
        })();

        return () => {
            isUnmounted = true;
            stopAudio();
            if (srRef.current) {
                try { srRef.current.abort(); } catch (_) { /* ignore */ }
            }
            if (recorderRef.current) {
                recorderRef.current.destroy();
                recorderRef.current = null;
            }
            micStreamRef.current?.getTracks().forEach(t => t.stop());
            if (recTimerRef.current) clearInterval(recTimerRef.current);
            if (ttsTimerRef.current) clearTimeout(ttsTimerRef.current);
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

            const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/speaking/transcribe`, {
                method: 'POST',
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

            // Setup Frontend SR
            const SR = getSRConstructor();
            if (!SR) {
                setRecError('浏览器不支持语音识别，请使用 Chrome 浏览器或 Edge');
                setStatusSync('idle');
                return;
            }
            const sr = new SR();
            sr.lang = 'en-US';
            sr.continuous = true;
            sr.interimResults = true;
            sr.maxAlternatives = 1;

            let accumulatedFinal = '';

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

                stopAudioVisualizer();
                stopRecTimer();
                const text = liveTranscriptRef.current.trim();
                setLiveTranscript('');
                liveTranscriptRef.current = '';

                // Also stop the background WAV recorder
                if (recorderRef.current) {
                    recorderRef.current.stopRecording(() => {
                        const blob = recorderRef.current!.getBlob();
                        recorderRef.current!.reset();
                        recorderRef.current!.destroy();
                        recorderRef.current = null;

                        if (text) {
                            handleSend(text, blob.size > 1000 ? blob : undefined);
                        } else {
                            setRecError('未能识别到语音，请大声重试');
                            setStatusSync('idle');
                        }
                    });
                } else {
                    if (text) {
                        handleSend(text);
                    } else {
                        setRecError('未能识别到语音，请大声重试');
                        setStatusSync('idle');
                    }
                }
            };

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
                } else {
                    setRecError(`识别错误: ${e.error}`);
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

                // 2. 准备后台纯正 WAV 录音库
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
                        setStatusSync('listening');
                        startRecTimer();
                    }
                };

                sr.start();
            } catch (err) {
                setRecError('麦克风权限被拒绝或无法启动，请检查浏览器设置');
                setStatusSync('idle');
            }

        } else if (s === 'listening') {
            // Stop manually
            setStatusSync('processing');
            // This implicitly calls sr.onend
            try { srRef.current?.stop(); } catch (_) { /* ignore */ }
        }
    };

    // ── Send text to AI ───────────────────────────────────────────────────
    const handleSend = async (text: string, audioBlob?: Blob) => {
        if (!text) { setStatusSync('idle'); return; }
        // Prevent concurrent requests (e.g. double onend firing)
        if (pendingRef.current) return;
        pendingRef.current = true;

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
            const chatPromise = api<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number }>('/speaking/chat', {
                method: 'POST',
                body: { messages },
            });
            const uploadPromise = audioBlob ? uploadRecording(audioBlob, text) : Promise.resolve(null);

            const [chatRes, azureScores] = await Promise.all([chatPromise, uploadPromise]);

            // Prepare TTS first (so audio is ready when bubble appears)
            const audioUrl = await prepareTTSAudio(chatRes.reply);

            const combinedScores = {
                grammar: chatRes.grammar_score,
                vocab: chatRes.vocab_score,
                relevance: chatRes.relevance_score,
                ...(azureScores || {})
            };

            const aiMsg: ChatMessage = {
                role: 'assistant',
                content: chatRes.reply,
                scores: combinedScores
            };
            setChatHistory(h => [...h, aiMsg]);
            contextRef.current = [...contextRef.current, userMsg, { role: 'assistant', content: chatRes.reply }];
            setWordsSync(prev => prev.map(w => ({ ...w, count: w.count + countMatches(chatRes.reply, w.en) })));

            // Play audio → on finish → idle
            playTTSAudio(audioUrl, chatRes.reply, () => {
                pendingRef.current = false;
                setStatusSync('idle');
            });

        } catch {
            pendingRef.current = false;
            setChatHistory(h => [...h, { role: 'system', content: '⚠️ AI 连接失败，请检查网络后重试' }]);
            setStatusSync('idle');
        }
    };

    // ── TTS: prepare audio (server-side edge-tts) ─────────────────────────
    const prepareTTSAudio = async (text: string): Promise<string | null> => {
        const clean = text.replace(/<[^>]*>/g, '').replace(/[*#`_]/g, '');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/listening/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: clean }),
            });
            if (!res.ok) throw new Error('TTS failed');
            const blob = await res.blob();
            return URL.createObjectURL(blob);
        } catch {
            return null;
        }
    };

    // ── TTS: play ─────────────────────────────────────────────────────────
    const stopAudio = () => {
        if (ttsTimerRef.current) clearTimeout(ttsTimerRef.current);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current = null;
        }
        window.speechSynthesis?.cancel();
    };

    const playTTSAudio = (url: string | null, text: string, onDone: () => void) => {
        setStatusSync('speaking');
        stopAudio();
        const clean = text.replace(/<[^>]*>/g, '').replace(/[*#`_]/g, '');

        // Safety timer: resume after 45s even if audio never ends
        const safety = setTimeout(onDone, 45_000);
        ttsTimerRef.current = safety;
        const done = () => { clearTimeout(safety); onDone(); };

        if (url) {
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { URL.revokeObjectURL(url); done(); };
            audio.onerror = () => { URL.revokeObjectURL(url); done(); };
            audio.play().catch(done);
        } else {
            // Fallback: browser TTS
            try {
                const utter = new SpeechSynthesisUtterance(clean);
                utter.lang = 'en-US';
                utter.rate = 1.1;
                utter.onend = done;
                utter.onerror = done;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utter);
            } catch { done(); }
        }
    };

    // ── UI helpers ─────────────────────────────────────────────────────────
    const STATUS_LABEL: Record<Status, string> = {
        loading: '加载中...',
        mic_loading: '请求麦克风权限...',
        idle: '可以说话了',
        listening: '录音中...',
        processing: 'AI 思考中...',
        speaking: 'AI 说话中...',
    };
    const MIC_LABEL: Record<Status, string> = {
        loading: '加载中，请稍候...',
        mic_loading: '🎙️ 加载麦克风...',
        idle: '🎙️ 按下开始说话',
        listening: '🔴 点击结束说话',
        processing: '⏳ AI 思考中...',
        speaking: '🔊 AI 说话中...',
    };
    const formatTime = (s: number) =>
        `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const BAR_COUNT = 12;
    const isDisabled = status === 'loading' || status === 'mic_loading' || status === 'processing' || status === 'speaking';

    return (
        <div className="sc-root">
            {/* ── Sidebar: Word Basket & Ai Settings ── */}
            <aside className="sc-sidebar">
                <div className="sc-sidebar-header">
                    <button className="sc-back-btn" onClick={() => navigate('/speaking')}>← 返回</button>
                    <h3>📚 词汇 & 设置</h3>
                </div>

                <div style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                    <AiModelSelector label="当前模型" description="" />
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
                                    <span dangerouslySetInnerHTML={{ __html: highlightWords(msg.content, words) }} />
                                ) : msg.role === 'system' ? (
                                    <span className="sc-system-msg">{msg.content}</span>
                                ) : (
                                    <span>{msg.content}</span>
                                )}
                            </div>

                            {msg.scores && (() => {
                                const validScores = [
                                    msg.scores.accuracy,
                                    msg.scores.pronunciation,
                                    msg.scores.fluency,
                                    msg.scores.completeness,
                                    msg.scores.grammar,
                                    msg.scores.vocab,
                                    msg.scores.relevance
                                ].filter(s => typeof s === 'number') as number[];

                                const avgScore = validScores.length > 0
                                    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                                    : null;

                                return (
                                    <details className="sc-score-panel">
                                        <summary>
                                            🌟 查看本轮口语多维评分详情
                                            {avgScore !== null && <span style={{ marginLeft: '10px', color: '#16a34a', fontWeight: 'bold' }}>🏆 综合得分: {avgScore} / 100</span>}
                                        </summary>
                                        <div className="sc-score-details">
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">🎯 准确度 (Accuracy):</span>
                                                <span className="sc-score-value">{msg.scores.accuracy ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">👄 发音 (Pronunciation):</span>
                                                <span className="sc-score-value">{msg.scores.pronunciation ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">🌊 流利度 (Fluency):</span>
                                                <span className="sc-score-value">{msg.scores.fluency ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">🧩 完整度 (Completeness):</span>
                                                <span className="sc-score-value">{msg.scores.completeness ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                            <div className="sc-score-divider" />
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">📝 语法得分 (Grammar):</span>
                                                <span className="sc-score-value">{msg.scores.grammar ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">🎓 切题度 (Relevance):</span>
                                                <span className="sc-score-value">{msg.scores.relevance ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">📚 词汇运用 (Vocabulary):</span>
                                                <span className="sc-score-value">{msg.scores.vocab ?? '--'} <span style={{ fontSize: '11px', color: '#9ca3af' }}>/ 100</span></span>
                                            </div>
                                        </div>
                                    </details>
                                );
                            })()}
                        </div>
                    ))}

                    {/* Live transcript bubble while listening */}
                    {status === 'listening' && liveTranscript && (
                        <div className="sc-bubble sc-bubble-user sc-bubble-live">
                            <span className="sc-live-dot" />
                            <span>{liveTranscript}</span>
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
                <div className="sc-controls">
                    <div className="sc-status-bar">
                        {/* Status indicator */}
                        <div className={`sc-status-indicator sc-status-${status}`}>
                            <span className="sc-dot" />
                            <span>{STATUS_LABEL[status]}</span>
                            {status === 'listening' && (
                                <span className="sc-recording-time">{formatTime(recordingTime)}</span>
                            )}
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
                                    : status === 'mic_loading' ? '请在浏览器弹窗中允许麦克风权限...'
                                        : status === 'listening' ? '正在录音，说完后点击红色按钮停止'
                                            : status === 'processing' ? 'AI 正在生成回复，请稍候...'
                                                : status === 'speaking' ? '正在播放，播完后按钮变绿可继续'
                                                    : '正在加载，请稍候...'}
                        </div>
                    </div>

                    {/* Main mic button */}
                    <button
                        id="sc-mic-button"
                        className={`sc-mic-btn sc-mic-${status}`}
                        onClick={toggleRecording}
                        disabled={isDisabled}
                    >
                        {MIC_LABEL[status]}
                    </button>
                </div>
            </main>
        </div>
    );
}

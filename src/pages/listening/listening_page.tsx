import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { showConfirm } from '../../components/common/ConfirmService';
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
import { rawToBand, formatBand } from '../../utils/ielts_band';
import { resolveAnswerSentences, markResolvedSentences } from '../../utils/answer_sentences';
import { applyPaneWidth, watchPaneFreezeMin } from '../../utils/pane_resize';
import {
    FormRenderer,
    TableRenderer,
    FlowchartRenderer,
    ShortAnswerRenderer,
    MatchingRenderer,
    NoteRenderer,
    scoreListeningQuestions,
    bankVal,
} from '../../components/listening/ListeningQuestionRenderer';
import ListeningMapSVG from '../../components/listening/ListeningMapSVG';
import MatchingLetterGrid from '../../components/common/MatchingLetterGrid';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PracticeBottomBar, { type PracticeNavLabels } from '../../components/common/PracticeBottomBar';
import { MockTimerBar } from '../../components/mock/MockExamShell';
import { useMockExamGuard } from '../../components/mock/useMockExamGuard';
import '../../styles/listening_page.css';
import '../../styles/reading_page.css';

// Number-to-word map (used for answer comparison)
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

// Question data comes from AI generation or legacy bank records, so field drift cannot be fully prevented - on error degrade to a local notice rather than a blank page
export default function ListeningPageWrapper() {
    return (
        <ErrorBoundary>
            <ListeningPage />
        </ErrorBoundary>
    );
}

function ListeningPage() {
    const { state } = useLocation();
    const [searchParams] = useSearchParams();
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    // Full mock: mockId present -> exam mode (timed + exit guard + submit returns to the hub)
    const mockIdParam = searchParams.get('mockId');
    const mockId = mockIdParam ? Number(mockIdParam) : null;
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
    const customPrompt: string = typeof state?.customPrompt === 'string' ? state.customPrompt.trim() : '';
    const navigate = useNavigate();
    const onReturnHome = () => navigate(mockId ? `/mock/${mockId}` : (bankId ? '/practice/ai/bank' : '/'));
    const { t } = useLang();
    const [absurdMode] = useState<boolean>(Boolean(state?.absurdMode));

    // Cold start with no config -> render the landing page, do not kick off a paid generation (see the same note in reading_page)
    const [noConfig, setNoConfig] = useState(false);
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
    // renderTick must be in the deps for the same reason as reading_page's getAnswer: answers live in a ref,
    // and the React Compiler (enabled in vite.config.ts) cannot see in-place ref mutation. As long as getAnswer's
    // identity is stable the compiler decides the downstream component's inputs are unchanged and replays cached JSX,
    // so clicks 'register but do not show'. Reading hit this as a real bug on 2026-07-27 (matching questions would not respond).
    //
    // Listening has not shown it yet only because the matching grid is written inside an IIFE whose props are rebuilt
    // every render - an accident of the implementation. Extract that block into a component and it reproduces instantly.
    // Harden it the same way here rather than relying on the accident.
    //
    // No input-performance cost: text gap-fills write the ref directly (not via setAnswerV2), so typing does not re-render.
    const getAnswer = useCallback((qid: number) => userAnswersRef.current[qid] || '', [renderTick]);
    const setAnswerV2 = useCallback((qid: number, value: string) => {
        userAnswersRef.current[qid] = value;
        setRenderTick(t => t + 1);
    }, []);

    // -- Bottom bar data (pills show the real q.id; under full-test Section 2 = 11..20) --
    const navQuestionIds = useMemo<number[]>(() => {
        const data = st.listeningData;
        if (!data) return [];
        if (data.type === 'full') {
            const sec = (data.sections || []).find(s => s.sectionNum === st.activeSection) || (data.sections || [])[0];
            return (sec?.questions || []).map(q => q.id);
        }
        const qs = (data as { questions?: { id: number }[] }).questions;
        return Array.isArray(qs) ? qs.map(q => q.id) : [];
    }, [st.listeningData, st.activeSection]);

    // renderTick is the re-render beat for answersRef (inline gap-fills are uncontrolled and do not fire while typing,
    // so the answered fill colour catches up on the next natural re-render - a known trade-off, consistent with existing behaviour)
    const navAnsweredIds = useMemo<Set<number>>(() => {
        void renderTick; // answers live in a ref, so this tick triggers the recompute
        const s = new Set<number>();
        for (const [k, v] of Object.entries(userAnswersRef.current)) {
            if (String(v ?? '').trim()) s.add(Number(k));
        }
        return s;
    }, [renderTick]);

    const navOverviewParts = useMemo(() => {
        const data = st.listeningData;
        if (!data || data.type !== 'full') return undefined;
        return (data.sections || []).map(sec => ({
            label: `Section ${sec.sectionNum}`,
            questionIds: (sec.questions || []).map(q => q.id),
            active: sec.sectionNum === st.activeSection,
        }));
    }, [st.listeningData, st.activeSection]);

    // time-on-task tick (same as reading; audio playback progress is a separate thing)
    useEffect(() => {
        if (st.step !== 2 || st.isLoading || !st.startTime) return;
        const interval = setInterval(() => {
            set('elapsedSeconds', Math.floor((Date.now() - st.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [st.step, st.isLoading, st.startTime]);

    const formatAudioTime = (secs: number): string => {
        if (!isFinite(secs) || secs < 0) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // time on task (shown in the middle of the top toolbar; distinct from audio progress via formatAudioTime)
    const formatElapsed = useCallback((totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return {
            h: String(h).padStart(2, '0'),
            m: String(m).padStart(2, '0'),
            s: String(s).padStart(2, '0'),
        };
    }, []);

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

    // release the object URL
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const CACHE_KEY = 'listening_session_cache';

    // -- Full mock exam mode --
    const isMockActive = mockId !== null && st.step === 2 && !st.isLoading;
    const { confirmExit: mockConfirmExit } = useMockExamGuard({
        mockId: mockId ?? 0,
        part: 'listening',
        active: isMockActive,
    });
    const MOCK_DRAFT_KEY = mockId ? `mock:${mockId}:listening:answers` : '';
    // Auto-save the draft so progress survives a refresh (the deadline lives on the server, so timing is unaffected)
    useEffect(() => {
        if (!isMockActive || !MOCK_DRAFT_KEY) return;
        const timer = setInterval(() => {
            try {
                localStorage.setItem(MOCK_DRAFT_KEY, JSON.stringify(userAnswersRef.current));
            } catch { /* a storage failure must not block answering */ }
        }, 4000);
        return () => clearInterval(timer);
    }, [isMockActive, MOCK_DRAFT_KEY]);

    // mock refresh recovery: with no server-side answers, resume from the local draft
    const restoreMockDraft = (): Record<number, string> => {
        if (!MOCK_DRAFT_KEY) return {};
        try {
            const raw = localStorage.getItem(MOCK_DRAFT_KEY);
            if (raw) return JSON.parse(raw) as Record<number, string>;
        } catch { /* treat a corrupted draft as empty */ }
        return {};
    };

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;

        // Bank mode: fetch the question by bankId, never call AI generation
        if (bankId) {
            sessionStorage.removeItem(CACHE_KEY);
            setSt(createListeningState());
            loadFromBank(bankId);
            return;
        }

        // Refresh recovery: prefer the cached data in sessionStorage
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { listeningData: cachedData, vocabList: cachedVocab } = JSON.parse(cached);
                setSt(s => ({
                    ...s,
                    listeningData: cachedData,
                    vocabList: cachedVocab,
                    isLoading: false,
                    startTime: Date.now(),
                    elapsedSeconds: 0,
                }));
                // audio cannot be persisted, so after a refresh the questions survive but the audio does not
                return;
            } catch {
                sessionStorage.removeItem(CACHE_KEY);
            }
        }

        // No config means no generation: empty state proves we did not come from the config page (same as the reading_page note)
        if (!state) {
            setNoConfig(true);
            return;
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
                    showToast(t('listeningDetails.toastContentMissing'), 'error');
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
                    startTime: Date.now(),
                    elapsedSeconds: 0,
                }));
                const saved = (detail.userAnswer || null) as Record<number, string> | null;
                if (saved && typeof saved === 'object') {
                    userAnswersRef.current = { ...saved };
                    setSt(s => ({ ...s, step: 3 }));
                } else {
                    userAnswersRef.current = mockId ? restoreMockDraft() : {};
                }
                setAudioLoading(true);
                await fetchAudioForPassage(fullContent.sections[0]?.passage || '');
                setAudioLoading(false);
                return;
            }
            const singleContent = content as { passage?: string; questions?: unknown };
            if (!singleContent.passage || !Array.isArray(singleContent.questions)) {
                showToast(t('listeningDetails.toastContentMissing'), 'error');
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
                startTime: Date.now(),
                elapsedSeconds: 0,
            }));

            const saved = (detail.userAnswer || null) as Record<number, string> | null;
            if (saved && typeof saved === 'object') {
                userAnswersRef.current = { ...saved };
                setSt(s => ({ ...s, step: 3 }));
            } else {
                userAnswersRef.current = mockId ? restoreMockDraft() : {};
            }

            setAudioLoading(true);
            await fetchAudioForPassage((listeningData as LegacyListeningData).passage || '');
            setAudioLoading(false);
        } catch (err: unknown) {
            console.error('Bank load error:', err);
            showToast(t('aiBank.loadFail'), 'error');
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

    // strip ** markers for TTS
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
                if (customPrompt) body.customPrompt = customPrompt;
                parsedData = await api('/listening/full', { method: 'POST', body });
            } else {
                const body: Record<string, unknown> = {
                    words, difficulty, wordCountMin, wordCountMax, practiceType, absurdMode, scenario,
                };
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                if (customPrompt) body.customPrompt = customPrompt;
                parsedData = await api('/listening/generate', {
                    method: 'POST',
                    body,
                });
            }

            sessionStorage.removeItem(CACHE_KEY);
            const justId = parsedData.aiQuestionId ?? null;
            showToast(t('aiBank.toastGeneratedSaved'), 'success');
            navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            return;
        } catch (err: unknown) {
            console.error("API Error:", err);
            const error = err as { message?: string, status?: number };
            showToast(error.message || t('common.error'), 'error', error.status);
            onReturnHome();
        } finally {
            set('isLoading', false);
        }
    };

    const submitQuiz = async (forced = false) => {
        if (!st.listeningData) return;
        // Total question count spans full-test sections OR single quiz.
        let totalQuestions = 0;
        if (st.listeningData.type === 'full') {
            // A dirty bank record may be missing the sections / questions arrays; guard at every level so submitting does not crash
            for (const sec of (st.listeningData.sections || [])) {
                totalQuestions += Array.isArray(sec.questions) ? sec.questions.length : 0;
            }
        } else {
            const qsArr = st.listeningData.questions;
            totalQuestions = Array.isArray(qsArr) ? qsArr.length : 0;
        }
        const answeredQuestions = Object.values(userAnswersRef.current).filter(v => String(v).trim().length > 0).length;
        if (!forced && answeredQuestions < totalQuestions) {
            if (!(await showConfirm(t('readingDetails.submitConfirm')))) return;
        }
        // stop TTS
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setTtsSpeaking(false);

        // mock mode: on submit, write the score (raw + band) into aiFeedback synchronously for the hub and report to read
        if (bankId && mockId) {
            const allQs: { id: number; answer?: string; answers?: string[] }[] = [];
            if (st.listeningData.type === 'full') {
                for (const sec of ((st.listeningData as FullListeningData).sections || [])) {
                    for (const q of (sec.questions || [])) allQs.push(q as { id: number; answer?: string; answers?: string[] });
                }
            } else {
                for (const q of ((st.listeningData as LegacyListeningData).questions || [])) {
                    allQs.push(q as { id: number; answer?: string; answers?: string[] });
                }
            }
            const { correct } = scoreListeningQuestions(allQs, qid => userAnswersRef.current[qid] || '');
            const total = allQs.length;
            const band = rawToBand('listening', correct, total) ?? 0;
            try {
                await submitAIQuestion(bankId, { ...userAnswersRef.current }, { correct, total, band });
            } catch (err) {
                console.error('mock submit failed:', err);
                showToast(t('listeningDetails.toastSaveFail'), 'error');
                if (!forced) return; // a failed manual submit stays on the page to retry; a timeout force-submit leaves anyway
            }
            if (MOCK_DRAFT_KEY) localStorage.removeItem(MOCK_DRAFT_KEY);
            showToast(t('mock.examMode.submittedToHub'), 'success');
            navigate(`/mock/${mockId}`, { replace: true });
            return;
        }

        if (bankId) {
            submitAIQuestion(bankId, { ...userAnswersRef.current }).catch(err => {
                console.error('submit to bank failed:', err);
                showToast(t('listeningDetails.toastSaveFail'), 'error');
            });
        }
        set('step', 3);
    };

    const restartFromBank = () => {
        userAnswersRef.current = {};
        setSt(s => ({ ...s, step: 2, startTime: Date.now(), elapsedSeconds: 0 }));
    };

    // play the already-prefetched audio
    const startTTS = async () => {
        if (!audioRef.current || ttsStarted) return;
        setTtsStarted(true);
        setTtsSpeaking(true);

        try {
            // start from the beginning
            audioRef.current.currentTime = 0;
            await audioRef.current.play();
        } catch (err: unknown) {
            console.error("Audio playback error:", err);
            setTtsSpeaking(false);
            setTtsStarted(false);
            showToast(t('listeningDetails.audioError'), 'error');
        }
    };

    // Resizer logic (REMOVED: The layout is now single-column with inline inputs)

    // floating underline
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
        // Allow dragging across the full 0-100%; what prevents 'dragged too narrow to read' is the layout freeze, not clamping the divider
        const content = layout.querySelector<HTMLElement>('.results-content');
        const stopWatchFreeze = watchPaneFreezeMin(layout, [sidebar, content]);

        const onMouseDown = (e: MouseEvent) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.getBoundingClientRect().width;
            layout.classList.add('is-resizing');
            resizer.classList.add('resizing');
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            // The transcript pane is visually on the **right** (CSS order flips it, see the
            // #listeningResultsLayout rules in reading_page.css), so dragging right narrows it and dragging left widens it -
            // hence the negated delta. DOM order is unchanged; do not reason from DOM position.
            applyPaneWidth(sidebar, startWidth - (e.clientX - startX), layout);
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
            stopWatchFreeze();
            resizer.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [st.step, st.isPassageOpen]);

    // No-config landing page: a cold start renders this instead of silently charging the user
    if (noConfig) {
        return (
            <div className="reading-container">
                <div className="page rp-noconfig">
                    <div className="rp-noconfig-icon" aria-hidden="true">🎧</div>
                    <h2 className="rp-noconfig-title">{t('listeningDetails.noConfigTitle')}</h2>
                    <p className="rp-noconfig-desc">{t('listeningDetails.noConfigDesc')}</p>
                    <div className="rp-noconfig-actions">
                        <button className="rp-noconfig-primary" onClick={() => navigate('/practice/ai/listening')}>
                            {t('listeningDetails.noConfigGoConfig')}
                        </button>
                        <button className="rp-noconfig-secondary" onClick={() => navigate('/practice/ai/bank?skill=listening')}>
                            {t('listeningDetails.noConfigGoBank')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Loading — two distinct phases
    if (st.isLoading) {
        return (
            <div className="reading-container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">
                        🧠 {t('listeningDetails.writingPassage')}
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
                        🔊 {t('listeningDetails.generatingAudio')}
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

        // strip every ** marker from the transcript (no bold highlighting in exam presentation)
        const removeMarkdown = (text: string) => {
            if (!text) return '';
            return text.replace(/\*\*/g, '');
        };

        // helper for rendering inline gap-fills
        const renderInlineInput = (qId: number, idx: number) => {
            // Shares the .rd-blank-input styling with reading's note/summary/sentence completion.
            // data-question-id sits on the input itself: the article, sentence and fallback paths all go
            // through here, so the bottom bar's jump and highlight anchors are covered in one place.
            return (
                <input
                    key={`input-${qId}-${idx}`}
                    type="text"
                    className="rd-blank-input"
                    data-question-id={qId}
                    placeholder={qId.toString()}
                    defaultValue={userAnswersRef.current[qId] || ''}
                    onChange={(e) => { userAnswersRef.current[qId] = e.target.value; }}
                />
            );
        };

        const renderSentenceMode = () => {
            if (st.listeningData?.type !== 'sentence') return null;
            // Shares the .rd-inline-q-block / .rd-blank-* styling with reading's sentence_completion
            const qs = Array.isArray(st.listeningData.questions) ? st.listeningData.questions : [];
            return qs.map(q => {
                // AI drift guard: fall back to bankVal when question is missing or not a string; match gaps with
                // /_{2,}/ (same as reading) instead of assuming exactly five underscores
                const parts = bankVal(q.question).split(/_{2,}/);
                return (
                    <div key={q.id} className="rd-inline-q-block">
                        <span className="rd-blank-num">{q.id}.</span>{' '}
                        {parts.map((p: string, i: number) => (
                            <span key={i}>
                                <span>{removeMarkdown(p)}</span>
                                {i < parts.length - 1 && renderInlineInput(q.id, i)}
                            </span>
                        ))}
                        {/* If the stem has no gap marker at all (the AI forgot), add one input so the question stays answerable */}
                        {parts.length === 1 && renderInlineInput(q.id, 0)}
                    </div>
                );
            });
        };

        const renderArticleMode = () => {
            if (st.listeningData?.type !== 'article') return null;
            const textToSplit = st.listeningData.blanked_passage || st.listeningData.passage || '';
            const paragraphs = textToSplit.split('\n\n');
            const qs = Array.isArray(st.listeningData.questions) ? st.listeningData.questions : [];
            // Gaps map to the questions array in order of appearance (rather than assuming the ids happen to be 1..N);
            // the gap pattern /_{2,}/ tolerates the AI drifting on underscore count
            const qids = qs.map(q => q.id);
            const renderedIds = new Set<number>();
            let blankIdx = 0;
            const body = paragraphs.map((p: string, pIdx: number) => {
                const parts = p.split(/_{2,}/);
                return (
                    <p key={pIdx} style={{ lineHeight: 2.2 }}>
                        {parts.map((partText: string, i: number) => {
                            let input = null;
                            if (i < parts.length - 1) {
                                const qid = qids[blankIdx] ?? blankIdx + 1;
                                renderedIds.add(qid);
                                input = renderInlineInput(qid, i);
                                blankIdx++;
                            }
                            return (
                                <span key={i}>
                                    <span>{removeMarkdown(partText)}</span>
                                    {input}
                                </span>
                            );
                        })}
                    </p>
                );
            });
            // When the text has fewer gaps than questions (the AI under-marked), add standalone inputs for the missing ones
            const missing = qs.filter(q => !renderedIds.has(q.id));
            return (
                <div className="listening-article-inline">
                    <h2 style={{ marginTop: 0 }}>{removeMarkdown(st.listeningData.title)}</h2>
                    {body}
                    {missing.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <p className="section-instructions" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                                {t('components.questionRenderer.answerRemaining')}
                            </p>
                            {missing.map(q => (
                                <div key={q.id} className="rd-blank-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="rd-blank-num">{q.id}.</span>
                                    {renderInlineInput(q.id, 0)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        const renderMultipleChoiceMode = () => {
            if (st.listeningData?.type !== 'multiple_choice') return null;
            // Shares the .question-block / .question-text / .option-label styling with reading MCQ
            const qs = Array.isArray(st.listeningData.questions) ? st.listeningData.questions : [];
            return (
                <div className="listening-mc-mode" key={`tick-${renderTick}`}>
                    {qs.map((q: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                        <div key={q.id} className="question-block" data-question-id={q.id}>
                            <div className="question-text">
                                {q.id}. {removeMarkdown(bankVal(q.question))}
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
                                    <span>{removeMarkdown(bankVal(optText))}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                </div>
            );
        };

        // --- Map question mode -----------------------------------
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
                        <h3 style={{ margin: '0 0 12px 0' }}>{t('listeningDetails.mapInstructions')}</h3>
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
                                    getAnswer={id => getAnswer(Number(id))}
                                    onAnswer={(id, letter) => setAnswerV2(Number(id), letter)}
                                />
                            );
                        })()}
                    </div>
                </div>
            );
        };

        return (
            <div className="reading-container">
                {mockId !== null && (
                    <MockTimerBar
                        mockId={mockId}
                        part="listening"
                        onExpire={() => submitQuiz(true)}
                        onRejected={(msg) => {
                            showToast(t('mock.examMode.startRejected').replace('{msg}', msg), 'error');
                            navigate(`/mock/${mockId}`, { replace: true });
                        }}
                    />
                )}
                <div id="floatUnderlineBtn" ref={floatBtnRef} onMouseDown={(e) => e.preventDefault()} onClick={executeUnderline}>
                    <u>U</u> {t('readingDetails.underline')}
                </div>
                <div className="page listening-page">
                    <div className="toolbar-area">
                        <div className="toolbar-left-group">
                            {!ttsStarted ? (
                                <button className="toolbar-btn toolbar-btn-primary" onClick={startTTS}>
                                    <span className="btn-icon">🔊</span> {t('listeningDetails.startAudio')}
                                </button>
                            ) : (
                                <button
                                    className={`aielts-player-play ${ttsSpeaking ? 'is-playing' : 'is-paused'}`}
                                    onClick={togglePlayPause}
                                    title={ttsSpeaking ? t('listeningDetails.player.pause') : t('listeningDetails.player.play')}
                                    aria-label={ttsSpeaking ? t('listeningDetails.player.pause') : t('listeningDetails.player.play')}
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
                                        title={t('listeningDetails.player.back5')}
                                        aria-label={t('listeningDetails.player.back5')}
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
                                            aria-label={t('listeningDetails.player.progress')}
                                        />
                                    </div>
                                    <button
                                        className="aielts-player-skip"
                                        onClick={() => skipSeconds(5)}
                                        title={t('listeningDetails.player.fwd5')}
                                        aria-label={t('listeningDetails.player.fwd5')}
                                    >⏩</button>
                                    <span className="aielts-player-time">
                                        {formatAudioTime(playbackTime)} / {formatAudioTime(audioDuration)}
                                    </span>
                                    <select
                                        value={playbackRate}
                                        onChange={(e) => handleRateChange(Number(e.target.value))}
                                        className="aielts-player-rate"
                                        title={t('listeningDetails.player.speed')}
                                    >
                                        <option value={0.75}>0.75×</option>
                                        <option value={1}>1×</option>
                                        <option value={1.25}>1.25×</option>
                                        <option value={1.5}>1.5×</option>
                                        <option value={2}>2×</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="toolbar-info-badges">
                            <span className="reading-timer">
                                <span className="timer-icon">⏱️</span>
                                {formatElapsed(st.elapsedSeconds).h !== '00' && (
                                    <span className="timer-digit">{formatElapsed(st.elapsedSeconds).h}<span className="timer-unit">h</span></span>
                                )}
                                <span className="timer-digit">{formatElapsed(st.elapsedSeconds).m}<span className="timer-unit">m</span></span>
                                <span className="timer-digit">{formatElapsed(st.elapsedSeconds).s}<span className="timer-unit">s</span></span>
                            </span>
                            <span className="toolbar-badge mode-badge">
                                {isMapMode ? `🗺️ ${t('listeningDetails.typeMap')}` : isArticleMode ? `📄 ${t('listeningDetails.typeArticle')}` : isMultipleChoiceMode ? `🎯 ${t('listeningDetails.typeMC')}` : `✏️ ${t('listeningDetails.typeSentence')}`}
                            </span>
                            {!isMultipleChoiceMode && !isMapMode && (
                                <span className="toolbar-badge limit-badge">
                                    ✍️ {t('listeningDetails.wordLimit')} {wordCountMax === wordCountMin
                                        ? `${wordCountMax} ${t('listeningDetails.wordUnit')}`
                                        : `${wordCountMin}–${wordCountMax} ${t('listeningDetails.wordUnit')}`}
                                </span>
                            )}
                        </div>
                        <div className="toolbar-right-group">
                            {ttsStarted && (
                                <button
                                    className="toolbar-btn toolbar-btn-outline"
                                    onClick={toggleControlsHidden}
                                    title={controlsHidden ? t('listeningDetails.player.showControls') : t('listeningDetails.player.hideControls')}
                                >
                                    <span className="btn-icon">{controlsHidden ? '👁' : '🙈'}</span>
                                    {controlsHidden ? t('listeningDetails.player.showBtn') : t('listeningDetails.player.hideBtn')}
                                </button>
                            )}
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
                            {/* Section switching moved to the bottom bar (click a collapsed Section label) */}
                            return (
                                <>
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
                                                        <div key={mcq.id} className="question-block" data-question-id={mcq.id}>
                                                            <div className="question-text">{mcq.id}. {bankVal(mcq.question)}</div>
                                                            {mcq.options && Object.entries(mcq.options).map(([k, v]) => (
                                                                <label key={k} className="option-label">
                                                                    <input
                                                                        type="radio"
                                                                        name={`q-${mcq.id}`}
                                                                        value={k}
                                                                        defaultChecked={getAnswer(mcq.id) === k}
                                                                        onChange={() => setAnswerV2(mcq.id, k)}
                                                                    />
                                                                    <strong>{k}.</strong> <span>{bankVal(v)}</span>
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
                                                                        questionIdOffset={(sub.startId ?? mapQs[0]?.id ?? 1) - 1}
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
                                                                <div key={fq.id} className="question-block" data-question-id={fq.id}>
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
                            st.listeningData.type === 'sentence' ? renderSentenceMode() :
                            // Unknown question type (AI drift / legacy bank record): show a clear notice rather than a silent blank
                            <div className="section-instructions">
                                {t('components.questionRenderer.unsupportedType').replace('{t}', String(st.listeningData.type))}
                            </div>)}

                    </div>

                    <PracticeBottomBar
                        questionIds={navQuestionIds}
                        answeredIds={navAnsweredIds}
                        scrollContainerId="listeningContent"
                        onSubmit={() => submitQuiz()}
                        onExit={async () => {
                            // mock mode: exiting scores 0, so go through the guard's confirm + forfeit flow
                            if (mockId) {
                                if (audioRef.current) audioRef.current.pause();
                                await mockConfirmExit();
                                return;
                            }
                            if (await showConfirm(t('listeningDetails.exitConfirm'))) {
                                if (audioRef.current) audioRef.current.pause();
                                onReturnHome();
                            }
                        }}
                        submitLabel={t('readingDetails.submitBtn')}
                        exitLabel={t('listeningDetails.exitBtn')}
                        navLabels={(t('listeningDetails.questionNav', { returnObjects: true }) as { jumpTo: string; progress: string; barLabel: string })}
                        overviewParts={navOverviewParts}
                        onPartSelect={i => {
                            const data = st.listeningData;
                            if (data && data.type === 'full') {
                                const sec = (data.sections || [])[i];
                                if (sec) switchFullSection(sec.sectionNum);
                            }
                        }}
                    />
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
        // A full paper (4 sections, 40 questions) also gets the 9-band conversion; single-section 'full' records are held back by the total threshold
        const band = isFullResults ? rawToBand('listening', score, total) : null;
        // With all 4 sections present, switch by section: the explanations and transcript show only the current
        // section, otherwise 40 questions and 4 scripts laid out flat make it impossible to find a question or tell which section it belongs to.
        const fullSections = isFullResults ? ((st.listeningData as FullListeningData).sections || []) : [];
        const isMultiSection = fullSections.length > 1;
        const activeResultSection = isMultiSection
            ? (fullSections.some(s => s.sectionNum === st.activeSection)
                ? st.activeSection
                : fullSections[0].sectionNum)
            : null;
        const shownSections = activeResultSection == null
            ? fullSections
            : fullSections.filter(s => s.sectionNum === activeResultSection);

        // the questions to show in the current view (after switching sections, only this section's)
        const shownQuestions = activeResultSection == null
            ? allResultQuestions
            : allResultQuestions.filter(q => q.sectionNum === activeResultSection);

        // Bottom bar data: per-question correctness plus the question ids of every section (including the collapsed columns).
        // The verdict must use the same rules as the tick/cross on the answer cards below (including checkAnswer's
        // number-to-word normalisation), otherwise you get the self-contradicting 'red pill, ticked card'.
        // Note the header total goes through scoreListeningQuestions (literal comparison), which is stricter - a known difference, left alone.
        const verdictOf = (q: { id: number; answer?: string; answers?: string[] }): boolean => {
            const userAns = userAnswersRef.current[q.id] || 'None';
            if (q.answer !== undefined && q.answer !== null && q.answers === undefined) {
                return userAns.trim().toUpperCase() === String(q.answer).trim().toUpperCase();
            }
            if (Array.isArray(q.answers) && q.answers.length > 0) {
                return checkAnswer(userAns, q.answers);
            }
            return false;
        };
        const resultMarks = new Map<number, boolean>();
        const correctIds = new Set<number>();
        for (const q of allResultQuestions) {
            const ok = verdictOf(q);
            resultMarks.set(q.id, ok);
            if (ok) correctIds.add(q.id);
        }
        const resultParts = (isMultiSection ? fullSections : []).map(s => ({
            label: t('results.sectionTab').replace('{n}', String(s.sectionNum)),
            questionIds: allResultQuestions.filter(q => q.sectionNum === s.sectionNum).map(q => q.id),
            active: s.sectionNum === activeResultSection,
        }));

        // Concatenate passages for the "show passage" sidebar
        const passageText = isFullResults
            ? shownSections.map(s => `[Section ${s.sectionNum}] ${s.title || ''}\n\n${s.passage || ''}`).join('\n\n---\n\n')
            : ((st.listeningData as LegacyListeningData).passage || '');
        const passageParagraphs = passageText.split('\n\n');
        // Only use the answers of the sections currently shown: otherwise another section's words get mis-highlighted in this script
        const shownAnswerMarks = resolveAnswerSentences(passageText, shownQuestions);

        return (
            <div className="results-container">
                {/* Results Header */}
                <div className="results-header">
                    <div className="results-header-left">
                        <h1>{t('results.analysis')}</h1>
                    </div>
                    <div className="results-header-right">
                        <div className="score-card">
                            <div className="score-number">{score}<span className="score-total">/{total}</span></div>
                            <div className="score-pct">{pct}%</div>
                        </div>
                        {band !== null && (
                            <div className="score-card score-band-card" title={t('results.estimatedBand')}>
                                <div className="score-band-label">{t('results.estimatedBand')}</div>
                                <div className="score-number">{formatBand(band)}<span className="score-total">/9</span></div>
                            </div>
                        )}
                        <div className="results-actions">
                            <button onClick={() => set('isPassageOpen', !st.isPassageOpen)} className={`toolbar-btn ${st.isPassageOpen ? 'active' : 'toolbar-btn-outline'}`}>
                            <span className="btn-icon">{st.isPassageOpen ? '✕' : '📖'}</span> {st.isPassageOpen ? t('results.hidePassage') : t('results.showPassage')}
                        </button>
                        {bankId && !mockId && (
                            // a mock child is locked in once submitted, no redo
                            <button onClick={restartFromBank} className="toolbar-btn toolbar-btn-outline"><span className="btn-icon">🔁</span> {t('aiBank.redoBtn')}</button>
                        )}
                        <button onClick={onReturnHome} className="toolbar-btn"><span className="btn-icon">{mockId ? '🎯' : bankId ? '📚' : '🏠'}</span> {mockId ? t('mock.examMode.backToHub') : bankId ? t('aiBank.backToBank') : t('common.home')}</button>
                        </div>
                    </div>
                </div>

                {/* Results body - answers on the left, transcript on the right */}
                <div className="results-layout" id="listeningResultsLayout">
                    {/* Passage sidebar - earlier in the DOM, moved to the visual right by CSS order */}
                    <div className={`passage-sidebar ${st.isPassageOpen ? 'open' : ''}`} id="listeningPassageSidebar">
                        <h3>{t('results.originalPassage')}</h3>
                        <h4 dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(st.listeningData.title)) }}></h4>
                        <div className="passage-text">
                            {passageParagraphs.map((p, idx) => (
                                <p key={idx} dangerouslySetInnerHTML={{
                                    // Mark answer sentences on plain text first, then apply ** highlighting, then sanitize once
                                    __html: sanitize(formatHighlight(markResolvedSentences(p, shownAnswerMarks))),
                                }}></p>
                            ))}
                        </div>
                        {st.vocabList.length > 0 && (
                            <div className="result-vocab-list" style={{ marginTop: '24px' }}>
                                <h3>📖 {t('results.targetVocab')}</h3>
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
                    <div className="results-content" id="listeningResultsContent">
                        {shownQuestions.map(q => {
                            const userAns = userAnswersRef.current[q.id] || 'None';
                            const hasOptions = Boolean(q.options && Object.keys(q.options).length > 0);
                            const hasTextAnswers = Array.isArray(q.answers) && q.answers.length > 0;
                            // Goes through the same verdictOf as above, so it always agrees with the bottom bar's red/green cells
                            const isCorrect = resultMarks.get(q.id) ?? false;

                            // Legacy MCQ / Map special renderings preserved
                            if ((isMultipleChoiceMode || q.sectionType === 'mixed') && hasOptions) {
                                return (
                                    <div key={q.id} className="result-block" data-question-id={q.id}>
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
                                            {t('results.yourAnswer')}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {t('results.correctAnswer')}: <strong>{q.answer}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t('results.statusCorrect')}` : `✗ ${t('results.statusIncorrect')}`}
                                        </p>
                                        {q.explanation && (
                                            <div className="explanation">
                                                <strong>{t('results.explanation')}:</strong> {q.explanation}
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
                                    <div key={q.id} className="result-block" data-question-id={q.id}>
                                        <div className="question-text">📍 Location {q.id}</div>
                                        <p>
                                            {t('results.yourAnswer')}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userOptText || 'None'}</strong> | {t('results.correctAnswer')}: <strong>{correctOptText}</strong>
                                        </p>
                                        <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                            {isCorrect ? `✓ ${t('results.statusCorrect')}` : `✗ ${t('results.statusIncorrect')}`}
                                        </p>
                                        {q.explanation && (
                                            <div className="explanation">
                                                <strong>{t('results.explanation')}:</strong> {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            // Default renderer: text answers OR letter matching / summary etc.
                            return (
                                <div key={q.id} className="result-block" data-question-id={q.id}>
                                    <div className="question-text">
                                        {q.id}. {(q.question || '').replace(/\*\*/g, '')}
                                        {q.sectionNum !== undefined && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>[Section {q.sectionNum}]</span>}
                                    </div>
                                    <p>
                                        {t('results.yourAnswer')}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {hasTextAnswers ? t('results.acceptableAnswers') : t('results.correctAnswer')}: <strong>{hasTextAnswers ? (q.answers as unknown[]).map(a => (a == null ? '' : String(a))).join(' / ') : (q.answer || '—')}</strong>
                                    </p>
                                    <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                        {isCorrect ? `✓ ${t('results.statusCorrect')}` : `✗ ${t('results.statusIncorrect')}`}
                                    </p>
                                    {q.explanation && (
                                        <div className="explanation">
                                            <strong>{t('results.explanation')}:</strong> {q.explanation}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom bar - the same component as the answering page, only the cells and pills switch to correct/incorrect colours.
                    Placed **after** results-layout: .results-container is a 100vh flex column and the layout takes flex:1,
                    so this pins to the bottom of the viewport no matter how long the explanations scroll. */}
                <PracticeBottomBar
                    questionIds={shownQuestions.map(q => q.id)}
                    answeredIds={correctIds}
                    resultMarks={resultMarks}
                    scrollContainerId="listeningResultsContent"
                    navLabels={{
                        ...(t('listeningDetails.questionNav', { returnObjects: true }) as PracticeNavLabels),
                        progress: t('results.partScore'),
                    }}
                    overviewParts={isMultiSection ? resultParts : undefined}
                    onPartSelect={i => {
                        const s = fullSections[i];
                        if (s) set('activeSection', s.sectionNum);
                    }}
                />
            </div>
        );
    }

    return null;
}

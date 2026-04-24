import Layout from '../../components/layout/Layout';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitReview, type VocabCard } from '../../api/vocab';
import {
    listVocabBooks,
    listBookWords,
    getTodayLearningTime,
    syncTodayLearningTime,
    updatePlanWord,
} from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../components/common/Toast';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard.css';

/* ── Types ───────────────────────────────────────────────────────────────── */

type Step = 'doing' | 'result';
type StudyMode = 'flashcard' | 'choice' | 'write' | 'copy';
type MasterySetting = 'auto' | number;

interface CopyPendingAction {
    cardIndex: number;
    remainingAfterSubmit: number;
    completed: boolean;
    dueAt: string;
    scheduledDays: number;
}

interface ReviewResult {
    word:          string;
    zh:            string;
    rating:        number;
    newDue:        string;
    scheduledDays: number;
}

/* ── 工具函数 ─────────────────────────────────────────────────────────────── */

/* ── 组件 ─────────────────────────────────────────────────────────────────── */

function speak(word: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
}

/* ── 组件 ─────────────────────────────────────────────────────────────────── */

const SESSION_KEY = 'vocab_flashcard_session';
const SESSION_KEY_PREFIX = 'vocab_flashcard_session_plan_';
const SESSION_KEY_USER_PREFIX = `${SESSION_KEY}_user_`;
const LIUHONGBO_BOOK_KEYWORDS = ['刘洪波', '雅思真经', 'liuhongbo', 'zhenjing'];
const LEARNING_TIMER_PENDING_KEY = 'vocab_learning_timer_pending_seconds';

function normalizeSessionScope(value?: string | null): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSessionKeyByPlanId(planId?: number | null, userScope?: string | null): string {
    const normalizedUser = normalizeSessionScope(userScope);
    if (typeof planId === 'number' && planId > 0) {
        const base = `${SESSION_KEY_PREFIX}${planId}`;
        return normalizedUser ? `${base}_user_${normalizedUser}` : base;
    }
    if (normalizedUser) {
        return `${SESSION_KEY_USER_PREFIX}${normalizedUser}`;
    }
    return SESSION_KEY;
}

function getSessionKeyCandidates(planId?: number | null, userScope?: string | null): string[] {
    const keys: string[] = [getSessionKeyByPlanId(planId, userScope)];
    if (typeof planId === 'number' && planId > 0) {
        keys.push(`${SESSION_KEY_PREFIX}${planId}`);
        keys.push(SESSION_KEY);
    } else {
        keys.push(SESSION_KEY);
    }
    return Array.from(new Set(keys));
}

function clampCopyRepetitions(value: number): number {
    return Math.min(20, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 3));
}

function clampCopyReviewDays(value: number): number {
    return Math.min(365, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 2));
}

function readPendingLearningSeconds(): number {
    try {
        const raw = localStorage.getItem(LEARNING_TIMER_PENDING_KEY);
        if (!raw) return 0;
        const parsed = parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
        return 0;
    }
}

function writePendingLearningSeconds(seconds: number): void {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    if (safeSeconds <= 0) return;
    const current = readPendingLearningSeconds();
    localStorage.setItem(LEARNING_TIMER_PENDING_KEY, String(current + safeSeconds));
}

function clearPendingLearningSeconds(): void {
    localStorage.removeItem(LEARNING_TIMER_PENDING_KEY);
}

function shuffleArray<T>(arr: T[]): T[] {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}

function pickUniqueZh(
    source: string[],
    exclude: Set<string>,
    count: number,
): string[] {
    if (count <= 0) return [];
    const pool = Array.from(
        new Set(
            source
                .map((item) => item.trim())
                .filter((item) => !!item && !exclude.has(item)),
        ),
    );
    return shuffleArray(pool).slice(0, count);
}

export default function VocabularyFlashcardDoingPage() {
    const { translations: t } = useLang();
    const { user } = useAuth();
    const location = useLocation();
    const navigate  = useNavigate();
    const userSessionScope = user?.id ?? null;
    
    const RATING_INFO = useMemo(() => [
        { id: 1, label: t.vocab.ratings.again, cls: 'btn-again', key: '1' },
        { id: 2, label: t.vocab.ratings.hard,  cls: 'btn-hard',  key: '2' },
        { id: 3, label: t.vocab.ratings.good,  cls: 'btn-good',  key: '3' },
        { id: 4, label: t.vocab.ratings.easy,  cls: 'btn-easy',  key: '4' },
    ], [t]);

    const STATE_LABELS: Record<number, string> = useMemo(() => ({
        0: t.vocab.status.new, 
        1: t.vocab.status.learning, 
        2: t.vocab.status.review, 
        3: t.vocab.status.relearn,
    }), [t]);

    const MODE_LABELS: Record<StudyMode, string> = useMemo(() => ({
        flashcard: t.vocab.modes.flashcard,
        choice:    t.vocab.modes.choice,
        write:     t.vocab.modes.write,
        copy:      t.vocab.modes.copy,
    }), [t]);

    const RS_CLASSES = ['rs-again', 'rs-hard', 'rs-good', 'rs-easy'];
    const RS_LABELS  = useMemo(() => [
        t.vocab.ratings.again, 
        t.vocab.ratings.hard, 
        t.vocab.ratings.good, 
        t.vocab.ratings.easy
    ], [t]);

    const estimateInterval = useCallback((card: VocabCard, rating: number): string => {
        const { state, stability: s } = card;
        if (state === 0 || state === 1 || state === 3) {
            if (rating <= 3) return t.vocab.intervals.tomorrow;
            return `${t.vocab.intervals.approx}${Math.max(1, Math.round(s || 4))}${t.vocab.intervals.daysUnit}`;
        }
        // Review 阶段
        if (rating === 1) return t.vocab.intervals.minsAfter.replace('{n}', '5');  // Again → Relearning
        const factor = rating === 2 ? 0.6 : rating === 3 ? 1.0 : 1.5;
        const days = Math.max(1, Math.round((s || 1) * factor));
        return days === 1 ? `1${t.vocab.intervals.daysUnit}` : `${t.vocab.intervals.approx}${days}${t.vocab.intervals.daysUnit}`;
    }, [t]);

    const formatDue = useCallback((isoStr: string): string => {
        if (!isoStr) return t.vocab.intervals.toSync;
        const diff = new Date(isoStr).getTime() - Date.now();
        const mins = Math.round(diff / 60000);
        if (mins <= 0) return t.vocab.intervals.today;
        if (mins < 60) return t.vocab.intervals.minsAfter.replace('{n}', mins.toString());
        const days = Math.round(diff / 86400000);
        if (days < 2) return t.vocab.intervals.tomorrow;
        return t.vocab.intervals.daysAfter.replace('{n}', days.toString());
    }, [t]);

    const nextMastery = useCallback((current: number, correct: boolean, target: number): number => {
        if (!correct) return 0;
        return Math.min(target, current + 1);
    }, []);

    const formatLearningDuration = useCallback((totalSeconds: number): string => {
        const safe = Math.max(0, totalSeconds);
        const h = Math.floor(safe / 3600).toString().padStart(2, '0');
        const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
        const s = (safe % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }, []);

    const [cards,          setCards]          = useState<VocabCard[]>([]);
    /** queue[0] 是当前卡片索引；毕业 = 弹出队头；未毕业 = 按重排规则重入 */
    const [queue,          setQueue]          = useState<number[]>([]);
    const [sessionMastery, setSessionMastery] = useState<number[]>([]); // 4选1/写英文：当前连续正确次数
    /** 本次会话中是否曾经不会：若曾忘，毕业时强制提交 rating=1（复习间隔 1 天） */
    const [sessionForgot,  setSessionForgot]  = useState<boolean[]>([]);
    const [graduatedCount, setGraduatedCount] = useState(0);
    /** 每次换卡时递增，驱动各卡片级别的 useEffect 重置 */
    const [visitKey,       setVisitKey]       = useState(0);

    const [isFlipped,    setIsFlipped]    = useState(false);
    const [isFlipping,   setIsFlipping]   = useState(false);
    const [step,         setStep]         = useState<Step>('doing');
    const [results,      setResults]      = useState<ReviewResult[]>([]);
    const [submitting,   setSubmitting]   = useState(false);
    const [initialized,  setInitialized]  = useState(false);
    const [lastRating,   setLastRating]   = useState<number | null>(null);
    const [planId,       setPlanId]       = useState<number | null>(null);
    const [planName,     setPlanName]     = useState('');
    const [mode,         setMode]         = useState<StudyMode>('flashcard');
    const [masteryTarget, setMasteryTarget] = useState<MasterySetting>(2);
    const [copyRepetitions, setCopyRepetitions] = useState(3);
    const [copyReviewDays, setCopyReviewDays] = useState(2);
    const [copyRemaining, setCopyRemaining] = useState<number[]>([]);
    const [copyInput, setCopyInput] = useState('');
    const [copySubmitted, setCopySubmitted] = useState(false);
    const [copyPendingAction, setCopyPendingAction] = useState<CopyPendingAction | null>(null);
    const [leaving,      setLeaving]      = useState(false);
    const [reviewOnly,   setReviewOnly]   = useState(false); // 复习模式：不提交 FSRS

    // 4选1
    const [choices,        setChoices]        = useState<Array<{ zh: string; correct: boolean }>>([]);
    const [choiceSelected, setChoiceSelected] = useState<number | null>(null);
    const [choiceCorrect,  setChoiceCorrect]  = useState<boolean | null>(null);
    const [choiceRevealed, setChoiceRevealed] = useState(false); // 是否已展开题目
    const [liuhongboZhPool, setLiuhongboZhPool] = useState<string[]>([]);
    const [liuhongboLoaded, setLiuhongboLoaded] = useState(false);

    // 看中文写英文
    const [writeInput,       setWriteInput]       = useState('');
    const [writeSubmitted,   setWriteSubmitted]   = useState(false);
    const [writeCorrect,     setWriteCorrect]     = useState<boolean | null>(null);
    const [unknownMode,      setUnknownMode]      = useState(false);    // 点击"不会"：展示单词让用户抄写
    const [quickProficient,  setQuickProficient]  = useState(false);   // 点击"熟练"：直接毕业

    // 追踪每个卡片的错误次数
    const [sessionErrorCount, setSessionErrorCount] = useState<number[]>([]);
    
    // 今日已学基数（进入本轮前已完成的数量）和每日配额，用于显示累计进度
    const [studiedTodayBase, setStudiedTodayBase] = useState(0);
    const [planDailyCount, setPlanDailyCount] = useState(0);

    // 用户今日学习时长（跨计划共享）：页面内每秒累计，离开页面时一次性同步
    const [todayLearningBaseSeconds, setTodayLearningBaseSeconds] = useState(0);
    const [sessionLearningSeconds, setSessionLearningSeconds] = useState(0);
    
    const learningTimerStartRef = useRef<number>(Date.now());
    const sessionLearningSecondsRef = useRef(0);
    const learningTimerSyncedRef = useRef(false);
    const learningTimerSyncedSecondsRef = useRef(0);
    
    /**
     * 根据错误次数动态调整重新插入的位置：
     * - 第1次错：放到后10个位置
     * - 第2次错：放到后20个位置
     * - 第3次错：放到后30个位置
     * - 依此类推，直到队尾
     */
    const reinsertAfterGap = useCallback((rest: number[], cardIndex: number) => {
        const errorCount = sessionErrorCount[cardIndex] ?? 0;
        const gap = Math.min((errorCount + 1) * 10, rest.length); // 1错10个, 2错20个, ...
        const insertPos = Math.min(gap, rest.length);
        return [...rest.slice(0, insertPos), cardIndex, ...rest.slice(insertPos)];
    }, [sessionErrorCount]);

    const getLiveSessionLearningSeconds = useCallback((): number => {
        const wallClockSeconds = Math.max(0, Math.floor((Date.now() - learningTimerStartRef.current) / 1000));
        return Math.max(sessionLearningSecondsRef.current, wallClockSeconds);
    }, []);

    const syncLearningTimerOnExit = useCallback(async (useKeepalive: boolean) => {
        if (learningTimerSyncedRef.current) return;

        const pendingCurrentSessionSeconds = Math.max(
            0,
            getLiveSessionLearningSeconds() - learningTimerSyncedSecondsRef.current,
        );
        if (pendingCurrentSessionSeconds <= 0) {
            learningTimerSyncedRef.current = true;
            return;
        }

        if (useKeepalive) {
            // Refresh/close 时不做易失败的实时网络请求，先落本地，页面重进后补偿同步。
            writePendingLearningSeconds(pendingCurrentSessionSeconds);
            learningTimerSyncedRef.current = true;
            learningTimerSyncedSecondsRef.current += pendingCurrentSessionSeconds;
            return;
        }

        const bufferedPendingSeconds = readPendingLearningSeconds();
        const totalToSync = pendingCurrentSessionSeconds + bufferedPendingSeconds;
        const data = await syncTodayLearningTime(totalToSync);
        clearPendingLearningSeconds();
        learningTimerSyncedRef.current = true;
        learningTimerSyncedSecondsRef.current += pendingCurrentSessionSeconds;
        setTodayLearningBaseSeconds(Math.max(0, Number(data.total_seconds) || 0));
    }, [getLiveSessionLearningSeconds]);

    /* 初始化 */
    useEffect(() => {
        const state = location.state as {
            cards?: VocabCard[];
            stats?: { studied_today?: number; remaining_today?: number };
            planId?: number;
            planName?: string;
            planDailyCount?: number;
            mode?: StudyMode;
            masteryTarget?: MasterySetting;
            copyRepetitions?: number;
            copyReviewDays?: number;
            reviewOnly?: boolean;
            forceNewSession?: boolean;
        } | null;

        const incomingPlanId = state?.planId ?? null;
        const incomingSessionKeyCandidates = getSessionKeyCandidates(incomingPlanId, userSessionScope);

        // 安全优先：每次进入学习页都清理本地会话缓存，避免通过本地缓存篡改熟练进度。
        incomingSessionKeyCandidates.forEach((key) => sessionStorage.removeItem(key));
        console.log('[词汇学习] 开始学习时已清理本地会话缓存，刷新/中断不保留单词进度', {
            planId: incomingPlanId,
        });

        const fallbackCopyRepetitions = clampCopyRepetitions(
            Number(
                state?.copyRepetitions
                ?? (incomingPlanId ? localStorage.getItem(`lp_copy_repetitions_${incomingPlanId}`) : null)
                ?? '3',
            ),
        );
        const fallbackCopyReviewDays = clampCopyReviewDays(
            Number(
                state?.copyReviewDays
                ?? (incomingPlanId ? localStorage.getItem(`lp_copy_review_days_${incomingPlanId}`) : null)
                ?? '2',
            ),
        );

        // 只允许从入口状态初始化，拒绝从本地会话恢复。
        if (!state?.cards?.length) {
            const fallback = state?.planId ? `/vocabulary/plans/${state.planId}` : '/vocabulary/plans';
            navigate(fallback, { replace: true });
            return;
        }
        const n = state.cards.length;
        setCards(state.cards);
        setQueue(Array.from({ length: n }, (_, i) => i));
        setSessionMastery(new Array(n).fill(0));
        setSessionForgot(new Array(n).fill(false));
        setSessionErrorCount(new Array(n).fill(0));  // 🔧 修复：初始化错误计数数组
        setCopyRepetitions(fallbackCopyRepetitions);
        setCopyReviewDays(fallbackCopyReviewDays);
        setCopyRemaining(new Array(n).fill(fallbackCopyRepetitions));
        setCopyInput('');
        setCopySubmitted(false);
        setCopyPendingAction(null);
        setGraduatedCount(0);
        if (state.planId)   setPlanId(state.planId);
        if (state.planName) setPlanName(state.planName);
        
        // 🔧 Mode初始化：从location.state → localStorage fallback → 默认'flashcard'
        let resolvedMode: StudyMode = 'flashcard';
        if (state.mode) {
            resolvedMode = state.mode;
            console.log('[词汇学习] Mode从location.state恢复', { mode: state.mode });
        } else if (state.planId) {
            // 尝试从localStorage恢复该计划的持久化mode设置
            const cachedMode = localStorage.getItem(`lp_study_mode_${state.planId}`) as StudyMode | null;
            if (cachedMode && ['flashcard', 'choice', 'write', 'copy'].includes(cachedMode)) {
                resolvedMode = cachedMode;
                console.log('[词汇学习] Mode从localStorage恢复', { mode: cachedMode, planId: state.planId });
            } else {
                console.log('[词汇学习] Mode使用默认值flashcard');
            }
        }
        setMode(resolvedMode);
        
        if (typeof state.masteryTarget === 'number') {
            setMasteryTarget(Math.min(5, Math.max(1, state.masteryTarget)));
        } else if (state.masteryTarget === 'auto') {
            setMasteryTarget('auto');
        }
        setPlanDailyCount(state.planDailyCount || 0);
        setStudiedTodayBase(state.stats?.studied_today ?? 0);
        if (state.reviewOnly) setReviewOnly(true);
        setVisitKey(1);
        setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        learningTimerStartRef.current = Date.now();
        sessionLearningSecondsRef.current = 0;
        learningTimerSyncedRef.current = false;
        learningTimerSyncedSecondsRef.current = 0;
        setSessionLearningSeconds(0);

        const loadTodayTotal = async () => {
            const pendingBufferedSeconds = readPendingLearningSeconds();
            if (pendingBufferedSeconds > 0) {
                try {
                    const flushed = await syncTodayLearningTime(pendingBufferedSeconds);
                    if (!cancelled) {
                        clearPendingLearningSeconds();
                        setTodayLearningBaseSeconds(Math.max(0, Number(flushed.total_seconds) || 0));
                    }
                    return;
                } catch (error) {
                    console.warn('[词汇学习] 补偿同步离页学习时长失败，稍后重试', error);
                }
            }

            try {
                const data = await getTodayLearningTime();
                if (!cancelled) {
                    setTodayLearningBaseSeconds(Math.max(0, Number(data.total_seconds) || 0));
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn('[词汇学习] 获取今日学习时长失败，按 0 秒处理', error);
                    setTodayLearningBaseSeconds(0);
                }
            }
        };
        void loadTodayTotal();

        const tickId = window.setInterval(() => {
            const elapsedSeconds = Math.max(
                0,
                Math.floor((Date.now() - learningTimerStartRef.current) / 1000),
            );
            sessionLearningSecondsRef.current = elapsedSeconds;
            setSessionLearningSeconds(elapsedSeconds);
        }, 1000);

        return () => {
            cancelled = true;
            window.clearInterval(tickId);
        };
    }, []);

    useEffect(() => {
        return () => {
            void syncLearningTimerOnExit(true);
        };
        // syncLearningTimerOnExit intentionally reads refs for latest values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Mode同步到localStorage（作为长期持久化备份） */
    useEffect(() => {
        if (!initialized || !planId) return;
        if (mode && ['flashcard', 'choice', 'write', 'copy'].includes(mode)) {
            localStorage.setItem(`lp_study_mode_${planId}`, mode);
            console.log('[词汇学习] Mode已同步到localStorage', { planId, mode });
        }
    }, [mode, planId, initialized]);

    /* 每次换卡 (visitKey 变化) 重置卡片状态 */
    useEffect(() => {
        if (!initialized) return;
        setIsFlipped(false);
        setLastRating(null);
        setChoiceSelected(null);
        setChoiceCorrect(null);
        setChoiceRevealed(false);
        setWriteInput('');
        setWriteSubmitted(false);
        setWriteCorrect(null);
        setUnknownMode(false);
        setQuickProficient(false);
        setCopyInput('');
        setCopySubmitted(false);
        setCopyPendingAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey]);

    /* 每张新卡自动播放一次单词读音（所有模式）
     * setTimeout 解决 Chrome cancel/speak 竞争：cancel() 后立即 speak() 会被吞掉 */
    useEffect(() => {
        if (!initialized || queue.length === 0) return;
        const word = cards[queue[0]]?.word;
        if (!word) return;
        const timer = setTimeout(() => speak(word), 150);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey]);

    /* 4选1 — 当前卡片变化时重新生成选项 */
    useEffect(() => {
        if (mode !== 'choice' || !cards.length || queue.length === 0) return;
        const ci      = queue[0];
        const current = cards[ci];
        if (!current) return;

        const currentZh = (current.zh ?? '').trim();
        const excludedZh = new Set<string>();
        if (currentZh) excludedZh.add(currentZh);

        const localZhPool = cards
            .filter((_, i) => i !== ci && !!_.zh)
            .map((card) => card.zh.trim());

        const wrongFromLocal = pickUniqueZh(localZhPool, excludedZh, 3);
        wrongFromLocal.forEach((zh) => excludedZh.add(zh));

        const wrongFromLiuhongbo = pickUniqueZh(
            liuhongboZhPool,
            excludedZh,
            Math.max(0, 3 - wrongFromLocal.length),
        );
        wrongFromLiuhongbo.forEach((zh) => excludedZh.add(zh));

        const wrong3 = [...wrongFromLocal, ...wrongFromLiuhongbo];

        const opts = shuffleArray([
            { zh: currentZh || current.zh, correct: true },
            ...wrong3.map((zh) => ({ zh, correct: false })),
        ]);

        setChoices(opts);
    // visitKey 驱动重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey, mode, cards, queue, liuhongboZhPool]);

    /* 4选1补充干扰项：优先从“刘洪波雅思真经”加载中文释义池 */
    useEffect(() => {
        if (mode !== 'choice' || liuhongboLoaded) return;

        let cancelled = false;

        const loadLiuhongboPool = async () => {
            try {
                const { books } = await listVocabBooks();
                const targetBook = books.find((book) => {
                    const normalized = `${book.name} ${book.description}`.toLowerCase();
                    return LIUHONGBO_BOOK_KEYWORDS.some((keyword) =>
                        normalized.includes(keyword.toLowerCase()),
                    );
                });

                if (!targetBook) {
                    return;
                }

                const { words } = await listBookWords(targetBook.id, 1, 5000);
                const pool = Array.from(
                    new Set(
                        words
                            .map((item) => (item.zh_brief ?? '').trim())
                            .filter((item) => !!item),
                    ),
                );

                if (!cancelled) {
                    setLiuhongboZhPool(pool);
                }
            } catch (error) {
                console.warn('[词汇学习] 加载刘洪波词书干扰项失败，继续使用本地选项池', error);
            } finally {
                if (!cancelled) {
                    setLiuhongboLoaded(true);
                }
            }
        };

        loadLiuhongboPool();

        return () => {
            cancelled = true;
        };
    }, [mode, liuhongboLoaded]);

    const submitReviewWithRetry = useCallback(async (
        word: string,
        rating: number,
        lastReview: string | null,
        cardPlanId: number | undefined,
    ) => {
        try {
            return await submitReview(word, rating, lastReview, cardPlanId);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { server_last_review?: string | null } } };
            if (axiosErr?.response?.status === 409) {
                const freshLR = axiosErr.response.data?.server_last_review ?? null;
                return await submitReview(word, rating, freshLR, cardPlanId);
            }
            throw err;
        }
    }, []);

    /* 队列清空 → 直接进入结果页（评分已实时同步） */
    useEffect(() => {
        if (!initialized || step !== 'doing' || queue.length !== 0 || graduatedCount === 0) return;
        setStep('result');
    }, [queue, initialized, step, graduatedCount]);

    const currentCardIdx = queue[0] ?? -1;
    const currentCard    = currentCardIdx >= 0 ? cards[currentCardIdx] : null;

    /* ── 核心：每次作答实时提交，再推进队列 ── */
    const submitAndAdvance = useCallback(async (
        ci:            number,
        card:          VocabCard,
        fsrsRating:    number,   // 本次实际提交给 FSRS 的评分
        newMastery:    number,   // 本次更新后的本地熟练度
        graduate:      boolean,
        forgotNow:     boolean,  // 本次操作是否属于"忘了"
    ) => {
        if (forgotNow) {
            setSessionForgot(prev => { const a = [...prev]; a[ci] = true; return a; });
            // 增加错误计数（只在拼错或答错时增加）
            setSessionErrorCount(prev => { const a = [...prev]; a[ci] = (a[ci] ?? 0) + 1; return a; });
        }

        let updatedCard: VocabCard = card;

        // 复习模式：跳过 FSRS 提交，纯浏览不影响间隔调度
        if (!reviewOnly) {
            try {
                const { card: nextCard } = await submitReviewWithRetry(
                    card.word,
                    fsrsRating,
                    card.last_review,
                    card.plan_id,
                );
                updatedCard = nextCard;
                setCards(prev => {
                    const next = [...prev];
                    next[ci] = nextCard;
                    return next;
                });
            } catch {
                showToast(t.vocab.toastSyncFail || '评分同步失败，请检查网络后重试', 'error');
                setSubmitting(false);
                return;
            }
        }

        if (graduate) {
            setResults(prev => [...prev, {
                word:          updatedCard.word,
                zh:            updatedCard.zh,
                rating:        fsrsRating,
                newDue:        updatedCard.due,
                scheduledDays: updatedCard.scheduled_days,
            }]);
            setGraduatedCount(g => g + 1);
        }

        setSessionMastery(prev => { const a = [...prev]; a[ci] = newMastery; return a; });
        setQueue(prev => {
            const rest = prev.slice(1);
            if (graduate) {
                // 毕业时重置错误计数
                setSessionErrorCount(p => { const a = [...p]; a[ci] = 0; return a; });
                return rest;
            }
            return reinsertAfterGap(rest, ci);
        });

        setVisitKey(k => k + 1);
        setSubmitting(false);
    }, [submitReviewWithRetry, reinsertAfterGap, reviewOnly]);

    /**
     * 记忆卡手动评分
     * - rating>=3（一般/容易）：毕业
     * - rating 1/2（忘了/困难）：重入队列
     */
    const handleFlashcardRating = useCallback(async (rating: number) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        setLastRating(rating);
        const ci            = currentCardIdx;
        const isCorrect     = rating >= 3;
        const forgotNow     = !isCorrect;
        const newMastery    = isCorrect ? 4 : 1;
        const graduate      = isCorrect;
        await submitAndAdvance(ci, currentCard, rating, newMastery, graduate, forgotNow);
    }, [submitting, currentCard, currentCardIdx, submitAndAdvance]);

    const resolveAutoMasteryTarget = useCallback((cardIndex: number, currentMode: StudyMode): number => {
        if (currentMode === 'choice') {
            // 4选1规则：首次答对一次通过；只要曾答错，后续必须连续答对2次。
            const hasWrongHistory = (sessionErrorCount[cardIndex] ?? 0) > 0 || Boolean(sessionForgot[cardIndex]);
            return hasWrongHistory ? 2 : 1;
        }
        if (masteryTarget === 'auto') {
            return 2;
        }
        return masteryTarget;
    }, [masteryTarget, sessionErrorCount, sessionForgot]);

    /* 4选1 / 写单词：自动评分并按对应模式的目标次数毕业 */
    const handleAutoRating = useCallback(async (isCorrect: boolean) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        const ci            = currentCardIdx;
        const curMastery    = sessionMastery[ci] ?? 0; // 当前连续正确次数
        const forgotNow     = !isCorrect;

        let newMastery: number;
        let graduate: boolean;
        const target = resolveAutoMasteryTarget(ci, mode);

        newMastery = nextMastery(curMastery, isCorrect, target);
        graduate = newMastery >= target;

        // 新评分策略：真实反映用户记忆状态
        // 答对未毕业→Good(3)  答错未毕业→Again(1)
        // 答对毕业→Easy(4)    答错毕业→Hard(2)
        const fsrsRating = graduate
            ? (isCorrect ? 4 : 2)
            : (isCorrect ? 3 : 1);
        const uiRating = isCorrect ? 3 : 1;

        setLastRating(uiRating);
        await submitAndAdvance(ci, currentCard, fsrsRating, newMastery, graduate, forgotNow);
    }, [submitting, currentCard, currentCardIdx, sessionMastery, mode, resolveAutoMasteryTarget, submitAndAdvance]);

    const buildAutoOutcome = useCallback((
        isCorrect: boolean,
        curMastery: number,
        cardIndex: number,
        currentMode: StudyMode,
    ) => {
        const forgotNow = !isCorrect;
        const target = resolveAutoMasteryTarget(cardIndex, currentMode);
        const newMastery = nextMastery(curMastery, isCorrect, target);
        const graduate = newMastery >= target;
        // 毕业且答对时：rating=4（Easy）让 FSRS 立即推到复习阶段（几天后）
        const fsrsRating = graduate
            ? (isCorrect ? 4 : 2)
            : (isCorrect ? 3 : 1);
        return { fsrsRating, newMastery, graduate, forgotNow };
    }, [resolveAutoMasteryTarget]);

    const syncCurrentAnsweredBeforeExit = useCallback(async () => {
        if (!currentCard || currentCardIdx < 0) return;

        let outcome: { fsrsRating: number; newMastery: number; graduate: boolean; forgotNow: boolean } | null = null;

        if (mode === 'choice' && choiceSelected !== null && choiceCorrect !== null) {
            const curMastery = sessionMastery[currentCardIdx] ?? 0;
            outcome = buildAutoOutcome(choiceCorrect, curMastery, currentCardIdx, 'choice');
        } else if (mode === 'write' && writeSubmitted && writeCorrect !== null) {
            if (quickProficient) {
                outcome = { fsrsRating: 4, newMastery: 4, graduate: true, forgotNow: false };
            } else {
                const curMastery = sessionMastery[currentCardIdx] ?? 0;
                outcome = buildAutoOutcome(writeCorrect, curMastery, currentCardIdx, 'write');
            }
        }

        if (!outcome) return;

        const { card: nextCard } = await submitReviewWithRetry(
            currentCard.word,
            outcome.fsrsRating,
            currentCard.last_review,
            currentCard.plan_id,
        );

        console.log('[词汇学习] 退出前已补交当前作答到后端', {
            word: currentCard.word,
            fsrsRating: outcome.fsrsRating,
            syncedDue: nextCard.due,
        });
    }, [
        currentCard,
        currentCardIdx,
        mode,
        choiceSelected,
        choiceCorrect,
        writeSubmitted,
        writeCorrect,
        quickProficient,
        sessionMastery,
        buildAutoOutcome,
        submitReviewWithRetry,
    ]);

    /* 4选1 前置：点击"会"展开题目 */
    const handleChoiceKnow = useCallback(() => {
        if (submitting || choiceSelected !== null) return;
        setChoiceRevealed(true);
    }, [submitting, choiceSelected]);

    /* 4选1 点击（仅记录选择，不自动进入下一题） */
    const handleChoice = useCallback((
        opt: { zh: string; correct: boolean },
        idx: number,
    ) => {
        if (choiceSelected !== null || submitting) return;
        setChoiceSelected(idx);
        setChoiceCorrect(opt.correct);
        setLastRating(opt.correct ? 3 : 1);
    }, [choiceSelected, submitting]);

    /* 4选1 点击"不会" */
    const handleChoiceUnknown = useCallback(() => {
        if (choiceSelected !== null || submitting) return;
        // 标记为答错
        setChoiceSelected(-1);
        setChoiceCorrect(false);
        setChoiceRevealed(true);  // 展开题目让用户看到所有选项，然后可以点下一个
        setLastRating(1);
    }, [choiceSelected, submitting]);

    /* 4选1 隐藏题目回到初始选择状态 */
    const handleChoiceHideQuestion = useCallback(() => {
        if (submitting) return;
        setChoiceRevealed(false);
        setChoiceSelected(null);
        setChoiceCorrect(null);
    }, [submitting]);

    const handleChoiceNext = useCallback(async () => {
        if (choiceSelected === null || choiceCorrect === null || submitting) return;
        await handleAutoRating(choiceCorrect);
    }, [choiceSelected, choiceCorrect, submitting, handleAutoRating]);

    /* 写英文提交 */
    const handleWriteSubmit = useCallback(() => {
        if (writeSubmitted || submitting || !writeInput.trim() || !currentCard) return;
        const input  = writeInput.trim().toLowerCase();
        const target = currentCard.word.toLowerCase();
        if (unknownMode) {
            // 抄写模式：必须完全正确才能进入"下一个"；错了清空重试
            if (input !== target) {
                setWriteInput('');
                return;
            }
            // 抄对了：标记为"不会"（mastery=wrong），解锁"下一个"
            setWriteCorrect(false);
            setWriteSubmitted(true);
        } else {
            setWriteCorrect(input === target);
            setWriteSubmitted(true);
        }
    }, [writeSubmitted, submitting, writeInput, currentCard, unknownMode]);

    const handleWriteNext = useCallback(async () => {
        if (!writeSubmitted || submitting || writeCorrect === null) return;
        if (quickProficient) {
            // 熟练自评：直接毕业，不走 mastery 进阶
            const ci  = currentCardIdx;
            const card = currentCard;
            if (ci < 0 || !card) return;
            setSubmitting(true);
            await submitAndAdvance(ci, card, 4, 4, true, false);
        } else {
            await handleAutoRating(writeCorrect);
        }
    }, [writeSubmitted, submitting, writeCorrect, quickProficient,
        currentCardIdx, currentCard, submitAndAdvance, handleAutoRating]);

    /* 快速自评 */
    const handleQuickAssess = useCallback((correct: boolean) => {
        if (writeSubmitted || submitting) return;
        if (!correct) {
            // 不会：展示单词，进入抄写流程
            setUnknownMode(true);
        } else {
            // 熟练：标记直接毕业，解锁"下一个"
            setQuickProficient(true);
            setWriteCorrect(true);
            setWriteSubmitted(true);
        }
    }, [writeSubmitted, submitting]);

    /* 撤销：回到初始写题状态（不会/熟练选择页） */
    const handleWriteUndo = useCallback(() => {
        setWriteInput('');
        setWriteSubmitted(false);
        setWriteCorrect(null);
        setUnknownMode(false);
        setQuickProficient(false);
    }, []);

    const buildDueAtFromDays = useCallback((days: number): string => {
        const base = new Date();
        if (days <= 0) return base.toISOString();
        base.setDate(base.getDate() + days);
        return base.toISOString();
    }, []);

    const handleCopySubmit = useCallback(async () => {
        if (submitting || !currentCard || currentCardIdx < 0 || copySubmitted) return;

        const normalizedInput = copyInput.trim().toLowerCase();
        const normalizedAnswer = currentCard.word.trim().toLowerCase();
        if (!normalizedInput) {
            showToast('请先输入抄写内容', 'error');
            return;
        }
        if (normalizedInput !== normalizedAnswer) {
            showToast('抄写不正确，需与单词完全一致后才能提交', 'error');
            return;
        }

        const currentRemaining = Math.max(0, copyRemaining[currentCardIdx] ?? copyRepetitions);
        if (currentRemaining <= 0) {
            return;
        }

        const remainingAfterSubmit = Math.max(0, currentRemaining - 1);
        let dueAt = currentCard.due;
        let scheduledDays = currentCard.scheduled_days ?? 0;

        if (remainingAfterSubmit === 0) {
            if (!planId || !currentCard.entry_id) {
                showToast('缺少计划词条信息，无法写回应复习时间', 'error');
                return;
            }

            setSubmitting(true);
            try {
                const expectedScheduledDays = Math.max(0, Number(currentCard.scheduled_days ?? 0)) + copyReviewDays;
                const { entry } = await updatePlanWord(planId, currentCard.entry_id, {
                    increment_review_days: copyReviewDays,
                    mark_reviewed: true,
                });
                dueAt = entry.fsrs_due ?? buildDueAtFromDays(expectedScheduledDays);
                scheduledDays = typeof entry.fsrs_scheduled_days === 'number'
                    ? entry.fsrs_scheduled_days
                    : expectedScheduledDays;

                setCards((prev) => {
                    const next = [...prev];
                    const target = next[currentCardIdx];
                    if (!target) return prev;
                    next[currentCardIdx] = {
                        ...target,
                        due: dueAt,
                        scheduled_days: scheduledDays,
                        state: entry.fsrs_state,
                        last_review: new Date().toISOString(),
                    };
                    return next;
                });
            } catch {
                showToast('写回应复习时间失败，请稍后重试', 'error');
                setSubmitting(false);
                return;
            } finally {
                setSubmitting(false);
            }
        }

        setCopyPendingAction({
            cardIndex: currentCardIdx,
            remainingAfterSubmit,
            completed: remainingAfterSubmit === 0,
            dueAt,
            scheduledDays,
        });
        setCopySubmitted(true);
    }, [
        submitting,
        currentCard,
        currentCardIdx,
        copySubmitted,
        copyInput,
        copyRemaining,
        copyRepetitions,
        planId,
        copyReviewDays,
        buildDueAtFromDays,
    ]);

    const handleCopyNext = useCallback(() => {
        if (submitting || !copySubmitted || !copyPendingAction) return;

        const { cardIndex, remainingAfterSubmit, completed, dueAt, scheduledDays } = copyPendingAction;

        setCopyRemaining((prev) => {
            const next = [...prev];
            next[cardIndex] = remainingAfterSubmit;
            return next;
        });

        if (completed) {
            const card = cards[cardIndex];
            if (card) {
                setResults((prev) => [
                    ...prev,
                    {
                        word: card.word,
                        zh: card.zh,
                        rating: 4,
                        newDue: dueAt,
                        scheduledDays,
                    },
                ]);
            }
            setGraduatedCount((g) => g + 1);
        }

        setQueue((prev) => {
            const rest = prev.slice(1);
            return completed ? rest : reinsertAfterGap(rest, cardIndex);
        });

        setLastRating(completed ? 4 : 3);
        setCopyInput('');
        setCopySubmitted(false);
        setCopyPendingAction(null);
        setVisitKey((k) => k + 1);
    }, [submitting, copySubmitted, copyPendingAction, cards, reinsertAfterGap]);

    /* 键盘快捷键（仅记忆卡模式） */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step !== 'doing' || submitting || mode !== 'flashcard') return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    setIsFlipped(f => !f);
                    break;
                case 'Digit1': case 'Numpad1': if (isFlipped) handleFlashcardRating(1); break;
                case 'Digit2': case 'Numpad2': if (isFlipped) handleFlashcardRating(2); break;
                case 'Digit3': case 'Numpad3': if (isFlipped) handleFlashcardRating(3); break;
                case 'Digit4': case 'Numpad4': if (isFlipped) handleFlashcardRating(4); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [step, isFlipped, submitting, handleFlashcardRating, mode]);

    /* 键盘快捷键（写单词模式）
     * 快速自评可用时（输入框为空、未提交）：↑ 熟练  ↓ 不会 */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step !== 'doing' || submitting || mode !== 'write') return;
            if (writeSubmitted || unknownMode || writeInput.trim()) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleQuickAssess(false);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleQuickAssess(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [step, submitting, mode, writeSubmitted, unknownMode, writeInput, handleQuickAssess]);

    /* 再来一轮 */
    const handleRetry = () => {
        const n = cards.length;
        setQueue(Array.from({ length: n }, (_, i) => i));
        setSessionMastery(new Array(n).fill(0));
        setSessionForgot(new Array(n).fill(false));
        setCopyRemaining(new Array(n).fill(copyRepetitions));
        setCopyInput('');
        setCopySubmitted(false);
        setCopyPendingAction(null);
        setGraduatedCount(0);
        setStep('doing');
        setResults([]);
        setLastRating(null);
        setVisitKey(k => k + 1);
    };

    const backPath  = planId ? `/vocabulary/plans/${planId}` : '/vocabulary/plans';

    /* 评分已实时同步，可直接返回 */
    const handleBack = useCallback(() => {
        if (leaving) return;
        if (submitting) return;
        console.log('[词汇学习] 用户点击返回，开始退出前同步');
        setLeaving(true);
        syncCurrentAnsweredBeforeExit()
            .then(() => syncLearningTimerOnExit(false))
            .then(() => {
                console.log('[词汇学习] 退出前同步成功，导航返回');
                navigate(backPath);
            })
            .catch((error) => {
                console.error('[词汇学习] 退出前同步失败', error);
                showToast('退出前同步失败，请稍后重试', 'error');
                setLeaving(false);
            });
    }, [
        backPath,
        navigate,
        leaving,
        submitting,
        syncCurrentAnsweredBeforeExit,
        syncLearningTimerOnExit,
    ]);

    /* ── 离页保护：仅做提示和学习时长同步，不再持久化单词会话 ── */
    useEffect(() => {
        // 1. beforeunload：用户刷新/关闭/离开时
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // 如果还在学习且有未完成的答题，给出警告
            if (initialized && queue.length > 0) {
                e.preventDefault();
                e.returnValue = t.vocab.exitConfirm;
                return t.vocab.exitConfirm;
            }
        };

        // 2. pagehide：用户关闭标签页时（比beforeunload更可靠）
        const handlePageHide = (_e: PageTransitionEvent) => {
            if (!initialized) {
                console.log('[词汇学习] 页面即将隐藏，跳过处理（未初始化）');
                return;
            }

            void syncLearningTimerOnExit(true);
            if (queue.length > 0) {
                console.log('[词汇学习] 页面隐藏时不再保存本地单词进度，未提交部分将丢失（按安全策略）');
            } else {
                console.log('[词汇学习] 页面隐藏，仅同步学习时长');
            }
        };

        if (!initialized) return;

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide as EventListener);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide as EventListener);
        };
    }, [
        initialized,
        queue,
        t.vocab.exitConfirm,
        syncLearningTimerOnExit,
    ]);

    /* ── 加载中 ── */
    if (!initialized || (!currentCard && step === 'doing')) {
        return (
            <Layout>
                <div className="config-page-wrap" style={{ textAlign: 'center', paddingTop: '60px' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{t.common.loading}</p>
                </div>
            </Layout>
        );
    }

    const total      = cards.length;
    // 累计每日进度：之前已学 + 本轮毕业数
    const dailyTotal     = planDailyCount > 0 ? planDailyCount : total;
    const dailyDone      = studiedTodayBase + graduatedCount;
    const progress       = dailyTotal > 0 ? Math.min(100, Math.round((dailyDone / dailyTotal) * 100)) : 0;
    const todayLearningTotalSeconds = todayLearningBaseSeconds + sessionLearningSeconds;
    const todayLearningDuration = formatLearningDuration(todayLearningTotalSeconds);
    const statusCls  = lastRating == null ? '' :
        lastRating === 1 ? 'status-again' :
        lastRating === 2 ? 'status-hard'  :
        lastRating === 3 ? 'status-good'  : 'status-easy';

    /* ══ 结果页 ══════════════════════════════════════════════════════════════ */
    if (step === 'result') {
        const counts = [1, 2, 3, 4].map(r => results.filter(x => x.rating === r).length);
        return (
            <Layout>
                <div className="config-page-wrap">
                    <div className="practice-header">
                        <button className="back-link" onClick={handleBack}>{t.common.back}</button>
                        <h1>{t.vocab.resultTitle}{planName ? ` · ${planName}` : ''}</h1>
                        <p>{t.vocab.masteredCount.replace('{n}', results.length.toString())}</p>
                    </div>
                    <div className="config-card">
                        <div className="fc-result-stats">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`fc-result-stat ${RS_CLASSES[i]}`}>
                                    <div className="rs-num">{counts[i]}</div>
                                    <div className="rs-label">{RS_LABELS[i]}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="config-card">
                        <h3>{t.vocab.reviewDetail}</h3>
                        <div className="fc-result-list">
                            {results.map((r, i) => (
                                <div key={i} className="fc-result-item">
                                    <span className="fc-ri-word">{r.word}</span>
                                    <span className="fc-ri-zh">{r.zh}</span>
                                    <span className="fc-ri-due">{formatDue(r.newDue)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="fc-result-actions">
                            <button className="fc-action-btn" onClick={handleRetry}>🔄 {t.vocab.retry}</button>
                            <button className="fc-action-btn primary" onClick={handleBack}>
                                {t.common.back}
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    /* ══ 背诵页 ══════════════════════════════════════════════════════════════ */
    if (!currentCard) return null;

    return (
        <Layout>
            <div className="config-page-wrap" style={{ maxWidth: '680px' }}>
                <div className="practice-header" style={{ marginBottom: '16px' }}>
                    <button className="back-link" onClick={handleBack}>{t.common.back}</button>
                    <h1 style={{ marginBottom: '4px' }}>{planName || t.vocab.studyTitle}{reviewOnly && <span style={{ fontSize: 13, fontWeight: 500, background: '#dbeafe', color: '#2563eb', padding: '2px 10px', borderRadius: 20, marginLeft: 10, verticalAlign: 'middle' }}>{t.vocab.reviewMode}</span>}</h1>
                </div>

                {/* 进度行 */}
                <div className="fc-header">
                    <span className="fc-counter">
                        ✓ {dailyDone} / {dailyTotal}
                        <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>
                            {t.vocab.queue} {queue.length}
                        </span>
                    </span>
                    <div className="fc-header-right">
                        <span className="fc-learning-timer" title="今日学习时长（跨计划共享）">
                            今日时长 {todayLearningDuration}
                        </span>
                        <span className="fc-mode-badge">{MODE_LABELS[mode]}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {STATE_LABELS[currentCard.state] ?? ''}
                            {currentCard.reps > 0 && ` · 复习 ${currentCard.reps} 次`}
                        </span>
                    </div>
                </div>
                <div className="fc-progress-bar">
                    <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                {/* ══ 记忆卡模式 ══ */}
                {mode === 'flashcard' && (
                    <>
                        <div
                            className="fc-scene"
                            onClick={() => !submitting && setIsFlipped(f => !f)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.code === 'Space') { e.preventDefault(); setIsFlipped(f => !f); }
                            }}
                            aria-label={isFlipped ? '点击翻回正面' : '点击翻转查看释义'}
                        >
                            <div
                                className={`fc-card ${isFlipped ? 'is-flipped' : ''} ${isFlipping ? 'is-flipping' : ''} ${statusCls}`}
                                onTransitionStart={(e) => { if (e.propertyName === 'transform') setIsFlipping(true); }}
                                onTransitionEnd={(e) => { if (e.propertyName === 'transform') setIsFlipping(false); }}
                            >
                                {/* 正面 */}
                                <div className="fc-face">
                                    <button
                                        className="fc-speak-btn"
                                        onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                        title="朗读"
                                    >🔊</button>
                                    <div className="fc-word">{currentCard.word}</div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                            {currentCard.phonetic}
                                        </div>
                                    )}
                                    {currentCard.reps > 0 && (
                                        <div className="fc-reps-badge">
                                            {t.vocab.repsDone.replace('{n}', currentCard.reps.toString())}
                                            {currentCard.lapses > 0 && ` · ${t.vocab.lapsesCount.replace('{n}', currentCard.lapses.toString())}`}
                                        </div>
                                    )}
                                    <div className="fc-tap-hint">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M12 5v14M5 12l7 7 7-7" />
                                        </svg>
                                        {t.vocab.tapToFlip}
                                    </div>
                                </div>

                                {/* 背面 */}
                                <div className="fc-face fc-face--back">
                                    <div className="fc-back-word">
                                        {currentCard.word}
                                        <button
                                            className="fc-speak-btn fc-speak-btn--inline"
                                            onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                            title="朗读"
                                        >🔊</button>
                                    </div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic">{currentCard.phonetic}</div>
                                    )}
                                    <div className="fc-meaning">{currentCard.zh}</div>
                                    {currentCard.grammar && (
                                        <div className="fc-grammar">{currentCard.grammar}</div>
                                    )}
                                    {currentCard.definitions && currentCard.definitions.length > 0 && (
                                        <div className="fc-definitions">
                                            {currentCard.definitions.map((d, i) => (
                                                <div key={i} className="fc-def-item">
                                                    {d.pos && <span className="fc-def-pos">{d.pos}</span>}
                                                    <span className="fc-def-meaning">{d.meaning}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {currentCard.examples && currentCard.examples.length > 0 && (
                                        <div className="fc-examples">
                                            {currentCard.examples.map((ex, i) => (
                                                <div key={i} className="fc-example-item">
                                                    <div className="fc-example-en">{ex.en}</div>
                                                    {ex.zh && <div className="fc-example-zh">{ex.zh}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="fc-state-label">
                                        {STATE_LABELS[currentCard.state]}
                                        {currentCard.stability > 0 && ` · ${t.vocab.stability} ${currentCard.stability.toFixed(1)}`}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 评分按钮：只有 rating=4（容易）才推进熟练度；1/2/3 均重入队 */}
                        <div className={`fc-rating-row${!isFlipped ? ' locked' : ''}`}>
                            {RATING_INFO.map(info => (
                                <button
                                    key={info.id}
                                    className={`fc-btn ${info.cls}`}
                                    onClick={() => handleFlashcardRating(info.id)}
                                    disabled={!isFlipped || submitting}
                                >
                                    <span className="btn-label">{info.label}</span>
                                    <span className="btn-key">[{info.key}]</span>
                                    <span className="btn-interval">{estimateInterval(currentCard, info.id)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="fc-kb-hint">
                            {t.vocab.ratingHint}
                        </div>
                    </>
                )}

                {/* ══ 4选1模式 ══ */}
                {mode === 'choice' && (
                    <>
                        <div className="fc-scene" style={{ cursor: 'default' }}>
                            <div className={`fc-card ${statusCls}`} style={{ minHeight: 180 }}>
                                <div className="fc-face">
                                    <button
                                        className="fc-speak-btn"
                                        onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                        title="朗读"
                                    >🔊</button>
                                    <div className="fc-word">{currentCard.word}</div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                            {currentCard.phonetic}
                                        </div>
                                    )}
                                    {choiceSelected !== null && (
                                        <div className="fc-choice-face-meaning">
                                            {currentCard.zh}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 如果还未展开题目，显示"会/不会"选择 */}
                        {!choiceRevealed && (
                            <div className="fc-choice-reveal-actions">
                                <button
                                    className="fc-choice-know-btn"
                                    onClick={handleChoiceKnow}
                                    disabled={submitting}
                                >
                                    {t.vocab.know}
                                </button>
                                <button
                                    className="fc-choice-unknown-btn"
                                    onClick={handleChoiceUnknown}
                                    disabled={submitting}
                                >
                                    {t.vocab.dontKnow}
                                </button>
                            </div>
                        )}

                        {/* 如果已展开题目，显示4个选项 */}
                        {choiceRevealed && (
                            <>
                                <div className="fc-choices">
                                    {choices.map((opt, idx) => {
                                        let cls = 'fc-choice-opt';
                                        if (choiceSelected !== null) {
                                            if (opt.correct)                 cls += ' correct';
                                            else if (choiceSelected === idx)  cls += ' wrong';
                                            else                             cls += ' dimmed';
                                        }
                                        return (
                                            <button
                                                key={idx}
                                                className={cls}
                                                onClick={() => handleChoice(opt, idx)}
                                                disabled={choiceSelected !== null || submitting}
                                            >
                                                {opt.zh}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className={`fc-choice-actions${choiceSelected !== null ? ' fc-choice-actions--answered' : ''}`}>
                                    {choiceSelected === null && (
                                        <button
                                            className="fc-choice-hide-btn"
                                            onClick={handleChoiceHideQuestion}
                                            disabled={submitting}
                                        >
                                            {t.vocab.hide}
                                        </button>
                                    )}
                                    {choiceSelected === null && (
                                        <button
                                            className="fc-choice-unknown"
                                            onClick={handleChoiceUnknown}
                                            disabled={submitting}
                                        >
                                            {t.vocab.dontKnow}
                                        </button>
                                    )}
                                    {choiceSelected !== null && (
                                        <>
                                            <div className={`fc-choice-feedback ${choiceCorrect ? 'correct' : 'wrong'}`}>
                                                {choiceCorrect ? '✅ 回答正确' : '❌ 回答错误'}
                                            </div>
                                            <button
                                                className="fc-write-next"
                                                onClick={handleChoiceNext}
                                                disabled={submitting}
                                            >
                                                {t.vocab.next}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* ══ 看中文写英文模式 ══ */}
                {mode === 'write' && (
                    <>
                        <div className="fc-scene" style={{ cursor: 'default' }}>
                            <div className={`fc-card ${statusCls}`} style={{ minHeight: 160 }}>
                                <div className="fc-face">
                                    <div className="fc-meaning" style={{ textAlign: 'center' }}>
                                        {currentCard.zh}
                                    </div>
                                    {currentCard.grammar && (
                                        <div className="fc-grammar" style={{ marginTop: 12 }}>
                                            {currentCard.grammar}
                                        </div>
                                    )}
                                    {/* 提示区域由掌握度控制：第一遍(0)显示全拼，第二遍(>0)显示首字母提示 */}
                                    {!unknownMode && (sessionMastery[currentCardIdx] ?? 0) === 0 && (
                                        <div className="fc-write-hint">
                                            <span className="fc-write-copy-chars">
                                                {currentCard.word}
                                            </span>
                                            <span className="fc-write-hint-len" style={{ marginLeft: 8 }}>
                                                {t.vocab.charsCount.replace('{n}', currentCard.word.length.toString())}
                                            </span>
                                        </div>
                                    )}
                                    {!unknownMode && (sessionMastery[currentCardIdx] ?? 0) > 0 && (
                                        <div className="fc-write-hint">
                                            <span className="fc-write-hint-chars">
                                                {currentCard.word[0]}
                                                {'_'.repeat(currentCard.word.length - 1)}
                                            </span>
                                            <span className="fc-write-hint-len" style={{ marginLeft: 8 }}>
                                                {t.vocab.charsCount.replace('{n}', currentCard.word.length.toString())}
                                            </span>
                                        </div>
                                    )}
                                    {/* 抄写模式：卡片内展示单词供参考 */}
                                    {unknownMode && !writeSubmitted && (
                                        <div className="fc-unknown-reveal">
                                            <span className="fc-unknown-word">{currentCard.word}</span>
                                            {currentCard.phonetic && (
                                                <span className="fc-phonetic" style={{ marginLeft: 10 }}>
                                                    {currentCard.phonetic}
                                                </span>
                                            )}
                                            <button
                                                className="fc-speak-btn fc-speak-btn--inline"
                                                onClick={() => speak(currentCard.word)}
                                                title="朗读"
                                            >🔊</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="fc-write-area">
                            <div className="fc-write-input-row">
                                <input
                                    type="text"
                                    className={`fc-write-input${
                                        writeSubmitted
                                            ? writeCorrect ? ' write-correct' : ' write-wrong'
                                            : ''
                                    }`}
                                    placeholder={unknownMode ? t.vocab.copyPlaceholder : t.vocab.writePlaceholder}
                                    value={writeInput}
                                    onChange={e => setWriteInput(e.target.value)}
                                    onKeyDown={e => {
                                        // 方向键在快速自评可用时交给全局 handler，阻止浏览器 autocomplete 默认行为
                                        if (!writeSubmitted && !unknownMode && !writeInput.trim() &&
                                            (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                                            e.preventDefault();
                                            return;
                                        }
                                        if (e.key === 'Enter') {
                                            if (!writeSubmitted) handleWriteSubmit();
                                            else handleWriteNext();
                                        }
                                    }}
                                    autoComplete="new-password"
                                    readOnly={writeSubmitted}
                                    // eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus
                                />
                                <button
                                    className="fc-write-submit"
                                    onClick={handleWriteSubmit}
                                    disabled={writeSubmitted || !writeInput.trim() || submitting}
                                >
                                    {t.vocab.submit} <span className="fc-qa-key">[键盘↵]</span>
                                </button>
                                {/* 朗读按钮始终可点击 */}
                                <button
                                    className="fc-speak-btn fc-speak-btn--standalone"
                                    onClick={() => speak(currentCard.word)}
                                    title="朗读单词"
                                >🔊</button>
                            </div>
                            {/* 快速自评按钮（未提交、非抄写模式、且输入框为空时显示） */}
                            {!writeSubmitted && !unknownMode && !writeInput.trim() && (
                                <div className="fc-quick-assess">
                                    <button
                                        className="fc-qa-btn fc-qa-unknown"
                                        onClick={() => handleQuickAssess(false)}
                                        disabled={submitting}
                                    >不会 <span className="fc-qa-key">[键盘↓]</span></button>
                                    <button
                                        className="fc-qa-btn fc-qa-proficient"
                                        onClick={() => handleQuickAssess(true)}
                                        disabled={submitting}
                                    >熟练 <span className="fc-qa-key">[键盘↑]</span></button>
                                </div>
                            )}
                            {/* 抄写模式下的撤销入口 */}
                            {unknownMode && !writeSubmitted && (
                                <button className="fc-write-undo" onClick={handleWriteUndo}>
                                    ↩ {t.vocab.undo}
                                </button>
                            )}
                            {writeSubmitted && (
                                <div className={`fc-write-result ${writeCorrect ? 'correct' : 'wrong'}`}>
                                    <span>
                                        {unknownMode
                                            ? `✓ ${t.vocab.copiedLabel}：${currentCard.word}`
                                            : writeCorrect
                                                ? `✓ ${t.vocab.correctLabel}：${currentCard.word}`
                                                : `✗ ${t.vocab.wrongLabel}：${currentCard.word}`}
                                    </span>
                                    <button
                                        className="fc-write-next"
                                        onClick={handleWriteNext}
                                        disabled={submitting}
                                    >
                                        {t.vocab.next} → <span className="fc-qa-key">[键盘↵]</span>
                                    </button>
                                    <button
                                        className="fc-write-undo"
                                        onClick={handleWriteUndo}
                                        disabled={submitting}
                                    >
                                        ↩ {t.vocab.undo}
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ══ 抄写模式 ══ */}
                {mode === 'copy' && (
                    <>
                        <div className="fc-scene" style={{ cursor: 'default' }}>
                            <div className={`fc-card ${statusCls}`} style={{ minHeight: 190 }}>
                                <div className="fc-face">
                                    <button
                                        className="fc-speak-btn"
                                        onClick={(e) => { e.stopPropagation(); speak(currentCard.word); }}
                                        title="朗读"
                                    >🔊</button>
                                    <div className="fc-word">{currentCard.word}</div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                            {currentCard.phonetic}
                                        </div>
                                    )}
                                    <div className="fc-copy-meaning">{currentCard.zh}</div>
                                    <div className="fc-copy-remaining">
                                        本词剩余抄写：{Math.max(0, copyRemaining[currentCardIdx] ?? copyRepetitions)} / {copyRepetitions}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="fc-write-area">
                            <div className="fc-write-input-row">
                                <input
                                    type="text"
                                    className={`fc-write-input${copySubmitted ? ' write-correct' : ''}`}
                                    placeholder={t.vocab.copyPlaceholder}
                                    value={copyInput}
                                    onChange={(e) => setCopyInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (!copySubmitted) {
                                                void handleCopySubmit();
                                            } else {
                                                handleCopyNext();
                                            }
                                        }
                                    }}
                                    autoComplete="new-password"
                                    readOnly={copySubmitted}
                                    // eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus
                                />
                                <button
                                    className="fc-write-submit"
                                    onClick={() => { void handleCopySubmit(); }}
                                    disabled={
                                        copySubmitted
                                        || submitting
                                        || !copyInput.trim()
                                        || copyInput.trim().toLowerCase() !== currentCard.word.trim().toLowerCase()
                                    }
                                >
                                    提交
                                </button>
                            </div>

                            {!copySubmitted && (
                                <div className="fc-copy-hint">
                                    输入必须与单词完全一致，提交后需要手动点击“下一题”。中途退出时，未完成的本词抄写次数不会保留。
                                </div>
                            )}

                            {copySubmitted && (
                                <div className="fc-write-result correct">
                                    <span>
                                        {copyPendingAction?.completed
                                            ? `✓ 本词已完成：在原间隔基础上 +${copyReviewDays} 天（当前下次复习间隔 ${copyPendingAction?.scheduledDays ?? copyReviewDays} 天）`
                                            : `✓ 抄写成功，剩余 ${copyPendingAction?.remainingAfterSubmit ?? 0} 遍`}
                                    </span>
                                    <button
                                        className="fc-write-next"
                                        onClick={handleCopyNext}
                                        disabled={submitting}
                                    >
                                        {t.vocab.next} →
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}

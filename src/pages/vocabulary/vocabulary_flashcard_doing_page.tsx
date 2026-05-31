import Layout from '../../components/layout/Layout';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard.css';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
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
import FlashcardMode from '../../components/vocabulary/FlashcardMode';
import ChoiceMode from '../../components/vocabulary/ChoiceMode';
import WriteMode from '../../components/vocabulary/WriteMode';
import CopyMode from '../../components/vocabulary/CopyMode';
import GazeMode from '../../components/vocabulary/GazeMode';
import {
    type Step,
    type StudyMode,
    type TrackingMode,
    type MasterySetting,
    type CopyPendingAction,
    type ReviewResult,
    type CompletionDueHint,
    LIUHONGBO_BOOK_KEYWORDS,
    getSessionKeyCandidates,
    clampCopyRepetitions,
    clampCopyReviewDays,
    readPendingLearningSeconds,
    writePendingLearningSeconds,
    clearPendingLearningSeconds,
    shuffleArray,
    pickUniqueZh,
    countCopies,
} from '../../utils/vocab_flashcard_utils';
import { speakWord } from '../../utils/speak';
export default function VocabularyFlashcardDoingPage() {
    const { translations: t } = useLang();
    const { user } = useAuth();
    const location = useLocation();
    const navigate  = useNavigate();
    const userSessionScope = user?.id ?? null;
    
    const STATE_LABELS: Record<number, string> = useMemo(() => ({
        0: t.vocab.status.new, 
        1: t.vocab.status.learning, 
        2: t.vocab.status.review, 
        3: t.vocab.status.relearn,
    }), [t]);

    const MODE_LABELS: Record<StudyMode, string> = useMemo(() => ({
        flashcard: t.vocab.modes.flashcard,
        'flashcard-simple': '记忆卡简单模式',
        choice:    t.vocab.modes.choice,
        write:     t.vocab.modes.write,
        copy:      t.vocab.modes.copy,
        article_copy: '文章抄写',
        story_mode: '故事模式',
    }), [t]);

    const TRACKING_LABELS: Record<TrackingMode, string> = useMemo(() => ({
        none:  t.vocab.flashcardTracking.none,
        eye:   t.vocab.flashcardTracking.eye,
        mouse: t.vocab.flashcardTracking.mouse,
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

    const formatDueDate = useCallback((isoStr: string): string => {
        if (!isoStr) return t.vocab.intervals.toSync;
        const date = new Date(isoStr);
        if (Number.isNaN(date.getTime())) return t.vocab.intervals.toSync;
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    }, [t]);

    const predictDueAtFromRating = useCallback((card: VocabCard, rating: number): string => {
        const now = new Date();
        const next = new Date(now);
        const s = Number(card.stability || 0);

        if (card.state === 0 || card.state === 1 || card.state === 3) {
            const days = rating <= 3 ? 1 : Math.max(1, Math.round(s || 4));
            next.setDate(next.getDate() + days);
            return next.toISOString();
        }

        if (rating === 1) {
            next.setMinutes(next.getMinutes() + 5);
            return next.toISOString();
        }

        const factor = rating === 2 ? 0.6 : rating === 3 ? 1.0 : 1.5;
        const days = Math.max(1, Math.round((s || 1) * factor));
        next.setDate(next.getDate() + days);
        return next.toISOString();
    }, []);

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
    const [trackingMode, setTrackingMode] = useState<TrackingMode>('none');
    const [trackingMenuOpen, setTrackingMenuOpen] = useState(false);
    const trackingMenuRef = useRef<HTMLDivElement | null>(null);

    // Click outside to close tracking menu
    useEffect(() => {
        if (!trackingMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (trackingMenuRef.current && !trackingMenuRef.current.contains(e.target as Node)) {
                setTrackingMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [trackingMenuOpen]);
    const [masteryTarget, setMasteryTarget] = useState<MasterySetting>(2);
    const [copyRepetitions, setCopyRepetitions] = useState(3);
    const [copyReviewDays, setCopyReviewDays] = useState(2);
    const [copyRemaining, setCopyRemaining] = useState<number[]>([]);
    const [copyInput, setCopyInput] = useState('');
    const [copySubmitted, setCopySubmitted] = useState(false);
    const [copyPendingAction, setCopyPendingAction] = useState<CopyPendingAction | null>(null);
    const [completionDueHint, setCompletionDueHint] = useState<CompletionDueHint | null>(null);
    const [copyReviewDaysTemp, setCopyReviewDaysTemp] = useState<number[]>([]);  // 每个单词的临时天数修改
    const [copyWordHidden, setCopyWordHidden] = useState(false);  // 用户的隐藏偏好（全局）
    const [copyWordVisible, setCopyWordVisible] = useState(true);  // 当前单词是否显示
    const [isPeeking, setIsPeeking] = useState(false);
    const [leaving,      setLeaving]      = useState(false);
    const [reviewOnly,   setReviewOnly]   = useState(false); // 复习模式：不提交 FSRS
    const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(() => {
        try {
            const cached = localStorage.getItem('vocab_auto_pronounce_enabled');
            if (cached !== null) {
                return cached === 'true';
            }
        } catch {
            // ignore
        }
        return true;
    });

    const toggleAutoSpeak = useCallback(() => {
        setAutoSpeakEnabled(prev => {
            const next = !prev;
            try {
                localStorage.setItem('vocab_auto_pronounce_enabled', String(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

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

    /**
     * 写模式专用后插公式（独立于其他模式）：
     * - 第1次错：放到后5个位置
     * - 第2次错：放到后6个位置
     * - 依此类推，最多10个或到队尾
     */
    const reinsertAfterGapForWrite = useCallback((rest: number[], cardIndex: number) => {
        const errorCount = sessionErrorCount[cardIndex] ?? 0;
        const gap = Math.min(errorCount + 5, 10, rest.length);
        return [...rest.slice(0, gap), cardIndex, ...rest.slice(gap)];
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
        setCopyReviewDaysTemp(new Array(n).fill(fallbackCopyReviewDays));  // 初始化每个单词的临时天数
        setCopyInput('');
        setCopySubmitted(false);
        setCopyPendingAction(null);
        setCopyWordHidden(false);  // 初始化隐藏偏好为显示
        setCopyWordVisible(true);  // 初始化单词可见性为显示
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
            if (cachedMode && ['flashcard', 'flashcard-simple', 'choice', 'write', 'copy'].includes(cachedMode)) {
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
        if (mode && ['flashcard', 'flashcard-simple', 'choice', 'write', 'copy'].includes(mode)) {
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
        setCompletionDueHint(null);
        setCopyWordVisible(!copyWordHidden);  // 根据隐藏偏好重置显示状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey]);

    /* 每张新卡自动播放一次单词读音（所有模式）
     * setTimeout 解决 Chrome cancel/speak 竞争：cancel() 后立即 speak() 会被吞掉 */
    useEffect(() => {
        if (!initialized || queue.length === 0 || !autoSpeakEnabled) return;
        const word = cards[queue[0]]?.word;
        if (!word) return;
        const timer = setTimeout(() => speakWord(word), 150);
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
        // 默写模式：只在毕业时提交 FSRS，中间进度不提交（退出即丢弃）
        const shouldSubmitFsrs = !reviewOnly && !(mode === 'write' && !graduate);

        if (shouldSubmitFsrs) {
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
            setCompletionDueHint({
                word: updatedCard.word,
                dueAt: updatedCard.due,
            });
        }

        setSessionMastery(prev => { const a = [...prev]; a[ci] = newMastery; return a; });
        setQueue(prev => {
            const rest = prev.slice(1);
            if (graduate) {
                // 毕业时重置错误计数
                setSessionErrorCount(p => { const a = [...p]; a[ci] = 0; return a; });
                return rest;
            }
            const reinsert = mode === 'write' ? reinsertAfterGapForWrite : reinsertAfterGap;
            return reinsert(rest, ci);
        });

        setVisitKey(k => k + 1);
        setSubmitting(false);
    }, [submitReviewWithRetry, reinsertAfterGap, reinsertAfterGapForWrite, reviewOnly, mode, t.vocab.toastSyncFail]);

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

        const target = resolveAutoMasteryTarget(ci, mode);

        const newMastery = nextMastery(curMastery, isCorrect, target);
        const graduate = newMastery >= target;

        // 新评分策略：真实反映用户记忆状态
        // 答对未毕业→Good(3)  答错未毕业→Again(1)
        // 答对毕业→Easy(4)    答错毕业→Hard(2)
        const fsrsRating = graduate
            ? (isCorrect ? 4 : 2)
            : (isCorrect ? 3 : 1);
        const uiRating = isCorrect ? 3 : 1;

        setLastRating(uiRating);
        await submitAndAdvance(ci, currentCard, fsrsRating, newMastery, graduate, forgotNow);
    }, [submitting, currentCard, currentCardIdx, sessionMastery, mode, resolveAutoMasteryTarget, submitAndAdvance, nextMastery]);

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
    }, [resolveAutoMasteryTarget, nextMastery]);

    const syncCurrentAnsweredBeforeExit = useCallback(async () => {
        if (!currentCard || currentCardIdx < 0) return;

        let outcome: { fsrsRating: number; newMastery: number; graduate: boolean; forgotNow: boolean } | null = null;

        if (mode === 'choice' && choiceSelected !== null && choiceCorrect !== null) {
            const curMastery = sessionMastery[currentCardIdx] ?? 0;
            outcome = buildAutoOutcome(choiceCorrect, curMastery, currentCardIdx, 'choice');
        }
        // write 模式中途退出不补交，未完成的进度直接丢弃

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

        // 仅在“本次作答已达到毕业条件”时显示下次学习提示
        if (opt.correct && currentCard && currentCardIdx >= 0) {
            const curMastery = sessionMastery[currentCardIdx] ?? 0;
            const outcome = buildAutoOutcome(true, curMastery, currentCardIdx, 'choice');
            if (outcome.graduate) {
                setCompletionDueHint({
                    word: currentCard.word,
                    dueAt: predictDueAtFromRating(currentCard, outcome.fsrsRating),
                });
            }
        }
    }, [
        choiceSelected,
        submitting,
        currentCard,
        currentCardIdx,
        sessionMastery,
        buildAutoOutcome,
        predictDueAtFromRating,
    ]);

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
            const isCorrect = input === target;
            setWriteCorrect(isCorrect);
            setWriteSubmitted(true);

            // 仅在“本次提交已达到毕业条件”时显示下次学习提示
            if (isCorrect && currentCardIdx >= 0) {
                const curMastery = sessionMastery[currentCardIdx] ?? 0;
                const outcome = buildAutoOutcome(true, curMastery, currentCardIdx, 'write');
                if (outcome.graduate) {
                    setCompletionDueHint({
                        word: currentCard.word,
                        dueAt: predictDueAtFromRating(currentCard, outcome.fsrsRating),
                    });
                }
            }
        }
    }, [
        writeSubmitted,
        submitting,
        writeInput,
        currentCard,
        unknownMode,
        currentCardIdx,
        sessionMastery,
        buildAutoOutcome,
        predictDueAtFromRating,
    ]);

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
        if (writeSubmitted || submitting || !currentCard) return;
        if (!correct) {
            // 不会：展示单词，进入抄写流程
            setUnknownMode(true);
        } else {
            // 熟练：标记直接毕业，解锁"下一个"
            setQuickProficient(true);
            setWriteCorrect(true);
            setWriteSubmitted(true);
            setCompletionDueHint({
                word: currentCard.word,
                dueAt: predictDueAtFromRating(currentCard, 4),
            });
        }
    }, [writeSubmitted, submitting, currentCard, predictDueAtFromRating]);

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
        if (!normalizedInput) {
            showToast('请先输入抄写内容', 'error');
            return;
        }
        const currentRemaining = Math.max(0, copyRemaining[currentCardIdx] ?? copyRepetitions);
        if (currentRemaining <= 0) {
            return;
        }

        const correctCount = countCopies(copyInput, currentCard.word);

        if (correctCount < currentRemaining) {
            showToast(`抄写次数不足，需完整抄写 ${currentRemaining} 次`, 'error');
            return;
        }

        const remainingAfterSubmit = 0;
        let dueAt = currentCard.due;
        let scheduledDays = currentCard.scheduled_days ?? 0;
        
        // 获取用户为这个单词修改的天数（如果没改就用全局默认值）
        const reviewDaysForThisWord = copyReviewDaysTemp[currentCardIdx] ?? copyReviewDays;

        if (remainingAfterSubmit === 0) {
            if (!planId || !currentCard.entry_id) {
                showToast('缺少计划词条信息，无法写回应复习时间', 'error');
                return;
            }

            setSubmitting(true);
            try {
                const expectedScheduledDays = reviewDaysForThisWord;
                const { entry } = await updatePlanWord(planId, currentCard.entry_id, {
                    next_review_days: reviewDaysForThisWord,
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

        // 抄写模式在“本词完成”瞬间即显示下次学习提示
        if (remainingAfterSubmit === 0) {
            setCompletionDueHint({
                word: currentCard.word,
                dueAt,
            });
        }

        // 如果单词处于隐藏状态，提交后临时显示
        if (copyWordHidden) {
            setCopyWordVisible(true);
        }
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
        copyReviewDaysTemp,
        copyWordHidden,
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
                setCompletionDueHint({
                    word: card.word,
                    dueAt,
                });
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

    const toggleCopyWordHiddenPreference = useCallback(() => {
        const newHidden = !copyWordHidden;
        setCopyWordHidden(newHidden);
        // 提交后可能处于“临时显示”状态，这里不覆盖它。
        if (!copySubmitted) {
            setCopyWordVisible(!newHidden);
        }
    }, [copyWordHidden, copySubmitted]);

    /* 键盘快捷键（记忆卡模式） */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step !== 'doing' || submitting || !mode.startsWith('flashcard')) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space':
                    if (mode === 'flashcard-simple') return;
                    e.preventDefault();
                    setIsFlipping(true);
                    setIsFlipped(f => !f);
                    setTimeout(() => setIsFlipping(false), 350);
                    break;
                case 'Digit1': case 'Numpad1': if (isFlipped || mode === 'flashcard-simple') handleFlashcardRating(1); break;
                case 'Digit2': case 'Numpad2': if (isFlipped || mode === 'flashcard-simple') handleFlashcardRating(2); break;
                case 'Digit3': case 'Numpad3': if (isFlipped || mode === 'flashcard-simple') handleFlashcardRating(3); break;
                case 'Digit4': case 'Numpad4': if (isFlipped || mode === 'flashcard-simple') handleFlashcardRating(4); break;
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
        setCopyReviewDaysTemp(new Array(n).fill(copyReviewDays));  // 重置临时天数
        setCopyInput('');
        setCopySubmitted(false);
        setCopyPendingAction(null);
        setCopyWordVisible(!copyWordHidden);  // 根据隐藏偏好重置显示状态
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
        const handlePageHide = () => {
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
            <Layout
                pageTitle={`${t.vocab.resultTitle}${planName ? ` · ${planName}` : ''}`}
                pageSubtitle={t.vocab.masteredCount.replace('{n}', results.length.toString())}
                backUrl="/vocabulary"
                backText={t.common.back}
            >
                <div className="config-page-wrap fc-loading">
                    <p>{t.common.loading}</p>
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
    const statusCls  = mode === 'write'
        ? (writeSubmitted
            ? (writeCorrect ? 'status-good' : 'status-again')
            : (unknownMode ? 'status-again' : ''))
        : lastRating == null ? '' :
            lastRating === 1 ? 'status-again' :
            lastRating === 2 ? 'status-hard'  :
            lastRating === 3 ? 'status-good'  : 'status-easy';

    /* ══ 结果页 ══════════════════════════════════════════════════════════════ */
    if (step === 'result') {
        const counts = [1, 2, 3, 4].map(r => results.filter(x => x.rating === r).length);
        return (
            <Layout>
                <div className="config-page-wrap">
                    
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
                        <ul className="fc-result-list">
                            {results.map((r, i) => (
                                <li key={i} className="fc-result-item">
                                    <span className="fc-ri-word">{r.word}</span>
                                    <span className="fc-ri-zh">{r.zh}</span>
                                    <span className="fc-ri-due">{formatDue(r.newDue)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="fc-result-actions">
                            <button type="button" className="fc-action-btn" onClick={handleRetry}><RotateCcw size={16} /> {t.vocab.retry}</button>
                            <button type="button" className="fc-action-btn primary" onClick={handleBack}>
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
        <Layout
            onBack={handleBack}
            backText={t.common.back}
            pageTitle={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {planName || t.vocab.studyTitle}
                    {reviewOnly && <span className="fc-review-badge">{t.vocab.reviewMode}</span>}
                </span>
            }
        >
            <div className="config-page-wrap fc-doing-page">

                {/* 进度行 */}
                <div className="fc-header">
                    <span className="fc-counter">
                        ✓ {dailyDone} / {dailyTotal}
                        <span className="fc-queue-remaining">
                            {t.vocab.queue} {queue.length}
                        </span>
                    </span>
                    <div className="fc-header-right">
                        <button
                            type="button"
                            className="fc-auto-speak-btn"
                            onClick={toggleAutoSpeak}
                            aria-label={autoSpeakEnabled ? "关闭自动发音" : "开启自动发音"}
                        >
                            {autoSpeakEnabled ? <><Volume2 size={14} /> 自动发音开</> : <><VolumeX size={14} /> 自动发音关</>}
                        </button>
                        <span className="fc-learning-timer" title="今日学习时长（跨计划共享）">
                            今日时长 {todayLearningDuration}
                        </span>
                        <div className="fc-mode-badge-wrap" ref={trackingMenuRef}>
                            <button
                                className={`fc-mode-badge${mode.startsWith('flashcard') ? ' has-submenu' : ''}`}
                                onClick={() => mode.startsWith('flashcard') && setTrackingMenuOpen(v => !v)}
                                title={mode.startsWith('flashcard') ? '模式与追踪选项' : undefined}
                            >
                                {MODE_LABELS[mode]}
                                {mode.startsWith('flashcard') && trackingMode !== 'none' && (
                                    <span className="fc-mode-badge-sub">· {TRACKING_LABELS[trackingMode]}</span>
                                )}
                                {mode.startsWith('flashcard') && <span className="fc-mode-badge-arrow">▾</span>}
                            </button>
                            {trackingMenuOpen && mode.startsWith('flashcard') && (
                                <div className="fc-tracking-menu">
                                    <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>学习模式</div>
                                    {(['flashcard', 'flashcard-simple'] as StudyMode[]).map(m => (
                                        <button
                                            key={m}
                                            className={`fc-tracking-menu-item${mode === m ? ' active' : ''}`}
                                            onClick={() => { setMode(m); setTrackingMenuOpen(false); }}
                                        >
                                            <span className="fc-tracking-menu-dot" />
                                            <span>{MODE_LABELS[m]}</span>
                                            {mode === m && <span className="fc-tracking-menu-check">✓</span>}
                                        </button>
                                    ))}
                                    <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                                    <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>追踪模式</div>
                                    {(['none', 'eye', 'mouse'] as TrackingMode[]).map(tm => (
                                        <button
                                            key={tm}
                                            className={`fc-tracking-menu-item${trackingMode === tm ? ' active' : ''}`}
                                            onClick={() => { setTrackingMode(tm); setTrackingMenuOpen(false); }}
                                        >
                                            <span className="fc-tracking-menu-dot" />
                                            <span>{TRACKING_LABELS[tm]}</span>
                                            {trackingMode === tm && <span className="fc-tracking-menu-check">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <span className="fc-state-label-inline">
                            {STATE_LABELS[currentCard.state] ?? ''}
                            {currentCard.reps > 0 && ` · 复习 ${currentCard.reps} 次`}
                        </span>
                    </div>
                </div>
                <div
                    className="fc-progress-bar"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="学习进度"
                >
                    <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
                </div>


                {/* ══ 记忆卡模式 ══ */}
                {(mode === 'flashcard' || mode === 'flashcard-simple') && trackingMode === 'none' && (
                    <FlashcardMode
                        currentCard={currentCard}
                        isFlipped={isFlipped}
                        isFlipping={isFlipping}
                        statusCls={statusCls}
                        submitting={submitting}
                        onFlip={() => {
                            setIsFlipping(true);
                            setIsFlipped(f => !f);
                            setTimeout(() => setIsFlipping(false), 350);
                        }}
                        onRating={handleFlashcardRating}
                        estimateInterval={estimateInterval}
                        simpleMode={mode === 'flashcard-simple'}
                    />
                )}

                {/* ══ 记忆卡 · 追踪模式 ══ */}
                {(mode === 'flashcard' || mode === 'flashcard-simple') && trackingMode !== 'none' && (
                    <GazeMode
                        currentCard={currentCard}
                        isFlipped={isFlipped}
                        isFlipping={isFlipping}
                        statusCls={statusCls}
                        submitting={submitting}
                        trackingMode={trackingMode as 'eye' | 'mouse'}
                        onFlip={() => {
                            setIsFlipping(true);
                            setIsFlipped(f => !f);
                            setTimeout(() => setIsFlipping(false), 350);
                        }}
                        onRating={handleFlashcardRating}
                        estimateInterval={estimateInterval}
                        simpleMode={mode === 'flashcard-simple'}
                    />
                )}

                {/* ══ 4选1模式 ══ */}
                {mode === 'choice' && (
                    <ChoiceMode
                        currentCard={currentCard}
                        statusCls={statusCls}
                        submitting={submitting}
                        choices={choices}
                        choiceSelected={choiceSelected}
                        choiceCorrect={choiceCorrect}
                        choiceRevealed={choiceRevealed}
                        completionDueHint={completionDueHint}
                        onChoiceKnow={handleChoiceKnow}
                        onChoiceUnknown={handleChoiceUnknown}
                        onChoice={handleChoice}
                        onChoiceHideQuestion={handleChoiceHideQuestion}
                        onChoiceNext={handleChoiceNext}
                        formatDueDate={formatDueDate}
                    />
                )}

                {/* ══ 看中文写英文模式 ══ */}
                {mode === 'write' && (
                    <WriteMode
                        currentCard={currentCard}
                        currentCardIdx={currentCardIdx}
                        statusCls={statusCls}
                        submitting={submitting}
                        writeInput={writeInput}
                        writeSubmitted={writeSubmitted}
                        writeCorrect={writeCorrect}
                        unknownMode={unknownMode}
                        sessionMastery={sessionMastery}
                        completionDueHint={completionDueHint}
                        onWriteInput={setWriteInput}
                        onWriteSubmit={handleWriteSubmit}
                        onWriteNext={handleWriteNext}
                        onQuickAssess={handleQuickAssess}
                        onWriteUndo={handleWriteUndo}
                        formatDueDate={formatDueDate}
                    />
                )}

                {/* ══ 抄写模式 ══ */}
                {mode === 'copy' && (
                    <CopyMode
                        currentCard={currentCard}
                        currentCardIdx={currentCardIdx}
                        statusCls={statusCls}
                        submitting={submitting}
                        copyInput={copyInput}
                        copySubmitted={copySubmitted}
                        copyRepetitions={copyRepetitions}
                        copyRemaining={copyRemaining}
                        copyReviewDays={copyReviewDays}
                        copyReviewDaysTemp={copyReviewDaysTemp}
                        copyWordHidden={copyWordHidden}
                        copyWordVisible={copyWordVisible}
                        isPeeking={isPeeking}
                        copyPendingAction={copyPendingAction}
                        completionDueHint={completionDueHint}
                        onCopyInput={setCopyInput}
                        onCopySubmit={() => { void handleCopySubmit(); }}
                        onCopyNext={handleCopyNext}
                        onCopyReviewDaysChange={(cardIdx, val) => {
                            setCopyReviewDaysTemp((prev) => {
                                const next = [...prev];
                                next[cardIdx] = val;
                                return next;
                            });
                        }}
                        onToggleHidden={toggleCopyWordHiddenPreference}
                        onPeekStart={() => setIsPeeking(true)}
                        onPeekEnd={() => setIsPeeking(false)}
                        formatDueDate={formatDueDate}
                    />
                )}
            </div>
        </Layout>
    );
}

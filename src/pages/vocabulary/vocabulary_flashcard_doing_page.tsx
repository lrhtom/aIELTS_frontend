import Layout from '../../components/layout/Layout';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitReview, type VocabCard } from '../../api/vocab';
import { showToast } from '../../components/common/Toast';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard.css';

/* ── Types ───────────────────────────────────────────────────────────────── */

type Step = 'doing' | 'result';
type StudyMode = 'flashcard' | 'choice' | 'write';
type MasterySetting = 'auto' | number;

interface ReviewResult {
    word:          string;
    zh:            string;
    rating:        number;
    newDue:        string;
    scheduledDays: number;
}

interface SessionCache {
    cards:           VocabCard[];
    queue:           number[];
    sessionMastery:  number[];
    sessionForgot:   boolean[];
    sessionErrorCount: number[];     // 新增：追踪每个卡片的错误次数
    masteryTarget?:  MasterySetting;
    graduatedCount:  number;
    isFlipped:       boolean;
    step:            Step;
    results:         ReviewResult[];
    planId?:         number;
    planName?:       string;
    mode:            StudyMode;      // 🔧 必需字段：确保mode始终存在
}

const SESSION_KEY = 'vocab_flashcard_session';

const RATING_INFO = [
    { id: 1, label: '忘了', cls: 'btn-again', key: '1' },
    { id: 2, label: '困难', cls: 'btn-hard',  key: '2' },
    { id: 3, label: '一般', cls: 'btn-good',  key: '3' },
    { id: 4, label: '容易', cls: 'btn-easy',  key: '4' },
];

const STATE_LABELS: Record<number, string> = {
    0: '新卡片', 1: '学习中', 2: '复习', 3: '重新学习',
};

const MODE_LABELS: Record<StudyMode, string> = {
    flashcard: '记忆卡',
    choice:    '4选1',
    write:     '看中文写英文',
};

const RS_CLASSES = ['rs-again', 'rs-hard', 'rs-good', 'rs-easy'];
const RS_LABELS  = ['忘了', '困难', '一般', '容易'];

/* ── 工具函数 ─────────────────────────────────────────────────────────────── */

/**
 * 连续正确计数规则（4选1 / 写英文模式专用）
 *   wrong   → 0（连对中断）
 *   correct → +1
 * 达到 masteryTarget 次后毕业
 */
function nextMastery(current: number, correct: boolean, masteryTarget: number): number {
    if (!correct) return 0;
    return Math.min(masteryTarget, current + 1);
}

function estimateInterval(card: VocabCard, rating: number): string {
    const { state, stability: s } = card;
    if (state === 0 || state === 1 || state === 3) {
        if (rating <= 3) return '明天';
        return `约${Math.max(1, Math.round(s || 4))}天`;
    }
    // Review 阶段
    if (rating === 1) return '5分钟后';  // Again → Relearning
    const factor = rating === 2 ? 0.6 : rating === 3 ? 1.0 : 1.5;
    const days = Math.max(1, Math.round((s || 1) * factor));
    return days === 1 ? '1天' : `约${days}天`;
}

function formatDue(isoStr: string): string {
    if (!isoStr) return '待同步';
    const diff = new Date(isoStr).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return '今天';
    if (mins < 60) return `${mins}分钟后`;
    const days = Math.round(diff / 86400000);
    if (days < 2) return '明天';
    return `${days}天后`;
}

function speak(word: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
}

/* ── 组件 ─────────────────────────────────────────────────────────────────── */

export default function VocabularyFlashcardDoingPage() {
    const location = useLocation();
    const navigate  = useNavigate();

    const [cards,          setCards]          = useState<VocabCard[]>([]);
    /** queue[0] 是当前卡片索引；毕业 = 弹出队头；重入 = 移到队尾 */
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
    const [leaving,      setLeaving]      = useState(false);
    const [reviewOnly,   setReviewOnly]   = useState(false); // 复习模式：不提交 FSRS

    // 4选1
    const [choices,        setChoices]        = useState<Array<{ zh: string; correct: boolean }>>([]);
    const [choiceSelected, setChoiceSelected] = useState<number | null>(null);
    const [choiceCorrect,  setChoiceCorrect]  = useState<boolean | null>(null);
    const [choiceRevealed, setChoiceRevealed] = useState(false); // 是否已展开题目

    // 看中文写英文
    const [writeInput,       setWriteInput]       = useState('');
    const [writeSubmitted,   setWriteSubmitted]   = useState(false);
    const [writeCorrect,     setWriteCorrect]     = useState<boolean | null>(null);
    const [unknownMode,      setUnknownMode]      = useState(false);    // 点击"不会"：展示单词让用户抄写
    const [quickProficient,  setQuickProficient]  = useState(false);   // 点击"熟练"：直接毕业

    // 追踪每个卡片的错误次数
    const [sessionErrorCount, setSessionErrorCount] = useState<number[]>([]);
    
    // 记录加载时的plan配置，用于检测daily_count是否改变
    const [planDailyCountAtLoad, setPlanDailyCountAtLoad] = useState<number | null>(null);
    
    // 今日已学基数（进入本轮前已完成的数量）和每日配额，用于显示累计进度
    const [studiedTodayBase, setStudiedTodayBase] = useState(0);
    const [planDailyCount, setPlanDailyCount] = useState(0);
    
    // 防止持久化 useEffect 在同步退出时覆盖 sessionStorage
    const navigatingAwayRef = useRef(false);
    
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
            reviewOnly?: boolean;
            forceNewSession?: boolean;
        } | null;

        // 首要是检查是否强行要求开启新会话（例如从计划页点击"开始学习"时）
        if (state?.forceNewSession) {
            console.log('[词汇学习] 新会话开启：清除 sessionStorage 的所有脏历史', { planId: state.planId });
            sessionStorage.removeItem(SESSION_KEY);
            
            // 重要：从浏览器的 history 当中擦除这个 flag，这样如果用户学习到一半按 F5
            // 刷新页面，就不会被再次误认为是个 new session，而是能正常走 cache 恢复逻辑！
            const restoredState = { ...state };
            delete restoredState.forceNewSession;
            window.history.replaceState({ ...window.history.state, usr: restoredState }, '');
        }

        // 然后再尝试从 sessionStorage 恢复，如果存在且 planId 匹配
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw && state?.planId) {
            try {
                const cached: SessionCache = JSON.parse(raw);
                // 检查两个条件：
                // 1. planId 必须匹配
                // 2. (新增) planDailyCount 必须匹配或缓存中不存在daily_count字段（向后兼容）
                if (cached.planId === state.planId) {
                    // 检查daily_count是否改变（防止用户修改计划后队列未更新）
                    const cachedDailyCount = (cached as any).planDailyCount || null;
                    const currentDailyCount = state.planDailyCount || null;
                    
                    if (cachedDailyCount !== null && currentDailyCount !== null && cachedDailyCount !== currentDailyCount) {
                        console.log('[词汇学习] 检测到 daily_count 改变，清除缓存重新开始', {
                            old: cachedDailyCount,
                            new: currentDailyCount,
                        });
                        sessionStorage.removeItem(SESSION_KEY);
                        // 继续初始化为当前的location.state
                    } else {
                        console.log('[词汇学习] 从 sessionStorage 恢复会话', {
                            planId: cached.planId,
                            totalCards: cached.cards.length,
                            queueLength: cached.queue?.length,
                            graduatedCount: cached.graduatedCount,
                            mode: cached.mode,
                        });
                        const n = cached.cards.length;
                        setCards(cached.cards);
                        setQueue(cached.queue ?? Array.from({ length: n }, (_, i) => i));
                        setSessionMastery(cached.sessionMastery ?? new Array(n).fill(0));
                        setSessionForgot(cached.sessionForgot  ?? new Array(n).fill(false));
                        setSessionErrorCount(cached.sessionErrorCount ?? new Array(n).fill(0));
                        if (typeof cached.masteryTarget === 'number') {
                            setMasteryTarget(Math.min(5, Math.max(1, cached.masteryTarget)));
                        } else if (cached.masteryTarget === 'auto') {
                            setMasteryTarget('auto');
                        }
                        setGraduatedCount(cached.graduatedCount ?? 0);
                        setIsFlipped(cached.isFlipped ?? false);
                        setStep(cached.step ?? 'doing');
                        setResults(cached.results ?? []);
                        if (cached.planId)   setPlanId(cached.planId);
                        if (cached.planName) setPlanName(cached.planName);
                        
                        // 恢复当前答题的临时状态（用于刷新后显示上次进度）
                        if ((cached as any).choiceSelected !== undefined) {
                            setChoiceSelected((cached as any).choiceSelected);
                        }
                        if ((cached as any).choiceCorrect !== undefined) {
                            setChoiceCorrect((cached as any).choiceCorrect);
                        }
                        if ((cached as any).choiceRevealed) {
                            setChoiceRevealed((cached as any).choiceRevealed);
                        }
                        if ((cached as any).writeInput !== undefined) {
                            setWriteInput((cached as any).writeInput);
                        }
                        if ((cached as any).writeSubmitted) {
                            setWriteSubmitted((cached as any).writeSubmitted);
                        }
                        if ((cached as any).writeCorrect !== undefined) {
                            setWriteCorrect((cached as any).writeCorrect);
                        }
                        if ((cached as any).lastRating !== undefined) {
                            setLastRating((cached as any).lastRating);
                        }
                        
                        // 🔧 Mode恢复优先级（重要：新传入的state.mode > 缓存的mode > localStorage > 默认值）
                        // 这样确保用户在详情页改变mode后，学习页面立即使用新mode
                        let resolvedMode: StudyMode = 'flashcard';
                        if (state?.mode && ['flashcard', 'choice', 'write'].includes(state.mode)) {
                            // 🎯 优先使用新传入的state.mode（用户在详情页的新选择）
                            resolvedMode = state.mode;
                            console.log('[词汇学习] Mode从location.state中恢复（优先级最高）', { mode: state.mode });
                        } else if (cached.mode && ['flashcard', 'choice', 'write'].includes(cached.mode)) {
                            // 次优先：使用缓存中的mode（同一session中的mode）
                            resolvedMode = cached.mode;
                            console.log('[词汇学习] Mode从sessionStorage恢复（state中无mode）', { mode: cached.mode });
                        } else if (cached.planId) {
                            // 最后fallback到localStorage持久化设置
                            const cachedMode = localStorage.getItem(`lp_study_mode_${cached.planId}`) as StudyMode | null;
                            if (cachedMode && ['flashcard', 'choice', 'write'].includes(cachedMode)) {
                                resolvedMode = cachedMode;
                                console.log('[词汇学习] Mode从localStorage恢复（sessionStorage/state中缺失）', { mode: cachedMode, planId: cached.planId });
                            }
                        }
                        setMode(resolvedMode);
                        
                        console.log('[词汇学习] 恢复当前答题状态', {
                            choiceSelected: (cached as any).choiceSelected,
                            writeSubmitted: (cached as any).writeSubmitted,
                            lastRating: (cached as any).lastRating,
                        });
                        
                        setVisitKey(1);
                        setInitialized(true);
                        setPlanDailyCountAtLoad(currentDailyCount);
                        return;
                    }
                }
            } catch (e) {
                console.error('[词汇学习] 恢复 sessionStorage 失败', e);
            }
        }

        // sessionStorage 不可用或 planId 不匹配或 daily_count 改变，从 location.state 初始化
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
            if (cachedMode && ['flashcard', 'choice', 'write'].includes(cachedMode)) {
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
        setPlanDailyCountAtLoad(state.planDailyCount || null);
        setPlanDailyCount(state.planDailyCount || 0);
        setStudiedTodayBase(state.stats?.studied_today ?? 0);
        if (state.reviewOnly) setReviewOnly(true);
        setVisitKey(1);
        setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Mode同步到localStorage（作为长期持久化备份） */
    useEffect(() => {
        if (!initialized || !planId) return;
        if (mode && ['flashcard', 'choice', 'write'].includes(mode)) {
            localStorage.setItem(`lp_study_mode_${planId}`, mode);
            console.log('[词汇学习] Mode已同步到localStorage', { planId, mode });
        }
    }, [mode, planId, initialized]);

    /* 持久化 */
    useEffect(() => {
        // 如果正在导航离开，则跳过此次持久化（防止用旧状态覆盖 syncCurrentAnsweredBeforeExit 刚刚保存的状态）
        if (navigatingAwayRef.current) {
            console.log('[词汇学习] 正在导航，跳过持久化 useEffect（保护 syncCurrentAnsweredBeforeExit 的结果）');
            return;
        }
        if (!initialized) return;
        
        // 扩展SessionCache：保存当前答题的临时状态
        const cache: SessionCache & { 
            planDailyCount?: number;
            // 当前卡片的答题临时状态（用于恢复时显示）
            currentCardIdx?: number;
            choiceSelected?: number | null;
            choiceCorrect?: boolean | null;
            choiceRevealed?: boolean;
            writeInput?: string;
            writeSubmitted?: boolean;
            writeCorrect?: boolean | null;
            isFlipped?: boolean;
            lastRating?: number | null;
        } = {
            cards, queue, sessionMastery, sessionForgot, sessionErrorCount,
            masteryTarget,
            graduatedCount, isFlipped, step, results, mode,
            // 新增：保存当前答题状态
            currentCardIdx: currentCardIdx >= 0 ? currentCardIdx : undefined,
            choiceSelected: choiceSelected !== null ? choiceSelected : undefined,
            choiceCorrect: choiceCorrect !== null ? choiceCorrect : undefined,
            choiceRevealed: choiceRevealed ? choiceRevealed : undefined,
            writeInput: writeInput || undefined,
            writeSubmitted: writeSubmitted ? writeSubmitted : undefined,
            writeCorrect: writeCorrect !== null ? writeCorrect : undefined,
            lastRating: lastRating !== null ? lastRating : undefined,
        };
        if (planId)   cache.planId   = planId;
        if (planName) cache.planName = planName;
        if (planDailyCountAtLoad) cache.planDailyCount = planDailyCountAtLoad;
        
        console.log('[词汇学习] 持久化会话到 sessionStorage', {
            totalCards: cards.length,
            queueLength: queue.length,
            graduatedCount,
            step,
            currentCardIdx: currentCardIdx >= 0 ? currentCardIdx : 'none',
            planDailyCount: planDailyCountAtLoad,
        });
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
    }, [initialized, cards, queue, sessionMastery, sessionForgot, sessionErrorCount,
        masteryTarget, graduatedCount, isFlipped, step, results, planId, planName, mode, planDailyCountAtLoad]);

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
        const others = cards.filter((_, i) => i !== ci && _.zh);
        const wrong3  = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
        const opts    = [
            { zh: current.zh, correct: true },
            ...wrong3.map(c => ({ zh: c.zh, correct: false })),
        ].sort(() => Math.random() - 0.5);
        setChoices(opts);
    // visitKey 驱动重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey, mode, cards]);

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
                showToast('评分同步失败，请检查网络后重试', 'error');
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

    /* 4选1 / 写单词：自动评分，达到 masteryTarget 次连续正确后毕业 */
    const handleAutoRating = useCallback(async (isCorrect: boolean) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        const ci            = currentCardIdx;
        const curMastery    = sessionMastery[ci] ?? 0; // 当前连续正确次数
        const forgotNow     = !isCorrect;

        let newMastery: number;
        let graduate: boolean;
        let target: number;

        if (masteryTarget === 'auto') {
            // 自动：默认按连续2次正确毕业，避免一次答对直接拉长间隔。
            target = 2;
        } else {
            target = masteryTarget;
        }

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
    }, [submitting, currentCard, currentCardIdx, sessionMastery, masteryTarget, submitAndAdvance]);

    const buildAutoOutcome = useCallback((isCorrect: boolean, curMastery: number) => {
        const forgotNow = !isCorrect;
        const target = masteryTarget === 'auto' ? 2 : masteryTarget;
        const newMastery = nextMastery(curMastery, isCorrect, target);
        const graduate = newMastery >= target;
        // 毕业且答对时：rating=4（Easy）让 FSRS 立即推到复习阶段（几天后）
        const fsrsRating = graduate
            ? (isCorrect ? 4 : 2)
            : (isCorrect ? 3 : 1);
        return { fsrsRating, newMastery, graduate, forgotNow };
    }, [masteryTarget]);

    const syncCurrentAnsweredBeforeExit = useCallback(async () => {
        if (!currentCard || currentCardIdx < 0) return;

        let outcome: { fsrsRating: number; newMastery: number; graduate: boolean; forgotNow: boolean } | null = null;

        if (mode === 'choice' && choiceSelected !== null && choiceCorrect !== null) {
            const curMastery = sessionMastery[currentCardIdx] ?? 0;
            outcome = buildAutoOutcome(choiceCorrect, curMastery);
        } else if (mode === 'write' && writeSubmitted && writeCorrect !== null) {
            if (quickProficient) {
                outcome = { fsrsRating: 4, newMastery: 4, graduate: true, forgotNow: false };
            } else {
                const curMastery = sessionMastery[currentCardIdx] ?? 0;
                outcome = buildAutoOutcome(writeCorrect, curMastery);
            }
        }

        if (!outcome) return;

        const { card: nextCard } = await submitReviewWithRetry(
            currentCard.word,
            outcome.fsrsRating,
            currentCard.last_review,
            currentCard.plan_id,
        );

        // 计算新的本地状态（不通过 setState，直接用于 sessionStorage）
        const newCards = [...cards];
        newCards[currentCardIdx] = nextCard;

        const newSessionForgot = [...sessionForgot];
        if (outcome.forgotNow) {
            newSessionForgot[currentCardIdx] = true;
        }

        const newSessionMastery = [...sessionMastery];
        newSessionMastery[currentCardIdx] = outcome.newMastery;

        const newSessionErrorCount = [...sessionErrorCount];
        if (outcome.forgotNow) {
            newSessionErrorCount[currentCardIdx] = (newSessionErrorCount[currentCardIdx] ?? 0) + 1;
        }

        let newQueue = queue;
        let newGraduatedCount = graduatedCount;
        if (outcome.graduate) {
            newQueue = queue.slice(1);
            newGraduatedCount = graduatedCount + 1;
            newSessionErrorCount[currentCardIdx] = 0; // 毕业时重置错误计数
        } else {
            newQueue = reinsertAfterGap(queue.slice(1), currentCardIdx);
        }

        // 立即更新 sessionStorage（绕过 React 状态系统）
        // 关键：不调用 setState，避免持久化 useEffect 后续覆盖
        const cache: SessionCache & { planDailyCount?: number } = {
            cards: newCards,
            queue: newQueue,
            sessionMastery: newSessionMastery,
            sessionForgot: newSessionForgot,
            sessionErrorCount: newSessionErrorCount,
            masteryTarget,
            graduatedCount: newGraduatedCount,
            isFlipped,
            step,
            results,
            mode,
        };
        if (planId) cache.planId = planId;
        if (planName) cache.planName = planName;
        if (planDailyCountAtLoad) cache.planDailyCount = planDailyCountAtLoad;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
        
        console.log('[词汇学习] 退出前同步会话到 sessionStorage', {
            word: currentCard.word,
            outcome,
            newGraduatedCount: newGraduatedCount,
            queueLength: newQueue.length,
            planDailyCount: planDailyCountAtLoad,
            navigatingAway: true,
        });
        
        // 标记正在离开，防止持久化 useEffect 执行并覆盖刚保存的状态
        navigatingAwayRef.current = true;
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
        sessionForgot,
        sessionErrorCount,
        cards,
        queue,
        graduatedCount,
        isFlipped,
        step,
        results,
        planId,
        planName,
        planDailyCountAtLoad,
        masteryTarget,
        buildAutoOutcome,
        submitReviewWithRetry,
        reinsertAfterGap,
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
        setGraduatedCount(0);
        setStep('doing');
        setResults([]);
        setLastRating(null);
        setVisitKey(k => k + 1);
    };

    const backPath  = planId ? `/vocabulary/plans/${planId}` : '/vocabulary/plans';
    const backLabel = '返回学习计划';

    /* 评分已实时同步，可直接返回 */
    const handleBack = useCallback(() => {
        if (leaving) return;
        if (submitting) return;
        console.log('[词汇学习] 用户点击返回，开始退出前同步');
        setLeaving(true);
        syncCurrentAnsweredBeforeExit()
            .catch(() => {
                console.error('[词汇学习] 退出前同步失败', new Error('exit_sync_failed'));
                showToast('退出前同步失败，请稍后重试', 'error');
                setLeaving(false);
                throw new Error('exit_sync_failed');
            })
            .then(() => {
                console.log('[词汇学习] 退出前同步成功，导航返回');
                navigate(backPath);
            });
    }, [backPath, navigate, leaving, submitting, syncCurrentAnsweredBeforeExit]);

    /* ── 防止进度丢失：监听页面卸载事件 ── */
    useEffect(() => {
        // 1. beforeunload：用户刷新/关闭/离开时
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // 如果还在学习且有未完成的答题，给出警告
            if (initialized && queue.length > 0) {
                e.preventDefault();
                e.returnValue = '您还有未完成的单词，确定要离开吗？';
                return '您还有未完成的单词，确定要离开吗？';
            }
        };

        // 2. pagehide：用户关闭标签页时（比beforeunload更可靠）
        const handlePageHide = (_e: PageTransitionEvent) => {
            if (!initialized || step === 'result') {
                console.log('[词汇学习] 页面即将隐藏，跳过同步（已完成或未初始化）');
                return;
            }
            
            console.log('[词汇学习] 页面即将隐藏（用户关闭标签页/浏览器），触发紧急同步');
            
            // 关键：pagehide时立即同步，不等待异步完成
            // 因为用户可能已经关闭，异步请求会被中断
            try {
                const ci = queue[0] ?? -1;
                const card = ci >= 0 ? cards[ci] : null;
                if (!card) return;
                
                // 获取当前答题状态
                let outcome: { fsrsRating: number; newMastery: number; graduate: boolean; forgotNow: boolean } | null = null;
                
                if (mode === 'choice' && choiceSelected !== null && choiceCorrect !== null) {
                    const curMastery = sessionMastery[ci] ?? 0;
                    outcome = buildAutoOutcome(choiceCorrect, curMastery);
                } else if (mode === 'write' && writeSubmitted && writeCorrect !== null) {
                    if (quickProficient) {
                        outcome = { fsrsRating: 4, newMastery: 4, graduate: true, forgotNow: false };
                    } else {
                        const curMastery = sessionMastery[ci] ?? 0;
                        outcome = buildAutoOutcome(writeCorrect, curMastery);
                    }
                } else if (mode === 'flashcard' && lastRating !== null) {
                    // 记忆卡模式下，如果已评分就代表有进度
                    outcome = { fsrsRating: lastRating, newMastery: lastRating === 4 ? 4 : 1, graduate: lastRating === 4, forgotNow: lastRating !== 4 };
                }
                
                if (outcome) {
                    // 同步到sessionStorage
                    const newCards = [...cards];
                    newCards[ci] = card;
                    
                    const newSessionMastery = [...sessionMastery];
                    newSessionMastery[ci] = outcome.newMastery;
                    
                    const newSessionForgot = [...sessionForgot];
                    if (outcome.forgotNow) {
                        newSessionForgot[ci] = true;
                    }
                    
                    let newQueue = queue;
                    let newGraduatedCount = graduatedCount;
                    if (outcome.graduate) {
                        newQueue = queue.slice(1);
                        newGraduatedCount = graduatedCount + 1;
                    } else {
                        newQueue = reinsertAfterGap(queue.slice(1), ci);
                    }
                    
                    const cache: SessionCache & { planDailyCount?: number } = {
                        cards: newCards,
                        queue: newQueue,
                        sessionMastery: newSessionMastery,
                        sessionForgot: newSessionForgot,
                        sessionErrorCount: sessionErrorCount,
                        masteryTarget,
                        graduatedCount: newGraduatedCount,
                        isFlipped,
                        step,
                        results,
                        mode,
                    };
                    if (planId) cache.planId = planId;
                    if (planName) cache.planName = planName;
                    if (planDailyCountAtLoad) cache.planDailyCount = planDailyCountAtLoad;
                    
                    sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
                    console.log('[词汇学习] 紧急同步完成（pagehide）', { word: card?.word, outcome });
                    // 注：不使用 sendBeacon，因为缺少 Authorization header 和正确的 Content-Type，后端会拒绝
                }
            } catch (err) {
                console.error('[词汇学习] 紧急同步失败', err);
            }
        };

        // 3. 页面可见性变化：用户切换标签页时
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                console.log('[词汇学习] 页面变成隐藏，同步进度');
                // 隐藏时同步到sessionStorage（确保当前状态被保存）
                if (!navigatingAwayRef.current && queue.length > 0) {
                    const ci = queue[0] ?? -1;
                    if (ci >= 0) {
                        // 简单的sessionStorage更新（不涉及网络请求）
                        const cache: SessionCache & { planDailyCount?: number } = {
                            cards,
                            queue,
                            sessionMastery,
                            sessionForgot,
                            sessionErrorCount,
                            masteryTarget,
                            graduatedCount,
                            isFlipped,
                            step,
                            results,
                            mode,
                        };
                        if (planId) cache.planId = planId;
                        if (planName) cache.planName = planName;
                        if (planDailyCountAtLoad) cache.planDailyCount = planDailyCountAtLoad;
                        sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
                        console.log('[词汇学习] 标签页隐藏时已备份到sessionStorage');
                    }
                }
            }
        };

        if (!initialized) return;

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide as EventListener);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide as EventListener);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [
        initialized, step, queue, mode, 
        choiceSelected, choiceCorrect, writeSubmitted, writeCorrect, quickProficient,
        lastRating, cards, sessionMastery, sessionForgot, sessionErrorCount,
        masteryTarget, graduatedCount, isFlipped, results, planId, planName,
        planDailyCountAtLoad, buildAutoOutcome, reinsertAfterGap, navigatingAwayRef,
    ]);

    /* ── 加载中 ── */
    if (!initialized || (!currentCard && step === 'doing')) {
        return (
            <Layout>
                <div className="config-page-wrap" style={{ textAlign: 'center', paddingTop: '60px' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>加载中…</p>
                </div>
            </Layout>
        );
    }

    const total      = cards.length;
    // 累计每日进度：之前已学 + 本轮毕业数
    const dailyTotal     = planDailyCount > 0 ? planDailyCount : total;
    const dailyDone      = studiedTodayBase + graduatedCount;
    const progress       = dailyTotal > 0 ? Math.min(100, Math.round((dailyDone / dailyTotal) * 100)) : 0;
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
                        <button className="back-link" onClick={handleBack}>{backLabel}</button>
                        <h1>本轮结果{planName ? ` · ${planName}` : ''}</h1>
                        <p>共掌握 <strong>{results.length}</strong> 个单词</p>
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
                        <h3>复习明细</h3>
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
                            <button className="fc-action-btn" onClick={handleRetry}>🔄 再来一轮</button>
                            <button className="fc-action-btn primary" onClick={handleBack}>
                                {backLabel}
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
                    <button className="back-link" onClick={handleBack}>{backLabel}</button>
                    <h1 style={{ marginBottom: '4px' }}>{planName || '记忆卡背诵'}{reviewOnly && <span style={{ fontSize: 13, fontWeight: 500, background: '#dbeafe', color: '#2563eb', padding: '2px 10px', borderRadius: 20, marginLeft: 10, verticalAlign: 'middle' }}>复习模式</span>}</h1>
                </div>

                {/* 进度行 */}
                <div className="fc-header">
                    <span className="fc-counter">
                        ✓ {dailyDone} / {dailyTotal}
                        <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>
                            队列 {queue.length}
                        </span>
                    </span>
                    <div className="fc-header-right">
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
                                            已复习 {currentCard.reps} 次
                                            {currentCard.lapses > 0 && ` · 遗忘 ${currentCard.lapses} 次`}
                                        </div>
                                    )}
                                    <div className="fc-tap-hint">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M12 5v14M5 12l7 7 7-7" />
                                        </svg>
                                        点击翻转查看释义
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
                                        {currentCard.stability > 0 && ` · 稳定性 ${currentCard.stability.toFixed(1)}`}
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
                            Space = 翻转 &nbsp;|&nbsp; 翻牌后按 1 / 2 / 3 / 4 评分（3/4 = 掌握）
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
                                    会
                                </button>
                                <button
                                    className="fc-choice-unknown-btn"
                                    onClick={handleChoiceUnknown}
                                    disabled={submitting}
                                >
                                    不会
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
                                <div className="fc-choice-actions">
                                    {choiceSelected === null && (
                                        <button
                                            className="fc-choice-hide-btn"
                                            onClick={handleChoiceHideQuestion}
                                            disabled={submitting}
                                        >
                                            隐藏
                                        </button>
                                    )}
                                    {choiceSelected === null && (
                                        <button
                                            className="fc-choice-unknown"
                                            onClick={handleChoiceUnknown}
                                            disabled={submitting}
                                        >
                                            不会
                                        </button>
                                    )}
                                    {choiceSelected !== null && (
                                        <button
                                            className="fc-write-next"
                                            onClick={handleChoiceNext}
                                            disabled={submitting}
                                        >
                                            下一个
                                        </button>
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
                                    {/* 首字母提示 */}
                                    {!unknownMode && (
                                        <div className="fc-write-hint">
                                            <span className="fc-write-hint-chars">
                                                {currentCard.word[0]}
                                                {'_'.repeat(currentCard.word.length - 1)}
                                            </span>
                                            <span className="fc-write-hint-len">
                                                {currentCard.word.length}个字母
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
                                    placeholder={unknownMode ? '抄写上方单词…' : '输入英文单词…'}
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
                                    提交 <span className="fc-qa-key">[键盘↵]</span>
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
                                    ↩ 撤销
                                </button>
                            )}
                            {writeSubmitted && (
                                <div className={`fc-write-result ${writeCorrect ? 'correct' : 'wrong'}`}>
                                    <span>
                                        {unknownMode
                                            ? `✓ 已抄写：${currentCard.word}`
                                            : writeCorrect
                                                ? `✓ 正确：${currentCard.word}`
                                                : `✗ 正确答案：${currentCard.word}`}
                                    </span>
                                    <button
                                        className="fc-write-next"
                                        onClick={handleWriteNext}
                                        disabled={submitting}
                                    >
                                        下一个 → <span className="fc-qa-key">[键盘↵]</span>
                                    </button>
                                    <button
                                        className="fc-write-undo"
                                        onClick={handleWriteUndo}
                                        disabled={submitting}
                                    >
                                        ↩ 撤销
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

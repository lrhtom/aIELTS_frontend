import Layout from '../../components/layout/Layout';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard.css';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { submitReviewSafe, type VocabCard } from '../../api/vocab';
import { updatePlanWord } from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../../components/common/Toast';
import FlashcardMode from '../../components/vocabulary/FlashcardMode';
import ChoiceMode from '../../components/vocabulary/ChoiceMode';
import WriteMode from '../../components/vocabulary/WriteMode';
import CopyMode from '../../components/vocabulary/CopyMode';
import GazeMode from '../../components/vocabulary/GazeMode';
import { predictNextDueAt, formatDueLabel } from '../../utils/vocab_due_label';
import {
    type Step,
    type StudyMode,
    type TrackingMode,
    type MasterySetting,
    getSessionKeyCandidates,
    clampCopyRepetitions,
    clampCopyReviewDays,
    countCopies,
} from '../../utils/vocab_flashcard_utils';
import { speakWord } from '../../utils/speak';
import { useLearningTimer, formatLearningDuration } from '../../hooks/useLearningTimer';
import { useChoiceOptionsPool } from '../../hooks/useChoiceOptionsPool';
import { useExitWarning } from '../../hooks/useExitWarning';
import { useVocabFlashcardStore, resetVocabFlashcardStore } from '../../store/vocab_flashcard_store';

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
        t.vocab.ratings.easy,
    ], [t]);

    const estimateInterval = useCallback((card: VocabCard, rating: number): string => {
        const { state, stability: s } = card;
        if (state === 0 || state === 1 || state === 3) {
            if (rating <= 3) return t.vocab.intervals.tomorrow;
            return `${t.vocab.intervals.approx}${Math.max(1, Math.round(s || 4))}${t.vocab.intervals.daysUnit}`;
        }
        if (rating === 1) return t.vocab.intervals.minsAfter.replace('{n}', '5');
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
        return predictNextDueAt(card, rating).toISOString();
    }, []);

    const previewNextDueLabel = useCallback((card: VocabCard, rating: number): string => {
        const now = new Date();
        const due = predictNextDueAt(card, rating, now);
        return formatDueLabel(due, now, {
            today: t.vocab.intervals.today,
            tomorrow: t.vocab.intervals.tomorrow,
        });
    }, [t]);

    const nextMastery = useCallback((current: number, correct: boolean, target: number): number => {
        if (!correct) return 0;
        return Math.min(target, current + 1);
    }, []);

    const {
        todayLearningBaseSeconds,
        sessionLearningSeconds,
        syncLearningTimerOnExit,
    } = useLearningTimer();

    // ── Session store (cards, queue, cycle UI, submit guards) ────────────────
    const cards = useVocabFlashcardStore((s) => s.cards);
    const queue = useVocabFlashcardStore((s) => s.queue);
    const sessionMastery = useVocabFlashcardStore((s) => s.sessionMastery);
    const sessionForgot = useVocabFlashcardStore((s) => s.sessionForgot);
    const sessionErrorCount = useVocabFlashcardStore((s) => s.sessionErrorCount);
    const graduatedCount = useVocabFlashcardStore((s) => s.graduatedCount);
    const visitKey = useVocabFlashcardStore((s) => s.visitKey);
    const results = useVocabFlashcardStore((s) => s.results);

    const isFlipped = useVocabFlashcardStore((s) => s.isFlipped);
    const isFlipping = useVocabFlashcardStore((s) => s.isFlipping);
    const lastRating = useVocabFlashcardStore((s) => s.lastRating);
    const completionDueHint = useVocabFlashcardStore((s) => s.completionDueHint);
    const submitting = useVocabFlashcardStore((s) => s.submitting);
    const leaving = useVocabFlashcardStore((s) => s.leaving);

    const choiceSelected = useVocabFlashcardStore((s) => s.choiceSelected);
    const choiceCorrect = useVocabFlashcardStore((s) => s.choiceCorrect);
    const choiceRevealed = useVocabFlashcardStore((s) => s.choiceRevealed);

    const writeInput = useVocabFlashcardStore((s) => s.writeInput);
    const writeSubmitted = useVocabFlashcardStore((s) => s.writeSubmitted);
    const writeCorrect = useVocabFlashcardStore((s) => s.writeCorrect);
    const unknownMode = useVocabFlashcardStore((s) => s.unknownMode);
    const quickProficient = useVocabFlashcardStore((s) => s.quickProficient);

    const copyInput = useVocabFlashcardStore((s) => s.copyInput);
    const copySubmitted = useVocabFlashcardStore((s) => s.copySubmitted);
    const copyPendingAction = useVocabFlashcardStore((s) => s.copyPendingAction);
    const copyRemaining = useVocabFlashcardStore((s) => s.copyRemaining);
    const copyReviewDaysTemp = useVocabFlashcardStore((s) => s.copyReviewDaysTemp);
    const copyWordVisible = useVocabFlashcardStore((s) => s.copyWordVisible);

    const initSession = useVocabFlashcardStore((s) => s.initSession);
    const advanceQueue = useVocabFlashcardStore((s) => s.advanceQueue);
    const retrySession = useVocabFlashcardStore((s) => s.retrySession);
    const setIsFlipped = useVocabFlashcardStore((s) => s.setIsFlipped);
    const setIsFlipping = useVocabFlashcardStore((s) => s.setIsFlipping);
    const setLastRating = useVocabFlashcardStore((s) => s.setLastRating);
    const setCompletionDueHint = useVocabFlashcardStore((s) => s.setCompletionDueHint);
    const setSubmitting = useVocabFlashcardStore((s) => s.setSubmitting);
    const setLeaving = useVocabFlashcardStore((s) => s.setLeaving);
    const setChoiceSelected = useVocabFlashcardStore((s) => s.setChoiceSelected);
    const setChoiceCorrect = useVocabFlashcardStore((s) => s.setChoiceCorrect);
    const setChoiceRevealed = useVocabFlashcardStore((s) => s.setChoiceRevealed);
    const setWriteInput = useVocabFlashcardStore((s) => s.setWriteInput);
    const setWriteSubmitted = useVocabFlashcardStore((s) => s.setWriteSubmitted);
    const setWriteCorrect = useVocabFlashcardStore((s) => s.setWriteCorrect);
    const setUnknownMode = useVocabFlashcardStore((s) => s.setUnknownMode);
    const setQuickProficient = useVocabFlashcardStore((s) => s.setQuickProficient);
    const setCopyInput = useVocabFlashcardStore((s) => s.setCopyInput);
    const setCopySubmitted = useVocabFlashcardStore((s) => s.setCopySubmitted);
    const setCopyPendingAction = useVocabFlashcardStore((s) => s.setCopyPendingAction);
    const setCopyRemaining = useVocabFlashcardStore((s) => s.setCopyRemaining);
    const setCopyReviewDaysTemp = useVocabFlashcardStore((s) => s.setCopyReviewDaysTemp);
    const setCopyWordVisible = useVocabFlashcardStore((s) => s.setCopyWordVisible);
    const patchCard = useVocabFlashcardStore((s) => s.patchCard);

    // ── Page-local state (configuration, init flags, transient menu state) ──
    const [step, setStep] = useState<Step>('doing');
    const [initialized, setInitialized] = useState(false);
    const [planId, setPlanId] = useState<number | null>(null);
    const [planName, setPlanName] = useState('');
    const [planDailyCount, setPlanDailyCount] = useState(0);
    const [studiedTodayBase, setStudiedTodayBase] = useState(0);
    const [mode, setMode] = useState<StudyMode>('flashcard');
    const [trackingMode, setTrackingMode] = useState<TrackingMode>('none');
    const [trackingMenuOpen, setTrackingMenuOpen] = useState(false);
    const [masteryTarget, setMasteryTarget] = useState<MasterySetting>(2);
    const [copyRepetitions, setCopyRepetitions] = useState(3);
    const [copyReviewDays, setCopyReviewDays] = useState(2);
    const [copyWordHidden, setCopyWordHidden] = useState(false);
    const [isPeeking, setIsPeeking] = useState(false);
    const [reviewOnly, setReviewOnly] = useState(false);
    const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(() => {
        try {
            const cached = localStorage.getItem('vocab_auto_pronounce_enabled');
            if (cached !== null) return cached === 'true';
        } catch {
            // ignore
        }
        return true;
    });

    const trackingMenuRef = useRef<HTMLDivElement | null>(null);
    const submittedFsrsIndices = useRef<Set<number>>(new Set());

    // Reset store on unmount so a fresh visit starts clean.
    useEffect(() => {
        const submittedRef = submittedFsrsIndices;
        return () => {
            resetVocabFlashcardStore();
            submittedRef.current.clear();
        };
    }, []);

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

    const toggleAutoSpeak = useCallback(() => {
        setAutoSpeakEnabled((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('vocab_auto_pronounce_enabled', String(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    /**
     * 根据错误次数动态调整重新插入的位置：
     * - 第1次错：放到后10个位置
     * - 第2次错：放到后20个位置
     * - 依此类推，直到队尾
     */
    const reinsertAfterGap = useCallback((rest: number[], cardIndex: number) => {
        const errorCount = sessionErrorCount[cardIndex] ?? 0;
        const gap = Math.min((errorCount + 1) * 10, rest.length);
        const insertPos = Math.min(gap, rest.length);
        return [...rest.slice(0, insertPos), cardIndex, ...rest.slice(insertPos)];
    }, [sessionErrorCount]);

    /**
     * 写模式专用后插公式（独立于其他模式）：
     * 第1次错放到后5个，每多错一次后移1个，最多10个。
     */
    const reinsertAfterGapForWrite = useCallback((rest: number[], cardIndex: number) => {
        const errorCount = sessionErrorCount[cardIndex] ?? 0;
        const gap = Math.min(errorCount + 5, 10, rest.length);
        return [...rest.slice(0, gap), cardIndex, ...rest.slice(gap)];
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
            copyRepetitions?: number;
            copyReviewDays?: number;
            reviewOnly?: boolean;
            forceNewSession?: boolean;
        } | null;

        const incomingPlanId = state?.planId ?? null;
        const incomingSessionKeyCandidates = getSessionKeyCandidates(incomingPlanId, userSessionScope);

        // 安全优先：每次进入学习页都清理本地会话缓存。
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

        if (!state?.cards?.length) {
            const fallback = state?.planId ? `/vocabulary/plans/${state.planId}` : '/vocabulary/plans';
            navigate(fallback, { replace: true });
            return;
        }

        initSession({
            cards: state.cards,
            copyRepetitions: fallbackCopyRepetitions,
            copyReviewDays: fallbackCopyReviewDays,
        });

        setCopyRepetitions(fallbackCopyRepetitions);
        setCopyReviewDays(fallbackCopyReviewDays);
        setCopyWordHidden(false);
        if (state.planId) setPlanId(state.planId);
        if (state.planName) setPlanName(state.planName);

        let resolvedMode: StudyMode = 'flashcard';
        if (state.mode) {
            resolvedMode = state.mode;
            console.log('[词汇学习] Mode从location.state恢复', { mode: state.mode });
        } else if (state.planId) {
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
        setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* Mode同步到localStorage（作为长期持久化备份） */
    useEffect(() => {
        if (!initialized || !planId) return;
        if (mode && ['flashcard', 'flashcard-simple', 'choice', 'write', 'copy'].includes(mode)) {
            localStorage.setItem(`lp_study_mode_${planId}`, mode);
        }
    }, [mode, planId, initialized]);

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

    const choices = useChoiceOptionsPool({ mode, cards, queue, visitKey });

    /* 队列清空 → 直接进入结果页（评分已实时同步） */
    useEffect(() => {
        if (!initialized || step !== 'doing' || queue.length !== 0 || graduatedCount === 0) return;
        setStep('result');
    }, [queue, initialized, step, graduatedCount]);

    const currentCardIdx = queue[0] ?? -1;
    const currentCard    = currentCardIdx >= 0 ? cards[currentCardIdx] : null;

    /* ── 核心：每次作答实时提交，再推进队列 ── */
    const submitAndAdvance = useCallback(async (
        ci: number,
        card: VocabCard,
        fsrsRating: number,
        newMastery: number,
        graduate: boolean,
        forgotNow: boolean,
    ) => {
        let updatedCard: VocabCard = card;
        let shouldSubmitFsrs = false;

        if (!reviewOnly) {
            const hasSubmittedMistake = submittedFsrsIndices.current.has(ci);
            if (graduate) {
                shouldSubmitFsrs = true;
            } else if (forgotNow && !hasSubmittedMistake) {
                shouldSubmitFsrs = true;
                submittedFsrsIndices.current.add(ci);
            }
        }

        if (shouldSubmitFsrs) {
            try {
                const { card: nextCard } = await submitReviewSafe(
                    card.word,
                    fsrsRating,
                    card.last_review,
                    card.plan_id,
                );
                if (nextCard) {
                    updatedCard = nextCard;
                }
            } catch {
                showToast(t.vocab.toastSyncFail || '评分同步失败，请检查网络后重试', 'error');
                submittedFsrsIndices.current.delete(ci);
                setSubmitting(false);
                return;
            }
        }

        const reinsert = mode === 'write' ? reinsertAfterGapForWrite : reinsertAfterGap;

        advanceQueue({
            cardIndex: ci,
            graduate,
            forgotNow,
            newMastery,
            updatedCard: shouldSubmitFsrs && updatedCard !== card ? updatedCard : null,
            graduateResult: graduate
                ? {
                      word: updatedCard.word,
                      zh: updatedCard.zh,
                      rating: fsrsRating,
                      newDue: updatedCard.due,
                      scheduledDays: updatedCard.scheduled_days,
                  }
                : null,
            completionDueHint: graduate
                ? { word: updatedCard.word, dueAt: updatedCard.due }
                : null,
            reinsert,
            copyWordHidden,
        });
    }, [
        advanceQueue,
        reinsertAfterGap,
        reinsertAfterGapForWrite,
        reviewOnly,
        mode,
        t.vocab.toastSyncFail,
        copyWordHidden,
        setSubmitting,
    ]);

    /**
     * 记忆卡手动评分
     * - rating>=3（一般/容易）：毕业
     * - rating 1/2（忘了/困难）：重入队列
     *
     * 翻转防偷瞄：评分时如果当前是背面，先触发翻回动画并等 350ms 再切下一张。
     */
    const handleFlashcardRating = useCallback(async (rating: number) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        setLastRating(rating);

        if (mode === 'flashcard' && isFlipped) {
            setIsFlipping(true);
            setIsFlipped(false);
            await new Promise<void>((resolve) => setTimeout(resolve, 350));
            setIsFlipping(false);
        }

        const ci         = currentCardIdx;
        const isCorrect  = rating >= 3;
        const forgotNow  = !isCorrect;
        const newMastery = isCorrect ? 4 : 1;
        const graduate   = isCorrect;
        await submitAndAdvance(ci, currentCard, rating, newMastery, graduate, forgotNow);
    }, [
        submitting,
        currentCard,
        currentCardIdx,
        submitAndAdvance,
        mode,
        isFlipped,
        setSubmitting,
        setLastRating,
        setIsFlipping,
        setIsFlipped,
    ]);

    const resolveAutoMasteryTarget = useCallback((cardIndex: number, currentMode: StudyMode): number => {
        if (currentMode === 'choice') {
            const hasWrongHistory = (sessionErrorCount[cardIndex] ?? 0) > 0 || Boolean(sessionForgot[cardIndex]);
            return hasWrongHistory ? 2 : 1;
        }
        if (masteryTarget === 'auto') return 2;
        return masteryTarget;
    }, [masteryTarget, sessionErrorCount, sessionForgot]);

    /* 4选1 / 写单词：自动评分并按对应模式的目标次数毕业 */
    const handleAutoRating = useCallback(async (isCorrect: boolean) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        const ci         = currentCardIdx;
        const curMastery = sessionMastery[ci] ?? 0;
        const forgotNow  = !isCorrect;

        const target = resolveAutoMasteryTarget(ci, mode);
        const newMastery = nextMastery(curMastery, isCorrect, target);
        const graduate = newMastery >= target;

        // 评分策略：答对未毕业→Good(3) 答错未毕业→Again(1) 答对毕业→Easy(4) 答错毕业→Hard(2)
        const fsrsRating = graduate ? (isCorrect ? 4 : 2) : (isCorrect ? 3 : 1);
        const uiRating = isCorrect ? 3 : 1;

        setLastRating(uiRating);
        await submitAndAdvance(ci, currentCard, fsrsRating, newMastery, graduate, forgotNow);
    }, [
        submitting,
        currentCard,
        currentCardIdx,
        sessionMastery,
        mode,
        resolveAutoMasteryTarget,
        submitAndAdvance,
        nextMastery,
        setSubmitting,
        setLastRating,
    ]);

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
        const fsrsRating = graduate ? (isCorrect ? 4 : 2) : (isCorrect ? 3 : 1);
        return { fsrsRating, newMastery, graduate, forgotNow };
    }, [resolveAutoMasteryTarget, nextMastery]);

    const syncCurrentAnsweredBeforeExit = useCallback(async () => {
        if (!currentCard || currentCardIdx < 0) return;

        let outcome: { fsrsRating: number; newMastery: number; graduate: boolean; forgotNow: boolean } | null = null;

        if (mode === 'choice' && choiceSelected !== null && choiceCorrect !== null) {
            const curMastery = sessionMastery[currentCardIdx] ?? 0;
            outcome = buildAutoOutcome(choiceCorrect, curMastery, currentCardIdx, 'choice');
        }

        if (!outcome) return;

        if (submittedFsrsIndices.current.has(currentCardIdx)) {
            console.log('[词汇学习] 退出前检测到当前词已提交过 FSRS，跳过补交');
            return;
        }

        const { card: nextCard } = await submitReviewSafe(
            currentCard.word,
            outcome.fsrsRating,
            currentCard.last_review,
            currentCard.plan_id,
        );

        console.log('[词汇学习] 退出前已补交当前作答到后端', {
            word: currentCard.word,
            fsrsRating: outcome.fsrsRating,
            syncedDue: nextCard?.due,
        });
    }, [currentCard, currentCardIdx, mode, choiceSelected, choiceCorrect, sessionMastery, buildAutoOutcome]);

    /* 4选1 前置：点击"会"展开题目 */
    const handleChoiceKnow = useCallback(() => {
        if (submitting || choiceSelected !== null) return;
        setChoiceRevealed(true);
    }, [submitting, choiceSelected, setChoiceRevealed]);

    /* 4选1 点击（仅记录选择，不自动进入下一题） */
    const handleChoice = useCallback((opt: { zh: string; correct: boolean }, idx: number) => {
        if (choiceSelected !== null || submitting) return;
        setChoiceSelected(idx);
        setChoiceCorrect(opt.correct);
        setLastRating(opt.correct ? 3 : 1);

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
        setChoiceSelected,
        setChoiceCorrect,
        setLastRating,
        setCompletionDueHint,
    ]);

    /* 4选1 点击"不会" */
    const handleChoiceUnknown = useCallback(() => {
        if (choiceSelected !== null || submitting) return;
        setChoiceSelected(-1);
        setChoiceCorrect(false);
        setChoiceRevealed(true);
        setLastRating(1);
    }, [choiceSelected, submitting, setChoiceSelected, setChoiceCorrect, setChoiceRevealed, setLastRating]);

    /* 4选1 隐藏题目回到初始选择状态 */
    const handleChoiceHideQuestion = useCallback(() => {
        if (submitting) return;
        setChoiceRevealed(false);
        setChoiceSelected(null);
        setChoiceCorrect(null);
    }, [submitting, setChoiceRevealed, setChoiceSelected, setChoiceCorrect]);

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
            setWriteCorrect(false);
            setWriteSubmitted(true);
        } else {
            const isCorrect = input === target;
            setWriteCorrect(isCorrect);
            setWriteSubmitted(true);

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
        setWriteInput,
        setWriteCorrect,
        setWriteSubmitted,
        setCompletionDueHint,
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
    }, [
        writeSubmitted,
        submitting,
        writeCorrect,
        quickProficient,
        currentCardIdx,
        currentCard,
        submitAndAdvance,
        handleAutoRating,
        setSubmitting,
    ]);

    /* 快速自评 */
    const handleQuickAssess = useCallback((correct: boolean) => {
        if (writeSubmitted || submitting || !currentCard) return;
        if (!correct) {
            setUnknownMode(true);
        } else {
            setQuickProficient(true);
            setWriteCorrect(true);
            setWriteSubmitted(true);
            setCompletionDueHint({
                word: currentCard.word,
                dueAt: predictDueAtFromRating(currentCard, 4),
            });
        }
    }, [
        writeSubmitted,
        submitting,
        currentCard,
        predictDueAtFromRating,
        setUnknownMode,
        setQuickProficient,
        setWriteCorrect,
        setWriteSubmitted,
        setCompletionDueHint,
    ]);

    /* 撤销：回到初始写题状态（不会/熟练选择页） */
    const handleWriteUndo = useCallback(() => {
        setWriteInput('');
        setWriteSubmitted(false);
        setWriteCorrect(null);
        setUnknownMode(false);
        setQuickProficient(false);
    }, [setWriteInput, setWriteSubmitted, setWriteCorrect, setUnknownMode, setQuickProficient]);

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
        if (currentRemaining <= 0) return;

        const correctCount = countCopies(copyInput, currentCard.word);
        if (correctCount < currentRemaining) {
            showToast(`抄写次数不足，需完整抄写 ${currentRemaining} 次`, 'error');
            return;
        }

        const remainingAfterSubmit = 0;
        let dueAt = currentCard.due;
        let scheduledDays = currentCard.scheduled_days ?? 0;
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

                patchCard(currentCardIdx, {
                    ...currentCard,
                    due: dueAt,
                    scheduled_days: scheduledDays,
                    state: entry.fsrs_state,
                    last_review: new Date().toISOString(),
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

        if (remainingAfterSubmit === 0) {
            setCompletionDueHint({ word: currentCard.word, dueAt });
        }

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
        patchCard,
        setSubmitting,
        setCopyPendingAction,
        setCompletionDueHint,
        setCopyWordVisible,
        setCopySubmitted,
    ]);

    const handleCopyNext = useCallback(() => {
        if (submitting || !copySubmitted || !copyPendingAction) return;

        const { cardIndex, remainingAfterSubmit, completed, dueAt, scheduledDays } = copyPendingAction;
        const card = cards[cardIndex];

        setCopyRemaining((prev) => {
            const next = [...prev];
            next[cardIndex] = remainingAfterSubmit;
            return next;
        });

        // Reuse the same advance pipeline for the queue + UI reset cascade.
        advanceQueue({
            cardIndex,
            graduate: completed,
            forgotNow: false,
            newMastery: completed ? 4 : 3,
            updatedCard: null,
            graduateResult: completed && card
                ? { word: card.word, zh: card.zh, rating: 4, newDue: dueAt, scheduledDays }
                : null,
            completionDueHint: completed && card ? { word: card.word, dueAt } : null,
            reinsert: reinsertAfterGap,
            copyWordHidden,
        });
        setLastRating(completed ? 4 : 3);
    }, [
        submitting,
        copySubmitted,
        copyPendingAction,
        cards,
        reinsertAfterGap,
        advanceQueue,
        copyWordHidden,
        setCopyRemaining,
        setLastRating,
    ]);

    const toggleCopyWordHiddenPreference = useCallback(() => {
        const newHidden = !copyWordHidden;
        setCopyWordHidden(newHidden);
        if (!copySubmitted) {
            setCopyWordVisible(!newHidden);
        }
    }, [copyWordHidden, copySubmitted, setCopyWordVisible]);

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
                    setIsFlipped(!isFlipped);
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
    }, [step, isFlipped, submitting, handleFlashcardRating, mode, setIsFlipped, setIsFlipping]);

    /* 键盘快捷键（写单词模式）：快速自评可用时（输入框为空、未提交）：↑ 熟练  ↓ 不会 */
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
    const handleRetry = useCallback(() => {
        retrySession(copyRepetitions, copyReviewDays, copyWordHidden);
        setStep('doing');
    }, [retrySession, copyRepetitions, copyReviewDays, copyWordHidden]);

    const backPath  = planId ? `/vocabulary/plans/${planId}` : '/vocabulary/plans';

    /* 评分已实时同步，可直接返回 */
    const handleBack = useCallback(() => {
        if (leaving || submitting) return;
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
    }, [backPath, navigate, leaving, submitting, syncCurrentAnsweredBeforeExit, syncLearningTimerOnExit, setLeaving]);

    /* ── 离页保护：仅做提示和学习时长同步，不再持久化单词会话 ── */
    useExitWarning({
        enabled: initialized,
        hasPendingWork: queue.length > 0,
        exitConfirmMessage: t.vocab.exitConfirm,
        onPageHide: useCallback(() => {
            void syncLearningTimerOnExit(true);
        }, [syncLearningTimerOnExit]),
    });

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
        const counts = [1, 2, 3, 4].map((r) => results.filter((x) => x.rating === r).length);
        return (
            <Layout>
                <div className="config-page-wrap">
                    <div className="config-card">
                        <div className="fc-result-stats">
                            {[0, 1, 2, 3].map((i) => (
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
                                onClick={() => mode.startsWith('flashcard') && setTrackingMenuOpen((v) => !v)}
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
                                    {(['flashcard', 'flashcard-simple'] as StudyMode[]).map((m) => (
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
                                    {(['none', 'eye', 'mouse'] as TrackingMode[]).map((tm) => (
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
                            setIsFlipped(!isFlipped);
                            setTimeout(() => setIsFlipping(false), 350);
                        }}
                        onRating={handleFlashcardRating}
                        estimateInterval={estimateInterval}
                        previewNextDueLabel={previewNextDueLabel}
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
                            setIsFlipped(!isFlipped);
                            setTimeout(() => setIsFlipping(false), 350);
                        }}
                        onRating={handleFlashcardRating}
                        estimateInterval={estimateInterval}
                        previewNextDueLabel={previewNextDueLabel}
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

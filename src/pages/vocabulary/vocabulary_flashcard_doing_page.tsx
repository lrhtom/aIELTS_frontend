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
import ReadAloudMode from '../../components/vocabulary/ReadAloudMode';
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
    summariseWordBuckets,
} from '../../utils/vocab_flashcard_utils';
import {
    emptyProgress, localDateKey, loadTodayProgress, saveTodayProgress,
    recordGraduation, recordRating, todayWords, type TodayProgress,
} from '../../utils/vocab_today_progress';
import { speakWord } from '../../utils/speak';
import { previewInterval, elapsedCalendarDays } from '../../utils/fsrs';
import { devLog } from '../../utils/devLog';
import { useLearningTimer, formatLearningDuration } from '../../hooks/useLearningTimer';
import { useChoiceOptionsPool } from '../../hooks/useChoiceOptionsPool';
import { useExitWarning } from '../../hooks/useExitWarning';
import { useVocabFlashcardStore, resetVocabFlashcardStore } from '../../store/vocab_flashcard_store';

export default function VocabularyFlashcardDoingPage() {
    const { t } = useLang();
    const { user } = useAuth();
    const location = useLocation();
    const navigate  = useNavigate();
    const userSessionScope = user?.id ?? null;

    const STATE_LABELS: Record<number, string> = useMemo(() => ({
        0: t('vocab.status.new'),
        1: t('vocab.status.learning'),
        2: t('vocab.status.review'),
        3: t('vocab.status.relearn'),
    }), [t]);

    const MODE_LABELS: Record<StudyMode, string> = useMemo(() => ({
        flashcard: t('vocab.modes.flashcard'),
        'flashcard-simple': t('vocab.modes.flashcardSimple'),
        'read-aloud': t('vocab.modes.readAloud'),
        choice:    t('vocab.modes.choice'),
        write:     t('vocab.modes.write'),
        copy:      t('vocab.modes.copy'),
        article_copy: t('vocab.modes.articleCopy'),
        story_mode: t('vocab.modes.storyMode'),
    }), [t]);

    const TRACKING_LABELS: Record<TrackingMode, string> = useMemo(() => ({
        none:  t('vocab.flashcardTracking.none'),
        eye:   t('vocab.flashcardTracking.eye'),
        mouse: t('vocab.flashcardTracking.mouse'),
    }), [t]);

    const RS_CLASSES = ['rs-again', 'rs-hard', 'rs-good', 'rs-easy'];
    /**
     * Summary labels. Bucket 0 is deliberately NOT the rating name "Again":
     * it counts words that were forgotten at some point and then graduated, so
     * "Relearned" is what actually happened. Calling it Again invites reading
     * the row as a rating histogram, which is what made the old per-click
     * numbers so confusing.
     */
    const RS_WORD_LABELS = useMemo(() => [
        t('vocab.flashcardDoing.bucketRelearned'),
        t('vocab.ratings.hard'),
        t('vocab.ratings.good'),
        t('vocab.ratings.easy'),
    ], [t]);

    /**
     * The line under each rating button saying how many days away the card lands.
     *
     * It runs the scheduler in utils/fsrs.ts, ported verbatim from the backend's `fsrs_utils.py`,
     * so the number shown **is** the interval the backend will actually schedule (`fsrs.golden.test.ts`
     *
     * pins it against a golden table exported from the backend).
     * Do not go back to the old coefficient estimate (Hard x0.6 / Good x1.0 / Easy x1.5): checked against real
     * cards, 14 of 24 combinations were wrong, and Hard was wrong in *direction* - in real FSRS a successful
     */
    const estimateInterval = useCallback((card: VocabCard, rating: number): string => {
        const { scheduledDays } = previewInterval({
            state: card.state,
            stability: card.stability,
            difficulty: card.difficulty,
            elapsedDays: elapsedCalendarDays(card.last_review),
        }, rating);
        //recall only ever grows stability, even when rated Hard. Measured on the 'abbreviation' card: it showed 89 days, actual 182.
        if (scheduledDays === 0) return t('vocab.intervals.minsAfter').replace('{n}', '5');
        if (scheduledDays === 1) return t('vocab.intervals.tomorrow');
        return t('vocab.intervals.daysAfter').replace('{n}', String(scheduledDays));
    }, [t]);

    const formatDue = useCallback((isoStr: string): string => {
        if (!isoStr) return t('vocab.intervals.toSync');
        const diff = new Date(isoStr).getTime() - Date.now();
        const mins = Math.round(diff / 60000);
        if (mins <= 0) return t('vocab.intervals.today');
        if (mins < 60) return t('vocab.intervals.minsAfter').replace('{n}', mins.toString());
        const days = Math.round(diff / 86400000);
        if (days < 2) return t('vocab.intervals.tomorrow');
        return t('vocab.intervals.daysAfter').replace('{n}', days.toString());
    }, [t]);

    const formatDueDate = useCallback((isoStr: string): string => {
        if (!isoStr) return t('vocab.intervals.toSync');
        const date = new Date(isoStr);
        if (Number.isNaN(date.getTime())) return t('vocab.intervals.toSync');
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
            today: t('vocab.intervals.today'),
            tomorrow: t('vocab.intervals.tomorrow'),
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
    // `allRatings` deliberately not read here: the summary reports TODAY, and
    // the store only knows this session. Today's click totals come from
    // todayProgress instead. The store still records it for its own tests and
    // for anything that genuinely wants just this session.

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
    // scheduledDays = 0 is the Review-stage Again branch: it comes back in 5 minutes, same day
    // On a cold start (typed URL / refresh / opened by a tool like Lighthouse) location.state is empty,
    // so there are no cards to study. Render an explanatory page rather than navigating away silently - a silent
    // redirect reads as a crash to the user, and audit tools cannot measure a page that redirects immediately.
    const [noSession, setNoSession] = useState(false);
    const [planId, setPlanId] = useState<number | null>(null);
    const [planName, setPlanName] = useState('');
    const [planDailyCount, setPlanDailyCount] = useState(0);
    const [studiedTodayBase, setStudiedTodayBase] = useState(0);
    /**
     * Everything studied TODAY, not just this session — the results screen is
     * meant to answer "what did I get through today". Accumulated locally
     * because no review log exists server-side; see utils/vocab_today_progress.
     */
    const [todayProgress, setTodayProgress] = useState<TodayProgress>(() => emptyProgress(localDateKey()));
    /**
     * Refs so the answer handler can persist without taking these as deps —
     * adding them would rebuild the callback on every card and defeat the
     * memoisation the rest of the page relies on.
     */
    const planIdRef = useRef<number | null>(null);
    const userScopeRef = useRef<string | null>(null);
    const sessionForgotRef = useRef<boolean[]>([]);
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
    const [cardFrontFace, setCardFrontFace] = useState<'en' | 'zh'>(() => {
        try {
            const cached = localStorage.getItem('vocab_card_front_face');
            if (cached === 'zh' || cached === 'en') return cached;
        } catch {
            // ignore
        }
        return 'en';
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

    const setFrontFace = useCallback((face: 'en' | 'zh') => {
        setCardFrontFace(face);
        try {
            localStorage.setItem('vocab_card_front_face', face);
        } catch {
            // ignore
        }
    }, []);

    /**
     *  Note: this deliberately does not restore the session. 'A refresh loses your progress' is by design (see the cache clearing before initSession).
     * Push a wrong card back into the queue at a distance that grows with the mistake count:
     * - 1st mistake: 10 positions back
     * - 2nd mistake: 20 positions back
     */
    const reinsertAfterGap = useCallback((rest: number[], cardIndex: number) => {
        const errorCount = sessionErrorCount[cardIndex] ?? 0;
        const gap = Math.min((errorCount + 1) * 10, rest.length);
        const insertPos = Math.min(gap, rest.length);
        return [...rest.slice(0, insertPos), cardIndex, ...rest.slice(insertPos)];
    }, [sessionErrorCount]);

    /**
     * - and so on, up to the end of the queue
     * Re-insertion formula specific to the writing mode (independent of the others):
     */
    const reinsertAfterGapForWrite = useCallback((rest: number[], cardIndex: number) => {
        const errorCount = sessionErrorCount[cardIndex] ?? 0;
        const gap = Math.min(errorCount + 5, 10, rest.length);
        return [...rest.slice(0, gap), cardIndex, ...rest.slice(gap)];
    }, [sessionErrorCount]);

    /* Initialise the session from location.state (handed over by the plan page's start action) */
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

        // initialise
        incomingSessionKeyCandidates.forEach((key) => sessionStorage.removeItem(key));
        devLog('[词汇学习] 开始学习时已清理本地会话缓存，刷新/中断不保留单词进度', {
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
            // Safety first: clear the local session cache on every entry to the study page.
            if (state?.planId) setPlanId(state.planId);
            setNoSession(true);
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
            devLog('[词汇学习] Mode从location.state恢复', { mode: state.mode });
        } else if (state.planId) {
            const cachedMode = localStorage.getItem(`lp_study_mode_${state.planId}`) as StudyMode | null;
            if (cachedMode && ['flashcard', 'flashcard-simple', 'read-aloud', 'choice', 'write', 'copy'].includes(cachedMode)) {
                resolvedMode = cachedMode;
                devLog('[词汇学习] Mode从localStorage恢复', { mode: cachedMode, planId: state.planId });
            } else {
                devLog('[词汇学习] Mode使用默认值flashcard');
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

    /* Keep the answer handler's refs current without making it re-create per card */
    useEffect(() => { planIdRef.current = planId; }, [planId]);
    useEffect(() => { userScopeRef.current = user?.username ?? null; }, [user?.username]);
    useEffect(() => { sessionForgotRef.current = sessionForgot; }, [sessionForgot]);

    /* Pick today's tally back up, so a second session of the day adds to the
       first instead of restarting the count. */
    useEffect(() => {
        if (!initialized) return;
        setTodayProgress(loadTodayProgress(planId, user?.username ?? null));
    }, [initialized, planId, user?.username]);

    /* Mirror the study mode into localStorage as a long-term persistence backup */
    useEffect(() => {
        if (!initialized || !planId) return;
        if (mode && ['flashcard', 'flashcard-simple', 'read-aloud', 'choice', 'write', 'copy'].includes(mode)) {
            localStorage.setItem(`lp_study_mode_${planId}`, mode);
        }
    }, [mode, planId, initialized]);

    // Mirror the mode into localStorage (as a long-term persistence backup)
    // canFlip drives the 'you must hear the word before you can flip' rule: a new card starts with flipping
    // locked and unlocks on the TTS onEnd/onError; the 5s fallback covers TTS being cancelled by the next speakWord
    const [canFlip, setCanFlip] = useState(true);

    /* (a cancel fires no onended, which would strand canFlip at false forever).
     *  Every new card auto-plays the word once (in all modes)
     * The setTimeout works around a Chrome cancel/speak race: speak() immediately after cancel() gets swallowed */
    useEffect(() => {
        if (!initialized || queue.length === 0) return;
        if (mode === 'read-aloud') return;
        const word = cards[queue[0]]?.word;
        if (!word) return;

        //Read-aloud mode sequences pronunciation and recognition itself, so skip the outer auto-play to avoid double playback
        const shouldGateFlip = mode === 'flashcard';

        if (!autoSpeakEnabled) {
            if (shouldGateFlip) setCanFlip(true);
            return;
        }

        if (shouldGateFlip) setCanFlip(false);

        let unlocked = false;
        const unlock = () => {
            if (unlocked) return;
            unlocked = true;
            if (shouldGateFlip) setCanFlip(true);
        };

        const speakTimer = setTimeout(() => {
            speakWord(word, { onEnd: unlock, onError: unlock });
        }, 150);
        // Only the plain flashcard needs the flip lock; simple mode has no flip and the other modes are unaffected
        const safetyTimer = setTimeout(unlock, 5000);

        return () => {
            clearTimeout(speakTimer);
            clearTimeout(safetyTimer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey, mode]);

    const choices = useChoiceOptionsPool({ mode, cards, queue, visitKey });

    /* Queue empty -> go straight to the results page (scores are already synced live) */
    useEffect(() => {
        if (!initialized || step !== 'doing' || queue.length !== 0 || graduatedCount === 0) return;
        setStep('result');
    }, [queue, initialized, step, graduatedCount]);

    const currentCardIdx = queue[0] ?? -1;
    const currentCard    = currentCardIdx >= 0 ? cards[currentCardIdx] : null;

    /* queue empty -> go straight to the results page (scores already synced live) */
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
                showToast(t('vocab.toastSyncFail'), 'error');
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
            ratingClicked: fsrsRating,
            completionDueHint: graduate
                ? { word: updatedCard.word, dueAt: updatedCard.due }
                : null,
            reinsert,
            copyWordHidden,
        });

        // Fold this answer into today's running tally. Recorded per answer
        // rather than at the results screen so that leaving mid-session still
        // counts what was actually done — the session itself is never persisted.
        // `forgot` is taken from the store, which is the only place that knows
        // whether this word was already missed earlier in the session.
        setTodayProgress((prev) => {
            let next = recordRating(prev, fsrsRating);
            if (graduate) {
                next = recordGraduation(next, {
                    word: updatedCard.word,
                    zh: updatedCard.zh,
                    rating: fsrsRating,
                    newDue: updatedCard.due,
                    scheduledDays: updatedCard.scheduled_days,
                    forgot: forgotNow || Boolean(sessionForgotRef.current[ci]),
                });
            }
            saveTodayProgress(next, planIdRef.current, userScopeRef.current);
            return next;
        });
    }, [
        advanceQueue,
        reinsertAfterGap,
        reinsertAfterGapForWrite,
        reviewOnly,
        mode,
        t,
        copyWordHidden,
        setSubmitting,
    ]);

    /**
     *  -- Core: submit every answer live, then advance the queue --
     * Manual rating on a flashcard:
     * - rating >= 3 (good / easy): graduate
     *
     * - rating 1 or 2 (forgot / hard): back into the queue
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

    /*Anti-peek flip: if the card is showing its back when rated, play the flip-back animation and wait 350ms before the next card. */
    const handleAutoRating = useCallback(async (isCorrect: boolean) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        const ci         = currentCardIdx;
        const curMastery = sessionMastery[ci] ?? 0;
        const forgotNow  = !isCorrect;

        const target = resolveAutoMasteryTarget(ci, mode);
        const newMastery = nextMastery(curMastery, isCorrect, target);
        const graduate = newMastery >= target;

        // Multiple choice / spelling: auto-rate and graduate at the target repetition count for that mode
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
            devLog('[词汇学习] 退出前检测到当前词已提交过 FSRS，跳过补交');
            return;
        }

        const { card: nextCard } = await submitReviewSafe(
            currentCard.word,
            outcome.fsrsRating,
            currentCard.last_review,
            currentCard.plan_id,
        );

        devLog('[词汇学习] 退出前已补交当前作答到后端', {
            word: currentCard.word,
            fsrsRating: outcome.fsrsRating,
            syncedDue: nextCard?.due,
        });
    }, [currentCard, currentCardIdx, mode, choiceSelected, choiceCorrect, sessionMastery, buildAutoOutcome]);

    /* Rating policy: correct but not graduated -> Good(3), wrong but not graduated -> Again(1), correct and graduated -> Easy(4), wrong and graduated -> Hard(2) */
    const handleChoiceKnow = useCallback(() => {
        if (submitting || choiceSelected !== null) return;
        setChoiceRevealed(true);
    }, [submitting, choiceSelected, setChoiceRevealed]);

    /* Multiple choice, step 1: clicking 'I know it' reveals the question */
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

    /* Multiple choice click (records the selection only, does not auto-advance) */
    const handleChoiceUnknown = useCallback(() => {
        if (choiceSelected !== null || submitting) return;
        setChoiceSelected(-1);
        setChoiceCorrect(false);
        setChoiceRevealed(true);
        setLastRating(1);
    }, [choiceSelected, submitting, setChoiceSelected, setChoiceCorrect, setChoiceRevealed, setLastRating]);

    /* Multiple choice, clicking 'I do not know' */
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

    /* Multiple choice: hide the question and return to the initial choice state */
    const handleWriteSubmit = useCallback(() => {
        if (writeSubmitted || submitting || !writeInput.trim() || !currentCard) return;
        const input  = writeInput.trim().toLowerCase();
        const target = currentCard.word.toLowerCase();
        if (unknownMode) {
            // submit the English spelling
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
            // Copy mode: only a fully correct answer unlocks 'next'; a mistake clears the box to retry
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

    /* quick self-rating */
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

    /* Undo: back to the initial writing state (the 'do not know' / 'know it' choice) */
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
            showToast(t('vocab.flashcardDoing.toastCopyEmpty'), 'error');
            return;
        }
        const currentRemaining = Math.max(0, copyRemaining[currentCardIdx] ?? copyRepetitions);
        if (currentRemaining <= 0) return;

        const correctCount = countCopies(copyInput, currentCard.word);
        if (correctCount < currentRemaining) {
            showToast(t('vocab.flashcardDoing.toastCopyNotEnough').replace('{n}', String(currentRemaining)), 'error');
            return;
        }

        const remainingAfterSubmit = 0;
        let dueAt = currentCard.due;
        let scheduledDays = currentCard.scheduled_days ?? 0;
        const reviewDaysForThisWord = copyReviewDaysTemp[currentCardIdx] ?? copyReviewDays;

        if (remainingAfterSubmit === 0) {
            if (!planId || !currentCard.entry_id) {
                showToast(t('vocab.flashcardDoing.toastEntryMissing'), 'error');
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
                showToast(t('vocab.flashcardDoing.toastWriteBackFail'), 'error');
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

        // Copy mode has no explicit user rating. Derive it from the review-days
        // choice so cards the user pushed far into the future count as Easy,
        // and cards they want back sooner count lower. This replaces the old
        // hard-coded `rating: 4` which made every copy-mode graduation look
        // like Easy in the summary.
        const derivedRating = completed
            ? (scheduledDays >= 15 ? 4
               : scheduledDays >= 7 ? 3
               : scheduledDays >= 3 ? 2
               : 1)
            : 3; // per-round pulse before graduation stays neutral (Good)

        // Reuse the same advance pipeline for the queue + UI reset cascade.
        advanceQueue({
            cardIndex,
            graduate: completed,
            forgotNow: false,
            newMastery: completed ? 4 : 3,
            updatedCard: null,
            graduateResult: completed && card
                ? { word: card.word, zh: card.zh, rating: derivedRating, newDue: dueAt, scheduledDays }
                : null,
            ratingClicked: derivedRating,
            completionDueHint: completed && card ? { word: card.word, dueAt } : null,
            reinsert: reinsertAfterGap,
            copyWordHidden,
        });
        setLastRating(derivedRating);
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

    /* Keyboard shortcuts (flashcard mode) */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step !== 'doing' || submitting || !mode.startsWith('flashcard')) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space':
                    if (mode === 'flashcard-simple') return;
                    // Flipping is blocked while the audio is still playing, but only on the first
                    // flip to the back; once on the back, flipping freely back to the front is allowed.
                    if (!canFlip && !isFlipped) return;
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
    }, [step, isFlipped, submitting, handleFlashcardRating, mode, canFlip, setIsFlipped, setIsFlipping]);

    /* Keyboard shortcuts (spelling mode). While quick self-rating is available (box empty, not yet submitted): up = known, down = do not know */
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

    /* another round */
    const handleRetry = useCallback(() => {
        retrySession(copyRepetitions, copyReviewDays, copyWordHidden);
        setStep('doing');
    }, [retrySession, copyRepetitions, copyReviewDays, copyWordHidden]);

    const backPath  = planId ? `/vocabulary/plans/${planId}` : '/vocabulary/plans';

    /* scores are already synced live, so we can just go back */
    const handleBack = useCallback(() => {
        if (leaving || submitting) return;
        devLog('[词汇学习] 用户点击返回，开始退出前同步');
        setLeaving(true);
        syncCurrentAnsweredBeforeExit()
            .then(() => syncLearningTimerOnExit(false))
            .then(() => {
                devLog('[词汇学习] 退出前同步成功，导航返回');
                navigate(backPath);
            })
            .catch((error) => {
                console.error('[词汇学习] 退出前同步失败', error);
                showToast(t('vocab.flashcardDoing.toastExitSyncFail'), 'error');
                setLeaving(false);
            });
    }, [backPath, navigate, leaving, submitting, syncCurrentAnsweredBeforeExit, syncLearningTimerOnExit, setLeaving]);

    /* -- Leave guard: only prompts and syncs study time; word sessions are no longer persisted -- */
    useExitWarning({
        enabled: initialized,
        hasPendingWork: queue.length > 0,
        exitConfirmMessage: t('vocab.exitConfirm'),
        onPageHide: useCallback(() => {
            void syncLearningTimerOnExit(true);
        }, [syncLearningTimerOnExit]),
    });

    /* -- No session: a cold start or refresh has no cards, so render the explanation page instead of navigating away -- */
    if (noSession) {
        const backTo = planId ? `/vocabulary/plans/${planId}` : '/vocabulary/plans';
        return (
            <Layout
                pageTitle={t('vocab.studyTitle')}
                backUrl={backTo}
                backText={t('common.back')}
            >
                <div className="config-page-wrap fc-nosession">
                    <div className="fc-nosession-icon" aria-hidden="true">🃏</div>
                    <h2 className="fc-nosession-title">{t('vocab.noSessionTitle')}</h2>
                    <p className="fc-nosession-desc">{t('vocab.noSessionDesc')}</p>
                    <div className="fc-nosession-actions">
                        <button
                            type="button"
                            className="fc-nosession-primary"
                            onClick={() => navigate(backTo)}
                        >
                            {planId ? t('vocab.noSessionGoPlan') : t('vocab.noSessionGoPlans')}
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    /* -- No session: a cold start or refresh has no cards, so render the explanation page instead of navigating away -- */
    if (!initialized || (!currentCard && step === 'doing')) {
        return (
            <Layout
                pageTitle={`${t('vocab.resultTitle')}${planName ? ` · ${planName}` : ''}`}
                pageSubtitle={t('vocab.masteredCount').replace('{n}', results.length.toString())}
                backUrl="/vocabulary"
                backText={t('common.back')}
            >
                <div className="config-page-wrap fc-loading">
                    <p>{t('common.loading')}</p>
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

    /* -- Loading -- */
    if (step === 'result') {
        // The summary covers TODAY, not just the session that has ended. Study
        // three words, leave, come back and study three more, and this reads
        // six — reporting only the last few minutes hid everything earlier in
        // the day. The tally is accumulated per answer in
        // utils/vocab_today_progress, so leaving mid-session still counts.
        //
        // Four cards, counted by WORD, one bucket per word — see
        // summariseWordBuckets for the rule and why it is not a click histogram.
        // Per-click totals still appear below, explicitly labelled 次/times.
        const doneToday = todayWords(todayProgress);
        const wordBuckets = summariseWordBuckets(doneToday);
        const totalClicks = todayProgress.ratingClicks.reduce((a, b) => a + b, 0);
        // Forget CLICKS (a word missed three times counts three times here),
        // deliberately a different figure from the relearned WORD count above.
        const totalForgets = todayProgress.ratingClicks[0];
        const graduatedTotal = doneToday.length;
        return (
            <Layout>
                <div className="config-page-wrap">
                    <div className="config-card">
                        <div className="fc-result-stats">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className={`fc-result-stat ${RS_CLASSES[i]}`}>
                                    <div className="rs-num">{wordBuckets[i]}</div>
                                    <div className="rs-label">{RS_WORD_LABELS[i]}</div>
                                </div>
                            ))}
                        </div>
                        {/* Spell out the unit: these are words, one bucket each,
                            so they sum to the graduated count — unlike the
                            per-click totals below. */}
                        <div className="fc-result-stats-hint">
                            {t('vocab.flashcardDoing.wordBucketHint')}
                        </div>
                        <div style={{
                            marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap',
                            justifyContent: 'center', fontSize: 13,
                            color: 'var(--color-text-secondary)',
                        }}>
                            <span>✅ {t('vocab.flashcardDoing.statGraduated')} <strong style={{ color: 'var(--color-text)' }}>{graduatedTotal}</strong> {t('vocab.flashcardDoing.statWordUnit')}</span>
                            <span>🖱 {t('vocab.flashcardDoing.statRated')} <strong style={{ color: 'var(--color-text)' }}>{totalClicks}</strong> {t('vocab.flashcardDoing.statTimesUnit')}</span>
                            <span>❌ {t('vocab.flashcardDoing.statForgot')} <strong style={{ color: totalForgets > 0 ? '#dc2626' : 'var(--color-text)' }}>{totalForgets}</strong> {t('vocab.flashcardDoing.statTimesUnit')}</span>
                        </div>
                    </div>
                    <div className="config-card">
                        <h3>{t('vocab.reviewDetail')}</h3>
                        <ul className="fc-result-list">
                            {doneToday.map((r) => (
                                <li key={r.word} className="fc-result-item">
                                    <span className="fc-ri-word">{r.word}</span>
                                    <span className="fc-ri-zh">{r.zh}</span>
                                    <span className="fc-ri-due">{formatDue(r.newDue)}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="fc-result-actions">
                            <button type="button" className="fc-action-btn" onClick={handleRetry}><RotateCcw size={16} /> {t('vocab.retry')}</button>
                            <button type="button" className="fc-action-btn primary" onClick={handleBack}>
                                {t('common.back')}
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    /* == Results page ======================================================= */
    if (!currentCard) return null;

    return (
        <Layout
            onBack={handleBack}
            backText={t('common.back')}
            pageTitle={
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {planName || t('vocab.studyTitle')}
                    {reviewOnly && <span className="fc-review-badge">{t('vocab.reviewMode')}</span>}
                </span>
            }
        >
            <div className="config-page-wrap fc-doing-page">
                {/* == Study page ========================================================= */}
                <div className="fc-header">
                    <span className="fc-counter">
                        ✓ {dailyDone} / {dailyTotal}
                        <span className="fc-queue-remaining">
                            {t('vocab.queue')} {queue.length}
                        </span>
                    </span>
                    <div className="fc-header-right">
                        <button
                            type="button"
                            className="fc-auto-speak-btn"
                            onClick={toggleAutoSpeak}
                            aria-label={autoSpeakEnabled ? t('vocab.flashcardDoing.autoSpeakDisableAria') : t('vocab.flashcardDoing.autoSpeakEnableAria')}
                        >
                            {autoSpeakEnabled ? <><Volume2 size={14} /> {t('vocab.flashcardDoing.autoSpeakOn')}</> : <><VolumeX size={14} /> {t('vocab.flashcardDoing.autoSpeakOff')}</>}
                        </button>
                        <span className="fc-learning-timer" title={t('vocab.flashcardDoing.timerTitle')}>
                            {t('vocab.flashcardDoing.todayDuration').replace('{t}', todayLearningDuration)}
                        </span>
                        <div className="fc-mode-badge-wrap" ref={trackingMenuRef}>
                            {(() => {
                                const isCardMode = mode.startsWith('flashcard') || mode === 'read-aloud';
                                const isFlashcardOnly = mode.startsWith('flashcard');
                                return (
                                    <>
                                        <button
                                            className={`fc-mode-badge${isCardMode ? ' has-submenu' : ''}`}
                                            onClick={() => isCardMode && setTrackingMenuOpen((v) => !v)}
                                            title={isCardMode ? t('vocab.flashcardDoing.modeMenuTitle') : undefined}
                                        >
                                            {MODE_LABELS[mode]}
                                            {isFlashcardOnly && trackingMode !== 'none' && (
                                                <span className="fc-mode-badge-sub">· {TRACKING_LABELS[trackingMode]}</span>
                                            )}
                                            {isFlashcardOnly && cardFrontFace === 'zh' && (
                                                <span className="fc-mode-badge-sub">{t('vocab.flashcardDoing.zhFrontBadge')}</span>
                                            )}
                                            {isCardMode && <span className="fc-mode-badge-arrow">▾</span>}
                                        </button>
                                        {trackingMenuOpen && isCardMode && (
                                            <div className="fc-tracking-menu">
                                                <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('vocab.flashcardDoing.menuStudyMode')}</div>
                                                {(['flashcard', 'flashcard-simple', 'read-aloud'] as StudyMode[]).map((m) => (
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
                                                {isFlashcardOnly && (
                                                    <>
                                                        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                                                        <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('vocab.flashcardDoing.menuCardFace')}</div>
                                                        {([['en', t('vocab.flashcardDoing.faceEn')], ['zh', t('vocab.flashcardDoing.faceZh')]] as [('en' | 'zh'), string][]).map(([face, label]) => (
                                                            <button
                                                                key={face}
                                                                className={`fc-tracking-menu-item${cardFrontFace === face ? ' active' : ''}`}
                                                                onClick={() => { setFrontFace(face); setTrackingMenuOpen(false); }}
                                                            >
                                                                <span className="fc-tracking-menu-dot" />
                                                                <span>{label}</span>
                                                                {cardFrontFace === face && <span className="fc-tracking-menu-check">✓</span>}
                                                            </button>
                                                        ))}
                                                        <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
                                                        <div style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('vocab.flashcardDoing.menuTracking')}</div>
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
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <span className="fc-state-label-inline">
                            {STATE_LABELS[currentCard.state] ?? ''}
                            {currentCard.reps > 0 && t('vocab.flashcardDoing.reviewTimes').replace('{n}', String(currentCard.reps))}
                        </span>
                    </div>
                </div>
                <div
                    className="fc-progress-bar"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('vocab.flashcardDoing.progressAria')}
                >
                    <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                {/* progress row */}
                {(mode === 'flashcard' || mode === 'flashcard-simple') && trackingMode === 'none' && (
                    <FlashcardMode
                        currentCard={currentCard}
                        isFlipped={isFlipped}
                        isFlipping={isFlipping}
                        statusCls={statusCls}
                        submitting={submitting}
                        canFlip={canFlip || isFlipped}
                        onFlip={() => {
                            if (!canFlip && !isFlipped) return;
                            setIsFlipping(true);
                            setIsFlipped(!isFlipped);
                            setTimeout(() => setIsFlipping(false), 350);
                        }}
                        onRating={handleFlashcardRating}
                        estimateInterval={estimateInterval}
                        previewNextDueLabel={previewNextDueLabel}
                        simpleMode={mode === 'flashcard-simple'}
                        frontFace={cardFrontFace}
                    />
                )}

                {/* == Flashcard mode == */}
                {mode === 'read-aloud' && (
                    <ReadAloudMode
                        currentCard={currentCard}
                        statusCls={statusCls}
                        submitting={submitting}
                        onRating={handleFlashcardRating}
                        estimateInterval={estimateInterval}
                        previewNextDueLabel={previewNextDueLabel}
                    />
                )}

                {/* == Read-aloud mode == */}
                {(mode === 'flashcard' || mode === 'flashcard-simple') && trackingMode !== 'none' && (
                    <GazeMode
                        currentCard={currentCard}
                        isFlipped={isFlipped}
                        isFlipping={isFlipping}
                        statusCls={statusCls}
                        submitting={submitting}
                        trackingMode={trackingMode as 'eye' | 'mouse'}
                        canFlip={canFlip || isFlipped}
                        onFlip={() => {
                            if (!canFlip && !isFlipped) return;
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

                {/* == Flashcard, gaze-tracking mode == */}
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

                {/* == Multiple choice mode == */}
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

                {/* == Chinese-to-English spelling mode == */}
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

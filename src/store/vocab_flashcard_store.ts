import { create } from 'zustand';
import type { VocabCard } from '../api/vocab';
import type {
    CopyPendingAction,
    CompletionDueHint,
    ReviewResult,
    StudyMode,
} from '../utils/vocab_flashcard_utils';

/**
 * Zustand store for the per-session state of the vocabulary flashcard study
 * page. Everything in here is touched by at least one of the multi-slice
 * cascade actions (initSession / advanceQueue / resetCardUI / retrySession);
 * configuration-only fields (mode, masteryTarget, plan info, etc.) stay as
 * useState in the page component.
 */

interface SessionInit {
    cards: VocabCard[];
    copyRepetitions: number;
    copyReviewDays: number;
}

interface AdvanceArgs {
    cardIndex: number;
    graduate: boolean;
    forgotNow: boolean;
    newMastery: number;
    /** New `cards[cardIndex]` (after FSRS sync), or null to keep the existing card. */
    updatedCard: VocabCard | null;
    /** Append-on-graduate. */
    graduateResult: ReviewResult | null;
    /** "Next due" hint shown after graduation. */
    completionDueHint: CompletionDueHint | null;
    /**
     * Pure function that computes the next queue given the queue tail
     * (after popping the head) and the current card index. Lives in the page
     * because it depends on the active `mode`.
     */
    reinsert: (rest: number[], cardIndex: number) => number[];
    /** Whether the copy-word display preference is hide-by-default. */
    copyWordHidden: boolean;
}

export interface VocabFlashcardStore {
    // ── Session ─────────────────────────────────────────────────────────────
    cards: VocabCard[];
    queue: number[];
    sessionMastery: number[];
    sessionForgot: boolean[];
    sessionErrorCount: number[];
    graduatedCount: number;
    visitKey: number;
    results: ReviewResult[];

    // ── Cycle UI flags (reset every time we advance to the next card) ──────
    isFlipped: boolean;
    isFlipping: boolean;
    lastRating: number | null;
    completionDueHint: CompletionDueHint | null;

    choiceSelected: number | null;
    choiceCorrect: boolean | null;
    choiceRevealed: boolean;

    writeInput: string;
    writeSubmitted: boolean;
    writeCorrect: boolean | null;
    unknownMode: boolean;
    quickProficient: boolean;

    copyInput: string;
    copySubmitted: boolean;
    copyPendingAction: CopyPendingAction | null;
    copyRemaining: number[];
    copyReviewDaysTemp: number[];
    copyWordVisible: boolean;

    // ── Submit / leave guards ──────────────────────────────────────────────
    submitting: boolean;
    leaving: boolean;

    // ── Actions ────────────────────────────────────────────────────────────
    initSession: (init: SessionInit) => void;
    resetCardUI: (copyWordVisible: boolean) => void;
    advanceQueue: (args: AdvanceArgs) => void;
    retrySession: (copyRepetitions: number, copyReviewDays: number, copyWordHidden: boolean) => void;

    // Granular setters (used by mode handlers that touch a single slice)
    setIsFlipped: (v: boolean) => void;
    setIsFlipping: (v: boolean) => void;
    setLastRating: (v: number | null) => void;
    setCompletionDueHint: (v: CompletionDueHint | null) => void;
    setSubmitting: (v: boolean) => void;
    setLeaving: (v: boolean) => void;

    setChoiceSelected: (v: number | null) => void;
    setChoiceCorrect: (v: boolean | null) => void;
    setChoiceRevealed: (v: boolean) => void;

    setWriteInput: (v: string) => void;
    setWriteSubmitted: (v: boolean) => void;
    setWriteCorrect: (v: boolean | null) => void;
    setUnknownMode: (v: boolean) => void;
    setQuickProficient: (v: boolean) => void;

    setCopyInput: (v: string) => void;
    setCopySubmitted: (v: boolean) => void;
    setCopyPendingAction: (v: CopyPendingAction | null) => void;
    setCopyRemaining: (v: number[] | ((prev: number[]) => number[])) => void;
    setCopyReviewDaysTemp: (v: number[] | ((prev: number[]) => number[])) => void;
    setCopyWordVisible: (v: boolean) => void;

    /** Used by `submitAndAdvance` to patch a single card after an FSRS sync. */
    patchCard: (cardIndex: number, card: VocabCard) => void;
    /** Used when the user marks the current word as wrong outside the queue update. */
    markForgot: (cardIndex: number) => void;
    incrementErrorCount: (cardIndex: number) => void;
}

const initialCycleUiState = (copyWordVisible: boolean) => ({
    isFlipped: false,
    lastRating: null,
    completionDueHint: null,

    choiceSelected: null,
    choiceCorrect: null,
    choiceRevealed: false,

    writeInput: '',
    writeSubmitted: false,
    writeCorrect: null,
    unknownMode: false,
    quickProficient: false,

    copyInput: '',
    copySubmitted: false,
    copyPendingAction: null,
    copyWordVisible,
}) as const;

export const useVocabFlashcardStore = create<VocabFlashcardStore>((set) => ({
    cards: [],
    queue: [],
    sessionMastery: [],
    sessionForgot: [],
    sessionErrorCount: [],
    graduatedCount: 0,
    visitKey: 0,
    results: [],

    isFlipped: false,
    isFlipping: false,
    lastRating: null,
    completionDueHint: null,

    choiceSelected: null,
    choiceCorrect: null,
    choiceRevealed: false,

    writeInput: '',
    writeSubmitted: false,
    writeCorrect: null,
    unknownMode: false,
    quickProficient: false,

    copyInput: '',
    copySubmitted: false,
    copyPendingAction: null,
    copyRemaining: [],
    copyReviewDaysTemp: [],
    copyWordVisible: true,

    submitting: false,
    leaving: false,

    initSession: ({ cards, copyRepetitions, copyReviewDays }) => {
        const n = cards.length;
        set({
            cards,
            queue: Array.from({ length: n }, (_, i) => i),
            sessionMastery: new Array(n).fill(0),
            sessionForgot: new Array(n).fill(false),
            sessionErrorCount: new Array(n).fill(0),
            copyRemaining: new Array(n).fill(copyRepetitions),
            copyReviewDaysTemp: new Array(n).fill(copyReviewDays),
            graduatedCount: 0,
            results: [],
            visitKey: 1,
            ...initialCycleUiState(true),
            submitting: false,
            leaving: false,
        });
    },

    resetCardUI: (copyWordVisible) => set(initialCycleUiState(copyWordVisible)),

    advanceQueue: ({
        cardIndex,
        graduate,
        forgotNow,
        newMastery,
        updatedCard,
        graduateResult,
        completionDueHint,
        reinsert,
        copyWordHidden,
    }) => {
        set((state) => {
            const cards = updatedCard
                ? state.cards.map((c, i) => (i === cardIndex ? updatedCard : c))
                : state.cards;

            const sessionForgot = forgotNow
                ? state.sessionForgot.map((v, i) => (i === cardIndex ? true : v))
                : state.sessionForgot;

            const sessionErrorCount = forgotNow
                ? state.sessionErrorCount.map((v, i) =>
                      i === cardIndex ? (v ?? 0) + 1 : v,
                  )
                : state.sessionErrorCount;

            const sessionMastery = state.sessionMastery.map((v, i) =>
                i === cardIndex ? newMastery : v,
            );

            const restQueue = state.queue.slice(1);
            const queue = graduate ? restQueue : reinsert(restQueue, cardIndex);

            const resetErrorCount = graduate
                ? sessionErrorCount.map((v, i) => (i === cardIndex ? 0 : v))
                : sessionErrorCount;

            return {
                cards,
                sessionForgot,
                sessionErrorCount: resetErrorCount,
                sessionMastery,
                queue,
                results: graduateResult ? [...state.results, graduateResult] : state.results,
                graduatedCount: graduate ? state.graduatedCount + 1 : state.graduatedCount,
                completionDueHint,
                visitKey: state.visitKey + 1,
                submitting: false,
                ...initialCycleUiState(!copyWordHidden),
            };
        });
    },

    retrySession: (copyRepetitions, copyReviewDays, copyWordHidden) => {
        set((state) => {
            const n = state.cards.length;
            return {
                queue: Array.from({ length: n }, (_, i) => i),
                sessionMastery: new Array(n).fill(0),
                sessionForgot: new Array(n).fill(false),
                sessionErrorCount: new Array(n).fill(0),
                copyRemaining: new Array(n).fill(copyRepetitions),
                copyReviewDaysTemp: new Array(n).fill(copyReviewDays),
                graduatedCount: 0,
                results: [],
                visitKey: state.visitKey + 1,
                ...initialCycleUiState(!copyWordHidden),
                submitting: false,
                leaving: false,
            };
        });
    },

    setIsFlipped: (v) => set({ isFlipped: v }),
    setIsFlipping: (v) => set({ isFlipping: v }),
    setLastRating: (v) => set({ lastRating: v }),
    setCompletionDueHint: (v) => set({ completionDueHint: v }),
    setSubmitting: (v) => set({ submitting: v }),
    setLeaving: (v) => set({ leaving: v }),

    setChoiceSelected: (v) => set({ choiceSelected: v }),
    setChoiceCorrect: (v) => set({ choiceCorrect: v }),
    setChoiceRevealed: (v) => set({ choiceRevealed: v }),

    setWriteInput: (v) => set({ writeInput: v }),
    setWriteSubmitted: (v) => set({ writeSubmitted: v }),
    setWriteCorrect: (v) => set({ writeCorrect: v }),
    setUnknownMode: (v) => set({ unknownMode: v }),
    setQuickProficient: (v) => set({ quickProficient: v }),

    setCopyInput: (v) => set({ copyInput: v }),
    setCopySubmitted: (v) => set({ copySubmitted: v }),
    setCopyPendingAction: (v) => set({ copyPendingAction: v }),
    setCopyRemaining: (v) =>
        set((state) => ({
            copyRemaining: typeof v === 'function' ? v(state.copyRemaining) : v,
        })),
    setCopyReviewDaysTemp: (v) =>
        set((state) => ({
            copyReviewDaysTemp: typeof v === 'function' ? v(state.copyReviewDaysTemp) : v,
        })),
    setCopyWordVisible: (v) => set({ copyWordVisible: v }),

    patchCard: (cardIndex, card) =>
        set((state) => ({
            cards: state.cards.map((c, i) => (i === cardIndex ? card : c)),
        })),
    markForgot: (cardIndex) =>
        set((state) => ({
            sessionForgot: state.sessionForgot.map((v, i) =>
                i === cardIndex ? true : v,
            ),
        })),
    incrementErrorCount: (cardIndex) =>
        set((state) => ({
            sessionErrorCount: state.sessionErrorCount.map((v, i) =>
                i === cardIndex ? (v ?? 0) + 1 : v,
            ),
        })),
}));

/**
 * Reset the store back to its empty defaults — call when the page unmounts so a
 * fresh visit doesn't see leftover state from the previous session.
 */
export function resetVocabFlashcardStore(): void {
    useVocabFlashcardStore.setState({
        cards: [],
        queue: [],
        sessionMastery: [],
        sessionForgot: [],
        sessionErrorCount: [],
        graduatedCount: 0,
        visitKey: 0,
        results: [],
        isFlipped: false,
        isFlipping: false,
        lastRating: null,
        completionDueHint: null,
        choiceSelected: null,
        choiceCorrect: null,
        choiceRevealed: false,
        writeInput: '',
        writeSubmitted: false,
        writeCorrect: null,
        unknownMode: false,
        quickProficient: false,
        copyInput: '',
        copySubmitted: false,
        copyPendingAction: null,
        copyRemaining: [],
        copyReviewDaysTemp: [],
        copyWordVisible: true,
        submitting: false,
        leaving: false,
    });
}

// Re-export StudyMode so consumers only import from one place if needed.
export type { StudyMode };

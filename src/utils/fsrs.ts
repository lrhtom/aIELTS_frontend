/**
 * Frontend port of the FSRS-4.5 scheduler, written **line by line against** `backend/api/core/fsrs_utils.py`.
 *
 * Why port it instead of asking the backend
 * ------------------------
 * The four rating buttons on the flashcard page each show, live, how many days away that rating would schedule the
 * card. Four buttons per card and a fresh set on every flip means one round trip per card through an API - the feel collapses.
 *
 * Why the old estimate could not stay
 * ----------------------------
 * It previously used made-up coefficients (Hard x0.6 / Good x1.0 / Easy x1.5). Checked against real cards and the
 * backend, 14 of 24 combinations were wrong, and **all of them in the wrong direction**:
 *   - Hard x0.6 means 'rating Hard shortens the interval', but in real FSRS any successful recall (even when
 *       rated Hard) only grows stability; it is merely damped by w15. Measured on the 'abbreviation' card:
 *       the UI said 89 days, the truth was 182.
 *   - Good x1.0 assumes 'the interval does not change'; measured, it is consistently 1.6-2.1x out.
 *   - A new card rated Easy fell back to 4 because stability=0, when the true value is w3=15.47.
 *
 * Drift protection
 * --------
 * The weights and formulas must match the Python side. `fsrs.golden.test.ts` pins a golden table computed
 * directly by Python; change either side without the other and the test goes red immediately.
 */

/** FSRS-4.5 default weights, which must match `W` in `fsrs_utils.py` exactly. */
export const W = [
    0.4072, 1.1829, 3.1262, 15.4722,   // w0-3  initial stability for the four ratings of a new card
    7.2102,                            // w4    initial difficulty baseline (at rating 3)
    0.5316,                            // w5    initial difficulty slope
    1.0651,                            // w6    difficulty change coefficient
    0.0589,                            // w7    difficulty mean-reversion weight
    1.4330,                            // w8    recall stability gain (exponential factor)
    0.1544,                            // w9    recall stability S exponent
    1.0070,                            // w10   recall stability R exponent
    1.9741,                            // w11   forget stability base
    0.1000,                            // w12   forget stability difficulty exponent
    0.2975,                            // w13   forget stability S exponent
    0.2414,                            // w14   forget stability R exponent
    0.2047,                            // w15   Hard penalty factor
    2.9898,                            // w16   Easy bonus factor
    0.5100,                            // w17   short-term stability coefficient
    0.0, 0.0, 0.0,                     // w18-20 unused
] as const;

/** Forgetting curve: R(t,S) = (1 + FACTOR * t / S) ^ DECAY */
export const DECAY = -0.5;
export const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;   // ≈ 0.2346

export const NEW = 0;
export const LEARNING = 1;
export const REVIEW = 2;
export const RELEARNING = 3;

const clip = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function retrievability(elapsed: number, s: number): number {
    if (s <= 0) return 0;
    return Math.pow(1 + FACTOR * elapsed / s, DECAY);
}

function initStability(rating: number): number {
    return Math.max(W[rating - 1], 0.1);
}

function initDifficulty(rating: number): number {
    return clip(W[4] - Math.exp(W[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(d: number, rating: number): number {
    const raw = d - W[6] * (rating - 3);
    const opt = initDifficulty(4);                     // mean reversion toward the initial difficulty of an Easy rating
    return clip(W[7] * opt + (1 - W[7]) * raw, 1, 10);
}

function shortTermStability(s: number, rating: number): number {
    return Math.max(s * Math.exp(W[17] * (rating - 3 + W[18])), 0.1);
}

function recallStability(d: number, s: number, r: number, rating: number): number {
    const safeS = Math.max(s, 0.1);
    const hardPenalty = rating === 2 ? W[15] : 1;
    const easyBonus = rating === 4 ? W[16] : 1;
    const gain =
        Math.exp(W[8]) * (11 - d) * Math.pow(safeS, -W[9]) *
        (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus;
    return Math.max(safeS * (gain + 1), 0.1);
}

/**
 * Calendar days since the last review, using the same definition as the backend's `_calendar_days()`:
 * both take date() differences in UTC (the backend has `_USER_TZ = timezone.utc`),
 * so reviewing at 23:50 and returning at 00:10 the next day counts as 1 day, not 0.
 * Dividing the millisecond difference by 86400000 would give 0, inflating retrievability R and stretching the previewed interval.
 */
export function elapsedCalendarDays(lastReviewIso: string | null | undefined, now: Date = new Date()): number {
    if (!lastReviewIso) return 0;
    const lr = new Date(lastReviewIso);
    if (Number.isNaN(lr.getTime())) return 0;
    const dayOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.max(0, Math.round((dayOf(now) - dayOf(lr)) / 86400000));
}

/** Stability after forgetting (the starting point for relearning). The interval is a fixed 5 minutes, but stability drops sharply. */
function forgetStability(d: number, s: number, r: number): number {
    return Math.max(
        W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]),
        0.1,
    );
}

export interface FsrsCardState {
    state: number;
    stability: number;
    difficulty: number;
    /** Calendar days since the last review; pass 0 for a new card */
    elapsedDays?: number;
}

export interface FsrsPreview {
    /** How many days out it is scheduled. 0 = later the same day (a Review-stage Again, back in 5 minutes) */
    scheduledDays: number;
    /** the updated stability */
    stability: number;
    /** the updated difficulty (1-10) */
    difficulty: number;
    /** the updated stage */
    state: number;
}

/**
 * Given a card's current state and a rating, compute the next interval the backend would schedule.
 *
 * It maps branch for branch onto `fsrs_schedule()`; only the number of days until due is needed here,
 * so the timezone and reps/lapses computations are omitted - they do not affect the interval.
 */
export function previewInterval(card: FsrsCardState, rating: number): FsrsPreview {
    const state = card.state ?? NEW;
    const s = card.stability || 0;
    let d = card.difficulty || 0;
    if (d <= 0) d = initDifficulty(3);                 // the same fallback as the backend
    const elapsed = card.elapsedDays ?? 0;

    // -- New card --
    if (state === NEW) {
        const newS = initStability(rating);
        const newD = initDifficulty(rating);
        if (rating === 4) {
            return { scheduledDays: Math.max(1, Math.round(newS)), stability: newS, difficulty: newD, state: REVIEW };
        }
        return { scheduledDays: 1, stability: newS, difficulty: newD, state: LEARNING };
    }

    // -- Learning / relearning --
    if (state === LEARNING || state === RELEARNING) {
        const baseS = s > 0 ? s : initStability(rating);
        const newD = nextDifficulty(d, rating);
        if (rating === 1) {
            // Again: discard the short-term result, reset stability to w0, and come back tomorrow
            return { scheduledDays: 1, stability: initStability(1), difficulty: newD, state };
        }
        const newS = shortTermStability(baseS, rating);
        if (rating === 4) {
            return { scheduledDays: Math.max(1, Math.round(newS)), stability: newS, difficulty: newD, state: REVIEW };
        }
        return { scheduledDays: 1, stability: newS, difficulty: newD, state };
    }

    // -- Review stage --
    const r = retrievability(elapsed, s);
    const newD = nextDifficulty(d, rating);
    if (rating === 1) {
        // Forgetting: back in 5 minutes, scheduled_days = 0, skipping the interval dispatch entirely
        return { scheduledDays: 0, stability: forgetStability(d, s, r), difficulty: newD, state: RELEARNING };
    }
    const newS = recallStability(d, s, r, rating);
    return { scheduledDays: Math.max(1, Math.round(newS)), stability: newS, difficulty: newD, state: REVIEW };
}

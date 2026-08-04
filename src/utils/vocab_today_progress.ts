/**
 * Today's study results, accumulated across every session of the day.
 *
 * Why this exists
 * ---------------
 * The results page used to show only the session that had just ended. Study
 * three words, leave, come back and study three more, and the summary claimed
 * three — the earlier ones were simply gone from view. What a learner wants at
 * the end of a session is "what did I get through today", not "what did I get
 * through in the last few minutes".
 *
 * Why it is accumulated here rather than read from the server
 * ----------------------------------------------------------
 * There is no review log. `VocabFSRS` keeps only each card's CURRENT state, and
 * `reps` / `lapses` are lifetime totals, not per-day ones — so "which words did
 * I finish today, and did I forget any of them on the way" cannot be
 * reconstructed server-side. It has to be recorded as it happens.
 *
 * Consequence worth knowing: this is per-browser. Studying the same plan on a
 * second device gives that device its own daily tally. The authoritative
 * progress count (`studied_today`) still comes from the server, so the number
 * in the top bar stays correct everywhere; only this end-of-day breakdown is
 * local.
 *
 * Merge rules mirror the summary's "one word, one bucket":
 *   - a word studied twice today counts ONCE,
 *   - and if it was forgotten in ANY session today it stays "relearned",
 *     because that is what happened to it today.
 */
import type { ReviewResult } from './vocab_flashcard_utils';

const KEY_PREFIX = 'vocab_today_progress';

export interface TodayProgress {
    /** Local calendar date this tally belongs to (YYYY-MM-DD). */
    date: string;
    /** Keyed by word so re-studying the same word today cannot double-count it. */
    words: Record<string, ReviewResult>;
    /** Clicks per rating, index 0..3 = Again/Hard/Good/Easy. */
    ratingClicks: [number, number, number, number];
}

/** Local calendar date — the day boundary the learner actually experiences. */
export function localDateKey(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function emptyProgress(date: string): TodayProgress {
    return { date, words: {}, ratingClicks: [0, 0, 0, 0] };
}

export function storageKey(planId: number | null, userScope?: string | null): string {
    const plan = typeof planId === 'number' && planId > 0 ? planId : 'global';
    const user = String(userScope ?? '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'anon';
    return `${KEY_PREFIX}_${user}_${plan}`;
}

/**
 * Fold one graduated word into today's tally.
 *
 * `forgot` is sticky: once a word has been forgotten today it stays in the
 * relearned bucket even if a later attempt went cleanly, because over the whole
 * day it *was* a word that had to be relearned.
 */
export function recordGraduation(prev: TodayProgress, result: ReviewResult): TodayProgress {
    const existing = prev.words[result.word];
    return {
        ...prev,
        words: {
            ...prev.words,
            [result.word]: existing
                ? { ...result, forgot: existing.forgot || result.forgot }
                : result,
        },
    };
}

/** Fold one rating click into today's tally (rating 1..4). */
export function recordRating(prev: TodayProgress, rating: number): TodayProgress {
    if (!Number.isInteger(rating) || rating < 1 || rating > 4) return prev;
    const clicks = [...prev.ratingClicks] as TodayProgress['ratingClicks'];
    clicks[rating - 1] += 1;
    return { ...prev, ratingClicks: clicks };
}

/** Today's graduated words, newest activity last (insertion order). */
export function todayWords(progress: TodayProgress): ReviewResult[] {
    return Object.values(progress.words);
}

/* ── Persistence ─────────────────────────────────────────────────────────── */

/**
 * Read today's tally. A stored tally from an earlier date is discarded rather
 * than shown — "today" has to mean today.
 */
export function loadTodayProgress(
    planId: number | null,
    userScope?: string | null,
    now: Date = new Date(),
): TodayProgress {
    const today = localDateKey(now);
    try {
        const raw = localStorage.getItem(storageKey(planId, userScope));
        if (!raw) return emptyProgress(today);
        const parsed = JSON.parse(raw) as Partial<TodayProgress>;
        if (parsed?.date !== today || typeof parsed.words !== 'object' || !parsed.words) {
            return emptyProgress(today);
        }
        const clicks = Array.isArray(parsed.ratingClicks) ? parsed.ratingClicks : [];
        return {
            date: today,
            words: parsed.words as Record<string, ReviewResult>,
            ratingClicks: [0, 1, 2, 3].map((i) => Number(clicks[i]) || 0) as TodayProgress['ratingClicks'],
        };
    } catch {
        // A corrupt or unavailable store must never block studying.
        return emptyProgress(today);
    }
}

export function saveTodayProgress(
    progress: TodayProgress,
    planId: number | null,
    userScope?: string | null,
): void {
    try {
        localStorage.setItem(storageKey(planId, userScope), JSON.stringify(progress));
    } catch {
        // Quota or private-mode failures are not worth interrupting a session for.
    }
}

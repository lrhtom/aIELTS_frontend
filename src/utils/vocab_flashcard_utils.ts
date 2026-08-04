/* ── Types ───────────────────────────────────────────────────────────────── */

export type Step = 'doing' | 'result';
export type StudyMode = 'flashcard' | 'flashcard-simple' | 'read-aloud' | 'choice' | 'write' | 'copy' | 'article_copy' | 'story_mode';
export type TrackingMode = 'none' | 'eye' | 'mouse';
export type MasterySetting = 'auto' | number;

export interface CopyPendingAction {
    cardIndex: number;
    remainingAfterSubmit: number;
    completed: boolean;
    dueAt: string;
    scheduledDays: number;
}

export interface ReviewResult {
    word:          string;
    zh:            string;
    /** The rating that graduated the word (not every rating it received). */
    rating:        number;
    newDue:        string;
    scheduledDays: number;
    /**
     * Was this word forgotten (rated Again, or answered wrong) at any point in
     * the session? Stamped by the store on graduation from `sessionForgot`, so
     * callers never pass it — see `advanceQueue`.
     *
     * It exists so the summary can classify each word into exactly ONE bucket:
     * a word that was ever forgotten counts as relearned and nowhere else.
     */
    forgot:        boolean;
}

export interface CompletionDueHint {
    word: string;
    dueAt: string;
}

/* ── Session key helpers ─────────────────────────────────────────────────── */

export const SESSION_KEY = 'vocab_flashcard_session';
export const SESSION_KEY_PREFIX = 'vocab_flashcard_session_plan_';
export const SESSION_KEY_USER_PREFIX = `${SESSION_KEY}_user_`;
export const LIUHONGBO_BOOK_KEYWORDS = ['刘洪波', '雅思真经', 'liuhongbo', 'zhenjing'];
export const LEARNING_TIMER_PENDING_KEY = 'vocab_learning_timer_pending_seconds';

export function normalizeSessionScope(value?: string | null): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getSessionKeyByPlanId(planId?: number | null, userScope?: string | null): string {
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

export function getSessionKeyCandidates(planId?: number | null, userScope?: string | null): string[] {
    const keys: string[] = [getSessionKeyByPlanId(planId, userScope)];
    if (typeof planId === 'number' && planId > 0) {
        keys.push(`${SESSION_KEY_PREFIX}${planId}`);
        keys.push(SESSION_KEY);
    } else {
        keys.push(SESSION_KEY);
    }
    return Array.from(new Set(keys));
}

/* ── Clamp helpers ───────────────────────────────────────────────────────── */

export function clampCopyRepetitions(value: number): number {
    return Math.min(20, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 3));
}

export function clampCopyReviewDays(value: number): number {
    return Math.min(365, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 2));
}

/* ── Learning timer persistence ──────────────────────────────────────────── */

export function readPendingLearningSeconds(): number {
    try {
        const raw = localStorage.getItem(LEARNING_TIMER_PENDING_KEY);
        if (!raw) return 0;
        const parsed = parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
        return 0;
    }
}

export function writePendingLearningSeconds(seconds: number): void {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    if (safeSeconds <= 0) return;
    const current = readPendingLearningSeconds();
    localStorage.setItem(LEARNING_TIMER_PENDING_KEY, String(current + safeSeconds));
}

export function clearPendingLearningSeconds(): void {
    localStorage.removeItem(LEARNING_TIMER_PENDING_KEY);
}

/* ── Array helpers ───────────────────────────────────────────────────────── */

export function shuffleArray<T>(arr: T[]): T[] {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}

export function pickUniqueZh(
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

/* ── Copy mode helpers ───────────────────────────────────────────────────── */

/**
 * Count how many complete copies of `target` appear in `input`.
 * Works for both single words ("apple") and phrases ("a lot of").
 */
export function countCopies(input: string, target: string): number {
    const inputLower = input.toLowerCase().trim();
    const targetLower = target.trim().toLowerCase();
    if (!inputLower || !targetLower) return 0;

    const escaped = targetLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern: string;
    if (targetLower.includes(' ')) {
        pattern = escaped.replace(/\s+/g, '\\s+');
    } else {
        pattern = '\\b' + escaped + '\\b';
    }

    const matches = inputLower.match(new RegExp(pattern, 'g'));
    return matches ? matches.length : 0;
}

/**
 * Extract typed copies from input for visual rendering.
 * Returns up to `maxCount` entries — complete copies first, then
 * any remaining partial input as the last entry.
 */
export function extractTypedCopies(input: string, target: string, maxCount: number): string[] {
    const result: string[] = [];
    const targetLower = target.trim().toLowerCase();
    const inputLower = input.toLowerCase();
    if (!inputLower || !targetLower) return result;

    const escaped = targetLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern: string;
    if (targetLower.includes(' ')) {
        pattern = escaped.replace(/\s+/g, '\\s+');
    } else {
        pattern = '\\b' + escaped + '\\b';
    }

    const regex = new RegExp(pattern, 'gi');
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(inputLower)) !== null && result.length < maxCount) {
        result.push(input.slice(match.index, match.index + match[0].length));
        lastIndex = match.index + match[0].length;
    }

    const remaining = input.slice(lastIndex).trim();
    if (remaining && result.length < maxCount) {
        result.push(remaining);
    }

    return result;
}

/**
 * Per-word summary buckets for the end-of-session results page.
 *
 * Index 0 = relearned, 1 = hard, 2 = good, 3 = easy, and **every graduated word
 * lands in exactly one of them**, so the four numbers sum to `results.length`.
 *
 * The rule: a word forgotten at any point in the session is relearned and is
 * counted nowhere else; only words that were never forgotten are bucketed by
 * the rating that graduated them.
 *
 * This used to be a per-CLICK rating histogram computed inline in the results
 * JSX, which double-counted — a word rated Again 3x then Good once landed in
 * both the Again column (3) and the Good column (1). The four numbers then
 * summed to the click count, never to the word count, while sitting next to a
 * "graduated N words" figure: two units in one row, reading as one distribution.
 * Per-click totals are still shown separately, explicitly labelled as times.
 */
export function summariseWordBuckets(results: ReviewResult[]): [number, number, number, number] {
    const buckets: [number, number, number, number] = [0, 0, 0, 0];
    for (const r of results) {
        if (r.forgot) {
            buckets[0] += 1;
            continue;
        }
        // rating 2/3/4 -> hard/good/easy. A graduating rating of 1 is only
        // reachable together with `forgot`, which is handled above; clamping
        // keeps a malformed record out of the wrong bucket rather than crashing.
        buckets[Math.min(3, Math.max(1, r.rating - 1))] += 1;
    }
    return buckets;
}

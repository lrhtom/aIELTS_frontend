/**
 * Pure helpers used by the flashcard rating buttons to preview when a card will next be due
 * for each of the 4 ratings (Again / Hard / Good / Easy).
 *
 * Kept separate from the component so they can be unit-tested without React.
 */

export type FsrsState = 0 | 1 | 2 | 3; // 0=New, 1=Learning, 2=Review, 3=Relearning

export interface FsrsCardLike {
    state: number;
    stability: number;
}

/**
 * Predict the next due Date for `card` if the user rated it `rating` (1..4) right now.
 *
 * Mirrors the heuristic in `predictDueAtFromRating` in vocabulary_flashcard_doing_page.tsx —
 * this is a UI estimate, not the server's authoritative FSRS scheduler.
 */
export function predictNextDueAt(card: FsrsCardLike, rating: number, now: Date = new Date()): Date {
    const next = new Date(now);
    const s = Number(card.stability || 0);

    // New, Learning, Relearning: short-loop. Easy graduates to ~stability days.
    if (card.state === 0 || card.state === 1 || card.state === 3) {
        const days = rating <= 3 ? 1 : Math.max(1, Math.round(s || 4));
        next.setDate(next.getDate() + days);
        return next;
    }

    // Review: Again sends to Relearning (5min). Hard/Good/Easy scale stability.
    if (rating === 1) {
        next.setMinutes(next.getMinutes() + 5);
        return next;
    }
    const factor = rating === 2 ? 0.6 : rating === 3 ? 1.0 : 1.5;
    const days = Math.max(1, Math.round((s || 1) * factor));
    next.setDate(next.getDate() + days);
    return next;
}

/**
 * Short label rendered inside each rating button.
 *
 * - Same calendar day → todayLabel (e.g. "今天")
 * - +1 day            → tomorrowLabel (e.g. "明天")
 * - Same year         → "MM-DD"
 * - Different year    → "YYYY-MM-DD"
 */
export function formatDueLabel(
    due: Date,
    now: Date,
    labels: { today: string; tomorrow: string },
): string {
    if (Number.isNaN(due.getTime())) return '';
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(due) - startOfDay(now)) / 86400000);
    if (dayDiff <= 0) return labels.today;
    if (dayDiff === 1) return labels.tomorrow;
    const sameYear = due.getFullYear() === now.getFullYear();
    const mm = String(due.getMonth() + 1).padStart(2, '0');
    const dd = String(due.getDate()).padStart(2, '0');
    return sameYear ? `${mm}-${dd}` : `${due.getFullYear()}-${mm}-${dd}`;
}

/**
 * The pure-function part of the 'next due date' label on the flashcard rating buttons.
 *
 * Kept out of the component so it can be unit tested without React.
 *
 * This file once carried its own estimate that **did not agree with the real scheduler** (Hard x0.6 / Good x1.0 /
 * Easy x1.5, with a 4-day fallback for new cards), and `vocab_due_label.test.ts` pinned those wrong values as the
 * expected ones, so the bug survived a long time under the protection of green tests. It now delegates entirely to
 * `utils/fsrs.ts` - the implementation ported verbatim from the backend's `fsrs_utils.py` and pinned by a golden table.
 * Do not reinvent a set of coefficients in this file again.
 */
import { previewInterval, elapsedCalendarDays } from './fsrs';

export type FsrsState = 0 | 1 | 2 | 3; // 0=New, 1=Learning, 2=Review, 3=Relearning

export interface FsrsCardLike {
    state: number;
    stability: number;
    /** When absent, falls back the same way the backend does (the initial difficulty of rating 3). Pass it in for an accurate prediction. */
    difficulty?: number;
    /** Time of the last review; when absent the card is treated as just reviewed (elapsed = 0). */
    last_review?: string | null;
}

/**
 * Predict when the card would next be due if `card` were rated `rating` (1..4) right now.
 *
 * The interval comes from the real FSRS scheduler. Day intervals land at **midnight UTC**, matching the backend's
 * `_next_day_midnight()`, rather than 'now + N x 24h' - otherwise a card reviewed in the evening would land a day
 * later than the backend actually schedules it and the label would disagree.
 */
export function predictNextDueAt(card: FsrsCardLike, rating: number, now: Date = new Date()): Date {
    const { scheduledDays } = previewInterval({
        state: card.state,
        stability: Number(card.stability || 0),
        difficulty: Number(card.difficulty || 0),
        elapsedDays: elapsedCalendarDays(card.last_review, now),
    }, rating);

    // scheduled_days = 0: a Review-stage Again, back in 5 minutes on the same day
    if (scheduledDays === 0) {
        return new Date(now.getTime() + 5 * 60 * 1000);
    }
    // day interval: midnight UTC today + N days (matching the backend's _next_day_midnight)
    const midnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return new Date(midnightUtc + scheduledDays * 86400000);
}

/**
 * The short label inside each rating button.
 *
 * - same day  -> todayLabel (for example 'Today')
 * - +1 day    -> tomorrowLabel (for example 'Tomorrow')
 * - same year -> 'MM-DD'
 * - next year -> 'YYYY-MM-DD'
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

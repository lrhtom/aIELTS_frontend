import { describe, it, expect } from 'vitest';
import { predictNextDueAt, formatDueLabel, type FsrsCardLike } from './vocab_due_label';

const labels = { today: '今天', tomorrow: '明天' };
// Anchor "now" to a fixed point so day diffs are reproducible across runs.
// 2026-06-23 10:00 local time.
const NOW = new Date(2026, 5, 23, 10, 0, 0);

function preview(card: FsrsCardLike, rating: number): string {
    return formatDueLabel(predictNextDueAt(card, rating, NOW), NOW, labels);
}

describe('previewNextDueLabel — new card (state=0, stability=0)', () => {
    const card: FsrsCardLike = { state: 0, stability: 0 };
    it('Again → 明天', () => expect(preview(card, 1)).toBe('明天'));
    it('Hard → 明天', () => expect(preview(card, 2)).toBe('明天'));
    it('Good → 明天', () => expect(preview(card, 3)).toBe('明天'));
    it('Easy → +4 days (stability fallback)', () => expect(preview(card, 4)).toBe('06-27'));
});

describe('previewNextDueLabel — learning card (state=1, stability=2)', () => {
    const card: FsrsCardLike = { state: 1, stability: 2 };
    it('Again → 明天', () => expect(preview(card, 1)).toBe('明天'));
    it('Easy → +2 days', () => expect(preview(card, 4)).toBe('06-25'));
});

describe('previewNextDueLabel — review card (state=2, stability=10)', () => {
    const card: FsrsCardLike = { state: 2, stability: 10 };
    it('Again → 今天 (sends to relearning +5min)', () => expect(preview(card, 1)).toBe('今天'));
    it('Hard → +6 days (factor 0.6)', () => expect(preview(card, 2)).toBe('06-29'));
    it('Good → +10 days (factor 1.0)', () => expect(preview(card, 3)).toBe('07-03'));
    it('Easy → +15 days (factor 1.5)', () => expect(preview(card, 4)).toBe('07-08'));
});

describe('previewNextDueLabel — review card crossing year boundary', () => {
    const card: FsrsCardLike = { state: 2, stability: 300 };
    it('Easy → +450 days → cross year → renders with year prefix', () => {
        // 450 days after 2026-06-23 → 2027-09-16
        const label = preview(card, 4);
        expect(label.length).toBeGreaterThan(5); // not "MM-DD"
        expect(label.startsWith('2027-')).toBe(true);
    });
});

describe('previewNextDueLabel — relearning card (state=3) behaves like learning', () => {
    const card: FsrsCardLike = { state: 3, stability: 5 };
    it('Again → 明天 (rating<=3 forces 1-day)', () => expect(preview(card, 1)).toBe('明天'));
    it('Easy → +5 days', () => expect(preview(card, 4)).toBe('06-28'));
});

describe('previewNextDueLabel — review card with low stability still produces sane output', () => {
    const card: FsrsCardLike = { state: 2, stability: 0.5 };
    it('Hard → +1 day (Math.max guard)', () => expect(preview(card, 2)).toBe('明天'));
    it('Easy → +1 day (round(0.5*1.5)=1)', () => expect(preview(card, 4)).toBe('明天'));
});

describe('formatDueLabel — direct edge cases', () => {
    it('NaN due → empty string', () => {
        expect(formatDueLabel(new Date(NaN), NOW, labels)).toBe('');
    });
    it('Past date (e.g. overdue card) → 今天', () => {
        const past = new Date(NOW.getTime() - 24 * 3600 * 1000);
        expect(formatDueLabel(past, NOW, labels)).toBe('今天');
    });
    it('Same day later → 今天', () => {
        const sameDay = new Date(NOW.getTime() + 30 * 60 * 1000); // +30 min
        expect(formatDueLabel(sameDay, NOW, labels)).toBe('今天');
    });
});

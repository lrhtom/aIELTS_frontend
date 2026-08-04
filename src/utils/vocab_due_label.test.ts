/**
 * The 'next due date' label on the rating buttons.
 *
 * This file was rewritten wholesale (2026-07-28). The old version pinned a **wrong** heuristic as the expected
 * values - 'Easy -> +4 days (stability fallback)' and 'Hard -> +6 days (factor 0.6)' - so the bug lived a long
 * time behind green tests. The real scheduler gives: a new card rated Easy = 15 days, and in the review stage a
 * Hard rating only ever makes the interval **longer**.
 *
 * Division of labour: whether the interval is right is verified by `fsrs.golden.test.ts` against the backend's
 * golden table; this file only checks the 'interval -> date -> label' arithmetic plus a few representative end-to-end results.
 */
import { describe, it, expect } from 'vitest';
import { predictNextDueAt, formatDueLabel, type FsrsCardLike } from './vocab_due_label';
import { previewInterval } from './fsrs';

const labels = { today: '今天', tomorrow: '明天' };
// A fixed anchor so the tests reproduce on any machine. Noon UTC avoids the local timezone shifting the date either way.
const NOW = new Date(Date.UTC(2026, 5, 23, 12, 0, 0));

function preview(card: FsrsCardLike, rating: number): string {
    return formatDueLabel(predictNextDueAt(card, rating, NOW), NOW, labels);
}

/** The number of days the current implementation produces, for assertions about whether the label reflects the interval faithfully. */
function days(card: FsrsCardLike, rating: number): number {
    return previewInterval({
        state: card.state,
        stability: card.stability,
        difficulty: card.difficulty ?? 0,
        elapsedDays: 0,
    }, rating).scheduledDays;
}

describe('新卡 (state=0)', () => {
    const card: FsrsCardLike = { state: 0, stability: 0 };
    it('Again → 明天', () => expect(preview(card, 1)).toBe('明天'));
    it('Hard → 明天', () => expect(preview(card, 2)).toBe('明天'));
    it('Good → 明天', () => expect(preview(card, 3)).toBe('明天'));
    it('Easy → 15 天后 = 07-08（旧版错写成 +4 天）', () => {
        expect(days(card, 4)).toBe(15);
        expect(preview(card, 4)).toBe('07-08');
    });
});

describe('学习中 (state=1, s=2)', () => {
    const card: FsrsCardLike = { state: 1, stability: 2 };
    it('Again → 明天', () => expect(preview(card, 1)).toBe('明天'));
    it('Hard / Good 仍是一天一步 → 明天', () => {
        expect(preview(card, 2)).toBe('明天');
        expect(preview(card, 3)).toBe('明天');
    });
    it('Easy 毕业进复习，间隔带上短期系数 e^w17', () => {
        // 2 x e^0.51 = 3.33 -> 3 days (the old version simply used stability=2)
        expect(days(card, 4)).toBe(3);
        expect(preview(card, 4)).toBe('06-26');
    });
});

describe('复习阶段 (state=2)', () => {
    it('Again → 今天（5 分钟后重来，不按天排）', () => {
        const card: FsrsCardLike = { state: 2, stability: 10, difficulty: 5, last_review: '2026-06-13T12:00:00Z' };
        expect(preview(card, 1)).toBe('今天');
        const due = predictNextDueAt(card, 1, NOW);
        expect(due.getTime() - NOW.getTime()).toBe(5 * 60 * 1000);
    });

    it('Hard 间隔只会变长，绝不缩短（旧版 ×0.6 会缩短）', () => {
        const card: FsrsCardLike = { state: 2, stability: 148.423, difficulty: 2.297, last_review: '2026-03-27T12:00:00Z' };
        const d = previewInterval({
            state: 2, stability: card.stability, difficulty: card.difficulty!,
            elapsedDays: 88,
        }, 2).scheduledDays;
        expect(d).toBeGreaterThan(card.stability);
    });

    it('Hard < Good < Easy 严格递增', () => {
        const card = { state: 2, stability: 60, difficulty: 4, elapsedDays: 30 };
        const [h, g, e] = [2, 3, 4].map(r => previewInterval(card, r).scheduledDays);
        expect(h).toBeLessThan(g);
        expect(g).toBeLessThan(e);
    });

    it('刚复习过（elapsed=0）时三档相同：R=1 没有记忆增益，这是 FSRS 的正确行为', () => {
        const card = { state: 2, stability: 10, difficulty: 5, elapsedDays: 0 };
        const [h, g, e] = [2, 3, 4].map(r => previewInterval(card, r).scheduledDays);
        expect(h).toBe(g);
        expect(g).toBe(e);
    });
});

describe('重学 (state=3) 与学习中同规则', () => {
    const card: FsrsCardLike = { state: 3, stability: 5 };
    it('Again → 明天', () => expect(preview(card, 1)).toBe('明天'));
    it('Easy → 5 × e^0.51 ≈ 8 天', () => {
        expect(days(card, 4)).toBe(8);
        expect(preview(card, 4)).toBe('07-01');
    });
});

describe('日期落点与后端对齐', () => {
    it('日间隔落在 UTC 零点，不是「此刻 + N×24h」', () => {
        const due = predictNextDueAt({ state: 0, stability: 0 }, 4, NOW);
        expect(due.getUTCHours()).toBe(0);
        expect(due.getUTCMinutes()).toBe(0);
    });

    it('深夜复习不会把日期多推一天', () => {
        const lateNight = new Date(Date.UTC(2026, 5, 23, 23, 50, 0));
        const due = predictNextDueAt({ state: 0, stability: 0 }, 1, lateNight);   // 1 day
        expect(due.toISOString().slice(0, 10)).toBe('2026-06-24');
    });

    it('跨年时标签带上年份', () => {
        const card: FsrsCardLike = { state: 2, stability: 300, difficulty: 2, last_review: '2025-09-01T12:00:00Z' };
        const label = preview(card, 4);
        expect(label.startsWith('20')).toBe(true);
        expect(label.length).toBe(10);
    });
});

describe('formatDueLabel 边界', () => {
    it('NaN → 空串', () => expect(formatDueLabel(new Date(NaN), NOW, labels)).toBe(''));
    it('过期卡（过去时间）→ 今天', () => {
        expect(formatDueLabel(new Date(NOW.getTime() - 86400000), NOW, labels)).toBe('今天');
    });
    it('当天稍后 → 今天', () => {
        expect(formatDueLabel(new Date(NOW.getTime() + 30 * 60000), NOW, labels)).toBe('今天');
    });
});

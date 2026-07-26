/**
 * 前端状态层测试：背单词会话的 Zustand store 状态迁移。
 *
 * 对应论文 §7.1 单元测试层里"前端状态"那一项 —— 此前只有纯工具函数
 * (format / retry / ielts_band …) 有测试，真正承载会话状态的 store 一条都没有。
 *
 * 测的是三个级联动作：
 *   initSession   开局：队列、掌握度、抄写计数全部按卡数初始化
 *   advanceQueue  每次评分后的队列推进（毕业出队 / 未毕业重排）
 *   retrySession  再来一轮：保留卡片，清空本轮所有进度
 *
 * 这些动作一次改十几个字段，是最容易出"改了 A 忘了 B"的地方，也正是
 * store 值得单测的原因。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { VocabCard } from '../api/vocab';
import { resetVocabFlashcardStore, useVocabFlashcardStore } from './vocab_flashcard_store';

// ── helpers ─────────────────────────────────────────────────────────────────

const makeCard = (word: string): VocabCard => ({
    word,
    zh: `${word}-中文`,
    due: '2026-07-01T00:00:00Z',
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    // Word 表富信息：真实数据里可能为空，这里给空值即可
    phonetic: '',
    grammar: '',
    definitions: [],
    examples: [],
});

const CARDS = [makeCard('alpha'), makeCard('beta'), makeCard('gamma')];

const get = () => useVocabFlashcardStore.getState();

/** 未毕业时把当前卡塞回队尾（页面里 flashcard 模式的实际策略）。 */
const reinsertToTail = (rest: number[], cardIndex: number) => [...rest, cardIndex];

/** advanceQueue 的默认参数，测试只覆盖关心的字段。 */
const advance = (over: Partial<Parameters<ReturnType<typeof get>['advanceQueue']>[0]> = {}) =>
    get().advanceQueue({
        cardIndex: get().queue[0],
        graduate: false,
        forgotNow: false,
        newMastery: 1,
        updatedCard: null,
        graduateResult: null,
        completionDueHint: null,
        ratingClicked: 3,
        reinsert: reinsertToTail,
        copyWordHidden: false,
        ...over,
    });

beforeEach(() => {
    resetVocabFlashcardStore();
});

// ── initSession ─────────────────────────────────────────────────────────────

describe('initSession', () => {
    it('按卡片数初始化队列与各并行数组', () => {
        get().initSession({ cards: CARDS, copyRepetitions: 3, copyReviewDays: 2 });
        const s = get();
        expect(s.cards).toHaveLength(3);
        expect(s.queue).toEqual([0, 1, 2]);
        expect(s.sessionMastery).toEqual([0, 0, 0]);
        expect(s.sessionForgot).toEqual([false, false, false]);
        expect(s.sessionErrorCount).toEqual([0, 0, 0]);
    });

    it('抄写模式的两个计数按传入配置铺满', () => {
        get().initSession({ cards: CARDS, copyRepetitions: 5, copyReviewDays: 4 });
        expect(get().copyRemaining).toEqual([5, 5, 5]);
        expect(get().copyReviewDaysTemp).toEqual([4, 4, 4]);
    });

    it('清空上一轮的成绩并把 visitKey 置为 1', () => {
        get().initSession({ cards: CARDS, copyRepetitions: 1, copyReviewDays: 1 });
        advance({ graduate: true, graduateResult: { word: 'alpha' } as never });
        expect(get().results).toHaveLength(1);

        get().initSession({ cards: CARDS, copyRepetitions: 1, copyReviewDays: 1 });
        expect(get().results).toEqual([]);
        expect(get().allRatings).toEqual([]);
        expect(get().graduatedCount).toBe(0);
        expect(get().visitKey).toBe(1);
    });

    it('重置每张卡的 UI 态（翻面 / 选择 / 拼写残留一律清掉）', () => {
        get().setIsFlipped(true);
        get().setChoiceSelected(2);
        get().setWriteInput('leftover');
        get().initSession({ cards: CARDS, copyRepetitions: 1, copyReviewDays: 1 });
        expect(get().isFlipped).toBe(false);
        expect(get().choiceSelected).toBeNull();
        expect(get().writeInput).toBe('');
    });

    it('空卡组不会炸，各数组均为空', () => {
        get().initSession({ cards: [], copyRepetitions: 3, copyReviewDays: 2 });
        expect(get().queue).toEqual([]);
        expect(get().sessionMastery).toEqual([]);
    });
});

// ── advanceQueue ────────────────────────────────────────────────────────────

describe('advanceQueue', () => {
    beforeEach(() => {
        get().initSession({ cards: CARDS, copyRepetitions: 3, copyReviewDays: 2 });
    });

    it('毕业时出队且 graduatedCount 自增', () => {
        advance({ graduate: true });
        expect(get().queue).toEqual([1, 2]);
        expect(get().graduatedCount).toBe(1);
    });

    it('未毕业时按 reinsert 策略重排，队列长度不变', () => {
        advance({ graduate: false });
        expect(get().queue).toEqual([1, 2, 0]);
        expect(get().graduatedCount).toBe(0);
    });

    it('每次调用都记录点击的评分 —— 不只是毕业那次', () => {
        // 同一张卡连点三次 Again 再以 Good 毕业，直方图必须看到 4 次
        advance({ ratingClicked: 1 });
        advance({ cardIndex: 1, ratingClicked: 1 });
        advance({ cardIndex: 2, ratingClicked: 1 });
        advance({ cardIndex: 0, ratingClicked: 3, graduate: true });
        expect(get().allRatings).toEqual([1, 1, 1, 3]);
    });

    it('遗忘会标记 sessionForgot 并累加错误次数', () => {
        advance({ cardIndex: 0, forgotNow: true });
        expect(get().sessionForgot).toEqual([true, false, false]);
        expect(get().sessionErrorCount).toEqual([1, 0, 0]);
    });

    it('毕业时把该卡的错误计数清零，遗忘标记保留', () => {
        advance({ cardIndex: 0, forgotNow: true });                    // 错 1 次
        advance({ cardIndex: 1 });
        advance({ cardIndex: 2 });
        advance({ cardIndex: 0, graduate: true });
        expect(get().sessionErrorCount[0]).toBe(0);   // 计数清零
        expect(get().sessionForgot[0]).toBe(true);    // 但"曾经忘过"要留痕
    });

    it('只更新目标卡的掌握度，其余不动', () => {
        advance({ cardIndex: 0, newMastery: 4 });
        expect(get().sessionMastery).toEqual([4, 0, 0]);
    });

    it('传入 updatedCard 时替换该卡，未传则保留原卡', () => {
        const updated = { ...CARDS[0], reps: 9 };
        advance({ cardIndex: 0, updatedCard: updated });
        expect(get().cards[0].reps).toBe(9);
        expect(get().cards[1].reps).toBe(0);

        advance({ cardIndex: 1, updatedCard: null });
        expect(get().cards[1]).toEqual(CARDS[1]);
    });

    it('只有毕业才追加 results', () => {
        advance({ graduate: false, graduateResult: null });
        expect(get().results).toHaveLength(0);
        advance({ graduate: true, graduateResult: { word: 'x' } as never });
        expect(get().results).toHaveLength(1);
    });

    it('每次推进都递增 visitKey 并清掉上一张卡的 UI 残留', () => {
        const before = get().visitKey;
        get().setIsFlipped(true);
        get().setWriteInput('typed');
        advance();
        expect(get().visitKey).toBe(before + 1);
        expect(get().isFlipped).toBe(false);
        expect(get().writeInput).toBe('');
        expect(get().submitting).toBe(false);
    });

    it('copyWordHidden 决定下一张卡默认是否显示单词', () => {
        advance({ copyWordHidden: true });
        expect(get().copyWordVisible).toBe(false);
        advance({ copyWordHidden: false });
        expect(get().copyWordVisible).toBe(true);
    });

    it('全部毕业后队列清空，graduatedCount 等于卡数', () => {
        advance({ cardIndex: 0, graduate: true });
        advance({ cardIndex: 1, graduate: true });
        advance({ cardIndex: 2, graduate: true });
        expect(get().queue).toEqual([]);
        expect(get().graduatedCount).toBe(3);
    });
});

// ── retrySession ────────────────────────────────────────────────────────────

describe('retrySession', () => {
    beforeEach(() => {
        get().initSession({ cards: CARDS, copyRepetitions: 3, copyReviewDays: 2 });
        advance({ cardIndex: 0, graduate: true, forgotNow: true, newMastery: 3 });
    });

    it('保留卡片本身，但队列与全部进度归零', () => {
        get().retrySession(3, 2, false);
        const s = get();
        expect(s.cards).toHaveLength(3);          // 卡片不重新拉取
        expect(s.queue).toEqual([0, 1, 2]);
        expect(s.sessionMastery).toEqual([0, 0, 0]);
        expect(s.sessionForgot).toEqual([false, false, false]);
        expect(s.sessionErrorCount).toEqual([0, 0, 0]);
        expect(s.graduatedCount).toBe(0);
        expect(s.results).toEqual([]);
        expect(s.allRatings).toEqual([]);
    });

    it('按新参数重铺抄写计数', () => {
        get().retrySession(7, 5, false);
        expect(get().copyRemaining).toEqual([7, 7, 7]);
        expect(get().copyReviewDaysTemp).toEqual([5, 5, 5]);
    });

    it('visitKey 继续递增（不回退），保证卡片组件强制重挂载', () => {
        const before = get().visitKey;
        get().retrySession(3, 2, false);
        expect(get().visitKey).toBe(before + 1);
    });
});

// ── resetVocabFlashcardStore ────────────────────────────────────────────────

describe('resetVocabFlashcardStore', () => {
    it('把 store 清回初始态，避免上一次会话泄漏到下一次', () => {
        get().initSession({ cards: CARDS, copyRepetitions: 3, copyReviewDays: 2 });
        advance({ graduate: true });
        resetVocabFlashcardStore();
        const s = get();
        expect(s.cards).toEqual([]);
        expect(s.queue).toEqual([]);
        expect(s.graduatedCount).toBe(0);
        expect(s.visitKey).toBe(0);
        expect(s.results).toEqual([]);
    });
});

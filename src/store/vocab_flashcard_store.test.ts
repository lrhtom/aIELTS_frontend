/**
 * Frontend state-layer tests: the Zustand store's state transitions for a vocabulary study session.
 *
 * This is the 'frontend state' item in the unit test layer of section 7.1 - previously only the pure utility
 * functions (format / retry / ielts_band and so on) had tests, and the store that actually carries session state had none.
 *
 * Three cascading actions are covered:
 *   initSession   opening: the queue, mastery counts and copy counts are all sized from the card count
 *   advanceQueue  advancing the queue after each rating (graduated cards leave, ungraduated ones are re-queued)
 *   retrySession  another round: keep the cards, clear every bit of this round's progress
 *
 * Each of these changes a dozen fields at once, which is where 'changed A, forgot B' bugs come from - and exactly
 * why the store is worth unit testing.
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
    // Word table enrichment: real data may leave these empty, so empty values are fine here
    phonetic: '',
    grammar: '',
    definitions: [],
    examples: [],
});

const CARDS = [makeCard('alpha'), makeCard('beta'), makeCard('gamma')];

const get = () => useVocabFlashcardStore.getState();

/** Push the current card to the back of the queue when it has not graduated (the actual flashcard-mode policy on the page). */
const reinsertToTail = (rest: number[], cardIndex: number) => [...rest, cardIndex];

/** Default arguments for advanceQueue; the tests only override the fields they care about. */
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
        // three Agains on the same card followed by a Good to graduate must show 4 entries in the histogram
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
        advance({ cardIndex: 0, forgotNow: true });                    // one mistake
        advance({ cardIndex: 1 });
        advance({ cardIndex: 2 });
        advance({ cardIndex: 0, graduate: true });
        expect(get().sessionErrorCount[0]).toBe(0);   // the count is reset
        expect(get().sessionForgot[0]).toBe(true);    // but 'was forgotten at some point' must still leave a trace
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

    // The summary classifies each word into exactly one bucket, and `forgot` is
    // what decides it. It has to be stamped by the store because only the store
    // knows whether the word was ever missed *earlier* in the session — the
    // call site only knows about the current click.
    it('毕业结果打上 forgot：全程没错过的词为 false', () => {
        advance({ cardIndex: 0, forgotNow: false, graduate: true,
                  graduateResult: { word: 'alpha' } as never });
        expect(get().results[0].forgot).toBe(false);
    });

    it('毕业结果打上 forgot：先错后对的词仍为 true（只算一次重复学习）', () => {
        advance({ cardIndex: 0, forgotNow: true,  graduate: false, graduateResult: null });
        advance({ cardIndex: 0, forgotNow: false, graduate: true,
                  graduateResult: { word: 'alpha' } as never });
        expect(get().results).toHaveLength(1);
        expect(get().results[0].forgot).toBe(true);
    });

    it('毕业结果打上 forgot：最后一次答错才毕业的词也算忘过', () => {
        advance({ cardIndex: 0, forgotNow: true, graduate: true,
                  graduateResult: { word: 'alpha' } as never });
        expect(get().results[0].forgot).toBe(true);
    });

    it('forgot 按卡片各算各的，不会串到别的词上', () => {
        advance({ cardIndex: 0, forgotNow: true,  graduate: true,
                  graduateResult: { word: 'alpha' } as never });
        advance({ cardIndex: 1, forgotNow: false, graduate: true,
                  graduateResult: { word: 'beta' } as never });
        expect(get().results.map((r) => r.forgot)).toEqual([true, false]);
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
        expect(s.cards).toHaveLength(3);          // the cards are not re-fetched
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

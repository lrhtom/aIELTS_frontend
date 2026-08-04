/**
 * End-of-session summary buckets.
 *
 * The invariant these tests exist for: **one word, one bucket**. The previous
 * implementation counted clicks, so a word forgotten three times and then
 * graduated appeared in two columns at once and the row no longer summed to the
 * number of words — which is the conflict this suite now prevents from coming
 * back.
 */
import { describe, it, expect } from 'vitest';
import { summariseWordBuckets, type ReviewResult } from './vocab_flashcard_utils';

/** Only the fields the summary reads; the rest are irrelevant here. */
function word(rating: number, forgot: boolean): ReviewResult {
    return { word: 'w', zh: '词', rating, newDue: '', scheduledDays: 1, forgot };
}

const RELEARNED = 0, HARD = 1, GOOD = 2, EASY = 3;

describe('never-forgotten words go by their graduating rating', () => {
    it('Hard -> hard', () => expect(summariseWordBuckets([word(2, false)])).toEqual([0, 1, 0, 0]));
    it('Good -> good', () => expect(summariseWordBuckets([word(3, false)])).toEqual([0, 0, 1, 0]));
    it('Easy -> easy', () => expect(summariseWordBuckets([word(4, false)])).toEqual([0, 0, 0, 1]));
});

describe('a forgotten word counts as relearned and nowhere else', () => {
    it('forgotten then graduated on Good is NOT also counted as good', () => {
        const buckets = summariseWordBuckets([word(3, true)]);
        expect(buckets[RELEARNED]).toBe(1);
        expect(buckets[GOOD]).toBe(0);
    });

    it('forgotten then graduated on Easy is NOT also counted as easy', () => {
        const buckets = summariseWordBuckets([word(4, true)]);
        expect(buckets[RELEARNED]).toBe(1);
        expect(buckets[EASY]).toBe(0);
    });

    it('a word forgotten many times still counts once, not once per mistake', () => {
        // The store collapses "forgot 3x" into a single flag, so three mistakes
        // on one word can only ever produce one relearned word. The old
        // per-click code reported 3 here.
        expect(summariseWordBuckets([word(3, true)])[RELEARNED]).toBe(1);
    });
});

describe('the four buckets always sum to the number of graduated words', () => {
    it('mixed session', () => {
        const results = [
            word(3, true),    // forgotten, graduated Good
            word(3, true),    // forgotten, graduated Good
            word(4, false),   // clean Easy
            word(3, false),   // clean Good
            word(3, false),   // clean Good
            word(2, false),   // clean Hard
        ];
        const buckets = summariseWordBuckets(results);
        expect(buckets).toEqual([2, 1, 2, 1]);
        expect(buckets.reduce((a, b) => a + b, 0)).toBe(results.length);
    });

    it('holds for an all-forgotten session', () => {
        const results = [word(3, true), word(2, true), word(4, true)];
        expect(summariseWordBuckets(results)).toEqual([3, 0, 0, 0]);
    });

    it('holds for a flawless session', () => {
        const results = [word(4, false), word(4, false), word(3, false)];
        const buckets = summariseWordBuckets(results);
        expect(buckets[RELEARNED]).toBe(0);
        expect(buckets.reduce((a, b) => a + b, 0)).toBe(3);
    });

    it('empty session is all zeros', () => {
        expect(summariseWordBuckets([])).toEqual([0, 0, 0, 0]);
    });
});

describe('malformed records cannot land in the wrong bucket', () => {
    it('a graduating rating of 1 without the forgot flag clamps into hard, not out of range', () => {
        // Not reachable through the UI (rating 1 never graduates), but a legacy
        // stored record must not silently corrupt the row or throw.
        const buckets = summariseWordBuckets([word(1, false)]);
        expect(buckets[HARD]).toBe(1);
        expect(buckets.reduce((a, b) => a + b, 0)).toBe(1);
    });

    it('an out-of-range high rating clamps into easy', () => {
        expect(summariseWordBuckets([word(9, false)])[EASY]).toBe(1);
    });
});

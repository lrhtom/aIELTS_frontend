/**
 * Today's tally must survive leaving and re-entering the study page, and must
 * keep the "one word, one bucket" rule the summary depends on.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// This suite runs under the `node` environment (no DOM), so localStorage has to
// be supplied. A Map-backed stub keeps the persistence tests honest without
// pulling jsdom into a suite that otherwise needs nothing from it.
vi.stubGlobal('localStorage', (() => {
    const store = new Map<string, string>();
    return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
    };
})());
import {
    emptyProgress, localDateKey, recordGraduation, recordRating, todayWords,
    loadTodayProgress, saveTodayProgress, storageKey,
} from './vocab_today_progress';
import { summariseWordBuckets } from './vocab_flashcard_utils';
import type { ReviewResult } from './vocab_flashcard_utils';

function word(w: string, rating: number, forgot: boolean): ReviewResult {
    return { word: w, zh: `${w}-zh`, rating, newDue: '', scheduledDays: 1, forgot };
}

const TODAY = localDateKey();

describe('accumulating across sessions', () => {
    it('a second session adds to the first rather than replacing it', () => {
        let p = emptyProgress(TODAY);
        p = recordGraduation(p, word('alpha', 3, false));   // session 1
        p = recordGraduation(p, word('beta', 4, false));    // session 2
        expect(todayWords(p)).toHaveLength(2);
    });

    it('rating clicks accumulate across sessions', () => {
        let p = emptyProgress(TODAY);
        p = recordRating(p, 1);
        p = recordRating(p, 1);
        p = recordRating(p, 3);
        expect(p.ratingClicks).toEqual([2, 0, 1, 0]);
    });

    it('ignores a rating outside 1..4 instead of corrupting the array', () => {
        let p = emptyProgress(TODAY);
        p = recordRating(p, 0);
        p = recordRating(p, 9);
        expect(p.ratingClicks).toEqual([0, 0, 0, 0]);
    });
});

describe('one word, one bucket — across the whole day', () => {
    it('studying the same word twice today counts it once', () => {
        let p = emptyProgress(TODAY);
        p = recordGraduation(p, word('alpha', 3, false));
        p = recordGraduation(p, word('alpha', 4, false));
        expect(todayWords(p)).toHaveLength(1);
    });

    it('forgotten earlier today stays relearned even if the later attempt was clean', () => {
        let p = emptyProgress(TODAY);
        p = recordGraduation(p, word('alpha', 3, true));    // forgot in session 1
        p = recordGraduation(p, word('alpha', 4, false));   // clean in session 2
        expect(todayWords(p)[0].forgot).toBe(true);
        expect(summariseWordBuckets(todayWords(p))).toEqual([1, 0, 0, 0]);
    });

    it('forgetting it only in the later session also marks it relearned', () => {
        let p = emptyProgress(TODAY);
        p = recordGraduation(p, word('alpha', 4, false));
        p = recordGraduation(p, word('alpha', 3, true));
        expect(todayWords(p)[0].forgot).toBe(true);
    });

    it('the buckets still sum to the number of distinct words studied today', () => {
        let p = emptyProgress(TODAY);
        for (const [w, r, f] of [['a', 3, true], ['b', 4, false], ['c', 3, false], ['a', 4, false]] as const) {
            p = recordGraduation(p, word(w, r, f));
        }
        const words = todayWords(p);
        expect(words).toHaveLength(3);
        expect(summariseWordBuckets(words).reduce((x, y) => x + y, 0)).toBe(3);
    });
});

describe('persistence', () => {
    beforeEach(() => localStorage.clear());

    it('round-trips through storage so leaving and returning keeps the tally', () => {
        let p = emptyProgress(TODAY);
        p = recordGraduation(p, word('alpha', 3, true));
        p = recordRating(p, 1);
        saveTodayProgress(p, 7, 'learner');

        const back = loadTodayProgress(7, 'learner');
        expect(todayWords(back)).toHaveLength(1);
        expect(back.words.alpha.forgot).toBe(true);
        expect(back.ratingClicks).toEqual([1, 0, 0, 0]);
    });

    it('yesterday\'s tally is discarded, not shown as today', () => {
        const stale = { ...emptyProgress('2000-01-01'), words: { old: word('old', 3, false) } };
        localStorage.setItem(storageKey(7, 'learner'), JSON.stringify(stale));
        expect(todayWords(loadTodayProgress(7, 'learner'))).toEqual([]);
    });

    it('plans are tallied separately', () => {
        saveTodayProgress(recordGraduation(emptyProgress(TODAY), word('alpha', 3, false)), 7, 'learner');
        expect(todayWords(loadTodayProgress(8, 'learner'))).toEqual([]);
    });

    it('users are tallied separately on a shared browser', () => {
        saveTodayProgress(recordGraduation(emptyProgress(TODAY), word('alpha', 3, false)), 7, 'anna');
        expect(todayWords(loadTodayProgress(7, 'bob'))).toEqual([]);
    });

    it('corrupt storage degrades to an empty tally instead of throwing', () => {
        localStorage.setItem(storageKey(7, 'learner'), '{not json');
        expect(() => loadTodayProgress(7, 'learner')).not.toThrow();
        expect(todayWords(loadTodayProgress(7, 'learner'))).toEqual([]);
    });

    it('a tally missing its clicks array still loads', () => {
        localStorage.setItem(storageKey(7, 'learner'), JSON.stringify({ date: TODAY, words: {} }));
        expect(loadTodayProgress(7, 'learner').ratingClicks).toEqual([0, 0, 0, 0]);
    });
});

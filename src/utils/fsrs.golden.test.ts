/**
 * Drift anchor for the frontend FSRS port.
 *
 * The table below is **not hand-written**: it was exported directly from the real `fsrs_schedule()` in
 * `backend/api/core/fsrs_utils.py` (see the note on the export script). If either side changes a weight or a
 * formula without the other following, this goes red immediately.
 *
 * To regenerate: run a short shell script in the backend directory that walks the same cases through fsrs_schedule
 * and dumps scheduledDays / stability / state as JSON to paste back here.
 *
 * Coverage: new / learning / relearning / review (very low to very high stability, hard cards, same-day review) x four ratings = 44 combinations.
 */
import { describe, it, expect } from 'vitest';
import { previewInterval, W, DECAY, FACTOR } from './fsrs';

interface GoldenRow {
    label: string;
    state: number;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    expect: Record<string, { scheduledDays: number; stability: number; difficulty: number; state: number }>;
}

const GOLDEN: GoldenRow[] = [
    {
        "label": "new",
        "state": 0,
        "stability": 0.0,
        "difficulty": 0.0,
        "elapsedDays": 0,
        "expect": {
            "1": {
                "scheduledDays": 1,
                "stability": 0.4072,
                "difficulty": 7.2102,
                "state": 1
            },
            "2": {
                "scheduledDays": 1,
                "stability": 1.1829,
                "difficulty": 6.5085,
                "state": 1
            },
            "3": {
                "scheduledDays": 1,
                "stability": 3.1262,
                "difficulty": 5.3146,
                "state": 1
            },
            "4": {
                "scheduledDays": 15,
                "stability": 15.4722,
                "difficulty": 3.2829,
                "state": 2
            }
        }
    },
    {
        "label": "learning_small",
        "state": 1,
        "stability": 0.41,
        "difficulty": 5.82,
        "elapsedDays": 1,
        "expect": {
            "1": {
                "scheduledDays": 1,
                "stability": 0.4072,
                "difficulty": 7.6753,
                "state": 1
            },
            "2": {
                "scheduledDays": 1,
                "stability": 0.2462,
                "difficulty": 6.6729,
                "state": 1
            },
            "3": {
                "scheduledDays": 1,
                "stability": 0.41,
                "difficulty": 5.6706,
                "state": 1
            },
            "4": {
                "scheduledDays": 1,
                "stability": 0.6828,
                "difficulty": 4.6682,
                "state": 2
            }
        }
    },
    {
        "label": "learning_mid",
        "state": 1,
        "stability": 2.44,
        "difficulty": 5.82,
        "elapsedDays": 2,
        "expect": {
            "1": {
                "scheduledDays": 1,
                "stability": 0.4072,
                "difficulty": 7.6753,
                "state": 1
            },
            "2": {
                "scheduledDays": 1,
                "stability": 1.4652,
                "difficulty": 6.6729,
                "state": 1
            },
            "3": {
                "scheduledDays": 1,
                "stability": 2.44,
                "difficulty": 5.6706,
                "state": 1
            },
            "4": {
                "scheduledDays": 4,
                "stability": 4.0633,
                "difficulty": 4.6682,
                "state": 2
            }
        }
    },
    {
        "label": "relearning",
        "state": 3,
        "stability": 1.2,
        "difficulty": 6.5,
        "elapsedDays": 1,
        "expect": {
            "1": {
                "scheduledDays": 1,
                "stability": 0.4072,
                "difficulty": 8.3152,
                "state": 3
            },
            "2": {
                "scheduledDays": 1,
                "stability": 0.7206,
                "difficulty": 7.3129,
                "state": 3
            },
            "3": {
                "scheduledDays": 1,
                "stability": 1.2,
                "difficulty": 6.3105,
                "state": 3
            },
            "4": {
                "scheduledDays": 2,
                "stability": 1.9983,
                "difficulty": 5.3081,
                "state": 2
            }
        }
    },
    {
        "label": "review_tiny",
        "state": 2,
        "stability": 0.44,
        "difficulty": 8.9,
        "elapsedDays": 1,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 0.1904,
                "difficulty": 10.0,
                "state": 3
            },
            "2": {
                "scheduledDays": 1,
                "stability": 0.6323,
                "difficulty": 9.5715,
                "state": 2
            },
            "3": {
                "scheduledDays": 1,
                "stability": 1.3797,
                "difficulty": 8.5692,
                "state": 2
            },
            "4": {
                "scheduledDays": 3,
                "stability": 3.2494,
                "difficulty": 7.5668,
                "state": 2
            }
        }
    },
    {
        "label": "review_low",
        "state": 2,
        "stability": 5.0,
        "difficulty": 5.0,
        "elapsedDays": 3,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 1.2017,
                "difficulty": 6.9036,
                "state": 3
            },
            "2": {
                "scheduledDays": 6,
                "stability": 6.3303,
                "difficulty": 5.9012,
                "state": 2
            },
            "3": {
                "scheduledDays": 11,
                "stability": 11.499,
                "difficulty": 4.8989,
                "state": 2
            },
            "4": {
                "scheduledDays": 24,
                "stability": 24.4307,
                "difficulty": 3.8965,
                "state": 2
            }
        }
    },
    {
        "label": "review_mid",
        "state": 2,
        "stability": 148.423,
        "difficulty": 2.297,
        "elapsedDays": 88,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 6.3355,
                "difficulty": 4.3598,
                "state": 3
            },
            "2": {
                "scheduledDays": 182,
                "stability": 181.9824,
                "difficulty": 3.3574,
                "state": 2
            },
            "3": {
                "scheduledDays": 312,
                "stability": 312.3671,
                "difficulty": 2.3551,
                "state": 2
            },
            "4": {
                "scheduledDays": 639,
                "stability": 638.5832,
                "difficulty": 1.3527,
                "state": 2
            }
        }
    },
    {
        "label": "review_high",
        "state": 2,
        "stability": 372.899,
        "difficulty": 1.337,
        "elapsedDays": 69,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 9.302,
                "difficulty": 3.4563,
                "state": 3
            },
            "2": {
                "scheduledDays": 399,
                "stability": 399.4071,
                "difficulty": 2.454,
                "state": 2
            },
            "3": {
                "scheduledDays": 502,
                "stability": 502.3961,
                "difficulty": 1.4516,
                "state": 2
            },
            "4": {
                "scheduledDays": 760,
                "stability": 760.0695,
                "difficulty": 1.0,
                "state": 2
            }
        }
    },
    {
        "label": "review_max",
        "state": 2,
        "stability": 643.51,
        "difficulty": 1.337,
        "elapsedDays": 120,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 11.2771,
                "difficulty": 3.4563,
                "state": 3
            },
            "2": {
                "scheduledDays": 686,
                "stability": 685.8794,
                "difficulty": 2.454,
                "state": 2
            },
            "3": {
                "scheduledDays": 850,
                "stability": 850.4927,
                "difficulty": 1.4516,
                "state": 2
            },
            "4": {
                "scheduledDays": 1262,
                "stability": 1262.3468,
                "difficulty": 1.0,
                "state": 2
            }
        }
    },
    {
        "label": "review_hard_card",
        "state": 2,
        "stability": 30.0,
        "difficulty": 9.5,
        "elapsedDays": 10,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 2.827,
                "difficulty": 10.0,
                "state": 3
            },
            "2": {
                "scheduledDays": 31,
                "stability": 30.8655,
                "difficulty": 10.0,
                "state": 2
            },
            "3": {
                "scheduledDays": 34,
                "stability": 34.2281,
                "difficulty": 9.1338,
                "state": 2
            },
            "4": {
                "scheduledDays": 43,
                "stability": 42.641,
                "difficulty": 8.1314,
                "state": 2
            }
        }
    },
    {
        "label": "review_fresh",
        "state": 2,
        "stability": 60.0,
        "difficulty": 4.0,
        "elapsedDays": 0,
        "expect": {
            "1": {
                "scheduledDays": 0,
                "stability": 4.1199,
                "difficulty": 5.9625,
                "state": 3
            },
            "2": {
                "scheduledDays": 60,
                "stability": 60.0,
                "difficulty": 4.9601,
                "state": 2
            },
            "3": {
                "scheduledDays": 60,
                "stability": 60.0,
                "difficulty": 3.9578,
                "state": 2
            },
            "4": {
                "scheduledDays": 60,
                "stability": 60.0,
                "difficulty": 2.9554,
                "state": 2
            }
        }
    }
];

const RATING_NAME: Record<string, string> = { '1': 'Again', '2': 'Hard', '3': 'Good', '4': 'Easy' };

describe('FSRS 前端移植 vs 后端黄金表', () => {
    it('权重表与后端一致（改了这里就等于改了所有用户的排期）', () => {
        expect(W.length).toBe(21);
        expect(W[0]).toBe(0.4072);
        expect(W[3]).toBe(15.4722);   // initial stability of a new card rated Easy
        expect(W[15]).toBe(0.2047);   // Hard penalty
        expect(W[16]).toBe(2.9898);   // Easy bonus
        expect(W[17]).toBe(0.51);     // short-term stability coefficient
        expect(DECAY).toBe(-0.5);
        expect(FACTOR).toBeCloseTo(0.2346, 4);
    });

    for (const row of GOLDEN) {
        for (const rating of ['1', '2', '3', '4']) {
            const want = row.expect[rating];
            it(`${row.label} + ${RATING_NAME[rating]} → ${want.scheduledDays} 天`, () => {
                const got = previewInterval(
                    { state: row.state, stability: row.stability, difficulty: row.difficulty, elapsedDays: row.elapsedDays },
                    Number(rating),
                );
                expect(got.scheduledDays).toBe(want.scheduledDays);
                expect(got.state).toBe(want.state);
                expect(got.stability).toBeCloseTo(want.stability, 3);
                expect(got.difficulty).toBeCloseTo(want.difficulty, 3);
            });
        }
    }
});

describe('回归：旧启发式错在哪（这些断言就是当初的 bug）', () => {
    it('新卡评 Easy 是 15 天，不是兜底出来的 4 天', () => {
        expect(previewInterval({ state: 0, stability: 0, difficulty: 0 }, 4).scheduledDays).toBe(15);
    });

    it('复习阶段评 Hard，间隔只会变长，绝不缩短', () => {
        const card = { state: 2, stability: 148.423, difficulty: 2.297, elapsedDays: 88 };
        const hard = previewInterval(card, 2).scheduledDays;
        expect(hard).toBeGreaterThan(card.stability);   // the old code's x0.6 would give 89 days
    });

    it('复习阶段 Again 走 5 分钟分支（scheduledDays = 0）而不是按天排', () => {
        const r = previewInterval({ state: 2, stability: 100, difficulty: 5, elapsedDays: 10 }, 1);
        expect(r.scheduledDays).toBe(0);
        expect(r.state).toBe(3);                        // → Relearning
    });

    it('四个评级的间隔严格递增（Hard < Good < Easy）', () => {
        const card = { state: 2, stability: 60, difficulty: 4, elapsedDays: 30 };
        const [hard, good, easy] = [2, 3, 4].map(r => previewInterval(card, r).scheduledDays);
        expect(hard).toBeLessThan(good);
        expect(good).toBeLessThan(easy);
    });
});

// IELTS 原始分 → 9 分制换算（满分 40 题的全套卷）。
// 换算表为剑桥官方练习册（Cambridge IELTS series）公布的 Academic 对照表。
// 仅对"全套"模式有意义：单题型练习 / 单篇 passage / 单 section 不适用。

type BandRow = [minRaw: number, band: number];

// 听力（Academic 与 General 相同）
const LISTENING_BANDS: BandRow[] = [
    [39, 9.0], [37, 8.5], [35, 8.0], [32, 7.5], [30, 7.0],
    [26, 6.5], [23, 6.0], [18, 5.5], [16, 5.0], [13, 4.5],
    [10, 4.0], [8, 3.5], [6, 3.0], [4, 2.5], [2, 2.0], [1, 1.0],
];

// Academic 阅读
const READING_BANDS: BandRow[] = [
    [39, 9.0], [37, 8.5], [35, 8.0], [33, 7.5], [30, 7.0],
    [27, 6.5], [23, 6.0], [19, 5.5], [15, 5.0], [13, 4.5],
    [10, 4.0], [8, 3.5], [6, 3.0], [4, 2.5], [2, 2.0], [1, 1.0],
];

/**
 * 把全套卷的答对题数换算成雅思 9 分制分数。
 *
 * @param total 卷面总题数 — 低于 38 视为非全套（如单篇/单 section/脏数据），返回 null 不展示。
 *   38/39 容忍：历史题库里存在改版前生成的 39 题套卷，按同一张表换算误差可忽略。
 */
export function rawToBand(skill: 'reading' | 'listening', correct: number, total: number): number | null {
    if (total < 38) return null;
    const table = skill === 'reading' ? READING_BANDS : LISTENING_BANDS;
    for (const [minRaw, band] of table) {
        if (correct >= minRaw) return band;
    }
    return correct > 0 ? 1.0 : 0;
}

/** 展示格式："6.5"（整数分也保留一位小数，与雅思成绩单一致） */
export function formatBand(band: number): string {
    return band.toFixed(1);
}

/**
 * 四科均分 → 雅思官方总分舍入规则：
 * 小数部分 < .25 → 舍到整数；[.25, .75) → .5；>= .75 → 进到下一整数。
 * 例：6.125 → 6.0；6.25 → 6.5；6.625 → 6.5；6.75 → 7.0。
 */
export function roundIeltsOverall(mean: number): number {
    const clamped = Math.max(0, Math.min(9, mean));
    const floor = Math.floor(clamped);
    const frac = clamped - floor;
    if (frac < 0.25) return floor;
    if (frac < 0.75) return floor + 0.5;
    return floor + 1;
}

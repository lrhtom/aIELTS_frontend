// IELTS raw score -> 9-band conversion (for a complete 40-question paper).
// The conversion table is the Academic table published in the official Cambridge IELTS practice books.
// Only meaningful in 'full' mode: single question types, single passages and single sections do not apply.

type BandRow = [minRaw: number, band: number];

// Listening (identical for Academic and General)
const LISTENING_BANDS: BandRow[] = [
    [39, 9.0], [37, 8.5], [35, 8.0], [32, 7.5], [30, 7.0],
    [26, 6.5], [23, 6.0], [18, 5.5], [16, 5.0], [13, 4.5],
    [10, 4.0], [8, 3.5], [6, 3.0], [4, 2.5], [2, 2.0], [1, 1.0],
];

// Academic reading
const READING_BANDS: BandRow[] = [
    [39, 9.0], [37, 8.5], [35, 8.0], [33, 7.5], [30, 7.0],
    [27, 6.5], [23, 6.0], [19, 5.5], [15, 5.0], [13, 4.5],
    [10, 4.0], [8, 3.5], [6, 3.0], [4, 2.5], [2, 2.0], [1, 1.0],
];

/**
 * Convert the number of correct answers on a full paper into an IELTS 9-band score.
 *
 * @param total questions on the paper - below 38 it is not a full paper (a single passage, a single section, or dirty data) and this returns null so nothing is shown.
 *   38/39 are tolerated: the bank holds papers of 39 questions generated before a revision, and the same table gives a negligible error.
 */
export function rawToBand(skill: 'reading' | 'listening', correct: number, total: number): number | null {
    if (total < 38) return null;
    const table = skill === 'reading' ? READING_BANDS : LISTENING_BANDS;
    for (const [minRaw, band] of table) {
        if (correct >= minRaw) return band;
    }
    return correct > 0 ? 1.0 : 0;
}

/** Display format: '6.5' (whole scores keep one decimal place, matching an IELTS report form) */
export function formatBand(band: number): string {
    return band.toFixed(1);
}

/**
 * Average of the four skills -> the official IELTS rounding rule:
 * a fractional part < .25 rounds down to the whole number; [.25, .75) rounds to .5; >= .75 rounds up to the next whole number.
 * For example 6.125 -> 6.0; 6.25 -> 6.5; 6.625 -> 6.5; 6.75 -> 7.0.
 */
export function roundIeltsOverall(mean: number): number {
    const clamped = Math.max(0, Math.min(9, mean));
    const floor = Math.floor(clamped);
    const frac = clamped - floor;
    if (frac < 0.25) return floor;
    if (frac < 0.75) return floor + 0.5;
    return floor + 1;
}

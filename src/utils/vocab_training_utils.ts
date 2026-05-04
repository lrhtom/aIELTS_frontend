/* ── Types ─────────────────────────────────────────────────────────────────── */

export type VocabMode = 'mcq' | 'dictation' | 'complete';

export interface VocabEntry {
    en: string;
    zh: string;
}

export interface PracticeQuestion {
    en: string;
    zh: string;
    options?: string[];
    correctIndex?: number;
    maskedWord?: string;
}

/* ── Parse input ───────────────────────────────────────────────────────────── */

export function parseVocabInput(raw: string): VocabEntry[] {
    return raw
        .split('\n')
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            const dashSep = trimmed.indexOf(' - ');
            if (dashSep !== -1) {
                const en = trimmed.slice(0, dashSep).trim();
                const zh = trimmed.slice(dashSep + 3).trim();
                if (en && zh) return { en, zh };
            }

            const colonSep = trimmed.indexOf(': ');
            if (colonSep !== -1) {
                const en = trimmed.slice(0, colonSep).trim();
                const zh = trimmed.slice(colonSep + 2).trim();
                if (en && zh) return { en, zh };
            }

            const zhMatch = /[一-龥]/.exec(trimmed);
            if (zhMatch && zhMatch.index !== undefined) {
                const en = trimmed.slice(0, zhMatch.index).replace(/[-\s]+$/, '').trim();
                const zh = trimmed.slice(zhMatch.index).trim();
                if (en && zh) return { en, zh };
            }

            return null;
        })
        .filter(Boolean) as VocabEntry[];
}

/* ── Shuffle ───────────────────────────────────────────────────────────────── */

export function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ── Build questions ───────────────────────────────────────────────────────── */

export function buildMcqQuestions(entries: VocabEntry[], shuffleWordOrder: boolean): PracticeQuestion[] {
    const orderedEntries = shuffleWordOrder ? shuffle(entries) : [...entries];
    return orderedEntries.map((entry, _idx, arr) => {
        const others = arr.filter((e) => e.en !== entry.en);
        const pool = others.length >= 3 ? others : [...others, ...others, ...others];
        const distractors = shuffle(pool).slice(0, 3).map((e) => e.zh);
        const rawOptions = shuffle([entry.zh, ...distractors]);
        const correctIndex = rawOptions.indexOf(entry.zh);
        return { en: entry.en, zh: entry.zh, options: rawOptions, correctIndex };
    });
}

export function buildDictationQuestions(entries: VocabEntry[], shuffleWordOrder: boolean): PracticeQuestion[] {
    const orderedEntries = shuffleWordOrder ? shuffle(entries) : [...entries];
    return orderedEntries.map((entry) => ({ en: entry.en, zh: entry.zh }));
}

export function createMaskedWord(word: string): string {
    const chars = word.split('');
    const letterIndexes = chars
        .map((ch, idx) => (/[a-zA-Z]/.test(ch) ? idx : -1))
        .filter((idx) => idx !== -1);

    if (letterIndexes.length === 0) return word;

    const firstLetterIndex = letterIndexes[0];
    const otherLetterIndexes = letterIndexes.slice(1);

    const minExtra = Math.ceil(letterIndexes.length * 0.1);
    const maxExtra = Math.ceil(letterIndexes.length * 0.25);
    const extraRevealCount = Math.min(
        otherLetterIndexes.length,
        Math.max(0, minExtra + Math.floor(Math.random() * (Math.max(1, maxExtra - minExtra + 1)))),
    );

    const revealSet = new Set<number>([
        firstLetterIndex,
        ...shuffle(otherLetterIndexes).slice(0, extraRevealCount),
    ]);

    if (revealSet.size >= letterIndexes.length) {
        const hideCandidatePool = otherLetterIndexes.length > 0 ? otherLetterIndexes : [firstLetterIndex];
        const hideIndex = hideCandidatePool[Math.floor(Math.random() * hideCandidatePool.length)];
        revealSet.delete(hideIndex);
    }

    return chars
        .map((ch, idx) => (/[a-zA-Z]/.test(ch) ? (revealSet.has(idx) ? ch : '_') : ch))
        .join('');
}

export function buildCompleteQuestions(entries: VocabEntry[], shuffleWordOrder: boolean): PracticeQuestion[] {
    const orderedEntries = shuffleWordOrder ? shuffle(entries) : [...entries];
    return orderedEntries.map((entry) => ({
        en: entry.en,
        zh: entry.zh,
        maskedWord: createMaskedWord(entry.en),
    }));
}

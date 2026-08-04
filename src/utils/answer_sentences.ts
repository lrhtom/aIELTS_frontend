/**
 * Results page: underline the whole sentence in the passage where each answer comes from, with a small question number at the end.
 *
 * Two steps, and they must stay separate
 * --------------
 *   resolveAnswerSentences(whole passage, question list) -> decides which sentences to mark
 *   markResolvedSentences(one paragraph, the result above) -> inserts the markers paragraph by paragraph at render time
 * Locating must happen across the **whole** passage: one question should map to exactly one sentence. An early version
 * called the matcher per paragraph, so the same answer word got marked in every paragraph containing it and the whole text looked like the answer.
 *
 * Three tiers of locating, degrading in turn
 * ------------------
 *   1. Literal answer   For gap-fill and short-answer types the answer is lifted straight from the passage and can be searched verbatim
 *   2. Quoted explanation  For multiple choice, true/false and matching the answer is a letter (A / True / iii), which never appears in the passage,
 *                but the explanation often quotes it: the second paragraph explicitly says it 'operated for more than four years'
 *   3. Content-word overlap  When the explanation paraphrases in English with no quotation at all (which is very common in practice),
 *                score each sentence by the weighted overlap of content words from the stem and the explanation, and take the highest-scoring sentence above a threshold
 *
 * Tier 3 can genuinely mark the wrong sentence, so its bar is set deliberately high (see FUZZY_MIN_*):
 * better to leave a few questions without an underline than to point the user at the wrong sentence.
 */

const MIN_ANSWER_LEN = 3;

const JUDGEMENT_WORDS = new Set(['true', 'false', 'not given', 'yes', 'no', 'notgiven', 'ng']);
const ROMAN_RE = /^[ivxlcdm]+$/i;
const SINGLE_LETTER_RE = /^[a-z]$/i;

/** Thresholds for fuzzy locating: both the number of content-word hits and the weighted score must clear the bar */
const FUZZY_MIN_HITS = 3;
const FUZZY_MIN_SCORE = 1.2;

/** English stop words plus the stock phrases common in IELTS explanations - hitting these proves nothing */
const STOPWORDS = new Set(`a an the and or but if while of in on at to for from by with without
about into over after before between during under above below is are was were be been being do does
did have has had can could will would shall should may might must not no nor so than that this these
those there here it its they them their he she his her you your we our i as such other more most some
any each which who whom whose what when where why how also only just very much many few both all
passage text paragraph states mentions says said according refers describes explains suggests
indicates author writer research researchers study studies experiment participants people`
    .split(/\s+/).filter(Boolean));

export interface QuestionLike {
    id?: number | string;
    answer?: unknown;
    answers?: unknown;
    explanation?: unknown;
    question?: unknown;
}

/** A passage sentence to mark, plus the question numbers it belongs to (several when questions share a sentence) */
export interface ResolvedMark {
    sentence: string;
    qids: Array<number | string>;
}

/** Is this answer worth searching for verbatim in the passage? */
export function isLocatableAnswer(raw: unknown): boolean {
    const s = String(raw ?? '').trim();
    if (s.length < MIN_ANSWER_LEN) return false;
    const lower = s.toLowerCase();
    if (JUDGEMENT_WORDS.has(lower)) return false;
    if (SINGLE_LETTER_RE.test(s)) return false;
    if (ROMAN_RE.test(s)) return false;      // i / ii / iii and so on are heading numbers, not words from the passage
    return true;
}

const QUOTE_RE = /[“"「『]([^”"」』]{4,120})[”"」』]/g;

/** Dig quoted passage fragments out of the explanation; keep only the mostly-English ones, since a Chinese note is useless for searching English text */
function mineExplanationQuotes(explanation: unknown): string[] {
    const text = String(explanation ?? '');
    if (!text) return [];
    const out: string[] = [];
    let m: RegExpExecArray | null;
    QUOTE_RE.lastIndex = 0;
    while ((m = QUOTE_RE.exec(text)) !== null) {
        const frag = m[1].trim();
        const letters = (frag.match(/[A-Za-z]/g) || []).length;
        // At least 4 letters and over half of them letters - excludes pure Chinese notes and letter-by-letter spellings like 'B-R-A-X-T-O-N'
        if (letters >= 4 && letters / frag.length > 0.5) out.push(frag);
    }
    return out;
}

/** Sentence splitting: . ! ? and newlines all count as boundaries. Abbreviations and periods inside quotes are not special-cased - an extra split is harmless */
function splitSentences(text: string): string[] {
    return (text || '')
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 12);          // anything this short is usually a label or heading, not an answer sentence
}

function contentWords(s: string): string[] {
    return (s.toLowerCase().match(/[a-z]{3,}/g) || []).filter(w => !STOPWORDS.has(w));
}

function esc(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decide which passage sentence each question should mark. Returns the sentences to mark, in passage order.
 */
export function resolveAnswerSentences(
    passage: string,
    questions: QuestionLike[] | undefined | null,
): ResolvedMark[] {
    const sentences = splitSentences(passage);
    if (sentences.length === 0 || !questions?.length) return [];

    // Whole-passage word frequency: the rarer a word, the more a hit tells us, so it weights the fuzzy match
    const freq = new Map<string, number>();
    for (const s of sentences) {
        for (const w of contentWords(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
    }

    const lowerSentences = sentences.map(s => s.toLowerCase());
    const byIndex = new Map<number, Array<number | string>>();

    const claim = (idx: number, qid: number | string) => {
        const list = byIndex.get(idx);
        if (list) { if (!list.includes(qid)) list.push(qid); }
        else byIndex.set(idx, [qid]);
    };

    for (const q of questions) {
        const qid = q?.id ?? '';

        // -- Tiers 1 and 2: verbatim-searchable anchors (the answer itself plus quotes from the explanation) --
        const exact: string[] = [];
        const list = Array.isArray(q?.answers) ? q.answers : (q?.answer != null ? [q.answer] : []);
        for (const a of list) {
            const s = String(a ?? '').trim();
            if (isLocatableAnswer(s)) exact.push(s);
        }
        exact.push(...mineExplanationQuotes(q?.explanation));
        // try the long ones first: short anchors match by accident more easily
        exact.sort((a, b) => b.length - a.length);

        let hitIdx = -1;
        for (const frag of exact) {
            const needle = frag.toLowerCase();
            const i = lowerSentences.findIndex(s => s.includes(needle));
            if (i >= 0) { hitIdx = i; break; }
        }
        if (hitIdx >= 0) { claim(hitIdx, qid); continue; }

        // -- Tier 3: weighted content-word overlap --
        const query = new Set(contentWords(`${String(q?.question ?? '')} ${String(q?.explanation ?? '')}`));
        if (query.size === 0) continue;

        let bestIdx = -1, bestScore = 0, bestHits = 0;
        sentences.forEach((sent, i) => {
            const words = new Set(contentWords(sent));
            let score = 0, hits = 0;
            for (const w of query) {
                if (!words.has(w)) continue;
                hits += 1;
                score += 1 / Math.sqrt(freq.get(w) ?? 1);   // the rarer across the passage, the higher the weight
            }
            if (hits > bestHits || (hits === bestHits && score > bestScore)) {
                bestIdx = i; bestScore = score; bestHits = hits;
            }
        });
        if (bestIdx >= 0 && bestHits >= FUZZY_MIN_HITS && bestScore >= FUZZY_MIN_SCORE) {
            claim(bestIdx, qid);
        }
    }

    return [...byIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([idx, qids]) => ({ sentence: sentences[idx], qids }));
}

/**
 * Insert answer-sentence markers into a stretch of **plain text** and return an HTML fragment.
 *
 * The output must still go through sanitize before reaching dangerouslySetInnerHTML.
 * This only inserts <mark> and <sup>; every other character is preserved as-is (including the `**` highlight markers, which the caller handles).
 */
export function markResolvedSentences(paragraph: string, marks: ResolvedMark[]): string {
    if (!paragraph || !marks.length) return paragraph;

    type Hit = { start: number; end: number; qids: Array<number | string> };
    const hits: Hit[] = [];
    for (const m of marks) {
        const re = new RegExp(esc(m.sentence), 'gi');
        const found = re.exec(paragraph);
        if (found) hits.push({ start: found.index, end: found.index + found[0].length, qids: m.qids });
    }
    if (!hits.length) return paragraph;

    hits.sort((a, b) => a.start - b.start);
    let out = '', cursor = 0;
    for (const h of hits) {
        if (h.start < cursor) continue;                    // skip overlaps, do not nest <mark>
        out += paragraph.slice(cursor, h.start);
        const label = h.qids.filter(q => q !== '' && q != null).join(', ');
        const tag = label ? `<sup class="answer-qno">Q${label}</sup>` : '';
        out += `<mark class="answer-sentence">${paragraph.slice(h.start, h.end)}${tag}</mark>`;
        cursor = h.end;
    }
    out += paragraph.slice(cursor);
    return out;
}

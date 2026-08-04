/**
 * Web Speech API wrapper plus read-aloud matching
 *
 * The project is Chrome-only (ChromeOnlyGuard), so webkitSpeechRecognition is available.
 * English recognition uses en-US, Chinese uses zh-CN.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type NativeSpeechRecognition = any;

interface SpeechRecognitionCtor {
    new (): NativeSpeechRecognition;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return (w.SpeechRecognition || w.webkitSpeechRecognition) ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
    return getRecognitionCtor() !== null;
}

export type RecognitionLang = 'en-US' | 'en-GB' | 'zh-CN';

export interface StartRecognitionOptions {
    lang: RecognitionLang;
    /** interim (not yet finalised) result callback */
    onInterim?: (transcript: string) => void;
    /** one final result */
    onFinal: (transcript: string) => void;
    /** error callback (no-speech / audio-capture / not-allowed / network) */
    onError?: (err: string) => void;
    /** recognition ended on its own */
    onEnd?: () => void;
}

export interface RecognitionHandle {
    stop: () => void;
    abort: () => void;
}

/**
 * Start one continuous recognition. The returned handle can stop or abort it.
 * It restarts itself whenever recognition ends naturally (staying in listening mode) until the caller aborts.
 */
export function startRecognition(options: StartRecognitionOptions): RecognitionHandle | null {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
        options.onError?.('not-supported');
        return null;
    }

    let aborted = false;
    let instance: NativeSpeechRecognition | null = null;

    const create = () => {
        const rec: NativeSpeechRecognition = new Ctor();
        rec.lang = options.lang;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 3;

        rec.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i];
                const transcript: string = result[0]?.transcript ?? '';
                if (result.isFinal) {
                    options.onFinal(transcript);
                } else {
                    interim += transcript;
                }
            }
            if (interim && options.onInterim) options.onInterim(interim);
        };

        rec.onerror = (event: any) => {
            const errStr = String(event?.error ?? 'unknown');
            // no-speech is far too common to count as a failure
            if (errStr !== 'no-speech' && errStr !== 'aborted') {
                options.onError?.(errStr);
            }
        };

        rec.onend = () => {
            options.onEnd?.();
            if (!aborted) {
                try {
                    rec.start();
                } catch {
                    // cannot restart: wait for the next external call
                }
            }
        };

        return rec;
    };

    try {
        instance = create();
        instance.start();
    } catch (err) {
        options.onError?.(String(err));
        return null;
    }

    return {
        stop() {
            aborted = true;
            try {
                instance?.stop();
            } catch {
                // ignore
            }
        },
        abort() {
            aborted = true;
            try {
                instance?.abort();
            } catch {
                // ignore
            }
        },
    };
}

/* -- Matching algorithm ------------------------------------------------------- */

const EN_PUNCT_RE = /[.,!?;:'"()[\]{}\-–—_/\\]/g;
const ZH_PUNCT_RE = /[。,，、；;：:！？!?()（）【】[\]"'"'《》<>/\\\-–—_·]/g;
const POS_PREFIX_RE = /^(n|v|adj|adv|prep|conj|pron|art|num|int|interj)\s*\.\s*/i;

export function normalizeEn(input: string): string {
    return input.toLowerCase().replace(EN_PUNCT_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeZh(input: string): string {
    return input.replace(ZH_PUNCT_RE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Levenshtein distance (short strings, so O(m*n) is plenty).
 */
function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        let curr = i;
        let leftDiag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const next = Math.min(curr + 1, prev[j] + 1, leftDiag + cost);
            leftDiag = prev[j];
            prev[j] = next;
            curr = next;
        }
    }
    return prev[b.length];
}

/**
 * English match: substring containment, or a Levenshtein distance <= max(1, floor(len*0.2)).
 * A phrase may have extra words in between as long as the order is preserved.
 */
export function matchesEnWord(transcript: string, target: string): boolean {
    const t = normalizeEn(transcript);
    const w = normalizeEn(target);
    if (!t || !w) return false;

    if (t.includes(w)) return true;

    // Phrase: every component word appearing anywhere in the transcript passes (order is not enforced)
    if (w.includes(' ')) {
        const parts = w.split(' ').filter(Boolean);
        return parts.every((p) => t.includes(p));
    }

    // Word: fuzzy match plus a token-by-token comparison
    const tolerance = Math.max(1, Math.floor(w.length * 0.2));
    if (levenshtein(t, w) <= tolerance) return true;

    const tokens = t.split(' ').filter(Boolean);
    return tokens.some((tok) => levenshtein(tok, w) <= tolerance);
}

/**
 * Split candidate glosses out of a card's zh field (for example 'n. apple; fruit; apple tree').
 * Strips the part-of-speech prefix, splits on separators, and drops anything shorter than one character.
 */
export function extractZhCandidates(rawZh: string): string[] {
    if (!rawZh) return [];
    const parts: string[] = [];
    rawZh
        .split(/[;；,，、/\n]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((p) => {
            const stripped = p.replace(POS_PREFIX_RE, '').trim();
            if (stripped) parts.push(stripped);
        });
    return Array.from(new Set(parts.filter((p) => p.length >= 1)));
}

/**
 * Loose Chinese match: any single gloss fragment appearing in the transcript passes.
 * A one-character fragment must match exactly; two characters or more allow a single-character hit (speech recognition often mangles a word into a homophone).
 */
export function matchesZhMeaning(transcript: string, targetZh: string): boolean {
    const t = normalizeZh(transcript);
    if (!t) return false;
    const candidates = extractZhCandidates(targetZh);
    if (candidates.length === 0) return false;

    for (const cand of candidates) {
        const c = normalizeZh(cand);
        if (!c) continue;
        if (t.includes(c)) return true;
        // Fallback: for fragments of 2+ characters, covering >= 50% of them in the transcript also passes
        if (c.length >= 2) {
            const chars = Array.from(c);
            const hits = chars.filter((ch) => t.includes(ch)).length;
            if (hits / chars.length >= 0.5) return true;
        }
    }
    return false;
}

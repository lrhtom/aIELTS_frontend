/**
 * Web Speech API 封装 + 朗读匹配
 *
 * 项目已 Chrome-only（ChromeOnlyGuard），webkitSpeechRecognition 可用。
 * 英文识别用 en-US，中文识别用 zh-CN。
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
    /** interim (未定型) 结果回调 */
    onInterim?: (transcript: string) => void;
    /** 一次 final 结果 */
    onFinal: (transcript: string) => void;
    /** 出错回调（no-speech / audio-capture / not-allowed / network） */
    onError?: (err: string) => void;
    /** 识别自然结束 */
    onEnd?: () => void;
}

export interface RecognitionHandle {
    stop: () => void;
    abort: () => void;
}

/**
 * 启动一次连续识别。返回 handle 可主动 stop/abort。
 * 内部会在识别自然结束时自动重启（保持监听状态），直到调用方 abort。
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
            // no-speech 太常见,不算失败
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
                    // 无法重启:等下一次外部调用
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

/* ── 匹配算法 ─────────────────────────────────────────────────────────────── */

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
 * Levenshtein distance (小串场景,O(m*n) 足够).
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
 * 英文匹配:含子串 或 Levenshtein 距离 ≤ max(1, floor(len*0.2))
 * 短语允许识别时中间夹词/次序保留。
 */
export function matchesEnWord(transcript: string, target: string): boolean {
    const t = normalizeEn(transcript);
    const w = normalizeEn(target);
    if (!t || !w) return false;

    if (t.includes(w)) return true;

    // 短语:每个组成词都在 transcript 中即算通过(顺序不强制)
    if (w.includes(' ')) {
        const parts = w.split(' ').filter(Boolean);
        return parts.every((p) => t.includes(p));
    }

    // 单词:模糊匹配 + 逐 token 比对
    const tolerance = Math.max(1, Math.floor(w.length * 0.2));
    if (levenshtein(t, w) <= tolerance) return true;

    const tokens = t.split(' ').filter(Boolean);
    return tokens.some((tok) => levenshtein(tok, w) <= tolerance);
}

/**
 * 从卡片的 zh(例如 "n. 苹果; 果; 苹果树")拆出候选释义分片。
 * 剥离词性前缀 + 按分隔符切,过滤 1 字以下。
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
 * 宽松中文匹配:任一释义分片出现在 transcript 中即算通过。
 * 分片长度=1:必须整字命中;长度≥2:允许单字命中(适配语音识别把"苹果"识别成"平果""频果"等)。
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
        // 兜底:分片≥2字时,如果 transcript 覆盖了 ≥50% 的字符,也算通过
        if (c.length >= 2) {
            const chars = Array.from(c);
            const hits = chars.filter((ch) => t.includes(ch)).length;
            if (hits / chars.length >= 0.5) return true;
        }
    }
    return false;
}

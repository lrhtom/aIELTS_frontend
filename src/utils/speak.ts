/**
 * Unified frontend pronunciation helper
 *
 * Strategy: prefer Youdao Dictionary's human recordings, fall back to speechSynthesis
 * Youdao's TTS quality is far above the browser's native synthesis and is close to a real recording.
 */

const YOUDAO_TTS_URL = 'https://dict.youdao.com/dictvoice';

/** the Audio instance currently playing */
let currentAudio: HTMLAudioElement | null = null;

export interface SpeakWordOptions {
    /** accent: uk British (default) / us American */
    accent?: 'uk' | 'us';
    /** called when playback starts */
    onStart?: () => void;
    /** called when playback finishes */
    onEnd?: () => void;
    /** called when playback fails */
    onError?: () => void;
}

/**
 * Speak an English word or phrase.
 *
 * Prefers Youdao's high-quality recording and falls back to the browser's native speechSynthesis on a network failure.
 */
export function speakWord(word: string, options?: SpeakWordOptions): void {
    const trimmed = word.trim();
    if (!trimmed) {
        options?.onError?.();
        return;
    }

    cancelSpeak();

    const { accent = 'uk', onStart, onEnd, onError } = options ?? {};
    const type = accent === 'uk' ? 1 : 2;
    const url = `${YOUDAO_TTS_URL}?audio=${encodeURIComponent(trimmed)}&type=${type}`;
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        onEnd?.();
    };

    audio.play()
        .then(() => {
            onStart?.();
        })
        .catch(() => {
            // the Youdao request failed -> fall back to the browser's native voice
            if (currentAudio === audio) currentAudio = null;
            _fallbackSpeak(trimmed, accent, { onStart, onEnd, onError });
        });
}

/**
 * Speak arbitrary text (Chinese, long sentences, and anything else Youdao is unsuited to).
 *
 * Uses the browser's native speechSynthesis.
 */
export function speakText(text: string, lang: string = 'en-US'): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    cancelSpeak();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = lang;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

/**
 * Cancel any pronunciation in progress
 */
export function cancelSpeak(): void {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

/* -- Internal fallback ------------------------------------------------- */

function _fallbackSpeak(
    text: string,
    accent: 'uk' | 'us',
    callbacks: Pick<SpeakWordOptions, 'onStart' | 'onEnd' | 'onError'>,
): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        callbacks.onError?.();
        return;
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
    u.onend = () => callbacks.onEnd?.();
    u.onerror = () => callbacks.onError?.();
    window.speechSynthesis.speak(u);
    callbacks.onStart?.();
}

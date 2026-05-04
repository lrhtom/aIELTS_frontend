/**
 * 统一前端发音工具
 *
 * 策略：有道词典真人发音优先 → speechSynthesis fallback
 * 有道词典 TTS 质量远超浏览器原生合成音，接近真人录音水平。
 */

const YOUDAO_TTS_URL = 'https://dict.youdao.com/dictvoice';

/** 当前正在播放的 Audio 实例 */
let currentAudio: HTMLAudioElement | null = null;

export interface SpeakWordOptions {
    /** 口音：uk 英式（默认） / us 美式 */
    accent?: 'uk' | 'us';
    /** 开始播放时回调 */
    onStart?: () => void;
    /** 播放完毕回调 */
    onEnd?: () => void;
    /** 播放失败回调 */
    onError?: () => void;
}

/**
 * 朗读英文单词/短语
 *
 * 优先使用有道词典高质量发音，网络失败时 fallback 到浏览器原生 speechSynthesis。
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
            // 有道请求失败 → fallback 到浏览器原生
            if (currentAudio === audio) currentAudio = null;
            _fallbackSpeak(trimmed, accent, { onStart, onEnd, onError });
        });
}

/**
 * 朗读任意文本（中文、长句等不适合有道词典的场景）
 *
 * 使用浏览器原生 speechSynthesis。
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
 * 取消所有正在进行的发音
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

/* ── 内部 fallback ─────────────────────────────────────────────────────── */

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

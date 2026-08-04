/**
 * Audio-quality interference - degrade the AI voice (TTS) through filters.
 *
 * In scenario conversations the TTS audio is a same-origin blob URL, so it can safely be routed through Web Audio:
 *   <audio> -> createMediaElementSource -> [filter chain] -> destination
 * which imitates a phone line, a muffled room, a radio, and so on. Multiple selections chain their filters in series.
 *
 * Note: once createMediaElementSource is called on an <audio>, its default output only goes through the graph,
 * so the graph must be connected to destination (otherwise it is silent). Every TTS clip is a new <audio> with its own source.
 */

export type QualityProfileKey = 'phone' | 'muffled' | 'radio';

const VALID: QualityProfileKey[] = ['phone', 'muffled', 'radio'];

const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined'
        ? (window.AudioContext ||
           (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;

/** A mild distortion curve (the crackle of a radio or walkie-talkie). */
// Return type pinned to Float32Array<ArrayBuffer> (not the default
// Float32Array<ArrayBufferLike>) so it satisfies WaveShaperNode.curve, whose
// setter rejects a possibly-SharedArrayBuffer-backed view under TS 5.7+ libs.
function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

/** Build the filter chain for a profile and return its tail node. */
function buildProfileChain(ctx: AudioContext, input: AudioNode, profile: QualityProfileKey): AudioNode {
    if (profile === 'phone') {
        // Phone line: band-limited to roughly 300-3400 Hz plus a slight gain, giving the flat, tinny sound
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.7;
        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking'; presence.frequency.value = 1700; presence.Q.value = 1.0; presence.gain.value = 6;
        const g = ctx.createGain(); g.gain.value = 1.2;
        input.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(g);
        return g;
    }
    if (profile === 'muffled') {
        // Muffled / through a wall: a lowpass strips the highs
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 1.15;
        input.connect(lp); lp.connect(g);
        return g;
    }
    // radio: narrow band plus distortion = walkie-talkie
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 500; hp.Q.value = 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2800; lp.Q.value = 0.8;
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(6);
    shaper.oversample = '2x';
    const g = ctx.createGain(); g.gain.value = 0.9;
    input.connect(hp); hp.connect(lp); lp.connect(shaper); shaper.connect(g);
    return g;
}

export class AudioQualityFx {
    private ctx: AudioContext | null = null;
    private profiles: QualityProfileKey[] = [];

    setProfiles(profiles: string[]): void {
        this.profiles = profiles.filter((p): p is QualityProfileKey => (VALID as string[]).includes(p));
    }

    get active(): boolean { return this.profiles.length > 0; }

    /** Route an <audio> through the filter chain. Returns false when no profile is active or it is unavailable (the caller then plays it directly). */
    attach(el: HTMLAudioElement): boolean {
        if (!this.profiles.length || !AC) return false;
        if (!this.ctx) this.ctx = new AC();
        void this.ctx.resume().catch(() => {});
        let node: AudioNode;
        try {
            node = this.ctx.createMediaElementSource(el);
        } catch {
            return false; // already routed, or not allowed
        }
        for (const p of this.profiles) node = buildProfileChain(this.ctx, node, p);
        node.connect(this.ctx.destination);
        return true;
    }

    dispose(): void {
        if (this.ctx) {
            const c = this.ctx;
            this.ctx = null;
            c.close().catch(() => {});
        }
        this.profiles = [];
    }
}

/**
 * Background ambience generator for scenario conversations (Web Audio API, synthesised entirely in the browser, no audio files)
 *
 * Each selected noise subtype (pub / canteen / office / street) gets its own looping noise chain
 * (looping pink noise -> bandpass/lowpass filter -> gain, some with a low hum or a slow swell),
 * and several are mixed and looped together, kept quiet so they do not drown out the TTS.
 *
 * Synthesised rather than shipped as audio files because it carries no copyright risk, works offline, adds almost
 * nothing to the bundle, and starts and stops instantly. To swap in real recordings later, just replace buildProfile with an <audio>/AudioBuffer loader.
 */

export type NoiseProfileKey = 'pub' | 'canteen' | 'office' | 'street';

interface ProfileParams {
    type: BiquadFilterType;
    freq: number;   // filter centre / cutoff frequency
    q: number;
    gain: number;   // relative gain of this noise layer (0..1)
    hum?: number;   // optional low hum frequency (Hz), imitating air conditioning or machinery
    lfo?: number;   // optional slow amplitude swell frequency (Hz), imitating the ebb and flow of a crowd or traffic
}

const PROFILE_PARAMS: Record<NoiseProfileKey, ProfileParams> = {
    pub:     { type: 'bandpass', freq: 520, q: 0.6, gain: 0.85, lfo: 0.15 },
    canteen: { type: 'highpass', freq: 850, q: 0.5, gain: 0.55 },
    office:  { type: 'lowpass',  freq: 240, q: 0.6, gain: 0.70, hum: 110 },
    street:  { type: 'bandpass', freq: 300, q: 0.4, gain: 0.80, lfo: 0.08 },
};

const ALL_PROFILES = Object.keys(PROFILE_PARAMS) as NoiseProfileKey[];

type ProfileNode = { stop: () => void };

const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined'
        ? (window.AudioContext ||
           (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;

export class NoiseAmbience {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private buffer: AudioBuffer | null = null;
    private nodes: ProfileNode[] = [];
    private active: NoiseProfileKey[] = [];
    private volume = 0.16;
    private muted = false;
    private gestureArmed = false;
    running = false;

    /** Start playing the given subtypes (creating the AudioContext if needed). */
    async start(profiles: string[]): Promise<void> {
        if (!AC) return;
        if (!this.ctx) {
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0;
            this.master.connect(this.ctx.destination);
            this.buffer = this.makePinkBuffer(this.ctx, 4);
        }
        await this.ctx.resume().catch(() => {});
        this.running = true;
        this.setProfiles(profiles);
        // Autoplay policy: if it is still suspended, resume on the next user gesture
        if (this.ctx.state === 'suspended') this.armGestureResume();
    }

    /** Change which subtypes are playing (adding and removing noise layers). */
    setProfiles(profiles: string[]): void {
        const valid = profiles.filter((p): p is NoiseProfileKey => p in PROFILE_PARAMS);
        // Background noise is on but no subtype was chosen -> default to a pub+office mix
        this.active = valid.length ? valid : (['pub', 'office'] as NoiseProfileKey[]);
        if (!this.running || !this.ctx || !this.buffer || !this.master) return;

        this.clearNodes();
        for (const p of this.active) this.nodes.push(this.buildProfile(p));
        // turn the whole thing down when layers are mixed, so they do not stack up too loud
        const target = this.muted ? 0 : this.volume / Math.sqrt(this.active.length || 1);
        this.rampMaster(target);
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        if (!this.master || !this.ctx) return;
        const target = muted ? 0 : this.volume / Math.sqrt(this.active.length || 1);
        this.rampMaster(target);
    }

    isMuted(): boolean { return this.muted; }

    stop(): void {
        this.running = false;
        this.clearNodes();
        if (this.ctx) {
            const ctx = this.ctx;
            this.ctx = null;
            this.master = null;
            this.buffer = null;
            ctx.close().catch(() => {});
        }
    }

    // ── internals ────────────────────────────────────────────────────────────
    private rampMaster(target: number): void {
        if (!this.master || !this.ctx) return;
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(target, now, 0.25);
    }

    private clearNodes(): void {
        for (const n of this.nodes) {
            try { n.stop(); } catch { /* ignore */ }
        }
        this.nodes = [];
    }

    private armGestureResume(): void {
        if (this.gestureArmed) return;
        this.gestureArmed = true;
        const resume = () => {
            this.ctx?.resume().catch(() => {});
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
            this.gestureArmed = false;
        };
        window.addEventListener('pointerdown', resume, { once: true });
        window.addEventListener('keydown', resume, { once: true });
    }

    private buildProfile(profile: NoiseProfileKey): ProfileNode {
        const ctx = this.ctx!;
        const master = this.master!;
        const p = PROFILE_PARAMS[profile];

        const src = ctx.createBufferSource();
        src.buffer = this.buffer!;
        src.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = p.type;
        filter.frequency.value = p.freq;
        filter.Q.value = p.q;

        const g = ctx.createGain();
        g.gain.value = p.gain;

        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start();

        // slow amplitude swell (crowd / traffic ebb and flow)
        let lfo: OscillatorNode | null = null;
        let lfoGain: GainNode | null = null;
        if (p.lfo) {
            lfo = ctx.createOscillator();
            lfo.frequency.value = p.lfo;
            lfoGain = ctx.createGain();
            lfoGain.gain.value = p.gain * 0.4;
            lfo.connect(lfoGain);
            lfoGain.connect(g.gain);
            lfo.start();
        }

        // low hum (air conditioning / server room)
        let hum: OscillatorNode | null = null;
        let humGain: GainNode | null = null;
        if (p.hum) {
            hum = ctx.createOscillator();
            hum.type = 'sine';
            hum.frequency.value = p.hum;
            humGain = ctx.createGain();
            humGain.gain.value = 0.04;
            hum.connect(humGain);
            humGain.connect(master);
            hum.start();
        }

        return {
            stop: () => {
                try { src.stop(); } catch { /* already stopped */ }
                lfo?.stop();
                hum?.stop();
                [src, filter, g, lfo, lfoGain, hum, humGain].forEach(n => {
                    try { n?.disconnect(); } catch { /* ignore */ }
                });
            },
        };
    }

    /** Generate a loopable stretch of pink noise (Paul Kellet's approximation). */
    private makePinkBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.96900 * b2 + w * 0.1538520;
            b3 = 0.86650 * b3 + w * 0.3104856;
            b4 = 0.55000 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.0168980;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
        }
        return buf;
    }
}

export { ALL_PROFILES };

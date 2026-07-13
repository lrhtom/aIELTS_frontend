/**
 * 场景对话「背景噪音」环境音生成器（Web Audio API，纯前端合成，无需音频文件）
 *
 * 选中的每种噪音子类型（pub / canteen / office / street）各生成一条循环噪音链
 * （循环 pink noise → 带通/低通滤波 → 增益，部分带低频嗡鸣 / 缓慢起伏），
 * 多种同时混音循环播放，音量压低以免盖过 TTS。
 *
 * 之所以用程序合成而不是打包音频文件：无版权风险、离线可用、体积几乎为 0，
 * 且便于随开随停。日后若想换成真实录音，只需把 buildProfile 换成 <audio>/AudioBuffer 加载即可。
 */

export type NoiseProfileKey = 'pub' | 'canteen' | 'office' | 'street';

interface ProfileParams {
    type: BiquadFilterType;
    freq: number;   // 滤波中心/截止频率
    q: number;
    gain: number;   // 该噪音相对增益 (0..1)
    hum?: number;   // 可选低频嗡鸣频率 (Hz)，模拟空调/机器
    lfo?: number;   // 可选缓慢幅度起伏频率 (Hz)，模拟人群/车流的涨落
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

    /** 启动并播放给定子类型（会在需要时创建 AudioContext）。 */
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
        // 自动播放策略：若仍被挂起，等下一次用户手势再恢复
        if (this.ctx.state === 'suspended') this.armGestureResume();
    }

    /** 重新设定要播放的子类型（增删噪音层）。 */
    setProfiles(profiles: string[]): void {
        const valid = profiles.filter((p): p is NoiseProfileKey => p in PROFILE_PARAMS);
        // 开了「背景噪音」但没细选任何子类型 → 默认给个 pub+office 混音
        this.active = valid.length ? valid : (['pub', 'office'] as NoiseProfileKey[]);
        if (!this.running || !this.ctx || !this.buffer || !this.master) return;

        this.clearNodes();
        for (const p of this.active) this.nodes.push(this.buildProfile(p));
        // 多层混音时整体压低，避免叠加过响
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

        // 缓慢幅度起伏（人群/车流涨落）
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

        // 低频嗡鸣（空调/机房）
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

    /** 生成一段可循环的 pink noise（Paul Kellet 近似）。 */
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

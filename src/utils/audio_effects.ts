/**
 * 音质干扰（audioquality）— 对 AI 语音(TTS)施加音质劣化滤波。
 *
 * 场景对话里 TTS 音频是同源 blob URL，可安全接入 Web Audio：
 *   <audio> → createMediaElementSource → [滤波链] → destination
 * 从而模拟电话线 / 闷响 / 无线电等信道音质。多选时滤波链串联。
 *
 * 注意：一旦对某 <audio> 调用 createMediaElementSource，它的默认输出就只走图，
 * 因此必须把图连到 destination（否则静音）。每条 TTS 都是新的 <audio>，各自建源。
 */

export type QualityProfileKey = 'phone' | 'muffled' | 'radio';

const VALID: QualityProfileKey[] = ['phone', 'muffled', 'radio'];

const AC: typeof AudioContext | undefined =
    typeof window !== 'undefined'
        ? (window.AudioContext ||
           (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;

/** 轻度失真曲线（无线电/对讲机的"炸裂"感）。 */
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

/** 为某个 profile 构建一段滤波链，返回链尾节点。 */
function buildProfileChain(ctx: AudioContext, input: AudioNode, profile: QualityProfileKey): AudioNode {
    if (profile === 'phone') {
        // 电话线：约 300–3400 Hz 带限 + 轻微增益，形成"扁而尖"的听感
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
        // 闷响 / 隔墙：低通去高频
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 1.15;
        input.connect(lp); lp.connect(g);
        return g;
    }
    // radio：窄带 + 失真 = 对讲机
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

    /** 把一个 <audio> 接入滤波链。无激活 profile 或不可用时返回 false（调用方照常直接播放）。 */
    attach(el: HTMLAudioElement): boolean {
        if (!this.profiles.length || !AC) return false;
        if (!this.ctx) this.ctx = new AC();
        void this.ctx.resume().catch(() => {});
        let node: AudioNode;
        try {
            node = this.ctx.createMediaElementSource(el);
        } catch {
            return false; // 已被接过 / 不允许
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

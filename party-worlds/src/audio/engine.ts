/**
 * Audio engine: one context, three buses, a limiter, and a handful of tiny synthesis
 * primitives. Everything is generated; there are no sample files.
 *
 * iOS Safari notes: the context is created (or resumed) only inside unlock(), which must be
 * called from a user gesture; an "interrupted" context (phone call, Siri) is resumed on the
 * next unlock()/resume(). Nothing here needs AudioWorklet or decodeAudioData.
 */

export interface ToneOpts {
  type?: OscillatorType;
  /** start frequency, Hz */
  f0: number;
  /** end frequency, Hz (exponential glide). Defaults to f0. */
  f1?: number;
  /** seconds */
  dur: number;
  gain: number;
  attack?: number;
  /** start time offset from now, seconds */
  at?: number;
  pan?: number;
  /** optional vibrato */
  vibHz?: number;
  vibDepth?: number;
  /** optional low-pass on the voice, Hz */
  lowpass?: number;
  bus?: GainNode;
}

export interface NoiseOpts {
  dur: number;
  gain: number;
  attack?: number;
  at?: number;
  pan?: number;
  filter?: BiquadFilterType;
  f0?: number;
  f1?: number;
  q?: number;
  /** gain shape: 'decay' (default) falls from the peak, 'swell' rises to it then cuts */
  shape?: 'decay' | 'swell';
  bus?: GainNode;
}

type Ctx = BaseAudioContext;

export class Engine {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  music: GainNode | null = null;
  /** live one-shot voices, for polyphony limiting */
  active = 0;
  readonly offline: boolean;
  private noiseBuf: AudioBuffer | null = null;
  private volumes = { master: 0.9, sfx: 1, music: 0.6 };

  constructor(provided: Ctx | null = null) {
    this.offline = !!provided && typeof (provided as OfflineAudioContext).startRendering === 'function';
    if (provided) this.attach(provided);
  }

  get ready(): boolean {
    return !!this.ctx && !!this.master;
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Create or resume the context. Call from a user gesture. */
  async unlock(): Promise<void> {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.attach(new AC({ latencyHint: 'interactive' }));
      }
      const c = this.ctx as AudioContext;
      if (typeof c.resume === 'function' && c.state !== 'running') await c.resume();
      // a one-sample buffer is the traditional iOS nudge
      if (this.ctx && this.master) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        src.connect(this.master);
        src.start();
      }
    } catch {
      /* audio is optional: the game runs silent */
    }
  }

  get running(): boolean {
    return !!this.ctx && (this.offline || (this.ctx as AudioContext).state === 'running');
  }

  suspend(): void {
    const c = this.ctx as AudioContext | null;
    if (c && !this.offline && typeof c.suspend === 'function' && c.state === 'running') void c.suspend().catch(() => undefined);
  }

  resume(): void {
    const c = this.ctx as AudioContext | null;
    if (c && !this.offline && typeof c.resume === 'function' && c.state !== 'running' && c.state !== 'closed') {
      void c.resume().catch(() => undefined);
    }
  }

  private attach(ctx: Ctx): void {
    this.ctx = ctx;
    const master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 10;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.14;
    // headroom after the limiter so a pile-up of sounds can never clip
    const out = ctx.createGain();
    out.gain.value = 0.8;
    master.connect(limiter);
    limiter.connect(out);
    out.connect(ctx.destination);
    this.master = master;
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(master);
    this.music.connect(master);
    this.applyVolumes(0);
  }

  setVolumes(v: { master: number; sfx: number; music: number }): void {
    const c = (x: number): number => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
    this.volumes = { master: c(v.master), sfx: c(v.sfx), music: c(v.music) };
    this.applyVolumes(0.06);
  }

  private applyVolumes(ramp: number): void {
    if (!this.ctx || !this.master || !this.sfx || !this.music) return;
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number): void => {
      if (ramp > 0) g.gain.setTargetAtTime(v, t, ramp);
      else g.gain.value = v;
    };
    set(this.master, this.volumes.master);
    set(this.sfx, this.volumes.sfx * 1.7);
    set(this.music, this.volumes.music * 0.55);
  }

  noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 1.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[i] = (seed / 2147483648 - 1) * 0.9;
      }
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  /** Route through an optional stereo pan. */
  private out(node: AudioNode, pan: number | undefined, bus: GainNode): void {
    const ctx = this.ctx!;
    if (pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      p.connect(bus);
    } else {
      node.connect(bus);
    }
  }

  private track(src: AudioScheduledSourceNode, tail: AudioNode): void {
    this.active++;
    src.onended = () => {
      this.active = Math.max(0, this.active - 1);
      try {
        tail.disconnect();
      } catch {
        /* already gone */
      }
    };
  }

  /** One enveloped oscillator. */
  tone(o: ToneOpts): void {
    const ctx = this.ctx;
    const bus = o.bus ?? this.sfx;
    if (!ctx || !bus || o.gain <= 0 || o.dur <= 0) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    const f0 = Math.max(20, o.f0);
    osc.frequency.setValueAtTime(f0, t0);
    if (o.f1 !== undefined && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    if (o.vibHz && o.vibDepth) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibHz;
      depth.gain.value = o.vibDepth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    const g = ctx.createGain();
    const a = Math.max(0.002, o.attack ?? 0.004);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.gain, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    g.gain.linearRampToValueAtTime(0, t0 + o.dur + 0.01);
    let tail: AudioNode = g;
    if (o.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lowpass;
      osc.connect(lp);
      lp.connect(g);
    } else {
      osc.connect(g);
    }
    this.out(tail, o.pan, bus);
    tail = g;
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
    this.track(osc, tail);
  }

  /** One enveloped, filtered burst of noise. */
  burst(o: NoiseOpts): void {
    const ctx = this.ctx;
    const bus = o.bus ?? this.sfx;
    if (!ctx || !bus || o.gain <= 0 || o.dur <= 0) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'bandpass';
    f.Q.value = o.q ?? 0.9;
    const f0 = Math.max(30, o.f0 ?? 1200);
    f.frequency.setValueAtTime(f0, t0);
    if (o.f1 !== undefined && o.f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    if (o.shape === 'swell') {
      g.gain.linearRampToValueAtTime(o.gain, t0 + o.dur * 0.85);
      g.gain.linearRampToValueAtTime(0, t0 + o.dur);
    } else {
      g.gain.linearRampToValueAtTime(o.gain, t0 + Math.max(0.002, o.attack ?? 0.003));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      g.gain.linearRampToValueAtTime(0, t0 + o.dur + 0.01);
    }
    src.connect(f);
    f.connect(g);
    this.out(g, o.pan, bus);
    // start at a pseudo-random offset so repeated bursts do not sound identical
    src.start(t0, ((t0 * 977) % 1) * 1.2);
    src.stop(t0 + o.dur + 0.03);
    this.track(src, g);
  }

  /**
   * A music-box / kalimba tine: a sine fundamental with two quick inharmonic partials.
   * `bright` 0 = soft kalimba … 1 = glassy music box.
   */
  pluck(freq: number, at: number, dur: number, gain: number, bright = 0.5, pan?: number, bus?: GainNode): void {
    this.tone({ f0: freq, dur, gain, at, pan, attack: 0.003, bus });
    this.tone({ f0: freq * 3.01, dur: dur * 0.35, gain: gain * (0.12 + 0.28 * bright), at, pan, attack: 0.002, bus });
    if (bright > 0.25) this.tone({ f0: freq * 5.42, dur: dur * 0.16, gain: gain * 0.16 * bright, at, pan, attack: 0.002, bus });
  }
}

/** Equal-tempered note → Hz. 69 = A4 (440). */
export function midi(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

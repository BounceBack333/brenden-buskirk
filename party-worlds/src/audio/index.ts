/**
 * Audio kit: every sound in the game, generated on the fly.
 *
 * Timbre identity (see docs/ART_BIBLE.md): music box, kalimba, wood, paper, rubber, breath.
 * Every one-shot carries information about what just happened; nothing is harsh or mocking.
 * All methods are safe before unlock() and never throw.
 */
import type { AudioKit, MusicMode, SfxName, SfxOptions } from '../kit/contracts';
import { Engine, midi } from './engine';

export interface AudioKitOptions {
  /** Render through this context instead of a live one (tests use an OfflineAudioContext). */
  context?: BaseAudioContext;
}

/** Sounds that may be dropped when a lot is already playing. */
const LOW_PRIORITY: ReadonlySet<SfxName> = new Set<SfxName>(['footstep', 'skid', 'score_tick']);
const MAX_VOICES = 44;

// ───────────────────────────── music ─────────────────────────────
// C major pentatonic, 104 bpm, eighth-note steps, two bars.
const STEP = 60 / 104 / 2;
const R = -1; // rest
const MELODY = [72, R, 76, 79, R, 76, 74, R, 72, R, 69, 72, 74, R, 76, R, 79, R, 81, 79, R, 76, 74, 76, 72, R, 67, 69, 72, R, R, R];
const BASS = [48, R, R, R, 55, R, R, R, 45, R, R, R, 55, R, R, R, 48, R, R, R, 52, R, R, R, 53, R, R, R, 55, R, 43, R];
const WIN = [67, 72, 76, 79, 84, R, 88, R];
// the race score: A minor pentatonic at 138 bpm, a driving bass under a restless arpeggio
const STEP_RACE = 60 / 138 / 2;
const RACE_ARP = [69, 72, 76, 81, 79, 76, 72, 76, 69, 72, 74, 79, 76, 74, 72, 67];
const RACE_BASS = [45, 45, 57, 45, 45, 57, 45, 48, 43, 43, 55, 43, 41, 41, 53, 55];

export function createAudioKit(opts: AudioKitOptions = {}): AudioKit {
  const eng = new Engine(opts.context ?? null);
  let unlocked = !!opts.context;

  // ── continuous voices ──
  interface Loop { gain: GainNode; filter: BiquadFilterNode; src: AudioScheduledSourceNode; extra?: OscillatorNode; depth?: GainNode }
  let tension: Loop | null = null;
  let wind: Loop | null = null;
  let flutter: Loop | null = null;
  let engine: (Loop & { osc2: OscillatorNode }) | null = null;
  let skid: Loop | null = null;

  function noiseLoop(type: BiquadFilterType, freq: number, q: number): Loop | null {
    const ctx = eng.ctx;
    if (!ctx || !eng.sfx) return null;
    const src = ctx.createBufferSource();
    src.buffer = eng.noise();
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(eng.sfx);
    src.start();
    return { gain, filter, src };
  }

  function stopLoop(l: Loop | null): void {
    if (!l || !eng.ctx) return;
    const t = eng.ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setTargetAtTime(0, t, 0.03);
    try {
      l.src.stop(t + 0.25);
      l.extra?.stop(t + 0.25);
    } catch {
      /* already stopped */
    }
    const g = l.gain;
    window.setTimeout(() => {
      try { g.disconnect(); } catch { /* gone */ }
    }, 400);
  }

  // ── music scheduler ──
  let mode: MusicMode = 'off';
  let step = 0;
  let nextTime = 0;
  let timer = 0;
  let winSteps = 0;

  function scheduleStep(i: number, t: number): void {
    const bus = eng.music ?? undefined;
    const at = Math.max(0, t - eng.now);
    if (mode === 'win') {
      const n = WIN[winSteps % WIN.length]!;
      if (n !== R) eng.pluck(midi(n), at, 0.9, 0.2, 0.8, 0, bus);
      if (winSteps === 4) {
        for (const c of [60, 64, 67]) eng.pluck(midi(c), at, 1.6, 0.1, 0.3, 0, bus);
      }
      winSteps++;
      if (winSteps >= WIN.length + 4) {
        mode = 'menu';
        step = 0;
      }
      return;
    }
    const k = i % MELODY.length;
    const m = MELODY[k]!;
    const b = BASS[k]!;
    if (mode === 'menu') {
      if (m !== R) eng.pluck(midi(m), at, 0.7, 0.16, 0.7, (k % 4) * 0.12 - 0.18, bus);
      if (b !== R) eng.tone({ f0: midi(b), dur: 0.9, gain: 0.1, at, attack: 0.02, bus });
      if (k % 8 === 4) eng.pluck(midi(m === R ? 79 : m + 12), at, 0.5, 0.05, 1, 0.3, bus);
    } else if (mode === 'play') {
      // lighter: every other melody note, softer bass — leaves room for the game
      if (m !== R && k % 2 === 0) eng.pluck(midi(m), at, 0.6, 0.1, 0.6, 0, bus);
      if (b !== R && k % 8 === 0) eng.tone({ f0: midi(b), dur: 0.8, gain: 0.07, at, attack: 0.02, bus });
    } else if (mode === 'race') {
      const j = i % 16;
      eng.tone({ type: 'triangle', f0: midi(RACE_BASS[j]!), dur: 0.16, gain: 0.13, at, attack: 0.004, lowpass: 900, bus });
      if (j % 2 === 0 || (i >> 4) % 2 === 1) eng.pluck(midi(RACE_ARP[j]! + ((i >> 5) % 2 ? 12 : 0)), at, 0.22, 0.07, 0.9, (j % 4) * 0.2 - 0.3, bus);
      if (j % 4 === 2) eng.burst({ dur: 0.04, gain: 0.05, filter: 'highpass', f0: 5000, at, bus });
    } else if (mode === 'tense') {
      // a ticking ostinato
      eng.pluck(midi(k % 2 === 0 ? 79 : 76), at, 0.18, 0.06, 0.9, 0, bus);
      if (k % 4 === 0) eng.tone({ f0: midi(43), dur: 0.3, gain: 0.07, at, attack: 0.01, bus });
    }
  }

  function pump(): void {
    if (!eng.ready || mode === 'off') return;
    const horizon = eng.now + (eng.offline ? 14 : 0.22);
    if (nextTime < eng.now) nextTime = eng.now + 0.03;
    let guard = 0;
    while (nextTime < horizon && guard++ < 400) {
      scheduleStep(step, nextTime);
      step++;
      nextTime += mode === 'race' ? STEP_RACE : STEP;
    }
  }

  function startTimer(): void {
    if (timer || eng.offline) return;
    timer = window.setInterval(() => {
      if (eng.running) pump();
    }, 60);
  }

  function stopTimer(): void {
    if (timer) window.clearInterval(timer);
    timer = 0;
  }

  // ── one-shots ──
  const lastAt = new Map<SfxName, number>();
  function play(name: SfxName, o: SfxOptions = {}): void {
    if (!eng.ready || !eng.running) return;
    // the same sound twice within a few milliseconds is just louder, not better
    const t = eng.now;
    const gap = LOW_PRIORITY.has(name) ? 0.04 : 0.015;
    const prev = lastAt.get(name);
    if (prev !== undefined && t - prev < gap) return;
    lastAt.set(name, t);
    if (eng.active > MAX_VOICES && LOW_PRIORITY.has(name)) return;
    if (eng.active > MAX_VOICES * 1.6) return;
    const i = Math.max(0, Math.min(1, o.intensity ?? 1));
    const pan = o.pan ?? 0;
    const p = o.pitch && o.pitch > 0 ? o.pitch : 1;
    switch (name) {
      case 'ui_tap':
        eng.tone({ f0: 880 * p, f1: 660 * p, dur: 0.06, gain: 0.26 });
        break;
      case 'ui_back':
        eng.tone({ f0: 520, f1: 380, dur: 0.09, gain: 0.26 });
        break;
      case 'ui_confirm':
        eng.pluck(midi(84), 0, 0.25, 0.12, 0.7);
        eng.pluck(midi(91), 0.07, 0.35, 0.12, 0.7);
        break;
      case 'ui_toggle':
        eng.burst({ dur: 0.03, gain: 0.3, f0: 3000, q: 3 });
        eng.tone({ f0: 700, dur: 0.06, gain: 0.2 });
        break;
      case 'countdown':
        eng.burst({ dur: 0.04, gain: 0.4, f0: 1400, q: 4 });
        eng.tone({ f0: 800, dur: 0.08, gain: 0.3, type: 'triangle' });
        break;
      case 'go':
        eng.pluck(midi(79), 0, 0.4, 0.16, 0.9);
        eng.pluck(midi(84), 0.09, 0.6, 0.18, 0.9);
        break;
      case 'swap':
        eng.pluck(midi(76), 0, 0.3, 0.12, 0.4, -0.3);
        eng.pluck(midi(81), 0.09, 0.3, 0.12, 0.4, 0.3);
        eng.pluck(midi(69), 0.2, 0.35, 0.09, 0.3, 0);
        break;
      case 'launch':
        // elastic twang + air
        eng.tone({ type: 'triangle', f0: 380 + 120 * i, f1: 120, dur: 0.26, gain: 0.34 + 0.3 * i, vibHz: 34, vibDepth: 22, lowpass: 1900, pan });
        eng.tone({ type: 'sine', f0: 190, f1: 70, dur: 0.18, gain: 0.3 * i, pan });
        eng.burst({ dur: 0.36, gain: 0.3 + 0.5 * i, f0: 500, f1: 2600, q: 0.7, pan, attack: 0.03 });
        break;
      case 'umbrella_open':
        eng.burst({ dur: 0.11, gain: 0.34, filter: 'highpass', f0: 900, f1: 2400, pan });
        eng.tone({ f0: 170, f1: 110, dur: 0.08, gain: 0.26, pan });
        break;
      case 'umbrella_close':
        eng.burst({ dur: 0.08, gain: 0.12, filter: 'highpass', f0: 2200, f1: 1000, pan, shape: 'swell' });
        break;
      case 'umbrella_spent':
        eng.burst({ dur: 0.05, gain: 0.2, f0: 3200, q: 2, pan });
        eng.burst({ dur: 0.05, gain: 0.15, f0: 2500, q: 2, pan, at: 0.07 });
        eng.burst({ dur: 0.07, gain: 0.11, f0: 2000, q: 2, pan, at: 0.15 });
        eng.tone({ f0: 420, f1: 250, dur: 0.28, gain: 0.08, pan, at: 0.04 });
        break;
      case 'boing': {
        const f = (300 - 110 * i) * p;
        const d = 0.26 + 0.3 * i;
        eng.tone({ type: 'triangle', f0: f, f1: f * 0.5, dur: d, gain: 0.2 + 0.12 * i, vibHz: 13, vibDepth: f * 0.12, lowpass: 1400, pan });
        eng.tone({ f0: f * 2.02, f1: f, dur: d * 0.5, gain: 0.07, pan });
        break;
      }
      case 'balloon_bump':
        eng.tone({ f0: 190, f1: 90, dur: 0.12, gain: 0.4, pan });
        eng.tone({ f0: 1400, f1: 1900, dur: 0.07, gain: 0.09, pan, at: 0.01 });
        break;
      case 'balloon_pop':
        eng.burst({ dur: 0.05, gain: 0.5, filter: 'lowpass', f0: 6500, f1: 1500, pan, attack: 0.001 });
        eng.tone({ f0: 230, f1: 80, dur: 0.09, gain: 0.36, pan });
        break;
      case 'ring':
        eng.pluck(midi(83), 0, 0.7, 0.16, 1, pan);
        eng.pluck(midi(88), 0.1, 0.9, 0.16, 1, pan);
        break;
      case 'rim':
        eng.burst({ dur: 0.04, gain: 0.5 + 0.6 * i, f0: 3000 * p, q: 4, pan, attack: 0.001 });
        eng.tone({ type: 'triangle', f0: 1100 * p, f1: 900 * p, dur: 0.06, gain: 0.16 + 0.2 * i, pan });
        break;
      case 'catch':
      case 'catch_perfect':
        eng.burst({ dur: 0.1, gain: 0.7, filter: 'lowpass', f0: 520, f1: 200, pan, attack: 0.002 });
        eng.tone({ f0: 150, f1: 85, dur: 0.13, gain: 0.4, pan });
        eng.pluck(midi(79), 0.07, 0.4, 0.17, 0.4, pan);
        eng.pluck(midi(84), 0.17, 0.55, 0.19, 0.4, pan);
        if (name === 'catch_perfect') {
          eng.pluck(midi(88), 0.28, 1.3, 0.16, 1, pan);
          for (let k = 0; k < 4; k++) eng.pluck(midi(96 + [0, 4, 7, 12][k]!), 0.34 + k * 0.055, 0.3, 0.05, 1, pan * 0.5);
        }
        break;
      case 'miss_splat':
        eng.burst({ dur: 0.17, gain: 0.7 * (0.5 + 0.5 * i), filter: 'lowpass', f0: 950, f1: 240, pan, attack: 0.002 });
        eng.tone({ f0: 120, f1: 68, dur: 0.16, gain: 0.5 * (0.5 + 0.5 * i), pan });
        break;
      case 'whoops':
        eng.pluck(midi(76), 0, 0.4, 0.11 * (0.5 + 0.5 * i), 0.2);
        eng.pluck(midi(72), 0.15, 0.6, 0.11 * (0.5 + 0.5 * i), 0.2);
        break;
      case 'dive':
        eng.burst({ dur: 0.19, gain: 0.6, f0: 800, f1: 1700, q: 0.9, pan, attack: 0.02 });
        break;
      case 'skid':
        eng.burst({ dur: 0.07, gain: 0.08 + 0.1 * i, filter: 'highpass', f0: 1800, pan });
        eng.burst({ dur: 0.06, gain: 0.06 + 0.07 * i, filter: 'highpass', f0: 1500, pan, at: 0.05 });
        break;
      case 'footstep':
        eng.burst({ dur: 0.05, gain: 0.5 + 0.4 * i, filter: 'lowpass', f0: 700, pan, attack: 0.002 });
        break;
      case 'score_tick':
        eng.tone({ f0: 1250 * p, dur: 0.04, gain: 0.16 });
        break;
      case 'star':
        eng.pluck(1046.5 * p, 0, 0.7, 0.16, 1);
        eng.tone({ f0: 2093 * p, dur: 0.5, gain: 0.04, at: 0.02 });
        break;
      case 'boost':
      case 'boost_big': {
        const big = name === 'boost_big';
        eng.burst({ dur: big ? 0.6 : 0.4, gain: big ? 0.6 : 0.45, f0: 400, f1: big ? 4200 : 3000, q: 0.7, attack: 0.02 });
        eng.tone({ type: 'sawtooth', f0: 110, f1: big ? 440 : 300, dur: big ? 0.5 : 0.32, gain: 0.16, lowpass: 1600 });
        if (big) eng.pluck(midi(88), 0.05, 0.5, 0.1, 1);
        break;
      }
      case 'charge':
        eng.pluck(midi(81) * p, 0, 0.18, 0.14, 1);
        eng.tone({ f0: 1760 * p, dur: 0.08, gain: 0.05 });
        break;
      case 'bump':
        eng.tone({ f0: 130, f1: 60, dur: 0.14, gain: 0.3 + 0.25 * i, pan });
        eng.burst({ dur: 0.06, gain: 0.25 + 0.3 * i, f0: 1800, q: 2, pan, attack: 0.001 });
        break;
      case 'kart_bump':
        eng.burst({ dur: 0.04, gain: 0.3 + 0.3 * i, f0: 2600, q: 3, pan, attack: 0.001 });
        eng.tone({ type: 'triangle', f0: 420, f1: 260, dur: 0.07, gain: 0.18, pan });
        break;
      case 'land':
        eng.tone({ f0: 110, f1: 55, dur: 0.16, gain: 0.4 });
        eng.burst({ dur: 0.1, gain: 0.3, filter: 'lowpass', f0: 700, f1: 250, attack: 0.002 });
        break;
      case 'lap':
        eng.pluck(midi(76), 0, 0.3, 0.15, 0.8);
        eng.pluck(midi(81), 0.09, 0.45, 0.15, 0.8);
        break;
      case 'final_lap':
        eng.pluck(midi(81), 0, 0.2, 0.16, 1);
        eng.pluck(midi(81), 0.12, 0.2, 0.16, 1);
        eng.pluck(midi(88), 0.24, 0.6, 0.18, 1);
        break;
      case 'plank':
        eng.tone({ f0: 180, f1: 90, dur: 0.12, gain: 0.4 });
        eng.burst({ dur: 0.08, gain: 0.4, f0: 900, q: 1.5, attack: 0.001 });
        eng.tone({ f0: 150, f1: 80, dur: 0.14, gain: 0.3, at: 0.13 });
        eng.burst({ dur: 0.06, gain: 0.25, f0: 700, q: 1.5, attack: 0.001, at: 0.13 });
        break;
      case 'fanfare': {
        const notes = [72, 76, 79, 84, 88];
        notes.forEach((n, k) => eng.pluck(midi(n), k * 0.11, 0.7, 0.15, 0.9, (k - 2) * 0.15));
        for (const n of [72, 79, 84, 88]) eng.pluck(midi(n), 0.62, 0.9, 0.11, 0.6);
        break;
      }
    }
  }

  const kit: AudioKit = {
    get unlocked() {
      return unlocked;
    },
    async unlock(): Promise<void> {
      await eng.unlock();
      if (eng.ready) {
        unlocked = true;
        if (mode !== 'off') {
          startTimer();
          pump();
        }
      }
    },
    setVolumes(v) {
      eng.setVolumes(v);
    },
    play(name, o) {
      try {
        play(name, o);
      } catch {
        /* a sound is never worth a crash */
      }
    },
    setTension(t) {
      try {
        if (!eng.ready || !eng.running) return;
        if (t === null) {
          stopLoop(tension);
          tension = null;
          return;
        }
        const ctx = eng.ctx!;
        if (!tension) {
          // a creaking stretch: buzzy source through a narrow, rising band, roughened by a slow wobble
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.Q.value = 7;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.type = 'triangle';
          lfo.connect(depth);
          depth.connect(osc.frequency);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(eng.sfx!);
          osc.start();
          lfo.start();
          tension = { gain, filter, src: osc, extra: lfo, depth };
        }
        const k = Math.max(0, Math.min(1, t));
        const now = ctx.currentTime;
        (tension.src as OscillatorNode).frequency.setTargetAtTime(70 + 150 * k, now, 0.04);
        tension.filter.frequency.setTargetAtTime(240 + 900 * k * k, now, 0.04);
        tension.extra!.frequency.setTargetAtTime(9 + 30 * k, now, 0.05);
        tension.depth!.gain.setTargetAtTime(4 + 26 * k, now, 0.05);
        tension.gain.gain.setTargetAtTime(0.03 + 0.2 * k, now, 0.04);
      } catch {
        /* optional */
      }
    },
    setWind(s) {
      try {
        if (!eng.ready || !eng.running) return;
        if (s === null) {
          stopLoop(wind);
          wind = null;
          return;
        }
        if (!wind) wind = noiseLoop('bandpass', 500, 0.7);
        if (!wind) return;
        const k = Math.max(0, Math.min(1, s));
        const now = eng.now;
        wind.filter.frequency.setTargetAtTime(320 + 1700 * k, now, 0.08);
        wind.gain.gain.setTargetAtTime(0.01 + 0.13 * k * k, now, 0.08);
      } catch {
        /* optional */
      }
    },
    setFlutter(o) {
      try {
        if (!eng.ready || !eng.running) return;
        if (o === null) {
          stopLoop(flutter);
          flutter = null;
          return;
        }
        const ctx = eng.ctx!;
        if (!flutter) {
          flutter = noiseLoop('highpass', 1900, 0.5);
          if (!flutter) return;
          // paper flutter = fast tremolo on the hiss
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.type = 'square';
          lfo.frequency.value = 19;
          lfo.connect(depth);
          depth.connect(flutter.gain.gain);
          lfo.start();
          flutter.extra = lfo;
          flutter.depth = depth;
        }
        const k = Math.max(0, Math.min(1, o));
        flutter.gain.gain.setTargetAtTime(0.045 * k, eng.now, 0.05);
        flutter.depth!.gain.setTargetAtTime(0.03 * k, eng.now, 0.05);
      } catch {
        /* optional */
      }
    },
    setEngine(revs, load = 0.3) {
      try {
        // stopping must work even while the context is suspended (phone locked, tab hidden),
        // or the motor would still be droning when it wakes
        if (!eng.ready || (!eng.running && revs !== null)) return;
        if (revs === null) {
          if (engine) {
            try { engine.osc2.stop(eng.now + 0.25); } catch { /* stopped */ }
            stopLoop(engine);
          }
          engine = null;
          return;
        }
        const ctx = eng.ctx!;
        if (!engine) {
          // a toy motor: two slightly detuned buzzers through a low-pass that opens with revs
          const a = ctx.createOscillator();
          const b = ctx.createOscillator();
          a.type = 'sawtooth';
          b.type = 'square';
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.Q.value = 2;
          const gain = ctx.createGain();
          gain.gain.value = 0;
          a.connect(filter);
          b.connect(filter);
          filter.connect(gain);
          gain.connect(eng.sfx!);
          a.start();
          b.start();
          engine = { gain, filter, src: a, osc2: b };
        }
        const k = Math.max(0, Math.min(1.2, revs));
        const l = Math.max(0, Math.min(1, load));
        const now = ctx.currentTime;
        const f = 52 + 150 * k;
        (engine.src as OscillatorNode).frequency.setTargetAtTime(f, now, 0.05);
        engine.osc2.frequency.setTargetAtTime(f * 1.505, now, 0.05);
        engine.filter.frequency.setTargetAtTime(380 + 1500 * k + 900 * l, now, 0.06);
        // kept low on purpose: it never stops, so it sits under every one-shot (set by measurement, not by ear)
        engine.gain.gain.setTargetAtTime(0.007 + 0.006 * k + 0.009 * l, now, 0.06);
      } catch {
        /* optional */
      }
    },
    setSkid(amount) {
      try {
        if (!eng.ready || (!eng.running && amount !== null)) return;
        if (amount === null) {
          stopLoop(skid);
          skid = null;
          return;
        }
        if (!skid) skid = noiseLoop('bandpass', 1700, 2.2);
        if (!skid) return;
        const k = Math.max(0, Math.min(1, amount));
        skid.filter.frequency.setTargetAtTime(1300 + 1300 * k, eng.now, 0.05);
        skid.gain.gain.setTargetAtTime(0.1 * k, eng.now, 0.04);
      } catch {
        /* optional */
      }
    },
    music(next) {
      try {
        if (next === mode) return;
        mode = next;
        if (next === 'win') winSteps = 0;
        if (next === 'off') {
          stopTimer();
          return;
        }
        if (!eng.ready) return;
        startTimer();
        pump();
      } catch {
        /* optional */
      }
    },
    suspend() {
      stopTimer();
      eng.suspend();
    },
    resume() {
      eng.resume();
      if (mode !== 'off' && unlocked) startTimer();
    },
  };
  return kit;
}

/**
 * Deterministic math for simulations.
 *
 * Simulation code may use only + - * / Math.sqrt Math.floor Math.round Math.abs Math.min Math.max
 * and the helpers in this file. Those are exactly specified by IEEE-754 / ECMAScript, so the same
 * inputs give bit-identical results on every device. Math.sin / cos / pow / exp are NOT
 * (engines may differ in the last bit), which is why dsin / dcos exist. This is what lets a
 * server re-run a client's inputs to validate a result, and lets replays be stored as inputs.
 */

export const PI = 3.141592653589793;
export const HALF_PI = 1.5707963267948966;
export const DEG = PI / 180;

function sinPoly(r: number): number {
  const r2 = r * r;
  return r * (1 - (r2 / 6) * (1 - (r2 / 20) * (1 - (r2 / 42) * (1 - (r2 / 72) * (1 - (r2 / 110) * (1 - r2 / 156))))));
}

function cosPoly(r: number): number {
  const r2 = r * r;
  return 1 - (r2 / 2) * (1 - (r2 / 12) * (1 - (r2 / 30) * (1 - (r2 / 56) * (1 - (r2 / 90) * (1 - r2 / 132)))));
}

/** Deterministic sine. Accurate to ~1e-12 for |x| up to a few thousand. */
export function dsin(x: number): number {
  const k = Math.round(x / HALF_PI);
  const r = x - k * HALF_PI;
  const q = ((k % 4) + 4) % 4;
  if (q === 0) return sinPoly(r);
  if (q === 1) return cosPoly(r);
  if (q === 2) return -sinPoly(r);
  return -cosPoly(r);
}

/** Deterministic cosine. */
export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Move `v` toward `target` by at most `maxDelta`. */
export function approach(v: number, target: number, maxDelta: number): number {
  if (v < target) return v + maxDelta > target ? target : v + maxDelta;
  return v - maxDelta < target ? target : v - maxDelta;
}

export function sign(v: number): -1 | 0 | 1 {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Small, fast, seedable PRNG (mulberry32). Deterministic everywhere. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** uniform in [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hiInclusive: number): number {
    return lo + Math.floor(this.next() * (hiInclusive - lo + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
  /** roughly normal, mean 0, sd ~1 (sum of uniforms) */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508;
  }
  get state(): number {
    return this.s;
  }
}

/** FNV-1a style hash over a list of numbers; used for desync checks and determinism tests. */
export function hashNumbers(values: readonly number[]): number {
  const f = new Float64Array(1);
  const u = new Uint32Array(f.buffer);
  let h = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    f[0] = values[i]!;
    h = Math.imul(h ^ u[0]!, 0x01000193);
    h = Math.imul(h ^ u[1]!, 0x01000193);
  }
  return h >>> 0;
}

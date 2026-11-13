/**
 * Can something person-shaped keep up? LEVEL=0|1|2 npx tsx dev/humanish.ts [races=12]
 * (LEVEL picks the rival ladder: 0 Gentle, 1 Keen, 2 Fierce. SKILLS/PACE override it; ONLY=0,3 picks variants.)
 *
 * A stand-in driver races the three shipped rivals in the real simulation. Unlike the rivals it
 * sees the world late (a reaction delay) and, in the keyboard variants, can only press left,
 * right or nothing (a wind-up on held keys was tried and measured worse, so it is not in the game). This is a SIMULATION of a player, used to tune handling and rival skill; it
 * is not a play-test and says nothing about whether the race is fun.
 */
import { createRace, stepRace, noDrive, trackOf, forwardSpeed } from '../src/attractions/dash/sim';
import type { DriveInput, RaceState } from '../src/attractions/dash/sim';
import { Rival } from '../src/attractions/dash/bot';
import { rivalLevel } from '../src/attractions/dash/rivals';

interface Variant {
  name: string;
  /** reaction delay in ticks */
  delay: number;
  input: 'analog' | 'keys';
  drift: boolean;
  /** decides only every n ticks (a person does not re-plan 60 times a second) */
  every: number;
  /** how hard it steers at an error (a calmer driver over-corrects less) */
  gain?: number;
  /** knocks the peg out on lap one, then takes the plank every lap */
  plank?: boolean;
}

const VARIANTS: Variant[] = [
  { name: 'thumb, 150 ms, drifts', delay: 9, input: 'analog', drift: true, every: 3 },
  { name: 'thumb, 250 ms, drifts', delay: 15, input: 'analog', drift: true, every: 5 },
  { name: 'thumb, 250 ms, never drifts', delay: 15, input: 'analog', drift: false, every: 5 },
  { name: 'thumb, 350 ms, never drifts', delay: 21, input: 'analog', drift: false, every: 8 },
  { name: 'thumb, 350 ms, calm hands, never drifts', delay: 21, input: 'analog', drift: false, every: 8, gain: 1.1 },
  { name: 'thumb, 150 ms, drifts, PLANK', delay: 9, input: 'analog', drift: true, every: 3, plank: true },
  { name: 'thumb, 250 ms, drifts, PLANK', delay: 15, input: 'analog', drift: true, every: 5, plank: true },
  { name: 'thumb, 250 ms, never drifts, PLANK', delay: 15, input: 'analog', drift: false, every: 5, plank: true },
  { name: 'keys, 150 ms, drifts', delay: 9, input: 'keys', drift: true, every: 3 },
  { name: 'keys, 250 ms, drifts', delay: 15, input: 'keys', drift: true, every: 5 },
  { name: 'keys, 250 ms, never drifts', delay: 15, input: 'keys', drift: false, every: 5 },
];

const LEVEL = rivalLevel(Number(process.env.LEVEL ?? 0));
const SKILLS = process.env.SKILLS ? process.env.SKILLS.split(',').map(Number) : [...LEVEL.skills];
const PACE = process.env.PACE ? process.env.PACE.split(',').map(Number) : [...LEVEL.pace];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const races = Number(process.argv[2] ?? 12);
const TRACK = process.env.TRACK ?? 'backyard';
const track = trackOf(createRace({ track: TRACK }));
const S = track.samples;
const N = S.length;

interface Seen { x: number; z: number; h: number; v: number; idx: number; drifting: boolean; driftDir: number; charge: number; surface: number; lap: number; open: boolean }

class Humanish {
  private seen: Seen[] = [];
  private steer = 0;
  private want = 0;
  private drift = false;
  private since = 0;
  private out: DriveInput = noDrive();
  constructor(private v: Variant) {}

  think(s: RaceState, seat: number): DriveInput {
    const k = s.karts[seat]!;
    const o = this.out;
    this.seen.push({ x: k.x, z: k.z, h: k.heading, v: forwardSpeed(k), idx: k.idx, drifting: k.drifting, driftDir: k.driftDir, charge: k.charge, surface: k.surface, lap: k.lap, open: s.plankOpen });
    if (this.seen.length > this.v.delay + 1) this.seen.shift();
    const p = this.seen[0]!;
    if (s.phase === 'countdown') {
      o.steer = 0; o.brake = false;
      o.drift = this.v.drift && s.phaseTick >= 170; // a decent start, not a perfect one
      return o;
    }
    if (s.tick % this.v.every === 0) {
      const a = S[(p.idx + Math.round(6 + p.v * 0.55)) % N]!;
      let curve = 0;
      for (let i = 2; i < 16; i++) curve += S[(p.idx + i) % N]!.k;
      curve /= 14;
      let ax = a.x; let az = a.z;
      const pl = track.plank;
      const fx = Math.cos(p.h); const fz = Math.sin(p.h);
      // a person sees a tin stood in the road and goes round it, on the side with more road
      for (const c of track.pillars ?? []) {
        const mx = c.x - p.x; const mz = c.z - p.z;
        const along = mx * fx + mz * fz;
        if (along < 0.5 || along > 24) continue;
        const clear = c.r + 0.62 + 1.1;
        if (Math.abs(fx * mz - fz * mx) > clear) continue;
        const q = S[(p.idx + Math.round(along)) % N]!;
        const lat = (c.x - q.x) * -q.tz + (c.z - q.z) * q.tx;
        const lane = lat - (lat >= 0 ? 1 : -1) * (clear + 0.5);
        ax = q.x - q.tz * lane + q.tx * 3; az = q.z + q.tx * lane + q.tz * 3;
        break;
      }
      if (this.v.plank) {
        // (the zones are the track's own: where a driver lines up for the shortcut, and where one turns for the prop)
        const inZone = (zn: { x0: number; x1: number; z0: number; z1: number }): boolean => p.x > zn.x0 && p.x < zn.x1 && p.z > zn.z0 && p.z < zn.z1;
        if (!p.open && p.lap >= 1 && inZone(pl.opener)) { ax = pl.prop.x; az = pl.prop.z; curve = 0; }
        else if (p.open && inZone(pl.fork) && p.surface !== 2) { ax = Math.max(pl.bx - 6, p.x - (5 + p.v * 0.3)); az = pl.az; curve = 0; }
      }
      const dx = ax - p.x; const dz = az - p.z;
      const err = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
      let want = Math.max(-1, Math.min(1, err * (this.v.gain ?? 2.4)));
      const tight = Math.abs(curve) > 0.045;
      const dir = curve > 0 ? 1 : -1;
      if (this.v.drift) {
        if (!this.drift && !p.drifting && tight && p.v > 10.5 && want * dir > 0.35 && p.surface === 0) { this.drift = true; this.since = s.tick; }
        if (this.drift) {
          const failed = !p.drifting && s.tick - this.since > 30;
          if (failed || Math.abs(curve) < 0.012 || p.charge >= 1 || (p.drifting && p.driftDir * dir < 0)) this.drift = false;
          if (p.drifting) want = Math.max(-1, Math.min(1, (err * 3.2 * p.driftDir - 1.2) / 0.8)) * p.driftDir;
        }
      }
      this.want = want;
    }
    if (this.v.input === 'analog') this.steer = this.want;
    else this.steer = this.want < -0.2 ? -1 : this.want > 0.2 ? 1 : 0; // a key is all or nothing
    o.steer = Math.round(this.steer * 127);
    o.drift = this.drift;
    o.brake = false;
    return o;
  }
}

console.log(`rivals ${process.env.SKILLS || process.env.PACE ? 'custom' : LEVEL.name}: skill ${SKILLS.join(', ')}, pace ${PACE.join(', ')} · ${races} races each · player on grid slot 0`);
for (const [vi, v] of VARIANTS.entries()) {
  if (ONLY && !ONLY.includes(vi)) continue;
  const rt = [0, 0, 0]; const rn = [0, 0, 0];
  let soil = 0; let onPlank = 0; let jumps = 0;
  let place = 0; let time = 0; let finished = 0; let best = 1e9; let grass = 0; let boosts = 0; let bumps = 0; let wins = 0; let lead = 0; let resets = 0;
  for (let r = 0; r < races; r++) {
    const s = createRace({ track: TRACK, karts: 4, required: [0], pace: [1, ...PACE] });
    const me = new Humanish(v);
    const bots = SKILLS.map((skill, i) => new Rival({ seed: 500 + r * 13 + i * 7, skill }));
    const inputs: DriveInput[] = [noDrive(), noDrive(), noDrive(), noDrive()];
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 60 * 300) {
      inputs[0] = me.think(s, 0);
      for (let i = 1; i < 4; i++) inputs[i] = bots[i - 1]!.think(s, i);
      stepRace(s, inputs);
      const k = s.karts[0]!;
      if (s.phase === 'racing' && !k.finished && k.surface === 1) grass++;
      if (s.phase === 'racing' && !k.finished && k.surface === 2) soil++;
      if (s.phase === 'racing' && !k.finished && k.surface === 3) onPlank++;
      for (const e of s.events) {
        if (e.type === 'boost' && e.seat === 0) boosts++;
        else if (e.type === 'jump' && e.seat === 0) jumps++;
        else if (e.type === 'bump' && e.seat === 0) bumps++;
        else if (e.type === 'reset' && e.seat === 0) resets++;
        else if (e.type === 'lap' && e.seat === 0 && e.ticks < best) best = e.ticks;
      }
    }
    for (let i = 1; i < 4; i++) if (s.karts[i]!.finished) { rt[i - 1]! += (s.karts[i]!.finishTick - 180) / 60; rn[i - 1]!++; }
    const k = s.karts[0]!;
    place += k.place;
    if (k.place === 1) wins++;
    if (k.finished) {
      finished++;
      time += (k.finishTick - 180) / 60;
      const first = Math.min(...s.karts.filter((q) => q.finished).map((q) => q.finishTick));
      lead += (k.finishTick - first) / 60;
    }
  }
  console.log(
    `${v.name.padEnd(40)} place ${(place / races).toFixed(2)} · wins ${String(wins).padStart(2)}/${races} · race ${(time / Math.max(1, finished)).toFixed(1)} s (${finished} finished, +${(lead / Math.max(1, finished)).toFixed(1)} s behind winner) · best lap ${(best / 60).toFixed(1)} s · per race: grass ${(grass / races / 60).toFixed(1)} s, soil ${(soil / races / 60).toFixed(1)} s, plank ${(onPlank / races / 60).toFixed(1)} s, jumps ${(jumps / races).toFixed(1)}, boosts ${(boosts / races).toFixed(1)}, wall hits ${(bumps / races).toFixed(1)}, resets ${(resets / races).toFixed(2)} · rivals ${rt.map((t, i) => (rn[i] ? (t / rn[i]!).toFixed(1) : '—')).join(' / ')} s`,
  );
}

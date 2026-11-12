/**
 * Rival drivers for solo racing. They drive through the same DriveInput as a person, with the
 * same kart, and only see public race state. What separates them is skill: how cleanly they
 * hold a line, whether they drift for boosts, and how often they get it wrong.
 * They are always labelled as bots.
 */
import { Rng, clamp } from '../../core/dmath';
import { KART } from './track';
import { forwardSpeed, noDrive, trackOf } from './sim';
import type { DriveInput, RaceState } from './sim';

export interface RivalOptions {
  seed: number;
  /** 0 = sloppy … 1 = sharp */
  skill: number;
}

export class Rival {
  private rng: Rng;
  private skill: number;
  private out: DriveInput = noDrive();
  private lane = 0;
  private laneUntil = 0;
  private drifting = false;
  private wobble = 0;
  private plankLap = -1;
  private usePlank = false;
  private startPress = -1;
  private pressAt = 0;

  constructor(opts: RivalOptions) {
    this.rng = new Rng(opts.seed);
    this.skill = clamp(opts.skill, 0, 1);
    // each rival times the start differently; the sharpest get the boost
    this.startPress = 180 - Math.round(4 + this.rng.next() * (10 + (1 - this.skill) * 70));
  }

  think(s: RaceState, seat: number): DriveInput {
    const o = this.out;
    o.steer = 0;
    o.drift = false;
    o.brake = false;
    const k = s.karts[seat];
    if (!k || s.phase === 'over') return o;
    if (s.phase === 'countdown') {
      o.drift = s.phaseTick >= this.startPress;
      return o;
    }
    const track = trackOf(s);
    const S = track.samples;
    const N = S.length;
    const vf = forwardSpeed(k);

    // pick a lane now and then, so rivals do not queue on one line
    if (s.tick >= this.laneUntil) {
      this.laneUntil = s.tick + 90 + this.rng.int(0, 180);
      this.lane = this.rng.range(-1.6, 1.6);
      this.wobble = this.rng.gauss() * (1 - this.skill) * 0.9;
    }

    // decide once per lap whether to take the plank (only when it is down)
    const pl = track.plank;
    if (this.plankLap !== k.lap) {
      this.plankLap = k.lap;
      this.usePlank = s.plankOpen && this.rng.next() < 0.25 + this.skill * 0.6;
    }
    const inZone = (zn: { x0: number; x1: number; z0: number; z1: number }): boolean => k.x > zn.x0 && k.x < zn.x1 && k.z > zn.z0 && k.z < zn.z1;
    const nearFork = inZone(pl.fork);
    // the sharpest rival opens the plank itself on lap two if nobody has
    const wantOpen = !s.plankOpen && this.skill > 0.8 && k.lap === 2 && inZone(pl.opener);

    let tx: number;
    let tz: number;
    let curve = 0;
    if (wantOpen) {
      tx = pl.prop.x;
      tz = pl.prop.z;
    } else if (this.usePlank && s.plankOpen && nearFork && k.surface !== 2) {
      // aim along the plank, a little ahead, whichever way it lies
      const px = pl.bx - pl.ax;
      const pz = pl.bz - pl.az;
      const len = Math.sqrt(px * px + pz * pz);
      const ux = px / len;
      const uz = pz / len;
      const done = (k.x - pl.ax) * ux + (k.z - pl.az) * uz;
      const reach = Math.min(len + 6, done + 5 + vf * 0.3);
      const off = this.wobble * 0.35;
      tx = pl.ax + ux * reach + uz * off;
      tz = pl.az + uz * reach - ux * off;
    } else {
      const ahead = Math.round(5 + vf * 0.5);
      const p = S[(k.idx + ahead) % N]!;
      // ease the lane toward the inside of what is coming
      for (let i = 2; i < 16; i++) curve += S[(k.idx + i) % N]!.k;
      curve /= 14;
      const inside = clamp(curve * 40, -1, 1) * (p.hw - 1.8) * (0.2 + 0.35 * this.skill);
      const lane = clamp(this.lane * 0.55 + inside + this.wobble, -(p.hw - 1.6), p.hw - 1.6);
      tx = p.x - p.tz * lane;
      tz = p.z + p.tx * lane;
    }

    // steer at the target
    const fx = Math.cos(k.heading);
    const fz = Math.sin(k.heading);
    const dx = tx - k.x;
    const dz = tz - k.z;
    const err = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
    let steer = clamp(err * 2.4, -1, 1);

    // drift through real corners for the boost (the better the rival, the more often)
    const tight = Math.abs(curve) > 0.04;
    const turnDir = curve > 0 ? 1 : -1;
    if (!this.drifting && !k.drifting && tight && k.surface !== 1 && vf > KART.driftMinSpeed + 1.5 && steer * turnDir > 0.3 && this.rng.next() < 0.01 + this.skill * 0.1) {
      this.drifting = true;
      this.pressAt = s.tick;
    }
    if (this.drifting) {
      // let go when the corner opens up, or once the boost a rival of this skill waits for is ready
      const want = this.skill > 0.7 && Math.abs(curve) > 0.03 ? 2 : 1;
      const failed = !k.drifting && s.tick - this.pressAt > 14;
      if (failed || Math.abs(curve) < 0.012 || k.charge >= want || k.driftDir * turnDir < 0) this.drifting = false;
      if (k.drifting) {
        // in a slide the stick trims the turn rate: ask for the yaw rate the line needs
        const rel = (err * 3.2 * k.driftDir - KART.driftBase) / KART.driftSteer;
        steer = clamp(rel, -1, 1) * k.driftDir;
      }
    }
    o.drift = this.drifting;
    // a weaker rival lifts for corners it does not trust itself in
    if (!k.drifting && vf > 11 && (Math.abs(err) > 0.9 || (tight && this.skill < 0.5 && this.rng.next() < 0.5 - this.skill))) o.brake = true;
    o.steer = Math.round(steer * 127);
    return o;
  }
}

/**
 * How violent is a combat race? LEVEL=0|1|2 npx tsx dev/combatprobe.ts [races=20]
 *
 * A stand-in driver (dev/humanish.ts's "thumb, 250 ms, drifts") holds the trigger whenever the
 * guns would hit, drops a mine when someone is close behind, and races the three shipped rivals
 * with weapons on. Prints what happened per race. A SIMULATION used to set the combat numbers;
 * it is not a play-test.
 */
import { createRace, stepRace, noDrive, trackOf, forwardSpeed } from '../src/attractions/dash/sim';
import type { DriveInput, RaceState } from '../src/attractions/dash/sim';
import { COMBAT, gunTarget, weaponsHot } from '../src/attractions/dash/combat';
import { Rival } from '../src/attractions/dash/bot';
import { rivalLevel } from '../src/attractions/dash/rivals';

const LEVEL = rivalLevel(Number(process.env.LEVEL ?? 1));
const COMBAT_ON = process.env.COMBAT !== '0';
/** LIVES=3 is "to the death"; LIVES=0 means a wreck always comes back */
const LIVES = Number(process.env.LIVES ?? 3);
const races = Number(process.argv[2] ?? 20);
const track = trackOf(createRace());
const S = track.samples;
const N = S.length;

/** the "thumb, 250 ms, drifts" stand-in, plus a trigger finger */
class Standin {
  private seen: { x: number; z: number; h: number; v: number; idx: number; drifting: boolean; driftDir: number; charge: number; surface: number }[] = [];
  private want = 0;
  private drift = false;
  private since = 0;
  private out: DriveInput = noDrive();
  constructor(private shoots: boolean) {}
  think(s: RaceState, seat: number): DriveInput {
    const k = s.karts[seat]!;
    const o = this.out;
    this.seen.push({ x: k.x, z: k.z, h: k.heading, v: forwardSpeed(k), idx: k.idx, drifting: k.drifting, driftDir: k.driftDir, charge: k.charge, surface: k.surface });
    if (this.seen.length > 16) this.seen.shift();
    const p = this.seen[0]!;
    o.fire = false; o.drop = false; o.brake = false;
    if (s.phase === 'countdown') { o.steer = 0; o.drift = s.phaseTick >= 170; return o; }
    if (s.tick % 5 === 0) {
      const a = S[(p.idx + Math.round(6 + p.v * 0.55)) % N]!;
      let curve = 0;
      for (let i = 2; i < 16; i++) curve += S[(p.idx + i) % N]!.k;
      curve /= 14;
      const fx = Math.cos(p.h); const fz = Math.sin(p.h);
      const dx = a.x - p.x; const dz = a.z - p.z;
      const err = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
      let want = Math.max(-1, Math.min(1, err * 2.4));
      const tight = Math.abs(curve) > 0.045;
      const dir = curve > 0 ? 1 : -1;
      if (!this.drift && !p.drifting && tight && p.v > 10.5 && want * dir > 0.35 && p.surface === 0) { this.drift = true; this.since = s.tick; }
      if (this.drift) {
        const failed = !p.drifting && s.tick - this.since > 30;
        if (failed || Math.abs(curve) < 0.012 || p.charge >= 1 || (p.drifting && p.driftDir * dir < 0)) this.drift = false;
        if (p.drifting) want = Math.max(-1, Math.min(1, (err * 3.2 * p.driftDir - 1.2) / 0.8)) * p.driftDir;
      }
      this.want = want;
    }
    // a person sees a mine coming and steers round it (most of the time)
    if (s.combat && !this.drift) {
      const fx = Math.cos(k.heading); const fz = Math.sin(k.heading);
      for (const mine of s.mines) {
        const mx = mine.x - k.x; const mz = mine.z - k.z;
        const along = mx * fx + mz * fz;
        const side = fx * mz - fz * mx;
        if (along > 2 && along < 16 && Math.abs(side) < 1.6 && mine.id % 4 !== 0) { this.want = side >= 0 ? -0.55 : 0.55; break; }
      }
    }
    o.steer = Math.round(this.want * 127);
    o.drift = this.drift;
    if (this.shoots && weaponsHot(s)) {
      o.fire = gunTarget(s, track, seat) >= 0;
      if (k.mines > 0 && s.tick % 90 === 0) {
        const fx = Math.cos(k.heading); const fz = Math.sin(k.heading);
        for (let j = 0; j < s.karts.length; j++) {
          if (j === seat) continue;
          const ox = s.karts[j]!.x - k.x; const oz = s.karts[j]!.z - k.z;
          const d = Math.hypot(ox, oz);
          if (d < 10 && ox * fx + oz * fz < -0.8 * d) o.drop = true;
        }
      }
    }
    return o;
  }
}

const outs = { me: 0, all: 0, standing: 0, meStanding: 0 };
const sum = { time: 0, finished: 0, place: 0, wins: 0, myWrecks: 0, myKills: 0, wrecks: 0, shots: 0, hits: 0, mineHits: 0, ownMine: 0, drops: 0, crates: 0, repairs: 0, rams: 0, ramDamage: 0, walls: 0, rivalTime: 0, rivalN: 0, armorAtEnd: 0 };
const worst = { wrecks: 0 };
for (let r = 0; r < races; r++) {
  const s = createRace({ karts: 4, required: [0], pace: [1, ...LEVEL.pace], combat: COMBAT_ON, lives: LIVES });
  const me = new Standin(true);
  const bots = LEVEL.skills.map((skill, i) => new Rival({ seed: 900 + r * 17 + i * 5, skill }));
  const inputs: DriveInput[] = [noDrive(), noDrive(), noDrive(), noDrive()];
  let guard = 0;
  let raceWrecks = 0;
  while (s.phase !== 'over' && guard++ < 60 * 300) {
    inputs[0] = me.think(s, 0);
    for (let i = 1; i < 4; i++) inputs[i] = bots[i - 1]!.think(s, i);
    stepRace(s, inputs);
    for (const e of s.events) {
      if (e.type === 'shot') { sum.shots++; if (e.hit >= 0) sum.hits++; }
      else if (e.type === 'wreck') { sum.wrecks++; raceWrecks++; }
      else if (e.type === 'mine_hit') { sum.mineHits++; if (e.owner === e.seat) sum.ownMine++; }
      else if (e.type === 'mine_drop') sum.drops++;
      else if (e.type === 'crate') sum.crates++;
      else if (e.type === 'repair') sum.repairs++;
      else if (e.type === 'ram') { sum.rams++; sum.ramDamage += e.damage; }
    }
  }
  worst.wrecks = Math.max(worst.wrecks, raceWrecks);
  const k = s.karts[0]!;
  if (k.out) outs.me++;
  outs.all += s.karts.filter((q) => q.out).length;
  if (s.lastStanding >= 0) { outs.standing++; if (s.lastStanding === 0) outs.meStanding++; }
  sum.place += k.place; if (k.place === 1) sum.wins++;
  sum.myWrecks += k.wrecks; sum.myKills += k.kills; sum.armorAtEnd += k.armor;
  if (k.finished && k.lap > s.laps) { sum.finished++; sum.time += (k.finishTick - 180) / 60; }
  for (let i = 1; i < 4; i++) if (s.karts[i]!.finished) { sum.rivalTime += (s.karts[i]!.finishTick - 180) / 60; sum.rivalN++; }
}
const per = (v: number): string => (v / races).toFixed(1);
console.log(`${COMBAT_ON ? 'COMBAT' : 'plain'} · rivals ${LEVEL.name} · ${races} races · armour ${COMBAT.armor}, ${COMBAT.damage} a round, magazine ${COMBAT.magazine}, mine ${COMBAT.mineDamage}`);
console.log(`stand-in: place ${(sum.place / races).toFixed(2)}, wins ${sum.wins}/${races}, race ${(sum.time / Math.max(1, sum.finished)).toFixed(1)} s (${sum.finished} finished), wrecked ${per(sum.myWrecks)} a race, wrecks caused ${per(sum.myKills)}, armour at the flag ${per(sum.armorAtEnd)}`);
console.log(`rivals: race ${(sum.rivalTime / Math.max(1, sum.rivalN)).toFixed(1)} s`);
if (COMBAT_ON && LIVES > 0) console.log(`to the death (${LIVES} lives): stand-in put out in ${outs.me}/${races} races; karts put out per race ${(outs.all / races).toFixed(2)}; races won by the last kart running ${outs.standing}/${races} (the stand-in ${outs.meStanding})`);
console.log(`per race, all four karts: wrecks ${per(sum.wrecks)} (most in one race ${worst.wrecks}), rounds ${per(sum.shots)} (${sum.shots ? Math.round((100 * sum.hits) / sum.shots) : 0}% hit), mines dropped ${per(sum.drops)}, mine hits ${per(sum.mineHits)} (own mine ${per(sum.ownMine)}), crates ${per(sum.crates)}, repairs ${per(sum.repairs)}, rams ${per(sum.rams)} (${(sum.ramDamage / Math.max(1, sum.rams)).toFixed(1)} armour each)`);

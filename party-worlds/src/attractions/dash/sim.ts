/**
 * Backyard Dash — the authoritative race simulation.
 *
 * Pure, fixed-step and deterministic (core/dmath only): state + every driver's input → next
 * state. No rendering, audio, DOM, randomness or clock. Runs in the browser, in bots, in tests,
 * and is ready to run on a server or to replay recorded inputs as a ghost.
 *
 * Handling in one paragraph: karts accelerate on their own; you steer. Hold DRIFT while turning
 * to hop into a slide that charges a boost (two levels); let go to fire it. Grass and soil are
 * slow unless you spend a boost on them. Sitting in someone's wake tows you. Karts shove each
 * other. The plank across the flowerbed starts propped up: bump the prop and it drops, open to
 * everyone for the rest of the race.
 */
import { clamp, dcos, dsin, hashNumbers } from '../../core/dmath';
import { COMBAT, damage, ram, stepCombat } from './combat';
import type { Mine } from './combat';
import { DEFAULT_TRACK, DT, KART, RACE, segDist2, trackById } from './track';
import type { Capsule, Circle, Track } from './track';

export interface DriveInput {
  /** -127 (full left) … 127 (full right) */
  steer: number;
  drift: boolean;
  brake: boolean;
  /** combat races: hold to shoot straight ahead */
  fire?: boolean;
  /** combat races: press to leave a mine behind */
  drop?: boolean;
}

export function noDrive(): DriveInput {
  return { steer: 0, drift: false, brake: false, fire: false, drop: false };
}

export const SURFACE = { road: 0, grass: 1, soil: 2, plank: 3 } as const;

export interface Kart {
  x: number;
  z: number;
  /** radians; 0 faces +x; increases turning right */
  heading: number;
  vx: number;
  vz: number;
  y: number;
  vy: number;
  steer: number;
  drifting: boolean;
  driftDir: -1 | 0 | 1;
  /** 0…2.2; ≥1 = boost ready, ≥2 = big boost ready */
  charge: number;
  boostTicks: number;
  stunTicks: number;
  /** bogged down after revving too early at the start */
  stallTicks: number;
  draftTicks: number;
  surface: number;
  /** nearest centre-line sample */
  idx: number;
  /** 0 on the grid, 1…laps while racing, laps+1 once finished */
  lap: number;
  cpMask: number;
  finished: boolean;
  finishTick: number;
  /** 1-based position, updated every tick */
  place: number;
  lapStartTick: number;
  bestLapTicks: number;
  stuckTicks: number;
  wrongTicks: number;
  /** just respawned: ghosted for a moment */
  blinkTicks: number;
  prevDrift: boolean;
  driftHeldTicks: number;
  startPressTick: number;
  jumped: boolean;
  /** rolled back over the start line: counts as a lap behind until it is crossed forward again */
  behind: boolean;
  /**
   * Throttle, 0.5…1: how much of the kart's top speed this driver uses. People always have 1.
   * Rival bots ease off by a stated amount per difficulty; it is never changed mid-race.
   */
  pace: number;
  // ── combat races only (see combat.ts); at rest otherwise ──
  /** 0…COMBAT.armor; at 0 the kart is a wreck */
  armor: number;
  /** rounds left in the magazine */
  ammo: number;
  gunTicks: number;
  /** ticks since the last round was fired */
  idleTicks: number;
  /** mines carried */
  mines: number;
  prevDrop: boolean;
  /** > 0 while wrecked and waiting to be put back */
  wreckTicks: number;
  /** times this kart has been wrecked */
  wrecks: number;
  /** wrecks this kart caused */
  kills: number;
  /** the seat that last hurt it (-1 none), and when */
  hitBy: number;
  hitTick: number;
  repairTick: number;
}

export type RaceEvent =
  | { type: 'go' }
  | { type: 'start_boost'; seat: number }
  | { type: 'stall'; seat: number }
  | { type: 'drift_start'; seat: number }
  | { type: 'charge'; seat: number; level: 1 | 2 }
  | { type: 'boost'; seat: number; level: 1 | 2 }
  | { type: 'bump'; seat: number; strength: number }
  | { type: 'kart_bump'; a: number; b: number; strength: number }
  | { type: 'plank_open'; seat: number }
  | { type: 'jump'; seat: number }
  | { type: 'land'; seat: number }
  | { type: 'lap'; seat: number; lap: number; ticks: number }
  | { type: 'finish'; seat: number; place: number }
  | { type: 'reset'; seat: number }
  | { type: 'over' }
  // combat races
  | { type: 'hot' }
  | { type: 'shot'; seat: number; hit: number }
  | { type: 'mine_drop'; seat: number; id: number }
  | { type: 'mine_hit'; seat: number; owner: number; id: number; x: number; z: number }
  | { type: 'mine_gone'; id: number }
  | { type: 'crate'; seat: number; index: number }
  | { type: 'repair'; seat: number; amount: number }
  | { type: 'ram'; seat: number; by: number; damage: number }
  | { type: 'wreck'; seat: number; by: number }
  | { type: 'respawn'; seat: number };

export type RacePhase = 'countdown' | 'racing' | 'over';

export interface RaceState {
  /** which circuit this is (see track.ts): part of the state so a replay or a server needs nothing else */
  trackId: string;
  tick: number;
  phase: RacePhase;
  phaseTick: number;
  laps: number;
  karts: Kart[];
  /** the table remembers: once the plank is down it stays down */
  plankOpen: boolean;
  plankOpener: number;
  firstFinishTick: number;
  /** tick on which the last required seat finished (0 = not yet) */
  homeTick: number;
  /** seats whose finish ends the race (the humans); empty = everyone */
  required: number[];
  /** armed karts: guns, mines, armour and wrecks (combat.ts). False plays the plain race. */
  combat: boolean;
  /** mines lying on the track */
  mines: Mine[];
  mineSeq: number;
  /** the tick each of the track's crates is next available */
  crateReady: number[];
  events: RaceEvent[];
}

export interface RaceConfig {
  karts?: number;
  laps?: number;
  required?: number[];
  /** track id; the default track when missing or unknown */
  track?: string;
  /** per-seat throttle for rival bots (see Kart.pace); missing seats get 1 */
  pace?: number[];
  /** armed karts (combat.ts); off when missing */
  combat?: boolean;
}

export function trackOf(s: RaceState): Track {
  return trackById(s.trackId);
}

/** Nearest centre-line sample to a point, searching the whole lap (set-up only: not per tick). */
function nearestSample(track: Track, x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < track.samples.length; i++) {
    const p = track.samples[i]!;
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function createRace(config: RaceConfig = {}): RaceState {
  const track = trackById(config.track ?? DEFAULT_TRACK);
  const n = clamp(Math.floor(config.karts ?? 4), 1, track.grid.length);
  const karts: Kart[] = [];
  for (let i = 0; i < n; i++) {
    const g = track.grid[i]!;
    karts.push({
      x: g.x, z: g.z, heading: g.heading, vx: 0, vz: 0, y: 0, vy: 0, steer: 0,
      drifting: false, driftDir: 0, charge: 0, boostTicks: 0, stunTicks: 0, stallTicks: 0, draftTicks: 0,
      surface: SURFACE.road, idx: nearestSample(track, g.x, g.z), lap: 0, cpMask: 3,
      finished: false, finishTick: 0, place: i + 1, lapStartTick: 0, bestLapTicks: 0,
      stuckTicks: 0, wrongTicks: 0, blinkTicks: 0, prevDrift: false, driftHeldTicks: 0, startPressTick: -999, jumped: false, behind: false,
      pace: clamp(config.pace?.[i] ?? 1, 0.5, 1),
      armor: COMBAT.armor, ammo: COMBAT.magazine, gunTicks: 0, idleTicks: 0, mines: 0, prevDrop: false,
      wreckTicks: 0, wrecks: 0, kills: 0, hitBy: -1, hitTick: 0, repairTick: -COMBAT.repairCooldownTicks,
    });
  }
  return {
    trackId: track.id,
    tick: 0, phase: 'countdown', phaseTick: 0, laps: Math.max(1, Math.floor(config.laps ?? RACE.laps)),
    karts, plankOpen: false, plankOpener: -1, firstFinishTick: 0, homeTick: 0,
    required: (config.required ?? []).filter((s) => s >= 0 && s < n),
    combat: config.combat === true, mines: [], mineSeq: 0, crateReady: (track.combat?.crates ?? []).map(() => 0),
    events: [],
  };
}

export function cloneRace(s: RaceState): RaceState {
  return {
    ...s, karts: s.karts.map((k) => ({ ...k })), required: s.required.slice(),
    mines: s.mines.map((m) => ({ ...m })), crateReady: s.crateReady.slice(), events: [],
  };
}

export function hashRace(s: RaceState): number {
  const v: number[] = [s.tick, s.phaseTick, s.plankOpen ? 1 : 0, s.plankOpener];
  for (const k of s.karts) v.push(k.x, k.z, k.heading, k.vx, k.vz, k.y, k.charge, k.boostTicks, k.idx, k.lap, k.cpMask, k.place, k.finishTick);
  if (s.combat) {
    // (only for combat races, so a plain race hashes exactly as it always has)
    for (const k of s.karts) v.push(k.armor, k.ammo, k.mines, k.wreckTicks, k.wrecks, k.kills);
    for (const m of s.mines) v.push(m.id, m.x, m.z, m.owner);
    for (const c of s.crateReady) v.push(c);
  }
  return hashNumbers(v);
}

/** Race progress as one number: higher is further ahead. */
export function progressOf(s: RaceState, k: Kart): number {
  const N = trackOf(s).samples.length;
  return (k.lap - 1 - (k.behind ? 1 : 0)) * N + k.idx;
}

/** Forward speed along the kart's nose. */
export function forwardSpeed(k: Kart): number {
  return k.vx * dcos(k.heading) + k.vz * dsin(k.heading);
}

const hit = { t: 0, cx: 0, cz: 0 };

export function stepRace(s: RaceState, inputs: readonly DriveInput[]): void {
  s.events.length = 0;
  if (s.phase === 'over') return;
  s.tick++;
  s.phaseTick++;
  const track = trackOf(s);

  if (s.phase === 'countdown') {
    for (let i = 0; i < s.karts.length; i++) {
      const k = s.karts[i]!;
      const inp = inputs[i] ?? NO_INPUT;
      if (inp.drift && !k.prevDrift) k.startPressTick = s.phaseTick;
      k.driftHeldTicks = inp.drift ? k.driftHeldTicks + 1 : 0;
      k.prevDrift = inp.drift;
    }
    if (s.phaseTick >= RACE.countdownTicks) {
      s.phase = 'racing';
      s.phaseTick = 0;
      s.events.push({ type: 'go' });
      for (let i = 0; i < s.karts.length; i++) {
        const k = s.karts[i]!;
        k.lapStartTick = s.tick;
        const since = RACE.countdownTicks - k.startPressTick;
        if (since >= 0 && since <= KART.startWindowTicks) {
          // a well-timed press is enough; it does not have to be held through GO
          k.boostTicks = KART.startBoostTicks;
          s.events.push({ type: 'start_boost', seat: i });
        } else if (k.driftHeldTicks > 50) {
          // revved too early: the kart bogs down for a moment
          k.stallTicks = 34;
          s.events.push({ type: 'stall', seat: i });
        }
        k.driftHeldTicks = 0;
        k.prevDrift = true; // a held button must be released before it can start a drift
      }
    }
    return;
  }

  for (let i = 0; i < s.karts.length; i++) drive(s, track, i, inputs[i] ?? NO_INPUT);
  collideKarts(s);
  if (s.combat) stepCombat(s, track, inputs);
  for (let i = 0; i < s.karts.length; i++) follow(s, track, i);
  rank(s);

  // The race ends when everyone is home; or a short run-out after the people who matter are
  // (so a rival half a second behind is given its time, not "still racing"); or a while after
  // the winner, whoever is still out.
  let done = true;
  for (const k of s.karts) if (!k.finished) done = false;
  if (!done && s.required.length > 0) {
    let home = true;
    for (const seat of s.required) if (!s.karts[seat]!.finished) home = false;
    if (home) {
      if (s.homeTick === 0) s.homeTick = s.tick;
      if (s.tick - s.homeTick >= RACE.runOutTicks) done = true;
    }
  }
  if (s.firstFinishTick > 0 && s.tick - s.firstFinishTick >= RACE.graceTicks) done = true;
  if (s.tick >= RACE.maxTicks) done = true;
  if (done) {
    s.phase = 'over';
    s.phaseTick = 0;
    s.events.push({ type: 'over' });
  }
}

const NO_INPUT: DriveInput = { steer: 0, drift: false, brake: false };

function drive(s: RaceState, track: Track, seat: number, inp: DriveInput): void {
  const k = s.karts[seat]!;
  if (k.blinkTicks > 0) k.blinkTicks--;
  if (k.wreckTicks > 0) {
    wrecked(s, track, seat);
    return;
  }
  const coasting = k.finished; // after the flag the kart rolls on by itself
  const steerIn = coasting ? 0 : clamp(Math.round(inp.steer), -127, 127) / 127;
  const driftIn = !coasting && inp.drift;
  const brakeIn = !coasting && inp.brake;
  k.steer += (steerIn - k.steer) * Math.min(1, 16 * DT);

  let fx = dcos(k.heading);
  let fz = dsin(k.heading);
  let vf = k.vx * fx + k.vz * fz;
  const airborne = k.y > 0.3;
  const stunned = k.stunTicks > 0;
  if (stunned) k.stunTicks--;

  // ── drifting ──
  const pressed = driftIn && !k.prevDrift;
  k.prevDrift = driftIn;
  if (!k.drifting) {
    if ((pressed || (driftIn && k.driftHeldTicks > 0)) && !stunned && !airborne && vf > KART.driftMinSpeed && Math.abs(k.steer) > 0.2) {
      k.drifting = true;
      k.driftDir = k.steer > 0 ? 1 : -1;
      k.charge = 0;
      if (k.y === 0) k.vy = KART.hop;
      s.events.push({ type: 'drift_start', seat });
    }
    // a press without enough steer or speed is remembered briefly so the hop is forgiving
    k.driftHeldTicks = driftIn ? (pressed ? 12 : Math.max(0, k.driftHeldTicks - 1)) : 0;
  } else {
    const rel = k.steer * k.driftDir;
    const before = k.charge;
    const onGrip = k.surface === SURFACE.road || k.surface === SURFACE.plank;
    k.charge = Math.min(2.2, k.charge + DT * KART.chargePerSecond * (0.75 + 0.75 * Math.max(0, rel)) * (onGrip ? 1 : 0.3));
    if (before < 1 && k.charge >= 1) s.events.push({ type: 'charge', seat, level: 1 });
    if (before < 2 && k.charge >= 2) s.events.push({ type: 'charge', seat, level: 2 });
    if (!driftIn || vf < 5.5 || stunned) {
      if (!stunned && k.charge >= 1) {
        const level: 1 | 2 = k.charge >= 2 ? 2 : 1;
        k.boostTicks = Math.max(k.boostTicks, level === 2 ? KART.boost2Ticks : KART.boost1Ticks);
        s.events.push({ type: 'boost', seat, level });
      }
      k.drifting = false;
      k.driftDir = 0;
      k.charge = 0;
    }
  }

  // ── steering ──
  const speed01 = clamp(Math.abs(vf) / KART.vMax, 0, 1);
  let omega: number;
  if (k.drifting) {
    omega = k.driftDir * (KART.driftBase + k.steer * k.driftDir * KART.driftSteer);
  } else {
    const rate = KART.turnLow + (KART.turnHigh - KART.turnLow) * speed01;
    omega = k.steer * rate * Math.min(1, Math.abs(vf) / 3) * (vf < 0 ? -1 : 1);
  }
  if (airborne) omega *= 0.35;
  if (stunned) omega = (seat % 2 === 0 ? 1 : -1) * (6.283185307179586 / (KART.stunTicks * DT)); // one full spin, ending where it began
  k.heading += omega * DT;
  if (k.heading > 6.283185307179586) k.heading -= 6.283185307179586;
  else if (k.heading < 0) k.heading += 6.283185307179586;
  fx = dcos(k.heading);
  fz = dsin(k.heading);
  vf = k.vx * fx + k.vz * fz;

  // ── speed ──
  const boosting = k.boostTicks > 0;
  if (boosting) k.boostTicks--;
  let surf = k.surface === SURFACE.grass ? KART.grass : k.surface === SURFACE.soil ? KART.soil : 1;
  if (boosting) surf = 1 - (1 - surf) * (1 - KART.boostIgnoresSurface);
  let target = (boosting ? KART.vBoost : KART.vMax) * k.pace * surf * (1 - KART.steerScrub * Math.abs(k.steer));
  if (k.drifting) target *= 0.97;
  if (k.draftTicks >= KART.draftTicks && !boosting) target *= KART.draftBonus;
  if (coasting) target = 5;
  if (k.stallTicks > 0) {
    k.stallTicks--;
    target = 0;
  }
  const speed = Math.sqrt(k.vx * k.vx + k.vz * k.vz);
  if (airborne) {
    // in the air the kart keeps its velocity; only the nose turns
  } else if (vf >= 0 && speed > 0.6 && !brakeIn) {
    // The velocity swings round toward the nose: quickly with grip, lazily in a slide. Speed is
    // kept, so a drift costs almost nothing and shows as a slip angle.
    let ux = k.vx / speed;
    let uz = k.vz / speed;
    let sinA = ux * fz - uz * fx;
    if (ux * fx + uz * fz < 0) sinA = sinA >= 0 ? 1 : -1;
    const g = k.drifting ? KART.driftGrip : stunned ? 2 : KART.grip;
    const d = sinA * Math.min(1, g * DT);
    const c = dcos(d);
    const sn = dsin(d);
    const rx = ux * c - uz * sn;
    uz = ux * sn + uz * c;
    ux = rx;
    let v = speed;
    if (stunned) v -= v * 2.2 * DT;
    else if (v < target) {
      v = Math.min(target, v + (target - v) * KART.accelK * DT + KART.accelMin * DT);
      if (boosting && v < KART.vMax) v = Math.min(KART.vMax, v + 22 * DT); // the kick
    } else v -= (v - target) * KART.coastK * DT;
    k.vx = ux * v;
    k.vz = uz * v;
  } else {
    // crawling, braking or reversing: the kart simply goes where it points
    if (brakeIn) {
      if (vf > 0.6) vf -= vf * KART.brakeK * DT + 2 * DT;
      else vf = Math.max(KART.vReverse, vf - 6 * DT);
    } else if (vf < target) {
      vf = Math.min(target, vf + (target - vf) * KART.accelK * DT + KART.accelMin * DT);
    } else vf -= (vf - target) * KART.coastK * DT;
    k.vx = fx * vf;
    k.vz = fz * vf;
  }
  k.x += k.vx * DT;
  k.z += k.vz * DT;

  // ── hop / jump ──
  if (k.y > 0 || k.vy > 0) {
    k.y += k.vy * DT;
    k.vy -= KART.gravity * DT;
    if (k.y <= 0) {
      k.y = 0;
      k.vy = 0;
      if (k.jumped) {
        k.jumped = false;
        s.events.push({ type: 'land', seat });
      }
    }
  }

  walls(s, track, k, seat, fx, fz);
}

/** A wreck: no driver input, it slides to a stop, and after a moment it is put back on the road. */
function wrecked(s: RaceState, track: Track, seat: number): void {
  const k = s.karts[seat]!;
  k.wreckTicks--;
  if (k.wreckTicks === 0) {
    putBack(track, k);
    k.armor = COMBAT.armor;
    k.ammo = COMBAT.magazine;
    k.blinkTicks = COMBAT.shieldTicks;
    s.events.push({ type: 'respawn', seat });
    return;
  }
  k.vx -= k.vx * 3 * DT;
  k.vz -= k.vz * 3 * DT;
  k.x += k.vx * DT;
  k.z += k.vz * DT;
  if (k.y > 0 || k.vy > 0) {
    k.y += k.vy * DT;
    k.vy -= KART.gravity * DT;
    if (k.y <= 0) {
      k.y = 0;
      k.vy = 0;
      k.jumped = false;
    }
  }
  walls(s, track, k, seat, dcos(k.heading), dsin(k.heading));
}

/** Solid things, the plank's prop and the edge of the yard. */
function walls(s: RaceState, track: Track, k: Kart, seat: number, fx: number, fz: number): void {
  for (const c of track.circles) hitCircle(s, k, seat, c, fx, fz);
  for (const c of track.capsules) hitCapsule(s, k, seat, c, fx, fz);
  const pl = track.plank;
  if (!s.plankOpen) {
    hitCapsule(s, k, seat, pl.blocker, fx, fz);
    // the prop: knock it and the plank comes down for everyone
    const dx = k.x - pl.prop.x;
    const dz = k.z - pl.prop.z;
    const reach = pl.prop.r + KART.radius;
    if (dx * dx + dz * dz < reach * reach && k.y < 0.6) {
      s.plankOpen = true;
      s.plankOpener = seat;
      k.vx *= 0.72;
      k.vz *= 0.72;
      s.events.push({ type: 'plank_open', seat });
    }
  }
  const b = track.bounds;
  if (k.x < b.x0) { k.x = b.x0; if (k.vx < 0) k.vx = -k.vx * 0.3; }
  if (k.x > b.x1) { k.x = b.x1; if (k.vx > 0) k.vx = -k.vx * 0.3; }
  if (k.z < b.z0) { k.z = b.z0; if (k.vz < 0) k.vz = -k.vz * 0.3; }
  if (k.z > b.z1) { k.z = b.z1; if (k.vz > 0) k.vz = -k.vz * 0.3; }
}

function bounce(s: RaceState, k: Kart, seat: number, nx: number, nz: number, pen: number, fx: number, fz: number): void {
  k.x += nx * pen;
  k.z += nz * pen;
  const vn = k.vx * nx + k.vz * nz;
  if (vn < 0) {
    k.vx -= (1 + KART.wallRestitution) * vn * nx;
    k.vz -= (1 + KART.wallRestitution) * vn * nz;
    k.vx *= 0.94;
    k.vz *= 0.94;
    const impact = -vn;
    if (impact > 2.5) s.events.push({ type: 'bump', seat, strength: clamp(impact / 12, 0.1, 1) });
    if (impact > KART.stunSpeed && k.stunTicks === 0 && k.blinkTicks === 0) {
      k.stunTicks = KART.stunTicks;
      if (s.combat) damage(s, seat, COMBAT.wallDamage, -1);
    }
  }
  // nose the kart along the wall so scraping recovers by itself
  const tx = -nz;
  const tz = nx;
  const along = fx * tx + fz * tz >= 0 ? 1 : -1;
  const cross = fx * (tz * along) - fz * (tx * along);
  if (fx * nx + fz * nz < 0.2) k.heading += (cross > 0 ? 1 : -1) * 0.05;
}

function hitCircle(s: RaceState, k: Kart, seat: number, c: Circle, fx: number, fz: number): void {
  const dx = k.x - c.x;
  const dz = k.z - c.z;
  const reach = c.r + KART.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= reach * reach) return;
  const d = Math.sqrt(d2) || 1e-6;
  bounce(s, k, seat, dx / d, dz / d, reach - d, fx, fz);
}

function hitCapsule(s: RaceState, k: Kart, seat: number, c: Capsule, fx: number, fz: number): void {
  const reach = c.r + KART.radius;
  const d2 = segDist2(k.x, k.z, c.x1, c.z1, c.x2, c.z2, hit);
  if (d2 >= reach * reach) return;
  const d = Math.sqrt(d2) || 1e-6;
  bounce(s, k, seat, (k.x - hit.cx) / d, (k.z - hit.cz) / d, reach - d, fx, fz);
}

function collideKarts(s: RaceState): void {
  const n = s.karts.length;
  const reach = KART.radius * 2;
  for (let i = 0; i < n; i++) {
    const a = s.karts[i]!;
    for (let j = i + 1; j < n; j++) {
      const b = s.karts[j]!;
      if (a.blinkTicks > 0 || b.blinkTicks > 0) continue;
      const dy = a.y - b.y;
      if (dy > 0.7 || dy < -0.7) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= reach * reach) continue;
      const d = Math.sqrt(d2) || 1e-6;
      const nx = dx / d;
      const nz = dz / d;
      const push = (reach - d) / 2;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      const vr = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vr < 0) {
        if (s.combat) ram(s, i, j, -vr, nx, nz);
        const j2 = (-(1 + KART.kartBounce) * vr) / 2;
        a.vx -= j2 * nx; a.vz -= j2 * nz;
        b.vx += j2 * nx; b.vz += j2 * nz;
        if (-vr > 1.5) s.events.push({ type: 'kart_bump', a: i, b: j, strength: clamp(-vr / 10, 0.1, 1) });
      }
    }
  }
}

/** Where the kart is on the course: surface, progress, laps, tow, and getting unstuck. */
function follow(s: RaceState, track: Track, seat: number): void {
  const k = s.karts[seat]!;
  const S = track.samples;
  const N = S.length;
  // (a shove from another kart must not push anyone out of the yard)
  const bd = track.bounds;
  k.x = clamp(k.x, bd.x0, bd.x1);
  k.z = clamp(k.z, bd.z0, bd.z1);

  // nearest centre-line sample, searched in a window so parallel straights never confuse it
  let best = k.idx;
  let bestD = Infinity;
  for (let o = -8; o <= 70; o++) {
    const i = (k.idx + o + N) % N;
    const p = S[i]!;
    const dx = k.x - p.x;
    const dz = k.z - p.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const p = S[best]!;
  const pn = S[(best + 1) % N]!;
  const pp = S[(best + N - 1) % N]!;
  const dRoad2 = Math.min(segDist2(k.x, k.z, p.x, p.z, pn.x, pn.z, hit), segDist2(k.x, k.z, pp.x, pp.z, p.x, p.z, hit));

  // surface
  const pl = track.plank;
  const dPlank2 = segDist2(k.x, k.z, pl.ax, pl.az, pl.bx, pl.bz, hit);
  const onPlank = s.plankOpen && dPlank2 <= pl.hw * pl.hw;
  const tPlank = hit.t;
  const bx = (k.x - track.bed.x) / track.bed.rx;
  const bz = (k.z - track.bed.z) / track.bed.rz;
  if (onPlank) k.surface = SURFACE.plank;
  else if (dRoad2 <= p.hw * p.hw) k.surface = SURFACE.road;
  else if (bx * bx + bz * bz < 1) k.surface = SURFACE.soil;
  else k.surface = SURFACE.grass;

  // the far end of the plank is a ramp
  const fx = dcos(k.heading);
  const fz = dsin(k.heading);
  const vf = k.vx * fx + k.vz * fz;
  // (only when driving along the plank toward its far end, whichever way the plank lies)
  const pdx = pl.bx - pl.ax;
  const pdz = pl.bz - pl.az;
  const along = (fx * pdx + fz * pdz) / Math.sqrt(pdx * pdx + pdz * pdz);
  if (onPlank && tPlank >= pl.rampFrom && k.y === 0 && vf > 7 && along > 0.5) {
    k.vy = 2.4 + 0.17 * vf;
    k.jumped = true;
    s.events.push({ type: 'jump', seat });
  }

  // progress and laps
  if (!k.finished && best !== k.idx) {
    const fwd = (best - k.idx + N) % N;
    if (fwd <= 70) {
      const c1 = Math.floor(N / 3);
      const c2 = Math.floor((2 * N) / 3);
      const passed = (c: number): boolean => ((c - k.idx + N) % N) <= fwd && c !== k.idx;
      if (passed(c1)) k.cpMask |= 1;
      if (passed(c2)) k.cpMask |= 2;
      if (best < k.idx) {
        // crossed the line going forward
        if (k.behind) {
          k.behind = false; // only undoing a roll back over the line: nothing earned
        } else if (k.cpMask === 3) {
          if (k.lap >= 1) {
            const ticks = s.tick - k.lapStartTick;
            if (k.bestLapTicks === 0 || ticks < k.bestLapTicks) k.bestLapTicks = ticks;
            s.events.push({ type: 'lap', seat, lap: k.lap, ticks });
          }
          k.lap++;
          k.lapStartTick = s.tick;
          if (k.lap > s.laps) {
            k.finished = true;
            k.finishTick = s.tick;
            if (s.firstFinishTick === 0) s.firstFinishTick = s.tick;
          }
        }
        k.cpMask = 0;
      }
    } else if (best > k.idx) {
      k.cpMask = 0; // rolled back over the line: that lap has to be earned again
      k.behind = true;
    }
    k.idx = best;
  }

  // tow from the kart ahead
  let towing = false;
  if (vf > 9 && k.y === 0) {
    for (let j = 0; j < s.karts.length; j++) {
      if (j === seat) continue;
      const o = s.karts[j]!;
      const dx = o.x - k.x;
      const dz = o.z - k.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > KART.draftRange * KART.draftRange || d2 < 0.5) continue;
      const d = Math.sqrt(d2);
      if ((dx * fx + dz * fz) / d >= KART.draftCos && o.vx * fx + o.vz * fz > 7) towing = true;
    }
  }
  k.draftTicks = towing ? Math.min(KART.draftTicks + 30, k.draftTicks + 1) : Math.max(0, k.draftTicks - 3);

  // wrong way / stuck → put the kart back on the road
  if (k.finished) return;
  if (k.wreckTicks > 0) {
    // a wreck is put back by its own clock
    k.stuckTicks = 0;
    k.wrongTicks = 0;
    return;
  }
  const facing = fx * p.tx + fz * p.tz;
  k.wrongTicks = facing < -0.35 && vf > 2 ? k.wrongTicks + 1 : Math.max(0, k.wrongTicks - 2);
  const slow = Math.abs(vf) < 1.2 && k.stunTicks === 0;
  const lost = dRoad2 > 30 * 30;
  k.stuckTicks = slow || lost ? k.stuckTicks + 1 : 0;
  if (k.stuckTicks > 150 || k.wrongTicks > 300) {
    k.x = p.x;
    k.z = p.z;
    k.heading = headingOf(p.tx, p.tz);
    k.vx = 0; k.vz = 0; k.y = 0; k.vy = 0;
    k.drifting = false; k.driftDir = 0; k.charge = 0; k.boostTicks = 0; k.stunTicks = 0; k.stallTicks = 0;
    k.stuckTicks = 0; k.wrongTicks = 0; k.blinkTicks = 70;
    s.events.push({ type: 'reset', seat });
  }
}

/** Stand a kart on the centre line where it had got to, stopped and pointing the right way. */
function putBack(track: Track, k: Kart): void {
  const p = track.samples[k.idx]!;
  k.x = p.x;
  k.z = p.z;
  k.heading = headingOf(p.tx, p.tz);
  k.vx = 0; k.vz = 0; k.y = 0; k.vy = 0;
  k.drifting = false; k.driftDir = 0; k.charge = 0; k.boostTicks = 0; k.stunTicks = 0; k.stallTicks = 0;
  k.stuckTicks = 0; k.wrongTicks = 0; k.jumped = false;
}

/** Heading angle for a unit direction, without atan2 (bisection on dcos/dsin is overkill: use quadrant + asin series). */
export function headingOf(tx: number, tz: number): number {
  // angle = atan2(tz, tx), built from a small-angle-safe formula; only used on respawn and by setup
  const ax = Math.abs(tx);
  const az = Math.abs(tz);
  // octant-reduced arctangent (max error ~1e-4 rad, plenty for pointing a respawned kart)
  const t = ax > az ? az / ax : ax / az;
  const t2 = t * t;
  let a = t * (0.9998660 + t2 * (-0.3302995 + t2 * (0.1801410 + t2 * (-0.0851330 + t2 * 0.0208351))));
  if (az > ax) a = 1.5707963267948966 - a;
  if (tx < 0) a = 3.141592653589793 - a;
  if (tz < 0) a = 6.283185307179586 - a;
  return a;
}

function rank(s: RaceState): void {
  const n = s.karts.length;
  for (let i = 0; i < n; i++) {
    const a = s.karts[i]!;
    let place = 1;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = s.karts[j]!;
      let ahead: boolean;
      if (a.finished && b.finished) ahead = b.finishTick < a.finishTick || (b.finishTick === a.finishTick && j < i);
      else if (a.finished !== b.finished) ahead = b.finished;
      else {
        const pa = progressOf(s, a);
        const pb = progressOf(s, b);
        ahead = pb > pa || (pb === pa && j < i);
      }
      if (ahead) place++;
    }
    if (a.finished && a.finishTick === s.tick) s.events.push({ type: 'finish', seat: i, place });
    a.place = place;
  }
}

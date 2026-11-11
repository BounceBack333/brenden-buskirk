/**
 * Catapult Courier — the authoritative simulation.
 *
 * Pure, fixed-step, deterministic (see core/dmath.ts): state + two players' inputs → next state.
 * No rendering, no audio, no DOM, no Math.random, no wall clock. The same module runs
 *   - in the browser for local play and prediction,
 *   - in Node for the room server (authority) and for tests,
 *   - "ahead of time" for the aim preview and the labelled bot.
 *
 * One round = N launches on one table. Roles swap every launch.
 */
import { DEG, clamp, approach, dcos, dsin, hashNumbers } from '../../core/dmath';
import { ARENAS, DEFAULT_ARENA, DT, TIMING, TUNE, jellyCircle, scoreLaunch } from './rules';
import type { Arena, LaunchSetup } from './rules';

// ───────────────────────────── Inputs ─────────────────────────────

/** One player's input for one tick. Small integers so it is cheap to send and exact to replay. */
export interface PlayerInput {
  /** launcher: true while the spoon is held back */
  pull: boolean;
  /** launcher: elevation, 0..1023 mapped onto aimMinDeg..aimMaxDeg */
  aimQ: number;
  /** launcher: draw strength 0..255 */
  powerQ: number;
  /** launcher, in flight: hold to open the umbrella */
  umbrella: boolean;
  /** catcher: -127..127 */
  move: number;
  /** catcher: dive (acts on the press edge) */
  dive: boolean;
}

export function noInput(): PlayerInput {
  return { pull: false, aimQ: 512, powerQ: 0, umbrella: false, move: 0, dive: false };
}

export function aimRadians(aimQ: number): number {
  const q = clamp(aimQ, 0, 1023) / 1023;
  return (TUNE.aimMinDeg + (TUNE.aimMaxDeg - TUNE.aimMinDeg) * q) * DEG;
}

export function launchSpeed(powerQ: number): number {
  const p = clamp(powerQ, 0, 255) / 255;
  return TUNE.speedMin + (TUNE.speedMax - TUNE.speedMin) * p;
}

// ───────────────────────────── State ─────────────────────────────

export type Phase = 'intro' | 'aim' | 'flight' | 'outcome' | 'done';
export type FlyerMode = 'seated' | 'air' | 'caught' | 'down';
export type CatcherMode = 'run' | 'dive' | 'slide' | 'recover';
export type MissKind = 'table' | 'stranded' | 'off_edge' | 'timeout';

export interface FlyerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: FlyerMode;
  /** umbrella openness 0..1 */
  open: number;
  /** ticks of umbrella time left this flight */
  budget: number;
  spent: boolean;
  airTicks: number;
  rimHits: number;
  ringsHit: number;
  jelly: boolean;
}

export interface CatcherState {
  x: number;
  vx: number;
  facing: 1 | -1;
  mode: CatcherMode;
  modeTick: number;
  /** basket bottom-centre */
  bx: number;
  by: number;
  prevDive: boolean;
}

export interface LaunchResult {
  launcherSeat: 0 | 1;
  caught: boolean;
  perfect: boolean;
  diveCatch: boolean;
  rings: number;
  jelly: boolean;
  points: number;
  missKind: MissKind | null;
  /** horizontal distance from the basket centre when the flight ended (for "so close!" feedback) */
  missBy: number;
  /** where a miss came down (the table remembers) */
  downX: number;
  airTicks: number;
}

export type CourierEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'launch'; power01: number }
  | { type: 'aim_cancel' }
  | { type: 'umbrella'; open: boolean }
  | { type: 'umbrella_spent' }
  | { type: 'jelly'; index: number; strength: number; dirX: number }
  | { type: 'cupcake'; index: number; strength: number }
  | { type: 'balloon_bump'; index: number; dx: number; dy: number }
  | { type: 'balloon_pop'; index: number }
  | { type: 'cake'; y: number }
  | { type: 'ring'; index: number }
  | { type: 'rim'; side: -1 | 1; strength: number }
  | { type: 'caught'; result: LaunchResult }
  | { type: 'miss'; result: LaunchResult }
  | { type: 'dive'; dir: 1 | -1 }
  | { type: 'skid' }
  | { type: 'step' };

export interface CourierState {
  arenaId: string;
  launches: number;
  tick: number;
  phase: Phase;
  phaseTick: number;
  launchIndex: number;
  launcherSeat: 0 | 1;
  aim: { pulling: boolean; aimQ: number; powerQ: number };
  flyer: FlyerState;
  catcher: CatcherState;
  ringsCollected: boolean[];
  /** the table remembers: balloons stay popped for the whole round */
  balloonsPopped: boolean[];
  /** the table remembers: where every miss came down, and whose it was */
  splats: { x: number; seat: 0 | 1 }[];
  results: LaunchResult[];
  total: number;
  /** events produced by the most recent step; consumed by view/audio, never by the sim */
  events: CourierEvent[];
}

export interface CourierConfig {
  arenaId?: string;
  launches?: number;
  /** which seat launches first */
  firstLauncher?: 0 | 1;
}

export function arenaOf(s: CourierState): Arena {
  return ARENAS[s.arenaId] ?? ARENAS[DEFAULT_ARENA]!;
}

export function setupOf(s: CourierState, launchIndex = s.launchIndex): LaunchSetup {
  const a = arenaOf(s);
  return a.script[launchIndex % a.script.length]!;
}

/** Which seat catches this launch. */
export function catcherSeat(s: CourierState): 0 | 1 {
  return s.launcherSeat === 0 ? 1 : 0;
}

function freshFlyer(): FlyerState {
  return {
    x: TUNE.launchX, y: TUNE.launchY, vx: 0, vy: 0, mode: 'seated',
    open: 0, budget: TUNE.umbrellaTicks, spent: false, airTicks: 0, rimHits: 0, ringsHit: 0, jelly: false,
  };
}

export function createCourier(config: CourierConfig = {}): CourierState {
  const arenaId = config.arenaId && ARENAS[config.arenaId] ? config.arenaId : DEFAULT_ARENA;
  const arena = ARENAS[arenaId]!;
  const first = config.firstLauncher ?? 0;
  const s: CourierState = {
    arenaId,
    launches: Math.max(1, Math.floor(config.launches ?? 6)),
    tick: 0,
    phase: 'intro',
    phaseTick: 0,
    launchIndex: 0,
    launcherSeat: first,
    aim: { pulling: false, aimQ: 512, powerQ: 0 },
    flyer: freshFlyer(),
    catcher: {
      x: arena.catcherStart, vx: 0, facing: -1, mode: 'run', modeTick: 0,
      bx: arena.catcherStart, by: TUNE.basket.carryY, prevDive: false,
    },
    ringsCollected: [],
    balloonsPopped: arena.balloons.map(() => false),
    splats: [],
    results: [],
    total: 0,
    events: [],
  };
  s.ringsCollected = setupOf(s).rings.map(() => false);
  return s;
}

/** Deep copy for prediction / previews. Events are not carried over. */
export function cloneCourier(s: CourierState): CourierState {
  return {
    ...s,
    aim: { ...s.aim },
    flyer: { ...s.flyer },
    catcher: { ...s.catcher },
    ringsCollected: s.ringsCollected.slice(),
    balloonsPopped: s.balloonsPopped.slice(),
    splats: s.splats.map((p) => ({ ...p })),
    results: s.results.map((r) => ({ ...r })),
    events: [],
  };
}

export function hashCourier(s: CourierState): number {
  const f = s.flyer;
  const c = s.catcher;
  return hashNumbers([
    s.tick, s.phaseTick, s.launchIndex, s.launcherSeat, s.total, s.results.length,
    f.x, f.y, f.vx, f.vy, f.open, f.budget, f.airTicks, f.rimHits, f.ringsHit,
    c.x, c.vx, c.facing, c.modeTick, c.bx, c.by,
    s.aim.aimQ, s.aim.powerQ, s.aim.pulling ? 1 : 0,
    s.balloonsPopped.reduce((n, p, i) => n + (p ? 1 << i : 0), 0),
  ]);
}

// ───────────────────────────── Step ─────────────────────────────

function setPhase(s: CourierState, phase: Phase): void {
  s.phase = phase;
  s.phaseTick = 0;
  s.events.push({ type: 'phase', phase });
}

export function stepCourier(s: CourierState, inputs: readonly [PlayerInput, PlayerInput]): void {
  s.events.length = 0;
  if (s.phase === 'done') return;
  s.tick++;
  const launcherIn = inputs[s.launcherSeat];
  const catcherIn = inputs[catcherSeat(s)];

  switch (s.phase) {
    case 'intro':
      stepCatcher(s, catcherIn);
      if (++s.phaseTick >= TIMING.intro) setPhase(s, 'aim');
      break;
    case 'aim':
      stepCatcher(s, catcherIn);
      stepAim(s, launcherIn);
      break;
    case 'flight':
      stepCatcher(s, catcherIn);
      stepFlight(s, launcherIn);
      break;
    case 'outcome': {
      // The catcher keeps sliding to a stop but can no longer act; the delivery is resolved.
      settleCatcher(s);
      const last = s.results[s.results.length - 1]!;
      const limit = last.caught ? TIMING.outcomeCaught : TIMING.outcomeMiss;
      if (++s.phaseTick >= limit) nextLaunch(s);
      break;
    }
  }
}

function nextLaunch(s: CourierState): void {
  if (s.launchIndex + 1 >= s.launches) {
    setPhase(s, 'done');
    return;
  }
  const arena = arenaOf(s);
  s.launchIndex++;
  s.launcherSeat = s.launcherSeat === 0 ? 1 : 0;
  s.flyer = freshFlyer();
  s.aim = { pulling: false, aimQ: 512, powerQ: 0 };
  const c = s.catcher;
  c.x = arena.catcherStart;
  c.vx = 0;
  c.facing = -1;
  c.mode = 'run';
  c.modeTick = 0;
  c.bx = c.x;
  c.by = TUNE.basket.carryY;
  c.prevDive = false;
  s.ringsCollected = setupOf(s).rings.map(() => false);
  setPhase(s, 'intro');
}

// ── aiming ──

function stepAim(s: CourierState, inp: PlayerInput): void {
  const a = s.aim;
  s.phaseTick++;
  const timedOut = s.phaseTick >= TIMING.aimLimit;
  if (inp.pull) {
    a.pulling = true;
    a.aimQ = clamp(Math.round(inp.aimQ), 0, 1023);
    a.powerQ = clamp(Math.round(inp.powerQ), 0, 255);
    if (timedOut) launch(s, a.aimQ, Math.max(a.powerQ, TIMING.minPowerQ));
    return;
  }
  if (a.pulling) {
    // Released this tick. The release input still carries the final aim; prefer it, so the
    // launch is exactly what the player let go of even if an earlier input was never seen.
    a.pulling = false;
    if (inp.powerQ >= TIMING.minPowerQ) {
      a.aimQ = clamp(Math.round(inp.aimQ), 0, 1023);
      a.powerQ = clamp(Math.round(inp.powerQ), 0, 255);
    }
    if (a.powerQ >= TIMING.minPowerQ) {
      launch(s, a.aimQ, a.powerQ);
    } else {
      a.powerQ = 0;
      s.events.push({ type: 'aim_cancel' });
    }
    return;
  }
  if (timedOut) launch(s, 560, 150); // nobody pulled: a gentle default lob keeps the party moving
}

function launch(s: CourierState, aimQ: number, powerQ: number): void {
  const ang = aimRadians(aimQ);
  const speed = launchSpeed(powerQ);
  const f = s.flyer;
  f.mode = 'air';
  f.x = TUNE.launchX;
  f.y = TUNE.launchY;
  f.vx = dcos(ang) * speed;
  f.vy = dsin(ang) * speed;
  s.aim.pulling = false;
  s.aim.aimQ = aimQ;
  s.aim.powerQ = powerQ;
  s.events.push({ type: 'launch', power01: clamp(powerQ, 0, 255) / 255 });
  setPhase(s, 'flight');
}

// ── catcher ──

function stepCatcher(s: CourierState, inp: PlayerInput): void {
  const c = s.catcher;
  const T = TUNE.catcher;
  const arena = arenaOf(s);
  const axis = clamp(Math.round(inp.move), -127, 127) / 127;
  const divePressed = inp.dive && !c.prevDive;
  c.prevDive = inp.dive;

  switch (c.mode) {
    case 'run': {
      if (divePressed) {
        const dir: 1 | -1 = axis > 0.2 ? 1 : axis < -0.2 ? -1 : c.facing;
        c.mode = 'dive';
        c.modeTick = 0;
        c.facing = dir;
        c.vx = dir * T.diveSpeed;
        s.events.push({ type: 'dive', dir });
        break;
      }
      const target = axis * T.maxSpeed;
      const reversing = (target > 0 && c.vx < -0.5) || (target < 0 && c.vx > 0.5);
      const rate = Math.abs(target) > Math.abs(c.vx) && !reversing ? T.accel : T.decel;
      if (reversing && Math.abs(c.vx) > 5.5 && s.tick % 6 === 0) s.events.push({ type: 'skid' });
      c.vx = approach(c.vx, target, rate * DT);
      if (axis > 0.05) c.facing = 1;
      else if (axis < -0.05) c.facing = -1;
      if (Math.abs(c.vx) > 3 && s.tick % 11 === 0) s.events.push({ type: 'step' });
      break;
    }
    case 'dive':
      c.vx = c.facing * T.diveSpeed;
      if (++c.modeTick >= T.diveTicks) {
        c.mode = 'slide';
        c.modeTick = 0;
      }
      break;
    case 'slide':
      c.vx *= 0.88;
      if (++c.modeTick >= T.slideTicks) {
        c.mode = 'recover';
        c.modeTick = 0;
      }
      break;
    case 'recover':
      c.vx *= 0.7;
      if (++c.modeTick >= T.recoverTicks) {
        c.mode = 'run';
        c.modeTick = 0;
      }
      break;
  }

  c.x += c.vx * DT;
  if (c.x < arena.laneMin) {
    c.x = arena.laneMin;
    if (c.vx < 0) c.vx = 0;
  } else if (c.x > arena.laneMax) {
    c.x = arena.laneMax;
    if (c.vx > 0) c.vx = 0;
  }
  poseBasket(c);
}

/** After a delivery is resolved the catcher just coasts to a stop. */
function settleCatcher(s: CourierState): void {
  const c = s.catcher;
  const arena = arenaOf(s);
  c.vx *= 0.85;
  c.x = clamp(c.x + c.vx * DT, arena.laneMin, arena.laneMax);
  if (c.mode !== 'run') {
    if (++c.modeTick >= TUNE.catcher.slideTicks) {
      c.mode = 'run';
      c.modeTick = 0;
    }
  }
  poseBasket(c);
}

/** How far into the dive pose the basket is, 0..1. */
export function diveAmount(c: CatcherState): number {
  const T = TUNE.catcher;
  if (c.mode === 'dive') return Math.min(1, c.modeTick / 4);
  if (c.mode === 'slide') return 1;
  if (c.mode === 'recover') return 1 - c.modeTick / T.recoverTicks;
  return 0;
}

function poseBasket(c: CatcherState): void {
  const T = TUNE.catcher;
  const d = diveAmount(c);
  c.bx = c.x + c.facing * T.diveLead * d;
  c.by = TUNE.basket.carryY - T.diveLower * d;
}

// ── flight ──

const SUBSTEPS = 2;

function stepFlight(s: CourierState, inp: PlayerInput): void {
  const f = s.flyer;
  s.phaseTick++;
  f.airTicks++;

  // umbrella: a small paper budget per flight
  const wantOpen = inp.umbrella && !f.spent && f.budget > 0;
  const before = f.open;
  f.open = approach(f.open, wantOpen ? 1 : 0, TUNE.umbrellaRate);
  if (wantOpen) {
    f.budget--;
    if (before === 0) s.events.push({ type: 'umbrella', open: true });
    if (f.budget <= 0) {
      f.spent = true;
      s.events.push({ type: 'umbrella_spent' });
    }
  } else if (before === 1 && !f.spent) {
    s.events.push({ type: 'umbrella', open: false });
  }

  const h = DT / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS && f.mode === 'air'; i++) {
    const px = f.x;
    integrate(s, f, h);
    collide(s, f, px);
  }

  if (f.mode === 'air' && f.airTicks >= TUNE.flightLimitTicks) endMiss(s, 'timeout');
}

/** Forces + integration for one substep. Shared with the aim preview. */
function integrate(s: CourierState, f: FlyerState, h: number): void {
  const o = f.open;
  const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
  const kc = TUNE.dragClosed * (1 - o);
  let ax = -kc * speed * f.vx;
  let ay = -TUNE.gravity - kc * speed * f.vy;
  if (o > 0) {
    ax += -TUNE.dragOpenX * o * Math.abs(f.vx) * f.vx;
    ay += f.vy < 0 ? TUNE.dragOpenDown * o * f.vy * f.vy : -TUNE.dragOpenUp * o * f.vy * f.vy;
  }
  const wind = setupOf(s).wind;
  if (wind !== 0) {
    const z = arenaOf(s).windZone;
    if (f.x >= z.x0 && f.x <= z.x1 && f.y >= z.y0 && f.y <= z.y1) {
      ax += wind * (TUNE.windClosedFactor + (1 - TUNE.windClosedFactor) * o);
    }
  }
  f.vx += ax * h;
  f.vy += ay * h;
  f.x += f.vx * h;
  f.y += f.vy * h;
}

function collide(s: CourierState, f: FlyerState, prevX: number): void {
  const arena = arenaOf(s);
  const setup = setupOf(s);
  const R = TUNE.bodyR;

  // donut rings: sensors, crossed in either direction
  for (let i = 0; i < setup.rings.length; i++) {
    if (s.ringsCollected[i]) continue;
    const g = setup.rings[i]!;
    if ((prevX - g.x) * (f.x - g.x) <= 0 && prevX !== f.x) {
      const t = (g.x - prevX) / (f.x - prevX);
      const yAt = f.y - f.vy * (DT / SUBSTEPS) * (1 - t);
      if (Math.abs(yAt - g.y) <= g.r) {
        s.ringsCollected[i] = true;
        f.ringsHit++;
        s.events.push({ type: 'ring', index: i });
      }
    }
  }

  // jelly: a wide, shallow trampoline with a guaranteed kick
  for (let i = 0; i < arena.jellies.length; i++) {
    const j = arena.jellies[i]!;
    if (Math.abs(f.x - j.x) > j.halfW + R * 0.6) continue;
    const jc = jellyCircle(j);
    const dx = f.x - jc.cx;
    const dy = f.y - jc.cy;
    const d2 = dx * dx + dy * dy;
    const reach = jc.r + R;
    if (d2 < reach * reach) {
      const d = Math.sqrt(d2) || 1e-6;
      const nx = dx / d;
      const ny = dy / d;
      const vn = f.vx * nx + f.vy * ny;
      if (vn < 0) {
        f.x = jc.cx + nx * reach;
        f.y = jc.cy + ny * reach;
        let out = -vn * TUNE.jelly.restitution;
        if (out < TUNE.jelly.kick) out = TUNE.jelly.kick;
        f.vx += (out - vn) * nx;
        f.vy += (out - vn) * ny;
        const sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        if (sp > TUNE.jelly.maxSpeed) {
          f.vx *= TUNE.jelly.maxSpeed / sp;
          f.vy *= TUNE.jelly.maxSpeed / sp;
        }
        f.jelly = true;
        s.events.push({ type: 'jelly', index: i, strength: clamp(-vn / 18, 0.15, 1), dirX: nx });
      }
    }
  }

  // cupcakes: wrapper block + frosting dome
  for (let i = 0; i < arena.cupcakes.length; i++) {
    const c = arena.cupcakes[i]!;
    const topY = c.h - c.r;
    let nx = 0;
    let ny = 0;
    let pen = 0;
    const ddx = f.x - c.x;
    const ddy = f.y - topY;
    if (ddy >= 0) {
      // against the frosting dome
      const d2 = ddx * ddx + ddy * ddy;
      const reach = c.r + R;
      if (d2 < reach * reach) {
        const d = Math.sqrt(d2) || 1e-6;
        nx = ddx / d;
        ny = ddy / d;
        pen = reach - d;
      }
    } else if (Math.abs(ddx) < c.r + R) {
      // against the wrapper's side
      nx = ddx >= 0 ? 1 : -1;
      pen = c.r + R - Math.abs(ddx);
    }
    if (pen > 0) {
      f.x += nx * pen;
      f.y += ny * pen;
      const vn = f.vx * nx + f.vy * ny;
      if (vn < 0) {
        const tx = -ny;
        const ty = nx;
        const vt = (f.vx * tx + f.vy * ty) * TUNE.cupcake.friction;
        const out = -vn * TUNE.cupcake.restitution;
        f.vx = out * nx + vt * tx;
        f.vy = out * ny + vt * ty;
        s.events.push({ type: 'cupcake', index: i, strength: clamp(-vn / 16, 0.1, 1) });
        const sp = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        if (ny > 0.7 && sp < TUNE.cupcake.restSpeed) {
          endMiss(s, 'stranded');
          return;
        }
      }
    }
  }

  // balloons: soft bumpers; a hard hit pops them and they stay popped
  for (let i = 0; i < arena.balloons.length; i++) {
    if (s.balloonsPopped[i]) continue;
    const b = arena.balloons[i]!;
    const dx = f.x - b.x;
    const dy = f.y - b.y;
    const reach = b.r + R;
    const d2 = dx * dx + dy * dy;
    if (d2 < reach * reach) {
      const d = Math.sqrt(d2) || 1e-6;
      const nx = dx / d;
      const ny = dy / d;
      const vn = f.vx * nx + f.vy * ny;
      if (vn < 0) {
        if (-vn >= TUNE.balloon.popSpeed) {
          s.balloonsPopped[i] = true;
          f.vx *= TUNE.balloon.popKeep;
          f.vy *= TUNE.balloon.popKeep;
          s.events.push({ type: 'balloon_pop', index: i });
        } else {
          f.x = b.x + nx * reach;
          f.y = b.y + ny * reach;
          const out = -vn * TUNE.balloon.restitution + TUNE.balloon.kick;
          f.vx += (out - vn) * nx;
          f.vy += (out - vn) * ny;
          s.events.push({ type: 'balloon_bump', index: i, dx: -nx, dy: -ny });
        }
      }
    }
  }

  // the cake cliff
  if (f.x + R > arena.xMax) {
    f.x = arena.xMax - R;
    if (f.vx > 0) {
      f.vx = -f.vx * TUNE.cakeWall.restitution;
      f.vy *= 0.6;
      s.events.push({ type: 'cake', y: f.y });
    }
  }

  if (collideBasket(s, f)) return;

  // the table
  if (f.y - R <= 0) {
    f.y = R;
    endMiss(s, 'table');
    return;
  }
  if (f.x < arena.xMin) endMiss(s, 'off_edge');
}

const RIM_SIDES = [-1, 1] as const;

/** Returns true if the flight ended (caught). */
function collideBasket(s: CourierState, f: FlyerState): boolean {
  const c = s.catcher;
  const B = TUNE.basket;
  const r = TUNE.seatR;
  const top = c.by + B.depth;
  const bvx = c.vx;

  // rims: two small circles; hitting one is the drama of a near miss
  for (const side of RIM_SIDES) {
    const rx = c.bx + side * B.halfOpen;
    const dx = f.x - rx;
    const dy = f.y - top;
    const reach = r + B.rimR;
    const d2 = dx * dx + dy * dy;
    if (d2 < reach * reach) {
      const d = Math.sqrt(d2) || 1e-6;
      const nx = dx / d;
      const ny = dy / d;
      const rvx = f.vx - bvx;
      const vn = rvx * nx + f.vy * ny;
      if (vn < 0) {
        f.x = rx + nx * reach;
        f.y = top + ny * reach;
        const out = -vn * 0.5;
        f.vx = rvx + (out - vn) * nx + bvx;
        f.vy = f.vy + (out - vn) * ny;
        // Nobody balances on a paper rim: a dead-centre rim hit tips off, inward on a tie.
        if (Math.abs(nx) < 0.25) f.vx += ((f.x - rx) * side <= 0 ? -side : side) * 1.8;
        f.rimHits++;
        s.events.push({ type: 'rim', side, strength: clamp(-vn / 14, 0.1, 1) });
      }
    }
  }

  const dx = f.x - c.bx;
  // dropped in through the opening
  if (f.y <= top && f.y >= c.by && Math.abs(dx) <= B.halfOpen - 0.05 && f.vy <= 2) {
    endCaught(s, dx);
    return true;
  }
  // bounced off the outside of the liner (its sides or its base — never the open top)
  const cx = clamp(f.x, c.bx - B.halfOpen, c.bx + B.halfOpen);
  const cy = clamp(f.y, c.by, top);
  const ox = f.x - cx;
  const oy = f.y - cy;
  const d2 = ox * ox + oy * oy;
  const overOpening = oy > 0 && ox === 0;
  if (!overOpening && d2 > 0 && d2 < r * r) {
    const d = Math.sqrt(d2);
    const nx = ox / d;
    const ny = oy / d;
    const rvx = f.vx - bvx;
    const vn = rvx * nx + f.vy * ny;
    f.x = cx + nx * r;
    f.y = cy + ny * r;
    if (vn < 0) {
      const out = -vn * 0.35;
      f.vx = rvx + (out - vn) * nx + bvx;
      f.vy = f.vy + (out - vn) * ny;
      f.rimHits++;
      s.events.push({ type: 'rim', side: nx >= 0 ? 1 : -1, strength: clamp(-vn / 14, 0.1, 1) });
    }
  }
  return false;
}

function endCaught(s: CourierState, dx: number): void {
  const f = s.flyer;
  const c = s.catcher;
  f.mode = 'caught';
  f.vx = 0;
  f.vy = 0;
  f.open = 0;
  const diveCatch = c.mode === 'dive' || c.mode === 'slide';
  const perfect = f.rimHits === 0 && Math.abs(dx) <= TUNE.basket.perfectDx;
  const result: LaunchResult = {
    launcherSeat: s.launcherSeat,
    caught: true,
    perfect,
    diveCatch,
    rings: f.ringsHit,
    jelly: f.jelly,
    points: scoreLaunch({ caught: true, perfect, diveCatch, rings: f.ringsHit, jelly: f.jelly }),
    missKind: null,
    missBy: Math.abs(dx),
    downX: f.x,
    airTicks: f.airTicks,
  };
  s.results.push(result);
  s.total += result.points;
  s.events.push({ type: 'caught', result });
  setPhase(s, 'outcome');
}

function endMiss(s: CourierState, kind: MissKind): void {
  const f = s.flyer;
  f.mode = 'down';
  f.vx = 0;
  f.vy = 0;
  f.open = 0;
  const result: LaunchResult = {
    launcherSeat: s.launcherSeat,
    caught: false,
    perfect: false,
    diveCatch: false,
    rings: f.ringsHit,
    jelly: f.jelly,
    points: 0,
    missKind: kind,
    missBy: Math.abs(f.x - s.catcher.bx),
    downX: f.x,
    airTicks: f.airTicks,
  };
  if (kind === 'table') s.splats.push({ x: f.x, seat: s.launcherSeat });
  s.results.push(result);
  s.events.push({ type: 'miss', result });
  setPhase(s, 'outcome');
}

// ───────────────────────────── Previews (aim arc, bot planning) ─────────────────────────────

export interface FlightSample {
  x: number;
  y: number;
}

export interface FlightForecast {
  /** where the flyer crosses basket-rim height on the way down, or NaN if it never does */
  landX: number;
  /** ticks until that crossing */
  landTicks: number;
  rings: number;
  jelly: boolean;
  /** true if the flight ended on an obstacle or off the table before reaching the lane */
  dead: boolean;
}

/**
 * Fly a copy of the current flyer forward without a catcher and report where it comes down.
 * `openPlan(tick)` says whether the umbrella is held on a given future tick.
 */
export function forecastFlight(
  s: CourierState,
  start: { x: number; y: number; vx: number; vy: number; open: number; budget: number; spent: boolean } | null,
  maxTicks: number,
  openPlan: ((tick: number) => boolean) | null,
  samples: FlightSample[] | null,
  sampleEvery = 3,
): FlightForecast {
  const sim = cloneCourier(s);
  const f = sim.flyer;
  if (start) {
    f.x = start.x; f.y = start.y; f.vx = start.vx; f.vy = start.vy;
    f.open = start.open; f.budget = start.budget; f.spent = start.spent;
  }
  f.mode = 'air';
  sim.phase = 'flight';
  // park the basket far away so only the world shapes the path
  sim.catcher.bx = -1000;
  sim.catcher.x = -1000;
  const rimY = TUNE.basket.carryY + TUNE.basket.depth;
  const out: FlightForecast = { landX: NaN, landTicks: maxTicks, rings: 0, jelly: false, dead: false };
  const h = DT / SUBSTEPS;
  for (let t = 0; t < maxTicks; t++) {
    const hold = openPlan ? openPlan(t) : false;
    const wantOpen = hold && !f.spent && f.budget > 0;
    f.open = approach(f.open, wantOpen ? 1 : 0, TUNE.umbrellaRate);
    if (wantOpen && --f.budget <= 0) f.spent = true;
    const prevY = f.y;
    for (let i = 0; i < SUBSTEPS && f.mode === 'air'; i++) {
      const px = f.x;
      integrate(sim, f, h);
      collide(sim, f, px);
    }
    if (samples && t % sampleEvery === 0) samples.push({ x: f.x, y: f.y });
    if (f.mode !== 'air') {
      out.dead = f.y > rimY + 0.01 || f.x < arenaOf(sim).laneMin - 1.5;
      if (Number.isNaN(out.landX)) {
        out.landX = f.x;
        out.landTicks = t + 1;
      }
      break;
    }
    if (f.vy < 0 && prevY > rimY && f.y <= rimY) {
      const k = (prevY - rimY) / (prevY - f.y);
      out.landX = f.x - f.vx * DT * (1 - k);
      out.landTicks = t + 1;
      const a = arenaOf(sim);
      if (out.landX >= a.laneMin - 1 && out.landX <= a.laneMax + 1) break;
    }
  }
  out.rings = f.ringsHit;
  out.jelly = f.jelly;
  return out;
}

/** Forecast a launch that has not happened yet. */
export function forecastLaunch(
  s: CourierState,
  aimQ: number,
  powerQ: number,
  maxTicks: number,
  samples: FlightSample[] | null = null,
  sampleEvery = 3,
): FlightForecast {
  const ang = aimRadians(aimQ);
  const speed = launchSpeed(powerQ);
  return forecastFlight(
    s,
    { x: TUNE.launchX, y: TUNE.launchY, vx: dcos(ang) * speed, vy: dsin(ang) * speed, open: 0, budget: TUNE.umbrellaTicks, spent: false },
    maxTicks,
    null,
    samples,
    sampleEvery,
  );
}

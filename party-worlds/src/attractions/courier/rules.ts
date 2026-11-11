/**
 * Catapult Courier — rules, tuning and static table layouts.
 * Everything a player could reasonably ask "why did that happen?" about is a number in this file.
 */

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/** Physical tuning. Identical for every character: looks never change these. */
export const TUNE = {
  gravity: 16,
  launchX: 0,
  launchY: 2.4,
  speedMin: 11,
  speedMax: 28,
  aimMinDeg: 18,
  aimMaxDeg: 80,
  /** collider used against the table, jelly, cupcakes, balloons */
  bodyR: 0.42,
  /** smaller collider used against the basket so a clean drop feels generous */
  seatR: 0.3,
  dragClosed: 0.0035,
  dragOpenX: 0.085,
  dragOpenUp: 0.12,
  dragOpenDown: 1.0, // terminal fall speed under the umbrella = sqrt(gravity / this) = 4 u/s
  umbrellaTicks: 96, // 1.6 s of open time per flight
  umbrellaRate: 1 / 7, // open/close blend per tick
  windClosedFactor: 0.3, // how much wind a tucked flyer feels (umbrella open feels all of it)
  flightLimitTicks: 14 * TICK_HZ,
  catcher: {
    maxSpeed: 8.5,
    accel: 70,
    decel: 95,
    diveSpeed: 15,
    diveTicks: 13,
    slideTicks: 21,
    recoverTicks: 14,
    diveLower: 0.45,
    diveLead: 0.6,
  },
  basket: {
    halfOpen: 0.85,
    depth: 0.9,
    rimR: 0.13,
    carryY: 1.05,
    perfectDx: 0.2,
  },
  jelly: { restitution: 0.9, kick: 9.5, maxSpeed: 22 },
  cupcake: { restitution: 0.4, friction: 0.8, restSpeed: 2.6 },
  balloon: { restitution: 0.85, kick: 2, popSpeed: 15, popKeep: 0.6 },
  cakeWall: { restitution: 0.25 },
} as const;

/** Phase timing in ticks. */
export const TIMING = {
  intro: 66,
  aimLimit: 20 * TICK_HZ,
  aimWarn: 5 * TICK_HZ,
  outcomeCaught: 150,
  outcomeMiss: 132,
  minPowerQ: 24, // releasing below this cancels the pull instead of dribbling off the spoon
} as const;

/**
 * Raw scoring for one delivery. Bonuses are only banked if the flyer is caught:
 * a delivery is a shared success, so both roles always share every point.
 */
export const POINTS = {
  caught: 100,
  perfect: 25, // dead-centre, no rim
  dive: 15, // caught mid-dive or mid-slide
  ring: 40, // per donut threaded
  jelly: 30, // at least one jelly bounce on the way
} as const;

export interface LaunchScore {
  caught: boolean;
  perfect: boolean;
  diveCatch: boolean;
  rings: number;
  jelly: boolean;
}

export function scoreLaunch(s: LaunchScore): number {
  if (!s.caught) return 0;
  return (
    POINTS.caught +
    (s.perfect ? POINTS.perfect : 0) +
    (s.diveCatch ? POINTS.dive : 0) +
    s.rings * POINTS.ring +
    (s.jelly ? POINTS.jelly : 0)
  );
}

/** Star thresholds for a six-launch duet, as a fraction of "every delivery caught with its ring". */
export function starsFor(total: number, launches: number, ringsAvailable: number): 0 | 1 | 2 | 3 {
  const solid = launches * POINTS.caught + ringsAvailable * POINTS.ring;
  if (total >= solid * 0.9) return 3;
  if (total >= solid * 0.6) return 2;
  if (total >= solid * 0.3) return 1;
  return 0;
}

// ───────────────────────────── Table layouts ─────────────────────────────

export interface RingDef { x: number; y: number; r: number }
/** A wide, shallow jelly: a circular arc `halfW` wide each side and `h` tall. A forgiving trampoline. */
export interface JellyDef { x: number; halfW: number; h: number }

/** The circle the jelly's bouncy surface is an arc of. */
export function jellyCircle(j: JellyDef): { cx: number; cy: number; r: number } {
  const r = (j.halfW * j.halfW + j.h * j.h) / (2 * j.h);
  return { cx: j.x, cy: j.h - r, r };
}
export interface CupcakeDef { x: number; r: number; h: number }
export interface BalloonDef { x: number; y: number; r: number }
export interface WindZone { x0: number; x1: number; y0: number; y1: number }

export interface LaunchSetup {
  rings: RingDef[];
  /** horizontal wind acceleration inside the wind zone, units/s² (negative = headwind) */
  wind: number;
}

export interface Arena {
  id: string;
  name: string;
  /** fall off the table behind the spoon */
  xMin: number;
  /** the cake cliff */
  xMax: number;
  laneMin: number;
  laneMax: number;
  catcherStart: number;
  jellies: JellyDef[];
  cupcakes: CupcakeDef[];
  balloons: BalloonDef[];
  windZone: WindZone;
  /** one entry per launch; the table itself stays the same and remembers what happened */
  script: LaunchSetup[];
}

const RING_A: RingDef = { x: 9.5, y: 9.4, r: 1.7 };
const RING_B: RingDef = { x: 17.5, y: 12.2, r: 1.6 };
const RING_C: RingDef = { x: 26.5, y: 8.6, r: 1.6 };
const RING_D: RingDef = { x: 19.2, y: 8.2, r: 1.5 };

export const ARENAS: Record<string, Arena> = {
  jelly_junction: {
    id: 'jelly_junction',
    name: 'Jelly Junction',
    xMin: -7,
    xMax: 43,
    laneMin: 14.5,
    laneMax: 41,
    catcherStart: 28,
    jellies: [{ x: 10.5, halfW: 3.2, h: 1.6 }],
    cupcakes: [],
    balloons: [
      { x: 36.5, y: 9.6, r: 1.25 },
      { x: 39.0, y: 12.4, r: 1.25 },
    ],
    windZone: { x0: 6, x1: 43, y0: 2.6, y1: 40 },
    script: [
      { rings: [RING_A], wind: 0 },
      { rings: [RING_B], wind: 0 },
      { rings: [RING_A], wind: -6 },
      { rings: [RING_D], wind: 0 },
      { rings: [RING_C], wind: 5 },
      { rings: [RING_A, RING_C], wind: -4 },
    ],
  },
};

export const DEFAULT_ARENA = 'jelly_junction';

export function ringsInScript(arena: Arena, launches: number): number {
  let n = 0;
  for (let i = 0; i < launches; i++) n += arena.script[i % arena.script.length]!.rings.length;
  return n;
}

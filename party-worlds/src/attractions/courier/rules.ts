/**
 * Catapult Courier — rules, tuning and static table layouts.
 * Everything a player could reasonably ask "why did that happen?" about is a number in this file.
 */

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/**
 * Physical tuning. Identical for every character: looks never change these.
 *
 * Scale note: 1 unit = one character height. The whole arena is about 24 units long, so at the
 * widest camera framing a character is still ~1/12 of the screen height on a phone. (The first
 * layout was 1.8× longer and characters became specks; see DECISIONS D-013.)
 */
export const TUNE = {
  gravity: 9,
  launchX: 0,
  launchY: 2.4,
  speedMin: 6.2,
  speedMax: 15.5,
  aimMinDeg: 18,
  aimMaxDeg: 80,
  /** collider used against the table, jelly, cupcakes, balloons */
  bodyR: 0.42,
  /** smaller collider used against the basket so a clean drop feels generous */
  seatR: 0.3,
  dragClosed: 0.0063,
  dragOpenX: 0.153,
  dragOpenUp: 0.216,
  dragOpenDown: 1.8, // terminal fall speed under the umbrella = sqrt(gravity / this) ≈ 2.2 u/s
  umbrellaTicks: 96, // 1.6 s of open time per flight
  umbrellaRate: 1 / 7, // open/close blend per tick
  windClosedFactor: 0.3, // how much wind a tucked flyer feels (umbrella open feels all of it)
  flightLimitTicks: 9 * TICK_HZ,
  catcher: {
    maxSpeed: 4.4,
    accel: 39,
    decel: 53,
    diveSpeed: 8.3,
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
    perfectDx: 0.15,
  },
  jelly: { restitution: 0.9, kick: 5.3, maxSpeed: 12.2 },
  cupcake: { restitution: 0.4, friction: 0.8, restSpeed: 1.45 },
  balloon: { restitution: 0.85, kick: 1.1, popSpeed: 8.3, popKeep: 0.6 },
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

const RING_A: RingDef = { x: 5.3, y: 5.3, r: 1.0 };
const RING_B: RingDef = { x: 9.7, y: 6.9, r: 0.95 };
const RING_C: RingDef = { x: 14.7, y: 4.9, r: 0.95 };
const RING_D: RingDef = { x: 10.7, y: 4.7, r: 0.9 };

export const ARENAS: Record<string, Arena> = {
  jelly_junction: {
    id: 'jelly_junction',
    name: 'Jelly Junction',
    xMin: -4.2,
    xMax: 24,
    laneMin: 8.6,
    laneMax: 22.1,
    catcherStart: 15.5,
    jellies: [{ x: 5.8, halfW: 1.8, h: 0.9 }],
    cupcakes: [],
    balloons: [
      { x: 20.3, y: 5.4, r: 0.8 },
      { x: 21.8, y: 7.0, r: 0.8 },
    ],
    windZone: { x0: 3.3, x1: 24, y0: 1.5, y1: 22 },
    script: [
      { rings: [RING_A], wind: 0 },
      { rings: [RING_B], wind: 0 },
      { rings: [RING_A], wind: -3.3 },
      { rings: [RING_D], wind: 0 },
      { rings: [RING_C], wind: 2.8 },
      { rings: [RING_A, RING_C], wind: -2.2 },
    ],
  },
};

export const DEFAULT_ARENA = 'jelly_junction';

export function ringsInScript(arena: Arena, launches: number): number {
  let n = 0;
  for (let i = 0; i < launches; i++) n += arena.script[i % arena.script.length]!.rings.length;
  return n;
}

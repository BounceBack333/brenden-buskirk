/**
 * Backyard Dash — tuning and the "Backyard After Dark" circuit.
 *
 * Coordinates: x east, z south (toward the camera in the lobby), y up. 1 unit = one character
 * height. A heading of 0 faces +x; a positive steer turns right (heading increases).
 * Everything here is built with deterministic maths so the server, bots, ghosts and tests agree.
 */
import { DEG, dcos, dsin } from '../../core/dmath';

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/** Kart handling. Identical for every driver: looks never change these. */
export const KART = {
  radius: 0.62,
  vMax: 16,
  vBoost: 21.5,
  vReverse: -4,
  accelK: 1.15, // how fast speed approaches its target, 1/s
  accelMin: 3.2, // …plus a floor so pulling away never feels sluggish, u/s²
  coastK: 2.0,
  brakeK: 4.5,
  turnLow: 2.9, // rad/s when slow
  turnHigh: 1.75, // rad/s at top speed
  grip: 11, // how fast sideways velocity dies normally, 1/s
  driftGrip: 4.2, // …and while drifting (the slide)
  driftMinSpeed: 8.5,
  driftBase: 1.2, // heading rate while drifting with neutral stick
  driftSteer: 0.8, // …tightened or widened by the stick
  chargePerSecond: 0.62, // drift charge with neutral stick; steering in charges faster
  boost1Ticks: 44,
  boost2Ticks: 84,
  startBoostTicks: 40,
  startWindowTicks: 22, // press drift this close to GO for a start boost
  grass: 0.55,
  soil: 0.4,
  boostIgnoresSurface: 0.4, // a boost shrugs off this much of a surface penalty (boosted grass ≈ road pace, never better)
  steerScrub: 0.05,
  draftRange: 6.5,
  draftCos: 0.975, // ~13° cone
  draftTicks: 40, // time in the cone before the tow starts
  draftBonus: 1.09,
  gravity: 22,
  hop: 2.4,
  wallRestitution: 0.25,
  stunSpeed: 8.5, // a wall hit harder than this spins you out briefly
  stunTicks: 22,
  kartBounce: 0.55,
} as const;

export const RACE = {
  laps: 3,
  countdownTicks: 3 * TICK_HZ,
  /** race is called this long after the first finisher, ranking the rest by progress */
  graceTicks: 25 * TICK_HZ,
  /** once the people are home the race runs on this long, so rivals close behind get a real gap */
  runOutTicks: Math.round(2.5 * TICK_HZ),
  maxTicks: 4 * 60 * TICK_HZ,
} as const;

export interface Sample {
  x: number;
  z: number;
  /** unit tangent */
  tx: number;
  tz: number;
  /** half width of the paved road here */
  hw: number;
  /** signed curvature (positive = right turn) */
  k: number;
}

export interface Circle { x: number; z: number; r: number }
export interface Capsule { x1: number; z1: number; x2: number; z2: number; r: number }
/** an axis-aligned patch of ground */
export interface Zone { x0: number; x1: number; z0: number; z1: number }

export interface Track {
  id: string;
  name: string;
  samples: Sample[];
  length: number;
  /** spacing between samples */
  ds: number;
  circles: Circle[];
  capsules: Capsule[];
  bounds: { x0: number; x1: number; z0: number; z1: number };
  grid: { x: number; z: number; heading: number }[];
  plank: {
    ax: number; az: number; bx: number; bz: number; hw: number;
    /** the last stretch of the plank is a ramp */
    rampFrom: number;
    /** closed: a raised end blocks the entrance */
    blocker: Capsule;
    /** bump this to drop the plank for everyone */
    prop: Circle;
    /** where a rival who means to take the plank lines up for it */
    fork: Zone;
    /** where a rival who means to open it turns for the peg */
    opener: Zone;
  };
  /** race times, in seconds, for a standard race here (RACE.laps laps): what a medal costs */
  medals: { gold: number; silver: number; bronze: number };
  /** where the menu parks the drivers, and where it looks at them from */
  lobby: {
    spots: { x: number; z: number; heading: number }[];
    camera: { x: number; y: number; z: number };
    look: { x: number; y: number; z: number };
  };
  /** the flowerbed the plank crosses (ellipse): very slow going */
  bed: { x: number; z: number; rx: number; rz: number };
  /** set dressing anchors the view uses (the sim only uses circles/capsules) */
  dressing: {
    hose: { cx: number; cz: number; r: number; a0: number; a1: number };
    pot: Circle;
    ball: Circle;
    /** the ladder on the lawn: outer rails at z0 and z1, from x0 to x1 */
    ladder: { x0: number; x1: number; z0: number; z1: number; rail: number };
    chairLegs: Circle[];
    bricks: Capsule[];
    workLight: { x: number; z: number };
  };
}

type P = [number, number];

/** Uniform Catmull-Rom through a closed loop of control points, densely sampled. */
function denseLoop(pts: P[], per: number): P[] {
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const z = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, z]);
    }
  }
  return out;
}

function buildSamples(pts: P[], startNear: P, widths: (x: number, z: number) => number): { samples: Sample[]; length: number; ds: number } {
  const dense = denseLoop(pts, 20);
  const m = dense.length;
  let length = 0;
  const seg: number[] = [];
  for (let i = 0; i < m; i++) {
    const a = dense[i]!;
    const b = dense[(i + 1) % m]!;
    const d = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
    seg.push(d);
    length += d;
  }
  const count = Math.round(length);
  const ds = length / count;
  const raw: P[] = [];
  let i = 0;
  let acc = 0;
  for (let k = 0; k < count; k++) {
    const target = k * ds;
    while (acc + seg[i]! < target && i < m - 1) {
      acc += seg[i]!;
      i++;
    }
    const a = dense[i]!;
    const b = dense[(i + 1) % m]!;
    const u = seg[i]! > 0 ? (target - acc) / seg[i]! : 0;
    raw.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  // start the lap at the finish line
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < count; k++) {
    const d = (raw[k]![0] - startNear[0]) * (raw[k]![0] - startNear[0]) + (raw[k]![1] - startNear[1]) * (raw[k]![1] - startNear[1]);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  const samples: Sample[] = [];
  for (let k = 0; k < count; k++) {
    const p = raw[(best + k) % count]!;
    const q = raw[(best + k + 1) % count]!;
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    samples.push({ x: p[0], z: p[1], tx: dx / d, tz: dz / d, hw: widths(p[0], p[1]), k: 0 });
  }
  for (let k = 0; k < count; k++) {
    const a = samples[k]!;
    const b = samples[(k + 1) % count]!;
    a.k = (a.tx * b.tz - a.tz * b.tx) / ds;
  }
  return { samples, length, ds };
}

function buildBackyard(): Track {
  // South straight heads east; a hose-banked hairpin; a brick chicane; a long bend round the
  // flowerbed (the plank cuts straight across it); a sweeper round the big pot.
  const pts: P[] = [
    [-45, 30], [-15, 30], [15, 30], [45, 30],
    [55.6, 25.6], [60, 15], [55.6, 4.4], [45, 0],
    [32, 0], [24, -4.5], [14, 4], [4, 0],
    [-2, -10], [-8, -20], [-16, -22.5], [-24, -20], [-30, -10], [-34, 0],
    [-45, 0], [-55.6, 4.4], [-60, 15], [-55.6, 25.6],
  ];
  const widths = (x: number, z: number): number => {
    // the chicane pinches; the flowerbed bend is generous so a long drift fits
    if (x > 8 && x < 34 && z < 8) return 3.4;
    if (z < -6) return 4.4;
    return 4.0;
  };
  const { samples, length, ds } = buildSamples(pts, [-5, 30], widths);

  const hose = { cx: 45, cz: 15, r: 20.4, a0: -78 * DEG, a1: 78 * DEG };
  const capsules: Capsule[] = [];
  const hoseSteps = 14;
  for (let i = 0; i < hoseSteps; i++) {
    const a = hose.a0 + ((hose.a1 - hose.a0) * i) / hoseSteps;
    const b = hose.a0 + ((hose.a1 - hose.a0) * (i + 1)) / hoseSteps;
    capsules.push({
      x1: hose.cx + dcos(a) * hose.r, z1: hose.cz + dsin(a) * hose.r,
      x2: hose.cx + dcos(b) * hose.r, z2: hose.cz + dsin(b) * hose.r, r: 0.55,
    });
  }
  // bricks on the inside of the two chicane apexes
  const bricks: Capsule[] = [
    { x1: 22.2, z1: 0.4, x2: 25.6, z2: 0.9, r: 0.7 },
    { x1: 12.4, z1: -1.2, x2: 15.8, z2: -0.7, r: 0.7 },
  ];
  capsules.push(...bricks);
  const chairLegs: Circle[] = [
    { x: 9, z: 25.2, r: 0.55 }, { x: 9, z: 34.8, r: 0.55 },
    { x: -24, z: 25.2, r: 0.55 }, { x: -24, z: 34.8, r: 0.55 },
  ];
  const pot: Circle = { x: -45, z: 15, r: 7 };
  // A ladder left lying along the middle of the lawn, from the pot to the hairpin. Without it the
  // whole infield is a shortcut: a straight line across the grass skips either end of the lap.
  // Rails and end rungs are solid; a lost tennis ball plugs the gap at the hairpin end.
  const ladder = { x0: -38, x1: 46, z0: 10.2, z1: 19.8, rail: 0.55 };
  capsules.push(
    { x1: ladder.x0, z1: ladder.z0, x2: ladder.x1, z2: ladder.z0, r: ladder.rail },
    { x1: ladder.x0, z1: ladder.z1, x2: ladder.x1, z2: ladder.z1, r: ladder.rail },
    { x1: ladder.x0 + 1.5, z1: ladder.z0, x2: ladder.x0 + 1.5, z2: ladder.z1, r: 0.4 },
    { x1: ladder.x1 - 1.5, z1: ladder.z0, x2: ladder.x1 - 1.5, z2: ladder.z1, r: 0.4 },
  );
  const ball: Circle = { x: 49.2, z: 15, r: 2.4 };
  const circles: Circle[] = [pot, ball, ...chairLegs];

  const grid = [
    { x: -9.5, z: 28.5, heading: 0 }, { x: -12.2, z: 31.5, heading: 0 },
    { x: -14.9, z: 28.5, heading: 0 }, { x: -17.6, z: 31.5, heading: 0 },
  ];
  return {
    id: 'backyard',
    name: 'Backyard After Dark',
    samples, length, ds, circles, capsules,
    bounds: { x0: -80, x1: 84, z0: -42, z1: 50 },
    grid,
    plank: {
      ax: 3, az: -1, bx: -31, bz: -1, hw: 1.35, rampFrom: 0.9,
      blocker: { x1: 1.2, z1: -2.7, x2: 1.2, z2: 0.7, r: 0.4 },
      prop: { x: 3.6, z: 2.3, r: 0.65 },
      fork: { x0: -33, x1: 16, z0: -6, z1: 6 },
      opener: { x0: 2, x1: 20, z0: -5, z1: 8 },
    },
    // from stand-in drivers (dev/humanish.ts), not people: a steady first-timer lands near
    // bronze, drifting well reaches silver, and gold needs the plank
    medals: { gold: 55, silver: 58.5, bronze: 63 },
    lobby: {
      // the two chosen drivers nose-out by the finish line; the other two wait further back
      spots: [{ x: -7.4, z: 28.4, heading: 0.5 }, { x: -9.2, z: 31.9, heading: 0.25 }, { x: -16, z: 27.6, heading: 0 }, { x: -18.5, z: 31.6, heading: 0 }],
      camera: { x: -0.9, y: 2.15, z: 36.3 },
      look: { x: -8.3, y: 0.95, z: 30.2 },
    },
    bed: { x: -14.5, z: -7, rx: 16.5, rz: 9.6 },
    dressing: { hose, pot, ball, ladder, chairLegs, bricks, workLight: { x: 70, z: 15 } },
  };
}

// ───────────────────────────── the track registry ─────────────────────────────
// A track is data: a centre line, solid things, one gated shortcut, medal times and a place to
// park in the menu. Adding one means writing a builder like buildBackyard, a world kit to draw
// it (src/worlds), and one line here. Nothing else in the game names a track.
const BUILDERS: Record<string, () => Track> = {
  backyard: buildBackyard,
};
const built = new Map<string, Track>();

export const DEFAULT_TRACK = 'backyard';
export const TRACK_IDS: readonly string[] = Object.keys(BUILDERS);

/** The track with this id; an unknown id gives the default track, never an exception. */
export function trackById(id: string): Track {
  const key = Object.prototype.hasOwnProperty.call(BUILDERS, id) ? id : DEFAULT_TRACK;
  let t = built.get(key);
  if (!t) {
    t = BUILDERS[key]!();
    built.set(key, t);
  }
  return t;
}

export function backyard(): Track {
  return trackById('backyard');
}

/** Squared distance from a point to a segment, with the closest point's parameter. */
export function segDist2(px: number, pz: number, x1: number, z1: number, x2: number, z2: number, out: { t: number; cx: number; cz: number }): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  out.t = t;
  out.cx = x1 + dx * t;
  out.cz = z1 + dz * t;
  const ex = px - out.cx;
  const ez = pz - out.cz;
  return ex * ex + ez * ez;
}

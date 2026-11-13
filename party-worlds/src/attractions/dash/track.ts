/**
 * Backyard Dash — tuning and the circuits: "Backyard After Dark" and "The Grease Pit".
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

/** What the yard-kit needs to draw the backyard: anchors only, the sim never reads them. */
export interface BackyardDressing {
  hose: { cx: number; cz: number; r: number; a0: number; a1: number };
  pot: Circle;
  ball: Circle;
  /** the ladder on the lawn: outer rails at z0 and z1, from x0 to x1 */
  ladder: { x0: number; x1: number; z0: number; z1: number; rail: number };
  chairLegs: Circle[];
  bricks: Capsule[];
  workLight: { x: number; z: number };
}

/** The same for the garage floor. */
export interface PitDressing {
  /** heavy chain round the outside of each hairpin (solid): centre, radius, from angle to angle */
  chains: { cx: number; cz: number; r: number; a0: number; a1: number }[];
  /** paint tins stood in the road */
  tins: Circle[];
  /** the stack of tyres inside the east hairpin, the oil drum inside the west one */
  tyres: Circle;
  drum: Circle;
  /** a jerry can inside the east loop */
  can: Circle;
  /** the fallen strip light that fences the infield (solid, and lit) */
  tube: Capsule;
  /** the two concrete blocks of the gate */
  blocks: Capsule[];
  /** where the track crosses itself */
  crossing: { x: number; z: number; half: number };
}

export interface Track {
  id: string;
  name: string;
  /** what this place calls its things, for the words on screen */
  words: {
    /** a few words for the track picker, and a sentence or two for the list of tracks */
    tag: string;
    blurb: string;
    /** "Three laps of …" */
    place: string;
    /** the gated shortcut and the thing that holds it shut */
    shortcut: string;
    prop: string;
  };
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
  /** the same for an armed race, where being shot at and wrecked costs time */
  combatMedals: { gold: number; silver: number; bronze: number };
  /** where the menu parks the drivers, and where it looks at them from */
  lobby: {
    spots: { x: number; z: number; heading: number }[];
    camera: { x: number; y: number; z: number };
    look: { x: number; y: number; z: number };
  };
  /**
   * Solid things standing in the road itself (they are in `circles` too). Rivals steer round
   * them; anything big enough is cover from guns and rockets (COMBAT.coverRadius).
   */
  pillars?: Circle[];
  /**
   * What the combat layer needs from a circuit (see combat.ts). Without it a combat race here
   * still has guns and ramming, but nothing to pick up and no repairs.
   */
  combat?: {
    /** crates, on the road but off the usual line; each always holds the same thing */
    crates: { x: number; z: number; item: 'mine' | 'rocket' | 'shock' | 'shield' | 'overdrive' }[];
    /** drive through for armour: put it on the long way round, so the shortcut costs something */
    repair: Zone;
    /** arena dressing for an armed race, all of it where no kart can go: fires in tin cans (or, raised and bigger, in something taller)… */
    fires?: { x: number; z: number; y?: number; size?: number }[];
    /** …and chevron boards, each facing the point (fx, fz) */
    boards?: { x: number; z: number; fx: number; fz: number }[];
  };
  /** the slow patch the shortcut crosses (ellipse): a flowerbed, an oil spill */
  bed: { x: number; z: number; rx: number; rz: number };
  /** set dressing anchors for this track's world kit (the sim only uses circles/capsules) */
  dressing: object;
}
export type BackyardTrack = Track & { dressing: BackyardDressing };
export type PitTrack = Track & { dressing: PitDressing };

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

function buildBackyard(): BackyardTrack {
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

  // Crates sit to one side of the usual line, each where its contents make sense: rockets at
  // the start of the long home straight (a sight-line), mines before the chicane (somewhere to
  // leave them), the shield on the long way round the flowerbed (one more reason not to take the
  // plank), the overdrive on the run down to the sweeper, the shockwave where the pack bunches
  // round the pot.
  const beside = <T extends string>(index: number, lane: number, item: T): { x: number; z: number; item: T } => {
    const p = samples[index % samples.length]!;
    return { x: p.x - p.tz * lane, z: p.z + p.tx * lane, item };
  };
  const crates = [
    beside(30, 2.2, 'rocket' as const), beside(100, -2.2, 'mine' as const), beside(164, 2.4, 'shield' as const),
    beside(212, -2.1, 'overdrive' as const), beside(244, 2.2, 'shock' as const),
  ];

  // Arena dressing for an armed race: fires in tin cans down the middle of the ladder (seen from
  // both straights, reached from neither) and behind the hairpin's wall, with chevron boards
  // between them.
  const fires: { x: number; z: number }[] = [];
  const boards: { x: number; z: number; fx: number; fz: number }[] = [];
  const midZ = (ladder.z0 + ladder.z1) / 2;
  for (let n = 0; n < 4; n++) fires.push({ x: ladder.x0 + 9 + ((ladder.x1 - ladder.x0 - 18) * n) / 3, z: midZ + (n % 2 ? 1.6 : -1.6) });
  for (let n = 0; n <= 6; n++) {
    const a = hose.a0 + ((hose.a1 - hose.a0) * (n + 0.5)) / 7;
    const r = hose.r + 2.6;
    if (n % 3 === 1) fires.push({ x: hose.cx + dcos(a) * (r + 1.6), z: hose.cz + dsin(a) * (r + 1.6) });
    else boards.push({ x: hose.cx + dcos(a) * r, z: hose.cz + dsin(a) * r, fx: hose.cx, fz: hose.cz });
  }

  const grid = [
    { x: -9.5, z: 28.5, heading: 0 }, { x: -12.2, z: 31.5, heading: 0 },
    { x: -14.9, z: 28.5, heading: 0 }, { x: -17.6, z: 31.5, heading: 0 },
  ];
  return {
    id: 'backyard',
    name: 'Backyard After Dark',
    words: {
      tag: 'A patio at night. Tight, quick, close.',
      blurb: 'A patio at night: a hose-banked hairpin, a brick chicane, a plank across the flowerbed. Tight, quick, close.',
      place: 'the patio after dark',
      shortcut: 'plank',
      prop: 'peg',
    },
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
    // armed, the same stand-in drivers take about four seconds longer (dev/combatprobe.ts)
    combatMedals: { gold: 59, silver: 63, bronze: 68 },
    lobby: {
      // the two chosen drivers nose-out by the finish line; the other two wait further back
      spots: [{ x: -7.4, z: 28.4, heading: 0.5 }, { x: -9.2, z: 31.9, heading: 0.25 }, { x: -16, z: 27.6, heading: 0 }, { x: -18.5, z: 31.6, heading: 0 }],
      camera: { x: -0.9, y: 2.15, z: 36.3 },
      look: { x: -8.3, y: 0.95, z: 30.2 },
    },
    // the repair strip is at the far side of the flowerbed bend: the plank skips it
    combat: { crates, repair: { x0: -20, x1: -9, z0: -28, z1: -17 }, fires, boards },
    bed: { x: -14.5, z: -7, rx: 16.5, rz: 9.6 },
    dressing: { hose, pot, ball, ladder, chairLegs, bricks, workLight: { x: 70, z: 15 } },
  };
}

/** Control points along an arc, from one angle (degrees) up to but not including the other. */
function arcPts(cx: number, cz: number, r: number, fromDeg: number, toDeg: number, steps: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (fromDeg + ((toDeg - fromDeg) * i) / steps) * DEG;
    out.push([cx + dcos(a) * r, cz + dsin(a) * r]);
  }
  return out;
}

/**
 * The Grease Pit: a figure of eight on a garage floor, laid out for a fight.
 *
 * A long, wide straight (the firing line) with paint tins stood in it for cover; a hairpin round
 * a stack of tyres; a gate between two concrete blocks, one kart wide, with the mines handed out
 * just before it; then the back leg crosses the firing line at right angles, so whoever is
 * coming down the straight is in somebody's sights. The long way round the oil spill has the
 * repair strip; the board across the spill skips it.
 */
function buildPit(): PitTrack {
  const pts: P[] = [
    // the firing line, heading east along z = 6
    [-52, 6], [-36, 6], [-20, 6], [-4, 6], [12, 6], [28, 6],
    // east hairpin (right-hand) round the tyres
    ...arcPts(46, 20.5, 14.5, -90, 90, 4),
    // south straight, through the gate, heading west
    [46, 35], [38, 35],
    // right, to head north
    ...arcPts(30, 22, 13, 90, 180, 2),
    // the back leg: north across the firing line at (17, 6)
    [17, 22], [17, 8], [17, -4],
    // left, to head west
    ...arcPts(4, -14, 13, 0, -90, 2),
    [4, -27], [-5, -27],
    // the long way round the oil spill (the board cuts straight across it)
    [-11, -37], [-17, -47], [-25, -49.5], [-33, -47], [-39, -37], [-43, -27],
    // west hairpin (left-hand) round the drum, back onto the firing line
    ...arcPts(-52, -10.5, 16.5, -90, -270, 4),
  ];
  const gate = { x0: 35.5, x1: 40.5, z: 35, hw: 2.9 };
  const widths = (x: number, z: number): number => {
    if (z > 28 && x < 46) {
      // the gate pinches the south straight to one kart and a bit; the road eases in and out of it
      const mid = (gate.x0 + gate.x1) / 2;
      const d = Math.abs(x - mid);
      const t = d < 2.5 ? 0 : d > 7.5 ? 1 : (d - 2.5) / 5;
      return gate.hw + (4.6 - gate.hw) * t;
    }
    if (z < -29) return 4.4; // round the spill, room for a long slide
    if (z < -20) return 4.2;
    if (x > 46 || x < -52) return 5; // the hairpins
    if (z > 0 && z < 12) return 5.5; // the firing line (and the crossing)
    return 4.4;
  };
  const { samples, length, ds } = buildSamples(pts, [-10, 6], widths);
  // (the widths above change in steps: ease them, so the road has no notches in its edges)
  for (let pass = 0; pass < 2; pass++) {
    const was = samples.map((p) => p.hw);
    const n = samples.length;
    for (let i = 0; i < n; i++) samples[i]!.hw = (was[(i + n - 2) % n]! + was[(i + n - 1) % n]! + was[i]! + was[(i + 1) % n]! + was[(i + 2) % n]!) / 5;
  }

  const capsules: Capsule[] = [];
  // a heavy chain round the outside of each hairpin
  const chains = [
    { cx: 46, cz: 20.5, r: 14.5 + 5 + 0.75, a0: -80 * DEG, a1: 80 * DEG },
    { cx: -52, cz: -10.5, r: 16.5 + 5 + 0.75, a0: 100 * DEG, a1: 260 * DEG },
  ];
  for (const c of chains) {
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const a = c.a0 + ((c.a1 - c.a0) * i) / steps;
      const b = c.a0 + ((c.a1 - c.a0) * (i + 1)) / steps;
      capsules.push({ x1: c.cx + dcos(a) * c.r, z1: c.cz + dsin(a) * c.r, x2: c.cx + dcos(b) * c.r, z2: c.cz + dsin(b) * c.r, r: 0.55 });
    }
  }
  // the gate: two concrete blocks, either side of the south straight
  const off = gate.hw + 1.9;
  const blocks: Capsule[] = [
    { x1: gate.x0 + 0.6, z1: gate.z - off, x2: gate.x1 - 0.6, z2: gate.z - off, r: 1.9 },
    { x1: gate.x0 + 0.6, z1: gate.z + off, x2: gate.x1 - 0.6, z2: gate.z + off, r: 1.9 },
  ];
  capsules.push(...blocks);
  // A strip light that came off its chains lies along the infield. Without it a straight line
  // across the sawdust from the top straight to the firing line skips the west hairpin.
  const tube: Capsule = { x1: -43.5, z1: -11, x2: 10.7, z2: -11, r: 1.1 };
  capsules.push(tube);

  // paint tins stood in the firing line: cover from guns and rockets, and something to hit
  // (each stands to one side: the middle of the road is clear, the gap behind a tin is not a way through)
  const tins: Circle[] = [{ x: -31, z: 2.9, r: 1.7 }, { x: 1, z: 9.2, r: 1.7 }, { x: 35, z: 2.9, r: 1.7 }];
  const tyres: Circle = { x: 45.5, z: 20.5, r: 6.8 };
  // (the can plugs the gap between the tyres and the gate's inside block: the gate is the only way through)
  const can: Circle = { x: 41.5, z: 27.5, r: 2.6 };
  // (big enough that the sawdust inside the hairpin is a tighter line, not a way to skip the corner)
  const drum: Circle = { x: -52, z: -10.5, r: 7.2 };
  const circles: Circle[] = [...tins, tyres, can, drum];

  const beside = <T extends string>(index: number, lane: number, item: T): { x: number; z: number; item: T } => {
    const p = samples[((index % samples.length) + samples.length) % samples.length]!;
    return { x: p.x - p.tz * lane, z: p.z + p.tx * lane, item };
  };
  /** the sample nearest a point (for placing things by where they are, not by counting) */
  const at = (x: number, z: number): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i]!;
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };
  // Seven crates, each where its contents are worth having: rockets at the head of the firing
  // line and again before the crossing, an overdrive to carry through the junction, the
  // shockwave in the hairpin where the pack bunches, mines before the gate and before the fork,
  // the shield on the long way round.
  const crates = [
    beside(at(-40, 6), 2.6, 'rocket' as const),
    beside(at(10, 6), -2.8, 'overdrive' as const),
    beside(at(60.5, 20.5), 2.2, 'shock' as const),
    beside(at(46, 35), -2.2, 'mine' as const),
    beside(at(17, 19), 2.0, 'rocket' as const),
    beside(at(10, -25), 2.0, 'mine' as const),
    beside(at(-14, -43), 2.2, 'shield' as const),
  ];

  // the oil drum inside the west hairpin is alight; behind each chain, fires in tin cans with
  // chevron boards between them
  const fires: { x: number; z: number; y?: number; size?: number }[] = [{ x: drum.x, z: drum.z, y: 1.5, size: 4.2 }];
  const boards: { x: number; z: number; fx: number; fz: number }[] = [];
  for (const c of chains) {
    for (let n = 0; n <= 6; n++) {
      const a = c.a0 + ((c.a1 - c.a0) * (n + 0.5)) / 7;
      const r = c.r + 2.6;
      if (n % 3 === 1) fires.push({ x: c.cx + dcos(a) * (r + 1.6), z: c.cz + dsin(a) * (r + 1.6) });
      else boards.push({ x: c.cx + dcos(a) * r, z: c.cz + dsin(a) * r, fx: c.cx, fz: c.cz });
    }
  }

  const grid = [
    { x: -14.5, z: 4.4, heading: 0 }, { x: -17.2, z: 7.6, heading: 0 },
    { x: -19.9, z: 4.4, heading: 0 }, { x: -22.6, z: 7.6, heading: 0 },
  ];
  return {
    id: 'pit',
    name: 'The Grease Pit',
    words: {
      tag: 'A garage floor, a figure of eight. Built for a fight.',
      blurb: 'A garage floor, a figure of eight: a long firing line with tins for cover, a one-kart gate, and a crossing where the track meets itself. Built for a fight.',
      place: 'the garage floor',
      shortcut: 'board',
      prop: 'chock',
    },
    samples, length, ds, circles, capsules,
    bounds: { x0: -84, x1: 78, z0: -64, z1: 50 },
    grid,
    pillars: tins,
    plank: {
      ax: -6, az: -28, bx: -40, bz: -28, hw: 1.35, rampFrom: 0.9,
      blocker: { x1: -7.8, z1: -29.7, x2: -7.8, z2: -26.3, r: 0.4 },
      prop: { x: -5.4, z: -24.7, r: 0.65 },
      fork: { x0: -42, x1: 7, z0: -33, z1: -21 },
      opener: { x0: -7, x1: 11, z0: -32, z1: -19 },
    },
    // from the same stand-in drivers as the backyard's (TRACK=pit dev/humanish.ts), not people:
    // a steady first-timer lands near bronze, drifting well reaches silver, gold needs the board
    medals: { gold: 67.5, silver: 71.5, bronze: 75 },
    // armed, the stand-in takes four to five seconds longer here too (TRACK=pit dev/combatprobe.ts)
    combatMedals: { gold: 71.5, silver: 76, bronze: 80 },
    lobby: {
      spots: [{ x: -12.4, z: 4.4, heading: 0.5 }, { x: -14.2, z: 7.9, heading: 0.25 }, { x: -21, z: 3.6, heading: 0 }, { x: -23.5, z: 7.6, heading: 0 }],
      camera: { x: -5.9, y: 2.15, z: 12.3 },
      look: { x: -13.3, y: 0.95, z: 6.2 },
    },
    // the repair strip is at the far side of the spill: the board skips it
    combat: { crates, repair: { x0: -31, x1: -19, z0: -56, z1: -44 }, fires, boards },
    bed: { x: -23.5, z: -34, rx: 16.5, rz: 9.6 },
    dressing: { chains, tins, tyres, drum, can, tube, blocks, crossing: { x: 17, z: 6, half: 5.5 } },
  };
}

// ───────────────────────────── the track registry ─────────────────────────────
// A track is data: a centre line, solid things, one gated shortcut, medal times and a place to
// park in the menu. Adding one means writing a builder like buildBackyard, a world kit to draw
// it (src/worlds), and one line here. Nothing else in the game names a track.
const BUILDERS: Record<string, () => Track> = {
  backyard: buildBackyard,
  pit: buildPit,
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

export function backyard(): BackyardTrack {
  return trackById('backyard') as BackyardTrack;
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

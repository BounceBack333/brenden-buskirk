import { describe, expect, it } from 'vitest';
import { createRace, noDrive, stepRace, trackOf } from '../src/attractions/dash/sim';
import type { DriveInput, RaceState } from '../src/attractions/dash/sim';
import { COMBAT, gunTarget } from '../src/attractions/dash/combat';
import { Rival } from '../src/attractions/dash/bot';
import { KART, RACE, trackById } from '../src/attractions/dash/track';
import type { PitDressing, PitTrack } from '../src/attractions/dash/track';

/**
 * The Grease Pit: the things that are true of this circuit and no other. It is a figure of
 * eight, so the track crosses itself; it has solid things stood in the road; and its infield is
 * fenced by a fallen strip light rather than a ladder.
 */
const pit = trackById('pit') as PitTrack;
const d: PitDressing = pit.dressing;
const S = pit.samples;
const N = S.length;

/** the sample nearest a point, and how far away it is */
function nearest(x: number, z: number, from = 0, to = N): { i: number; d: number } {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < to; i++) {
    const p = S[i]!;
    const dd = Math.hypot(p.x - x, p.z - z);
    if (dd < bestD) { bestD = dd; best = i; }
  }
  return { i: best, d: bestD };
}

/** a race already under way, with one kart placed by hand */
function placed(x: number, z: number, heading: number, idx: number, combat = false): RaceState {
  const s = createRace({ track: 'pit', karts: 2, combat });
  s.phase = 'racing';
  s.phaseTick = COMBAT.safeTicks + 1;
  s.tick = RACE.countdownTicks + COMBAT.safeTicks + 1;
  const k = s.karts[0]!;
  k.x = x; k.z = z; k.heading = heading; k.idx = idx; k.lap = 1; k.prevDrift = false;
  // (the other kart waits out of the way, far up the lap)
  const o = s.karts[1]!;
  const far = S[Math.floor(N * 0.6)]!;
  o.x = far.x; o.z = far.z; o.idx = Math.floor(N * 0.6); o.lap = 1;
  return s;
}
const drive = (over: Partial<DriveInput> = {}): DriveInput[] => [{ ...noDrive(), ...over }, { ...noDrive(), brake: true }];

describe('the crossing', () => {
  // where the firing line and the back leg meet, as each of them counts it
  const onLine = nearest(d.crossing.x, d.crossing.z, 0, Math.floor(N / 3));
  const onLeg = nearest(d.crossing.x, d.crossing.z, Math.floor(N / 3), Math.floor((2 * N) / 3));

  it('is one place on the floor and two places on the lap, a long way apart', () => {
    expect(onLine.d).toBeLessThan(1);
    expect(onLeg.d).toBeLessThan(1);
    // further apart round the lap than a kart's place on it is ever searched for, in both directions
    expect(onLeg.i - onLine.i).toBeGreaterThan(80);
    expect(onLine.i + N - onLeg.i).toBeGreaterThan(80);
    // and the two roads meet square
    const a = S[onLine.i]!;
    const b = S[onLeg.i]!;
    expect(Math.abs(a.tx * b.tx + a.tz * b.tz)).toBeLessThan(0.1);
  });

  it('driving straight through it on the firing line stays on the firing line', () => {
    const start = S[onLine.i - 12]!;
    const s = placed(start.x, start.z, 0, onLine.i - 12);
    for (let t = 0; t < 150; t++) stepRace(s, drive());
    const k = s.karts[0]!;
    expect(k.x).toBeGreaterThan(d.crossing.x + 6);
    expect(k.idx).toBeGreaterThan(onLine.i);
    expect(k.idx).toBeLessThan(onLine.i + 60);
    expect(k.surface).toBe(0); // road all the way
  });

  it('and straight through it on the back leg stays on the back leg', () => {
    const start = S[onLeg.i - 10]!;
    const s = placed(start.x, start.z, -Math.PI / 2, onLeg.i - 10);
    for (let t = 0; t < 120; t++) stepRace(s, drive());
    const k = s.karts[0]!;
    expect(k.z).toBeLessThan(d.crossing.z - 6);
    expect(k.idx).toBeGreaterThan(onLeg.i);
    expect(k.idx).toBeLessThan(onLeg.i + 60);
  });

  it('turning onto the other road there skips nothing: the lap goes no further until the kart is put back', () => {
    // coming down the firing line, turn left up the back leg: that would skip the whole east loop
    const start = S[onLine.i - 3]!;
    const s = placed(start.x, start.z, -Math.PI / 2, onLine.i - 3);
    let reset = false;
    let furthest = 0;
    for (let t = 0; t < 60 * 9; t++) {
      stepRace(s, drive());
      const k = s.karts[0]!;
      furthest = Math.max(furthest, k.idx);
      if (s.events.some((e) => e.type === 'reset' && e.seat === 0)) { reset = true; break; }
    }
    const k = s.karts[0]!;
    expect(furthest).toBeLessThan(onLine.i + 20); // never credited with the back leg
    expect(k.lap).toBe(1);
    expect(reset).toBe(true); // and in the end it is stood back on the road it left
    expect(Math.hypot(k.x - S[k.idx]!.x, k.z - S[k.idx]!.z)).toBeLessThan(0.01);
  });
});

describe('the furniture', () => {
  it('the tins stand in the road, to one side, with the middle clear', () => {
    expect(pit.pillars).toBe(d.tins);
    for (const t of d.tins) {
      expect(pit.circles).toContain(t);
      const n = nearest(t.x, t.z);
      const hw = S[n.i]!.hw;
      expect(n.d + t.r).toBeLessThan(hw); // wholly on the road
      expect(n.d - t.r).toBeGreaterThan(KART.radius + 0.5); // a kart on the centre line passes
      expect(hw - (n.d + t.r)).toBeLessThan(KART.radius * 2); // and nothing squeezes round the back
      expect(t.r).toBeGreaterThanOrEqual(COMBAT.coverRadius); // big enough to hide behind
    }
  });

  it('a tin is cover: no shot through it, a clear shot beside it', () => {
    const t = d.tins[0]!;
    const hidden = placed(t.x - 9, t.z, 0, nearest(t.x - 9, t.z).i, true);
    hidden.karts[1]!.x = t.x + 6; hidden.karts[1]!.z = t.z;
    expect(gunTarget(hidden, trackOf(hidden), 0)).toBe(-1);
    const open = placed(t.x - 9, t.z + 4, 0, nearest(t.x - 9, t.z + 4).i, true);
    open.karts[1]!.x = t.x + 6; open.karts[1]!.z = t.z + 4;
    expect(gunTarget(open, trackOf(open), 0)).toBe(1);
  });

  it('the gate is one kart and a bit wide, and the blocks stand clear of the road', () => {
    let narrow = Infinity;
    for (const p of S) narrow = Math.min(narrow, p.hw);
    expect(narrow).toBeGreaterThan(KART.radius * 3); // room to get through without scraping
    expect(narrow).toBeLessThan(KART.radius * 6); // but not two abreast in comfort
    for (const b of d.blocks) {
      const mid = nearest((b.x1 + b.x2) / 2, b.z1);
      expect(mid.d - b.r).toBeGreaterThan(S[mid.i]!.hw - 0.3);
    }
  });

  it('the strip light and the drum fence the infield: no gap a kart fits through', () => {
    // the west end of the light against the drum
    expect(d.tube.x1 - d.tube.r - (d.drum.x + d.drum.r)).toBeLessThan(KART.radius * 2);
    // the east end against the back leg's road
    const leg = nearest(d.tube.x2, d.tube.z2, Math.floor(N / 3), Math.floor((2 * N) / 3));
    expect(leg.d - d.tube.r - S[leg.i]!.hw).toBeLessThan(KART.radius * 2);
    // the gate cannot be driven round on the inside: its block, the can and the tyres leave no gap either
    const inner = d.blocks[0]!;
    expect(Math.hypot(inner.x2 - d.can.x, inner.z2 - d.can.z) - inner.r - d.can.r).toBeLessThan(KART.radius * 2);
    expect(Math.hypot(d.tyres.x - d.can.x, d.tyres.z - d.can.z) - d.tyres.r - d.can.r).toBeLessThan(KART.radius * 2);
    // and a kart driven at it across the sawdust stops there
    const s = placed(-20, d.tube.z1 - 8, Math.PI / 2, nearest(-20, -27).i);
    for (let t = 0; t < 240; t++) stepRace(s, drive());
    expect(s.karts[0]!.z).toBeLessThan(d.tube.z1);
  });

  it('nothing solid stands on the grid, the line or the crossing', () => {
    const clear = [...pit.grid.map((g) => [g.x, g.z] as const), [S[0]!.x, S[0]!.z] as const, [d.crossing.x, d.crossing.z] as const];
    for (const [x, z] of clear) {
      for (const c of pit.circles) expect(Math.hypot(c.x - x, c.z - z)).toBeGreaterThan(c.r + KART.radius + 2);
    }
    for (const c of pit.circles) expect(Math.abs(c.x - d.crossing.x) > d.crossing.half + c.r || Math.abs(c.z - d.crossing.z) > d.crossing.half + c.r).toBe(true);
  });
});

describe('rivals on the pit', () => {
  it('go round the tins and through the gate without making a habit of hitting them', () => {
    let bumps = 0;
    let resets = 0;
    const races = 4;
    for (let r = 0; r < races; r++) {
      const s = createRace({ track: 'pit', karts: 4, laps: 2 });
      const bots = [0.9, 0.7, 0.5, 0.3].map((skill, i) => new Rival({ seed: 40 + r * 11 + i, skill }));
      for (let t = 0; t < 60 * 120 && s.phase !== 'over'; t++) {
        stepRace(s, bots.map((b, i) => ({ ...b.think(s, i) })));
        for (const e of s.events) {
          if (e.type === 'bump') bumps++;
          else if (e.type === 'reset') resets++;
        }
      }
      expect(s.phase).toBe('over');
      expect(s.karts.every((k) => k.finished)).toBe(true);
    }
    expect(resets).toBe(0);
    expect(bumps / races).toBeLessThan(6); // (four karts, two laps: the odd scrape, not a pile-up)
  });
});

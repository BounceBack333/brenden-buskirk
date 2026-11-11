import { describe, expect, it } from 'vitest';
import { SURFACE, cloneRace, createRace, forwardSpeed, hashRace, headingOf, noDrive, stepRace, trackOf } from '../src/attractions/dash/sim';
import type { DriveInput, RaceEvent, RaceState } from '../src/attractions/dash/sim';
import { Rival } from '../src/attractions/dash/bot';
import { KART, RACE } from '../src/attractions/dash/track';
import { RIVAL_LEVELS, rivalLevel } from '../src/attractions/dash/rivals';
import { Rng } from '../src/core/dmath';

const idle = (n: number): DriveInput[] => Array.from({ length: n }, noDrive);

function run(s: RaceState, ticks: number, make: (t: number) => DriveInput[] = () => idle(s.karts.length)): RaceEvent[] {
  const ev: RaceEvent[] = [];
  for (let t = 0; t < ticks && s.phase !== 'over'; t++) {
    stepRace(s, make(t));
    ev.push(...s.events);
  }
  return ev;
}
const go = (s: RaceState): RaceEvent[] => run(s, RACE.countdownTicks);

function botRace(seed: number, laps = 3): { s: RaceState; events: RaceEvent[] } {
  const s = createRace({ karts: 4, laps });
  const bots = [0.95, 0.75, 0.55, 0.35].map((skill, i) => new Rival({ seed: seed + i, skill }));
  const events: RaceEvent[] = [];
  for (let t = 0; t < 60 * 240 && s.phase !== 'over'; t++) {
    stepRace(s, bots.map((b, i) => ({ ...b.think(s, i) })));
    events.push(...s.events);
  }
  return { s, events };
}

describe('the circuit', () => {
  it('is a closed loop of evenly spaced samples about 300 units round', () => {
    const t = trackOf(createRace());
    expect(t.samples.length).toBeGreaterThan(280);
    expect(t.samples.length).toBeLessThan(330);
    expect(Math.abs(t.ds - 1)).toBeLessThan(0.02);
    const a = t.samples[t.samples.length - 1]!;
    const b = t.samples[0]!;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1.1);
    // sample 0 is the finish line on the south straight, heading east
    expect(b.tx).toBeGreaterThan(0.99);
    expect(Math.abs(b.z - 30)).toBeLessThan(0.2);
  });
  it('headingOf matches atan2', () => {
    for (let a = 0.05; a < 6.2; a += 0.173) {
      expect(Math.abs(headingOf(Math.cos(a), Math.sin(a)) - a)).toBeLessThan(2e-4);
    }
  });
});

describe('starting', () => {
  it('nobody moves before GO', () => {
    const s = createRace({ karts: 2 });
    const x0 = s.karts[0]!.x;
    run(s, RACE.countdownTicks - 1, () => [{ steer: 127, drift: false, brake: false }, noDrive()]);
    expect(s.phase).toBe('countdown');
    expect(s.karts[0]!.x).toBe(x0);
  });
  it('a well-timed press earns a start boost; holding too early stalls', () => {
    const s = createRace({ karts: 3 });
    const ev = run(s, RACE.countdownTicks, (t) => [
      { steer: 0, drift: t >= RACE.countdownTicks - 12, brake: false }, // well timed
      { steer: 0, drift: t >= 30, brake: false }, // far too early
      noDrive(),
    ]);
    expect(ev.some((e) => e.type === 'go')).toBe(true);
    expect(ev.some((e) => e.type === 'start_boost' && e.seat === 0)).toBe(true);
    expect(ev.some((e) => e.type === 'stall' && e.seat === 1)).toBe(true);
    run(s, 50);
    expect(s.karts[0]!.x).toBeGreaterThan(s.karts[2]!.x + 2.6 + 1); // grid stagger is 2.7 apart per row
    expect(forwardSpeed(s.karts[1]!)).toBeLessThan(forwardSpeed(s.karts[2]!));
  });
});

describe('handling', () => {
  it('accelerates by itself to top speed and no further', () => {
    const s = createRace({ karts: 1 });
    go(s);
    run(s, 240);
    const v = forwardSpeed(s.karts[0]!);
    expect(v).toBeGreaterThan(KART.vMax * 0.97);
    expect(v).toBeLessThanOrEqual(KART.vMax + 1e-6);
  });
  it('positive steer turns right (heading increases)', () => {
    const s = createRace({ karts: 1 });
    go(s);
    run(s, 60);
    const h0 = s.karts[0]!.heading;
    run(s, 20, () => [{ steer: 127, drift: false, brake: false }]);
    expect(s.karts[0]!.heading).toBeGreaterThan(h0 + 0.2);
  });
  it('a drift keeps its speed, charges, and pays out a boost on release', () => {
    const s = createRace({ karts: 1 });
    go(s);
    // drive down the straight to the hairpin, then slide round it
    for (let t = 0; t < 600 && s.karts[0]!.x < 45.5; t++) stepRace(s, idle(1));
    const before = forwardSpeed(s.karts[0]!);
    const ev = run(s, 110, () => [{ steer: -40, drift: true, brake: false }]);
    expect(ev.some((e) => e.type === 'drift_start')).toBe(true);
    expect(s.karts[0]!.drifting).toBe(true);
    expect(ev.some((e) => e.type === 'charge' && e.level === 1)).toBe(true);
    const speed = Math.hypot(s.karts[0]!.vx, s.karts[0]!.vz);
    expect(speed).toBeGreaterThan(before * 0.85);
    const ev2 = run(s, 2);
    expect(ev2.some((e) => e.type === 'boost')).toBe(true);
    expect(s.karts[0]!.boostTicks).toBeGreaterThan(0);
  });
  it('letting go early gives nothing', () => {
    const s = createRace({ karts: 1 });
    go(s);
    run(s, 200);
    run(s, 20, () => [{ steer: -60, drift: true, brake: false }]);
    const ev = run(s, 3);
    expect(ev.some((e) => e.type === 'boost')).toBe(false);
  });
  it('grass is slow, and a boost shrugs most of it off', () => {
    const s = createRace({ karts: 1 });
    go(s);
    const k = s.karts[0]!;
    k.x = 0; k.z = 14; k.vx = 0; k.vz = 0; k.heading = 0; k.idx = 5; // the infield lawn
    run(s, 240);
    expect(k.surface).toBe(SURFACE.grass);
    const slow = forwardSpeed(k);
    expect(slow).toBeLessThan(KART.vMax * 0.62);
    k.x = 0; k.z = 14; k.boostTicks = 80;
    run(s, 70);
    expect(forwardSpeed(k)).toBeGreaterThan(slow * 1.5);
  });
  it('braking stops the kart and then backs it up slowly', () => {
    const s = createRace({ karts: 1 });
    go(s);
    run(s, 120);
    run(s, 260, () => [{ steer: 0, drift: false, brake: true }]);
    const v = forwardSpeed(s.karts[0]!);
    expect(v).toBeLessThan(0);
    expect(v).toBeGreaterThanOrEqual(KART.vReverse - 1e-6);
  });
});

describe('contact', () => {
  it('karts shove each other apart instead of overlapping', () => {
    const s = createRace({ karts: 2 });
    go(s);
    const [a, b] = s.karts as [typeof s.karts[0], typeof s.karts[0]];
    a.x = 0; a.z = 30; a.vx = 12; a.vz = 0;
    b.x = 2; b.z = 30; b.vx = 0; b.vz = 0;
    const ev = run(s, 10);
    expect(ev.some((e) => e.type === 'kart_bump')).toBe(true);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThanOrEqual(KART.radius * 2 - 0.05);
    expect(b.vx).toBeGreaterThan(3);
  });
  it('nothing drives through the big pot, even flat out', () => {
    const t = trackOf(createRace());
    const pot = t.dressing.pot;
    for (let i = 0; i < 20; i++) {
      const s = createRace({ karts: 1 });
      go(s);
      const k = s.karts[0]!;
      k.x = pot.x - pot.r - 6; k.z = pot.z + (i - 10) * 0.5; k.heading = 0; k.vx = KART.vBoost; k.vz = 0; k.boostTicks = 60;
      run(s, 60);
      expect(Math.hypot(k.x - pot.x, k.z - pot.z)).toBeGreaterThanOrEqual(pot.r + KART.radius - 0.02);
    }
  });
  it('the lost tennis ball in the hairpin infield is solid too', () => {
    const ball = trackOf(createRace()).dressing.ball;
    for (let i = 0; i < 9; i++) {
      const s = createRace({ karts: 1 });
      go(s);
      const k = s.karts[0]!;
      k.x = ball.x - ball.r - 5; k.z = ball.z + (i - 4) * 0.5; k.heading = 0; k.vx = KART.vMax; k.vz = 0;
      run(s, 50);
      expect(Math.hypot(k.x - ball.x, k.z - ball.z)).toBeGreaterThanOrEqual(ball.r + KART.radius - 0.02);
    }
  });
});

describe('rivals', () => {
  it('pace is a throttle: an eased-off kart tops out lower, and the default is full throttle', () => {
    const s = createRace({ karts: 3, pace: [1, 0.9, 0.1] });
    expect(createRace({ karts: 1 }).karts[0]!.pace).toBe(1);
    expect(s.karts[2]!.pace).toBe(0.5); // clamped: a rival is never made absurdly slow
    go(s);
    for (const k of s.karts) k.z = 28.5 + s.karts.indexOf(k) * 3; // side by side, out of each other's tow
    run(s, 200);
    expect(forwardSpeed(s.karts[0]!)).toBeGreaterThan(KART.vMax * 0.97);
    expect(forwardSpeed(s.karts[1]!)).toBeGreaterThan(KART.vMax * 0.9 * 0.97);
    expect(forwardSpeed(s.karts[1]!)).toBeLessThanOrEqual(KART.vMax * 0.9 + 1e-6);
  });
  it('the difficulty ladder is ordered: each level is sharper and quicker than the one below', () => {
    expect(RIVAL_LEVELS.map((l) => l.id)).toEqual(['gentle', 'keen', 'fierce']);
    for (let i = 0; i < RIVAL_LEVELS.length; i++) {
      const l = RIVAL_LEVELS[i]!;
      for (let j = 0; j < 3; j++) {
        expect(l.pace[j]).toBeGreaterThanOrEqual(0.5);
        expect(l.pace[j]).toBeLessThanOrEqual(1);
        if (j > 0) {
          expect(l.skills[j]).toBeLessThan(l.skills[j - 1]!);
          expect(l.pace[j]).toBeLessThanOrEqual(l.pace[j - 1]!);
        }
        if (i > 0) {
          expect(l.skills[j]).toBeGreaterThan(RIVAL_LEVELS[i - 1]!.skills[j]!);
          expect(l.pace[j]).toBeGreaterThan(RIVAL_LEVELS[i - 1]!.pace[j]!);
        }
      }
    }
    expect(rivalLevel(-3).id).toBe('gentle');
    expect(rivalLevel(99).id).toBe('fierce');
    expect(rivalLevel(Number.NaN).id).toBe('gentle');
  });
  it('gentle rivals take clearly longer over a race than fierce ones', () => {
    const winner = (level: number): number => {
      const l = rivalLevel(level);
      const s = createRace({ karts: 3, laps: 2, pace: [...l.pace] });
      const bots = l.skills.map((skill, i) => new Rival({ seed: 40 + i, skill }));
      for (let t = 0; t < 60 * 120 && s.phase !== 'over'; t++) stepRace(s, bots.map((b, i) => ({ ...b.think(s, i) })));
      expect(s.firstFinishTick).toBeGreaterThan(0);
      return s.firstFinishTick;
    };
    const gentle = winner(0);
    const keen = winner(1);
    const fierce = winner(2);
    expect(gentle).toBeGreaterThan(keen);
    expect(keen).toBeGreaterThan(fierce);
    expect(gentle - fierce).toBeGreaterThan(2 * 60); // at least two seconds over two laps
  });
});

describe('the plank remembers', () => {
  it('starts blocked, opens when the prop is bumped, and stays open for everyone', () => {
    const s = createRace({ karts: 2 });
    go(s);
    const t = trackOf(s);
    const k = s.karts[0]!;
    // drive straight at the closed plank: the raised end stops you
    k.x = 8; k.z = -1; k.heading = Math.PI; k.vx = -10; k.vz = 0; k.idx = 150;
    run(s, 50);
    expect(s.plankOpen).toBe(false);
    expect(k.x).toBeGreaterThan(t.plank.blocker.x1);
    // now bump the prop
    k.x = t.plank.prop.x + 2.5; k.z = t.plank.prop.z; k.heading = Math.PI; k.vx = -8; k.vz = 0;
    const ev = run(s, 30);
    expect(ev.some((e) => e.type === 'plank_open' && e.seat === 0)).toBe(true);
    expect(s.plankOpen).toBe(true);
    expect(s.plankOpener).toBe(0);
    // the other kart can now cross it, at full grip, and jumps off the far end
    const o = s.karts[1]!;
    o.x = 6; o.z = -1; o.heading = Math.PI; o.vx = -14; o.vz = 0; o.idx = k.idx;
    const ev2 = run(s, 200);
    expect(ev2.some((e) => e.type === 'jump' && e.seat === 1)).toBe(true);
    expect(ev2.some((e) => e.type === 'land' && e.seat === 1)).toBe(true);
    expect(s.plankOpen).toBe(true);
  });
  it('falling off the plank lands you in slow soil', () => {
    const s = createRace({ karts: 1 });
    go(s);
    s.plankOpen = true;
    const k = s.karts[0]!;
    k.x = -12; k.z = -6; k.heading = Math.PI; k.vx = -6; k.vz = 0; k.idx = 160;
    run(s, 120);
    expect(k.surface).toBe(SURFACE.soil);
    expect(forwardSpeed(k)).toBeLessThan(KART.vMax * 0.5);
  });
});

describe('a whole race', () => {
  it('four rivals finish three laps in order, with lap times and places', () => {
    const { s, events } = botRace(7);
    expect(s.phase).toBe('over');
    const places = s.karts.map((k) => k.place).sort();
    expect(places).toEqual([1, 2, 3, 4]);
    expect(s.karts.filter((k) => k.finished).length).toBeGreaterThanOrEqual(1);
    const winner = s.karts.find((k) => k.place === 1)!;
    expect(winner.lap).toBe(RACE.laps + 1);
    const seconds = (winner.finishTick - RACE.countdownTicks) / 60;
    expect(seconds).toBeGreaterThan(40);
    expect(seconds).toBeLessThan(80);
    expect(events.filter((e) => e.type === 'lap').length).toBeGreaterThanOrEqual(RACE.laps * 1);
    expect(events.filter((e) => e.type === 'finish').length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === 'reset')).toBe(false);
  });
  it('cutting straight across the lawn does not count as a lap', () => {
    const s = createRace({ karts: 1, laps: 1 });
    go(s);
    const k = s.karts[0]!;
    // shuttle back and forth over the finish line
    for (let i = 0; i < 6; i++) {
      k.x = -8; k.z = 30; k.heading = 0; k.vx = 12; k.vz = 0;
      run(s, 40);
    }
    expect(k.finished).toBe(false);
    expect(k.lap).toBeLessThanOrEqual(1);
  });
  it('the race is called for stragglers a while after the winner', () => {
    const s = createRace({ karts: 2, laps: 1, required: [0] });
    const bot = new Rival({ seed: 3, skill: 0.9 });
    for (let t = 0; t < 60 * 200 && s.phase !== 'over'; t++) stepRace(s, [{ ...bot.think(s, 0) }, noDrive()]);
    expect(s.phase).toBe('over');
    expect(s.karts[0]!.finished).toBe(true);
    expect(s.karts[0]!.place).toBe(1);
    expect(s.karts[1]!.place).toBe(2);
  });
});

describe('determinism and robustness', () => {
  it('the same inputs give the same race, tick for tick', () => {
    const a = botRace(21, 1);
    const b = botRace(21, 1);
    expect(hashRace(a.s)).toBe(hashRace(b.s));
    expect(a.s.tick).toBe(b.s.tick);
    expect(hashRace(botRace(22, 1).s)).not.toBe(hashRace(a.s));
  });
  it('clone is independent', () => {
    const s = createRace({ karts: 2 });
    go(s);
    const c = cloneRace(s);
    run(c, 30);
    expect(c.karts[0]!.x).not.toBe(s.karts[0]!.x);
  });
  it('never produces NaN and always ends under random abuse', () => {
    const rng = new Rng(5);
    const s = createRace({ karts: 4, laps: 1 });
    let cur = idle(4);
    for (let t = 0; t < RACE.maxTicks + 10 && s.phase !== 'over'; t++) {
      if (t % 9 === 0) cur = cur.map(() => ({ steer: rng.int(-300, 300), drift: rng.next() < 0.5, brake: rng.next() < 0.15 }));
      stepRace(s, cur);
      for (const k of s.karts) {
        for (const v of [k.x, k.z, k.heading, k.vx, k.vz, k.y, k.charge]) if (!Number.isFinite(v)) throw new Error(`non-finite at tick ${t}`);
        const b = trackOf(s).bounds;
        expect(k.x).toBeGreaterThanOrEqual(b.x0 - 1e-6);
        expect(k.x).toBeLessThanOrEqual(b.x1 + 1e-6);
      }
    }
    expect(s.phase).toBe('over');
  });
});

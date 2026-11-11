import { describe, expect, it } from 'vitest';
import {
  cloneCourier, createCourier, forecastLaunch, hashCourier, noInput, stepCourier,
} from '../src/attractions/courier/sim';
import type { CourierEvent, CourierState, PlayerInput } from '../src/attractions/courier/sim';
import { ARENAS, POINTS, TIMING, TUNE, scoreLaunch, starsFor, ringsInScript } from '../src/attractions/courier/rules';
import { Rng, dcos, dsin } from '../src/core/dmath';

type Pair = [PlayerInput, PlayerInput];
const idle = (): Pair => [noInput(), noInput()];

function run(s: CourierState, ticks: number, make: (t: number) => Pair = idle): CourierEvent[] {
  const events: CourierEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    stepCourier(s, make(t));
    events.push(...s.events);
  }
  return events;
}

function toAim(s: CourierState): void {
  run(s, TIMING.intro);
  expect(s.phase).toBe('aim');
}

/** Pull for a few ticks then release: launches with the given aim. */
function fire(s: CourierState, aimQ: number, powerQ: number): void {
  const seat = s.launcherSeat;
  const pull = (): Pair => {
    const p = idle();
    p[seat] = { ...noInput(), pull: true, aimQ, powerQ };
    return p;
  };
  run(s, 3, pull);
  run(s, 1);
  expect(s.phase).toBe('flight');
}

describe('deterministic math', () => {
  it('dsin/dcos match Math within 1e-10 and satisfy identity', () => {
    for (let i = -400; i <= 400; i++) {
      const x = i * 0.0371;
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-10);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-10);
    }
  });
  it('Rng is reproducible', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('round structure', () => {
  it('walks intro → aim → flight → outcome → next launch and swaps roles', () => {
    const s = createCourier({ launches: 2 });
    expect(s.phase).toBe('intro');
    expect(s.launcherSeat).toBe(0);
    toAim(s);
    fire(s, 500, 200);
    run(s, TUNE.flightLimitTicks + 10);
    expect(s.results.length).toBe(1);
    // finish outcome
    run(s, TIMING.outcomeCaught + 5);
    expect(s.launchIndex).toBe(1);
    expect(s.launcherSeat).toBe(1);
    toAim(s);
    fire(s, 500, 200);
    run(s, TUNE.flightLimitTicks + TIMING.outcomeCaught + 20);
    expect(s.phase).toBe('done');
    expect(s.results.length).toBe(2);
    const before = hashCourier(s);
    run(s, 30);
    expect(hashCourier(s)).toBe(before); // done is inert
  });

  it('a feeble release cancels instead of launching', () => {
    const s = createCourier();
    toAim(s);
    const p = idle();
    p[0] = { ...noInput(), pull: true, aimQ: 500, powerQ: TIMING.minPowerQ - 1 };
    stepCourier(s, p);
    stepCourier(s, idle());
    expect(s.phase).toBe('aim');
    expect(s.events.some((e) => e.type === 'aim_cancel')).toBe(true);
  });

  it('auto-launches when the aim clock runs out so nobody can stall a party', () => {
    const s = createCourier();
    toAim(s);
    run(s, TIMING.aimLimit + 2);
    expect(s.phase === 'flight' || s.phase === 'outcome').toBe(true);
  });

  it('only the launcher seat can launch and only the catcher seat can move the basket', () => {
    const s = createCourier();
    toAim(s);
    const wrong = (): Pair => {
      const p = idle();
      p[1] = { ...noInput(), pull: true, aimQ: 500, powerQ: 200 }; // seat 1 is the catcher
      p[0] = { ...noInput(), move: 127, dive: true }; // seat 0 is the launcher
      return p;
    };
    const x0 = s.catcher.x;
    run(s, 20, wrong);
    run(s, 2);
    expect(s.phase).toBe('aim');
    expect(s.catcher.x).toBe(x0);
  });
});

describe('flight', () => {
  it('more power flies further; the arena keeps most launches catchable', () => {
    const s = createCourier();
    const a = forecastLaunch(s, 420, 120, 900);
    const b = forecastLaunch(s, 420, 200, 900);
    expect(b.landX).toBeGreaterThan(a.landX + 1.5);
    const arena = ARENAS.jelly_junction!;
    let inLane = 0;
    let total = 0;
    for (let aq = 0; aq <= 1023; aq += 31) {
      for (let pq = TIMING.minPowerQ; pq <= 255; pq += 11) {
        const f = forecastLaunch(s, aq, pq, 900);
        total++;
        if (!f.dead && f.landX >= arena.laneMin && f.landX <= arena.laneMax) inLane++;
      }
    }
    // Design guard: a co-op catch game is only fun if the catcher usually gets a chance.
    expect(inLane / total).toBeGreaterThan(0.6);
  });

  it('the umbrella slows the fall and runs out', () => {
    const closed = createCourier();
    toAim(closed);
    fire(closed, 700, 220);
    const open = cloneCourier(closed);
    const hold = (): Pair => {
      const p = idle();
      p[0] = { ...noInput(), umbrella: true };
      return p;
    };
    // climb to the apex, then compare 40 ticks of falling
    while (closed.flyer.vy > 0) {
      stepCourier(closed, idle());
      stepCourier(open, idle());
    }
    run(closed, 40);
    const ev = run(open, 40, hold);
    expect(open.flyer.vy).toBeGreaterThan(closed.flyer.vy + 1.5);
    expect(open.flyer.vy).toBeGreaterThan(-3);
    expect(ev.some((e) => e.type === 'umbrella' && e.open)).toBe(true);
    const ev2 = run(open, TUNE.umbrellaTicks, hold);
    if (open.flyer.mode === 'air') {
      expect(open.flyer.spent).toBe(true);
      expect(ev2.some((e) => e.type === 'umbrella_spent')).toBe(true);
    }
  });

  it('a headwind shortens the flight and matters more under the umbrella', () => {
    const s = createCourier();
    const calm = forecastLaunch(s, 450, 200, 900).landX;
    s.launchIndex = 2; // scripted headwind
    const windy = forecastLaunch(s, 450, 200, 900).landX;
    expect(windy).toBeLessThan(calm - 0.25);
  });

  it('threads a ring when aimed through it and records a jelly bounce', () => {
    const s = createCourier();
    let ring = 0;
    let jelly = 0;
    for (let aq = 0; aq <= 1023; aq += 16) {
      for (let pq = 30; pq <= 255; pq += 8) {
        const f = forecastLaunch(s, aq, pq, 900);
        if (f.rings > 0) ring++;
        if (f.jelly) jelly++;
      }
    }
    expect(ring).toBeGreaterThan(20);
    expect(jelly).toBeGreaterThan(20);
  });
});

describe('catching', () => {
  function dropAt(offset: number, extra?: (s: CourierState) => void): CourierState {
    const s = createCourier();
    toAim(s);
    fire(s, 500, 200);
    const f = s.flyer;
    f.x = s.catcher.bx + offset;
    f.y = 5;
    f.vx = 0;
    f.vy = -4;
    extra?.(s);
    run(s, 200);
    return s;
  }

  it('a centred drop is a perfect catch worth 125', () => {
    const s = dropAt(0);
    expect(s.results[0]!.caught).toBe(true);
    expect(s.results[0]!.perfect).toBe(true);
    expect(s.results[0]!.points).toBe(POINTS.caught + POINTS.perfect);
    expect(s.total).toBe(125);
  });

  it('a slightly off-centre drop is caught but not perfect', () => {
    const s = dropAt(0.35);
    expect(s.results[0]!.caught).toBe(true);
    expect(s.results[0]!.perfect).toBe(false);
  });

  it('a drop on the rim rattles; a drop well outside misses and leaves a splat', () => {
    const rim = dropAt(0.85);
    expect(rim.results[0]!.caught || rim.results[0]!.missKind === 'table').toBe(true);
    const out = dropAt(1.9);
    expect(out.results[0]!.caught).toBe(false);
    expect(out.results[0]!.missKind).toBe('table');
    expect(out.results[0]!.points).toBe(0);
    expect(out.splats.length).toBe(1);
    expect(out.splats[0]!.seat).toBe(0);
  });

  it('nothing tunnels through the basket at high speed', () => {
    for (let k = 0; k < 40; k++) {
      const s = createCourier();
      toAim(s);
      fire(s, 500, 200);
      s.flyer.x = s.catcher.bx - 4 + k * 0.011;
      s.flyer.y = 1.5;
      s.flyer.vx = 14;
      s.flyer.vy = 0;
      run(s, 60);
      // It must either have bounced off the liner or been stopped; it can never end up caught
      // by entering through the side wall.
      if (s.results[0]?.caught) throw new Error('caught through the side of the basket');
    }
  });

  it('a dive covers ground fast, lowers the basket, then costs recovery time', () => {
    const s = createCourier();
    toAim(s);
    const x0 = s.catcher.x;
    const diveRight = (t: number): Pair => {
      const p = idle();
      p[1] = { ...noInput(), move: 127, dive: t === 0 };
      return p;
    };
    const ev = run(s, TUNE.catcher.diveTicks + 1, diveRight);
    expect(ev.some((e) => e.type === 'dive')).toBe(true);
    expect(s.catcher.x - x0).toBeGreaterThan(1.6);
    expect(s.catcher.by).toBeLessThan(TUNE.basket.carryY - 0.3);
    expect(s.catcher.mode).toBe('slide');
    run(s, TUNE.catcher.slideTicks + TUNE.catcher.recoverTicks + 1, idle);
    expect(s.catcher.mode).toBe('run');
    expect(s.catcher.by).toBeCloseTo(TUNE.basket.carryY, 6);
  });

  it('holding dive does not chain dives', () => {
    const s = createCourier();
    toAim(s);
    const hold = (): Pair => {
      const p = idle();
      p[1] = { ...noInput(), move: 127, dive: true };
      return p;
    };
    const ev = run(s, 200, hold);
    expect(ev.filter((e) => e.type === 'dive').length).toBe(1);
  });

  it('a diving catch earns the dive bonus', () => {
    const s = createCourier();
    toAim(s);
    fire(s, 500, 200);
    // start a dive, then drop the flyer into the moving basket
    const p = idle();
    p[1] = { ...noInput(), move: 127, dive: true };
    stepCourier(s, p);
    run(s, 5);
    s.flyer.x = s.catcher.bx + 0.6;
    s.flyer.y = s.catcher.by + TUNE.basket.depth + 0.35;
    s.flyer.vx = s.catcher.vx;
    s.flyer.vy = -5;
    run(s, 12);
    expect(s.results[0]?.caught).toBe(true);
    expect(s.results[0]?.diveCatch).toBe(true);
  });

  it('the catcher stays inside the lane', () => {
    const s = createCourier();
    toAim(s);
    const left = (): Pair => {
      const p = idle();
      p[1] = { ...noInput(), move: -127 };
      return p;
    };
    run(s, 400, left);
    expect(s.catcher.x).toBe(ARENAS.jelly_junction!.laneMin);
    expect(s.catcher.vx).toBe(0);
  });
});

describe('the table remembers', () => {
  it('a popped balloon stays popped for the rest of the round', () => {
    const s = createCourier();
    toAim(s);
    fire(s, 500, 200);
    const b = ARENAS.jelly_junction!.balloons[0]!;
    s.flyer.x = b.x - 2;
    s.flyer.y = b.y;
    s.flyer.vx = 13;
    s.flyer.vy = 0;
    const ev = run(s, 20);
    expect(ev.some((e) => e.type === 'balloon_pop')).toBe(true);
    expect(s.balloonsPopped[0]).toBe(true);
    run(s, TUNE.flightLimitTicks + TIMING.outcomeCaught + TIMING.intro + 10);
    expect(s.launchIndex).toBe(1);
    expect(s.balloonsPopped[0]).toBe(true);
  });

  it('a gentle touch only bumps a balloon', () => {
    const s = createCourier();
    toAim(s);
    fire(s, 500, 200);
    const b = ARENAS.jelly_junction!.balloons[0]!;
    s.flyer.x = b.x - 1.8;
    s.flyer.y = b.y;
    s.flyer.vx = 4.5;
    s.flyer.vy = 1.5;
    const ev = run(s, 30);
    expect(ev.some((e) => e.type === 'balloon_bump')).toBe(true);
    expect(s.balloonsPopped[0]).toBe(false);
  });
});

describe('scoring', () => {
  it('banks bonuses only on a catch', () => {
    expect(scoreLaunch({ caught: false, perfect: false, diveCatch: false, rings: 2, jelly: true })).toBe(0);
    expect(scoreLaunch({ caught: true, perfect: true, diveCatch: true, rings: 2, jelly: true }))
      .toBe(POINTS.caught + POINTS.perfect + POINTS.dive + 2 * POINTS.ring + POINTS.jelly);
  });
  it('stars are monotonic', () => {
    const rings = ringsInScript(ARENAS.jelly_junction!, 6);
    expect(rings).toBe(7);
    let last = 0;
    for (let t = 0; t <= 1400; t += 20) {
      const st = starsFor(t, 6, rings);
      expect(st).toBeGreaterThanOrEqual(last);
      last = st;
    }
    expect(starsFor(0, 6, rings)).toBe(0);
    expect(starsFor(6 * POINTS.caught + rings * POINTS.ring, 6, rings)).toBe(3);
  });
});

describe('determinism', () => {
  function scripted(seed: number): { hashes: number[]; total: number } {
    const rng = new Rng(seed);
    const s = createCourier({ launches: 4 });
    const hashes: number[] = [];
    const cur: Pair = idle();
    for (let t = 0; t < 6000 && s.phase !== 'done'; t++) {
      if (t % 7 === 0) {
        for (const seat of [0, 1] as const) {
          cur[seat] = {
            pull: rng.next() < 0.6,
            aimQ: rng.int(0, 1023),
            powerQ: rng.int(0, 255),
            umbrella: rng.next() < 0.5,
            move: rng.int(-127, 127),
            dive: rng.next() < 0.2,
          };
        }
      }
      stepCourier(s, cur);
      if (t % 20 === 0) hashes.push(hashCourier(s));
    }
    hashes.push(hashCourier(s));
    return { hashes, total: s.total };
  }

  it('the same inputs always produce the same state hashes', () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      const a = scripted(seed);
      const b = scripted(seed);
      expect(a.hashes).toEqual(b.hashes);
      expect(a.total).toBe(b.total);
    }
  });

  it('different inputs diverge (the hash is not constant)', () => {
    expect(scripted(1).hashes).not.toEqual(scripted(2).hashes);
  });

  it('clone is independent of the original', () => {
    const s = createCourier();
    toAim(s);
    fire(s, 500, 200);
    const c = cloneCourier(s);
    run(c, 50);
    expect(c.tick).toBe(s.tick + 50);
    expect(c.flyer.x).not.toBe(s.flyer.x);
  });

  it('never produces NaN under random abuse', () => {
    const rng = new Rng(7);
    const s = createCourier({ launches: 6 });
    for (let t = 0; t < 20000 && s.phase !== 'done'; t++) {
      const mk = (): PlayerInput => ({
        pull: rng.next() < 0.5, aimQ: rng.int(-50, 1100), powerQ: rng.int(-20, 300),
        umbrella: rng.next() < 0.5, move: rng.int(-300, 300), dive: rng.next() < 0.5,
      });
      stepCourier(s, [mk(), mk()]);
      const f = s.flyer;
      const c = s.catcher;
      for (const v of [f.x, f.y, f.vx, f.vy, f.open, c.x, c.vx, c.bx, c.by, s.total]) {
        if (!Number.isFinite(v)) throw new Error(`non-finite value at tick ${t}`);
      }
    }
    expect(s.phase).toBe('done');
  });
});

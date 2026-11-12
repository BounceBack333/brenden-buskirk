import { describe, expect, it } from 'vitest';
import { cloneRace, createRace, hashRace, noDrive, stepRace, trackOf } from '../src/attractions/dash/sim';
import type { DriveInput, RaceEvent, RaceState } from '../src/attractions/dash/sim';
import { COMBAT, canBeHit, gunTarget, weaponsHot } from '../src/attractions/dash/combat';
import { Rival } from '../src/attractions/dash/bot';
import { KART, RACE, TRACK_IDS, trackById } from '../src/attractions/dash/track';

/**
 * The combat layer: guns, mines, armour, wrecks. Karts are placed by hand on the home straight
 * (which runs east along z = 30) with the weapons already live, so each rule is tested alone.
 */
function arena(positions: [number, number, number?][], combat = true): RaceState {
  const s = createRace({ karts: positions.length, combat });
  s.phase = 'racing';
  s.phaseTick = COMBAT.safeTicks + 1;
  s.tick = RACE.countdownTicks + COMBAT.safeTicks + 1;
  positions.forEach(([x, z, heading], i) => {
    const k = s.karts[i]!;
    k.x = x;
    k.z = z;
    k.heading = heading ?? 0;
    k.lap = 1;
    k.prevDrift = false;
  });
  return s;
}

const inputs = (n: number, over: Record<number, Partial<DriveInput>> = {}): DriveInput[] =>
  Array.from({ length: n }, (_, i) => ({ ...noDrive(), ...(over[i] ?? {}) }));

function run(s: RaceState, ticks: number, over: Record<number, Partial<DriveInput>> | ((t: number) => Record<number, Partial<DriveInput>>) = {}): RaceEvent[] {
  const ev: RaceEvent[] = [];
  for (let t = 0; t < ticks && s.phase !== 'over'; t++) {
    stepRace(s, inputs(s.karts.length, typeof over === 'function' ? over(t) : over));
    ev.push(...s.events);
  }
  return ev;
}
const of = <T extends RaceEvent['type']>(ev: RaceEvent[], type: T): Extract<RaceEvent, { type: T }>[] =>
  ev.filter((e): e is Extract<RaceEvent, { type: T }> => e.type === type);

describe('a plain race stays plain', () => {
  it('ignores the trigger and the mine button, and nothing loses armour', () => {
    const s = arena([[0, 30], [8, 30]], false);
    s.karts[0]!.mines = 2;
    const ev = run(s, 240, { 0: { fire: true, drop: true } });
    expect(of(ev, 'shot').length).toBe(0);
    expect(of(ev, 'mine_drop').length).toBe(0);
    expect(s.mines.length).toBe(0);
    for (const k of s.karts) expect(k.armor).toBe(COMBAT.armor);
    expect(weaponsHot(s)).toBe(false);
  });
  it('plays tick for tick as it would without the buttons held', () => {
    const a = createRace({ karts: 4 });
    const b = createRace({ karts: 4 });
    for (let t = 0; t < 900; t++) {
      stepRace(a, inputs(4));
      stepRace(b, inputs(4, { 0: { fire: true, drop: t % 7 === 0 }, 2: { fire: true } }));
    }
    expect(hashRace(b)).toBe(hashRace(a));
  });
});

describe('guns', () => {
  it('are locked for the first seconds of the race, and say when they go live', () => {
    const s = createRace({ karts: 2, combat: true });
    const ev = run(s, RACE.countdownTicks + COMBAT.safeTicks - 1, { 0: { fire: true }, 1: { fire: true } });
    expect(of(ev, 'shot').length).toBe(0);
    expect(of(ev, 'hot').length).toBe(0);
    expect(s.karts[0]!.ammo).toBe(COMBAT.magazine);
    const next = run(s, 3, { 0: { fire: true } });
    expect(of(next, 'hot').length).toBe(1);
    expect(of(next, 'shot').length).toBeGreaterThan(0);
  });

  it('hit the kart ahead: one round, one bite of armour', () => {
    const s = arena([[0, 30], [10, 30]]);
    expect(gunTarget(s, trackOf(s), 0)).toBe(1);
    const ev = run(s, 1, { 0: { fire: true } });
    const shots = of(ev, 'shot');
    expect(shots.length).toBe(1);
    expect(shots[0]).toMatchObject({ seat: 0, hit: 1 });
    expect(s.karts[1]!.armor).toBe(COMBAT.armor - COMBAT.damage);
    expect(s.karts[0]!.ammo).toBe(COMBAT.magazine - 1);
    expect(s.karts[1]!.hitBy).toBe(0);
  });

  it('fire at a steady rate while the trigger is held', () => {
    const s = arena([[0, 30], [12, 30]]);
    const ev = run(s, COMBAT.shotTicks * 5, { 0: { fire: true } });
    expect(of(ev, 'shot').length).toBe(5);
  });

  it('miss what is behind, beside or too far away', () => {
    for (const [x, z] of [[-10, 30], [6, 34], [COMBAT.range + 6, 30]] as const) {
      const s = arena([[0, 30], [x, z]]);
      expect(gunTarget(s, trackOf(s), 0)).toBe(-1);
      const ev = run(s, 1, { 0: { fire: true } });
      expect(of(ev, 'shot')[0]).toMatchObject({ seat: 0, hit: -1 });
      expect(s.karts[1]!.armor).toBe(COMBAT.armor);
    }
  });

  it('point where the nose points', () => {
    // facing south, with the other kart to the south
    const s = arena([[0, 20, Math.PI / 2], [0.4, 30]]);
    expect(gunTarget(s, trackOf(s), 0)).toBe(1);
    const t = arena([[0, 20, 0], [0.4, 30]]);
    expect(gunTarget(t, trackOf(t), 0)).toBe(-1);
  });

  it('pick the nearest of two in the sights', () => {
    const s = arena([[0, 30], [18, 30], [9, 30.3]]);
    expect(gunTarget(s, trackOf(s), 0)).toBe(2);
  });

  it('cannot shoot through the big pot', () => {
    const track = trackOf(createRace());
    const pot = track.dressing.pot;
    const s = arena([[pot.x - 11, pot.z, 0], [pot.x + 11, pot.z]]);
    expect(gunTarget(s, track, 0)).toBe(-1);
    // the same gap on open road is a hit
    const open = arena([[0, 30], [22, 30]]);
    expect(gunTarget(open, track, 0)).toBe(1);
  });

  it('run dry, then refill once the trigger is released', () => {
    const s = arena([[0, 30]]);
    // the last round leaves on the tick this run ends
    const ev = run(s, COMBAT.shotTicks * (COMBAT.magazine - 1) + 1, { 0: { fire: true } });
    expect(of(ev, 'shot').length).toBe(COMBAT.magazine);
    expect(s.karts[0]!.ammo).toBe(0);
    run(s, COMBAT.reloadDelayTicks - 1);
    expect(s.karts[0]!.ammo).toBe(0);
    run(s, COMBAT.reloadTicks * COMBAT.magazine + 10);
    expect(s.karts[0]!.ammo).toBe(COMBAT.magazine);
  });
});

describe('mines', () => {
  it('drop behind the kart, one per press, and only if it has one', () => {
    const s = arena([[0, 30]]);
    expect(of(run(s, 2, { 0: { drop: true } }), 'mine_drop').length).toBe(0);
    run(s, 1); // let go of the button
    s.karts[0]!.mines = 2;
    const x = s.karts[0]!.x;
    const ev = run(s, 30, { 0: { drop: true } }); // held: still one
    expect(of(ev, 'mine_drop').length).toBe(1);
    expect(s.mines.length).toBe(1);
    expect(s.karts[0]!.mines).toBe(1);
    expect(s.mines[0]!.x).toBeLessThan(x); // behind a kart that faces east
    expect(s.mines[0]!.owner).toBe(0);
    run(s, 1);
    expect(of(run(s, 1, { 0: { drop: true } }), 'mine_drop').length).toBe(1);
    expect(s.karts[0]!.mines).toBe(0);
  });

  it('are harmless until armed, then take a large bite and spin whoever drives over them', () => {
    const s = arena([[0, 30], [-40, 30]]);
    s.mines.push({ id: 1, owner: 0, x: -38.5, z: 30, armTick: s.tick + 10, dieTick: s.tick + 9999 });
    run(s, 1);
    expect(s.karts[1]!.armor).toBe(COMBAT.armor); // sitting on it, not armed yet
    const ev = run(s, 12);
    const hits = of(ev, 'mine_hit');
    expect(hits.length).toBe(1);
    expect(hits[0]).toMatchObject({ seat: 1, owner: 0 });
    expect(s.karts[1]!.armor).toBe(COMBAT.armor - COMBAT.mineDamage);
    expect(s.karts[1]!.stunTicks).toBeGreaterThan(0);
    expect(s.mines.length).toBe(0);
  });

  it('do not care whose they are', () => {
    const s = arena([[0, 30]]);
    s.mines.push({ id: 1, owner: 0, x: 3, z: 30, armTick: 0, dieTick: s.tick + 9999 });
    const ev = run(s, 60);
    expect(of(ev, 'mine_hit')[0]).toMatchObject({ seat: 0, owner: 0 });
    expect(s.karts[0]!.armor).toBe(COMBAT.armor - COMBAT.mineDamage);
  });

  it('go away after a while, and the oldest goes when there are too many', () => {
    const s = arena([[0, 30]]);
    s.mines.push({ id: 1, owner: 0, x: -60, z: -30, armTick: 0, dieTick: s.tick + 5 });
    expect(of(run(s, 6), 'mine_gone').length).toBe(1);
    expect(s.mines.length).toBe(0);
    for (let i = 0; i < COMBAT.maxMines; i++) s.mines.push({ id: 10 + i, owner: 0, x: -70 + i, z: -35, armTick: 0, dieTick: s.tick + 99999 });
    s.karts[0]!.mines = 1;
    const ev = run(s, 2, { 0: { drop: true } });
    expect(s.mines.length).toBe(COMBAT.maxMines);
    expect(of(ev, 'mine_gone')[0]!.id).toBe(10);
  });
});

describe('crates and the repair strip', () => {
  it('every track that has them puts them where a kart can reach', () => {
    for (const id of TRACK_IDS) {
      const track = trackById(id);
      if (!track.combat) continue;
      expect(track.combat.crates.length).toBeGreaterThan(0);
      for (const c of track.combat.crates) {
        let best = Infinity;
        let hw = 0;
        for (const p of track.samples) {
          const d = Math.hypot(p.x - c.x, p.z - c.z);
          if (d < best) { best = d; hw = p.hw; }
        }
        expect(best).toBeLessThan(hw - COMBAT.crateRadius * 0.5); // on the road
        expect(best).toBeGreaterThan(1); // but off the middle of it
        for (const o of track.circles) expect(Math.hypot(o.x - c.x, o.z - c.z)).toBeGreaterThan(o.r + KART.radius);
      }
      // the repair strip covers some of the road, and none of the shortcut
      const r = track.combat.repair;
      const inside = (x: number, z: number): boolean => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
      expect(track.samples.filter((p) => inside(p.x, p.z)).length).toBeGreaterThan(5);
      const pl = track.plank;
      for (let t = 0; t <= 1; t += 0.05) expect(inside(pl.ax + (pl.bx - pl.ax) * t, pl.az + (pl.bz - pl.az) * t)).toBe(false);
    }
  });

  it('a crate fills the mines, then takes a while to come back', () => {
    const track = trackOf(createRace());
    const crate = track.combat!.crates[0]!;
    const s = arena([[crate.x - 0.5, crate.z]]);
    const ev = run(s, 2);
    expect(of(ev, 'crate')[0]).toMatchObject({ seat: 0, index: 0 });
    expect(s.karts[0]!.mines).toBe(COMBAT.carry);
    expect(s.crateReady[0]!).toBeGreaterThan(s.tick + COMBAT.crateRespawnTicks - 5);
    // a second kart arriving now gets nothing
    const t = arena([[crate.x - 0.5, crate.z], [0, 0]]);
    t.crateReady[0] = t.tick + 100;
    run(t, 2);
    expect(t.karts[0]!.mines).toBe(0);
    // a kart that is already full leaves it for somebody else
    const u = arena([[crate.x - 0.5, crate.z]]);
    u.karts[0]!.mines = COMBAT.carry;
    expect(of(run(u, 2), 'crate').length).toBe(0);
    expect(u.crateReady[0]!).toBe(0);
  });

  it('the repair strip gives armour back once per pass, never past full', () => {
    const track = trackOf(createRace());
    const r = track.combat!.repair;
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    const s = arena([[cx, cz, Math.PI]]);
    s.karts[0]!.armor = 30;
    const ev = run(s, 5);
    expect(of(ev, 'repair').length).toBe(1);
    expect(s.karts[0]!.armor).toBe(30 + COMBAT.repair);
    const t = arena([[cx, cz, Math.PI]]);
    t.karts[0]!.armor = COMBAT.armor - 5;
    run(t, 2);
    expect(t.karts[0]!.armor).toBe(COMBAT.armor);
    const full = arena([[cx, cz, Math.PI]]);
    expect(of(run(full, 5), 'repair').length).toBe(0);
  });
});

describe('ramming and walls', () => {
  it('a hard ram hurts the kart that is hit more than the one that hits', () => {
    const s = arena([[0, 30], [1.3, 30]]);
    s.karts[0]!.vx = 18;
    s.karts[1]!.vx = 2;
    const ev = run(s, 1);
    const rams = of(ev, 'ram');
    expect(rams.length).toBe(1);
    expect(rams[0]).toMatchObject({ seat: 1, by: 0 });
    const lostVictim = COMBAT.armor - s.karts[1]!.armor;
    const lostRammer = COMBAT.armor - s.karts[0]!.armor;
    expect(lostVictim).toBeGreaterThan(5);
    expect(lostVictim).toBeLessThanOrEqual(COMBAT.ramMax);
    expect(lostRammer).toBeCloseTo(lostVictim * COMBAT.ramSelf, 6);
    expect(s.karts[1]!.hitBy).toBe(0);
  });

  it('a nudge is only a nudge', () => {
    const s = arena([[0, 30], [1.3, 30]]);
    s.karts[0]!.vx = 9;
    s.karts[1]!.vx = 6;
    expect(of(run(s, 1), 'ram').length).toBe(0);
    for (const k of s.karts) expect(k.armor).toBe(COMBAT.armor);
  });

  it('a wall hit hard enough to spin the kart costs armour', () => {
    const track = trackOf(createRace());
    const pot = track.dressing.pot;
    const s = arena([[pot.x - pot.r - KART.radius - 0.3, pot.z, 0]]);
    s.karts[0]!.vx = 15;
    run(s, 4);
    expect(s.karts[0]!.stunTicks).toBeGreaterThan(0);
    expect(s.karts[0]!.armor).toBe(COMBAT.armor - COMBAT.wallDamage);
  });
});

describe('wrecks', () => {
  it('armour at nothing is a wreck, and whoever did it gets the credit', () => {
    const s = arena([[0, 30], [10, 30]]);
    s.karts[1]!.armor = COMBAT.damage;
    const ev = run(s, 1, { 0: { fire: true } });
    expect(of(ev, 'wreck')[0]).toMatchObject({ seat: 1, by: 0 });
    expect(s.karts[1]!.wreckTicks).toBeGreaterThan(0);
    expect(s.karts[1]!.wrecks).toBe(1);
    expect(s.karts[0]!.kills).toBe(1);
    expect(canBeHit(s.karts[1]!)).toBe(false);
  });

  it('nobody is credited for a kart that wrecks itself, unless someone hurt it just before', () => {
    const alone = arena([[0, 30]]);
    alone.karts[0]!.armor = 5;
    alone.mines.push({ id: 1, owner: 0, x: 2, z: 30, armTick: 0, dieTick: alone.tick + 9999 });
    expect(of(run(alone, 30), 'wreck')[0]).toMatchObject({ seat: 0, by: -1 });

    const pushed = arena([[0, 30], [-60, -30]]);
    pushed.karts[0]!.armor = 5;
    pushed.karts[0]!.hitBy = 1;
    pushed.karts[0]!.hitTick = pushed.tick - 60;
    pushed.mines.push({ id: 1, owner: 0, x: 2, z: 30, armTick: 0, dieTick: pushed.tick + 9999 });
    expect(of(run(pushed, 30), 'wreck')[0]).toMatchObject({ seat: 0, by: 1 });
    expect(pushed.karts[1]!.kills).toBe(1);
  });

  it('a wreck does not steer, stops, and is put back on the road with full armour and a shield', () => {
    const s = arena([[0, 31.5], [10, 30]]);
    s.karts[1]!.armor = 1;
    s.karts[1]!.vx = 14;
    run(s, 1, { 0: { fire: true } });
    const ev = run(s, COMBAT.wreckTicks - 2, { 1: { steer: 127, drift: true, fire: true } });
    const k = s.karts[1]!;
    expect(k.wreckTicks).toBeGreaterThan(0);
    expect(Math.hypot(k.vx, k.vz)).toBeLessThan(0.5);
    expect(of(ev, 'shot').filter((e) => e.seat === 1).length).toBe(0);
    expect(of(ev, 'reset').length).toBe(0); // not mistaken for a stuck kart
    const back = run(s, 3);
    expect(of(back, 'respawn')[0]).toMatchObject({ seat: 1 });
    expect(k.wreckTicks).toBe(0);
    expect(k.armor).toBe(COMBAT.armor);
    expect(k.ammo).toBe(COMBAT.magazine);
    expect(k.blinkTicks).toBeGreaterThan(COMBAT.shieldTicks - 5);
    const track = trackOf(s);
    expect(Math.min(...track.samples.map((p) => Math.hypot(p.x - k.x, p.z - k.z)))).toBeLessThan(1.5);
    // shielded: cannot be hurt, cannot shoot
    const armour = k.armor;
    s.mines.push({ id: 9, owner: 0, x: k.x + 1, z: k.z, armTick: 0, dieTick: s.tick + 9999 });
    const shielded = run(s, 20, { 1: { fire: true } });
    expect(k.armor).toBe(armour);
    expect(of(shielded, 'shot').filter((e) => e.seat === 1).length).toBe(0);
  });

  it('a kart that has finished is out of it', () => {
    const s = arena([[0, 30], [10, 30]]);
    s.karts[1]!.finished = true;
    s.karts[1]!.finishTick = s.tick;
    expect(gunTarget(s, trackOf(s), 0)).toBe(-1);
    run(s, 10, { 0: { fire: true }, 1: { fire: true } });
    expect(s.karts[1]!.armor).toBe(COMBAT.armor);
    expect(s.karts[0]!.armor).toBe(COMBAT.armor);
  });
});

describe('a whole combat race', () => {
  function botRace(seed: number): { s: RaceState; events: RaceEvent[] } {
    const s = createRace({ karts: 4, combat: true });
    const bots = [0.95, 0.75, 0.55, 0.35].map((skill, i) => new Rival({ seed: seed + i, skill }));
    const events: RaceEvent[] = [];
    for (let t = 0; t < 60 * 240 && s.phase !== 'over'; t++) {
      stepRace(s, bots.map((b, i) => ({ ...b.think(s, i) })));
      events.push(...s.events);
    }
    return { s, events };
  }

  it('is fought, is finished, and adds up', () => {
    for (const seed of [3, 41, 777]) {
      const { s, events } = botRace(seed);
      expect(s.phase).toBe('over');
      expect(s.karts.filter((k) => k.finished).length).toBeGreaterThanOrEqual(3);
      expect(of(events, 'shot').length).toBeGreaterThan(20);
      expect(of(events, 'shot').filter((e) => e.hit >= 0).length).toBeGreaterThan(10);
      const wrecks = of(events, 'wreck').length;
      expect(s.karts.reduce((n, k) => n + k.wrecks, 0)).toBe(wrecks);
      expect(s.karts.reduce((n, k) => n + k.kills, 0)).toBeLessThanOrEqual(wrecks);
      expect(of(events, 'respawn').length).toBeLessThanOrEqual(wrecks);
      for (const k of s.karts) {
        expect(k.armor).toBeGreaterThanOrEqual(0);
        expect(k.armor).toBeLessThanOrEqual(COMBAT.armor);
        expect(k.ammo).toBeGreaterThanOrEqual(0);
        expect(k.ammo).toBeLessThanOrEqual(COMBAT.magazine);
        expect(k.mines).toBeGreaterThanOrEqual(0);
        expect(k.mines).toBeLessThanOrEqual(COMBAT.carry);
        for (const v of [k.x, k.z, k.vx, k.vz, k.heading]) expect(Number.isFinite(v)).toBe(true);
      }
      expect(s.mines.length).toBeLessThanOrEqual(COMBAT.maxMines);
    }
  });

  it('is the same race every time, and a copy is its own race', () => {
    const a = botRace(12).s;
    const b = botRace(12).s;
    expect(hashRace(a)).toBe(hashRace(b));
    expect(hashRace(botRace(13).s)).not.toBe(hashRace(a));

    const s = arena([[0, 30], [10, 30]]);
    s.karts[0]!.mines = 2;
    run(s, 3, { 0: { drop: true } });
    const copy = cloneRace(s);
    const before = hashRace(s);
    run(copy, 200, { 0: { fire: true } });
    expect(hashRace(s)).toBe(before);
    expect(copy.mines).not.toBe(s.mines);
    expect(copy.crateReady).not.toBe(s.crateReady);
  });
});

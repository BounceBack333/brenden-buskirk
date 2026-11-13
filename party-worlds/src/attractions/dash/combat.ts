/**
 * Backyard Dash — the combat layer.
 *
 * Every kart carries the same kit: armour, twin forward guns with a small magazine, and one slot
 * for whatever it last picked up from a crate: mines, rockets, a shockwave, a shield or an
 * overdrive. Each crate says what is in it and always holds the same thing, so what you carry is
 * a matter of where you drove. Nothing here is bought, unlocked or random. Pure and deterministic like the rest of
 * the simulation (core/dmath arithmetic only); it runs only when the race was created with
 * `combat: true`, and a race without it plays exactly as it did before this file existed.
 *
 * The rules in one paragraph: guns are locked for a few seconds after GO. Hold FIRE and the guns
 * shoot straight ahead; a rival inside a narrow cone, in range and not behind something big,
 * loses armour. The magazine refills by itself once you stop shooting. USE spends what is in the
 * slot: a mine left behind you (arms after a moment, bites whoever drives over it, you
 * included); a rocket that flies ahead and leans toward whoever was in front of you; a shockwave
 * that hurts and bogs down everything close; a shield that stops all damage for a few seconds;
 * an overdrive that is a long boost in which whatever you hit takes a ram's worth and you take
 * none. Hard rams hurt the kart that is hit, hard wall hits
 * hurt you. Armour at zero is a wreck: a few seconds stopped, then back on the road with full
 * armour and a short shield. Whoever did it takes the spoils: some armour and a full magazine.
 * The repair strip on the long way round gives armour back, once per pass.
 *
 * "To the death" (RaceConfig.lives): each kart has that many wrecks in it. The last one puts it
 * out of the race for good, and if only one kart is left running before anyone has finished,
 * it has won. Without lives a wreck always comes back.
 *
 * It is cars against cars only.
 */
import { dcos, dsin } from '../../core/dmath';
import { KART, TICK_HZ, segDist2 } from './track';
import type { Track } from './track';
import type { DriveInput, Kart, RaceState } from './sim';

export const COMBAT = {
  armor: 100,
  /** guns, mines and ramming are locked this long after GO */
  safeTicks: 5 * TICK_HZ,
  magazine: 20,
  /** ticks between rounds while the trigger is held */
  shotTicks: 6,
  /** quiet time after the last round before the magazine starts to refill */
  reloadDelayTicks: 45,
  /** then one round comes back every this many ticks */
  reloadTicks: 10,
  range: 24,
  /** a target counts if it is no further off the nose than this, at the muzzle… */
  aimNear: 0.9,
  /** …plus this much per unit of distance (about 5 degrees) */
  aimSpread: 0.09,
  damage: 2,
  /** something at least this big blocks a shot */
  coverRadius: 1.5,
  mineDamage: 35,
  mineRadius: 1.1,
  mineArmTicks: 36,
  mineLifeTicks: 20 * TICK_HZ,
  maxMines: 10,
  crateRadius: 1.0,
  crateRespawnTicks: 15 * TICK_HZ,
  // ── rockets: fast, straight, and they lean toward whoever was ahead when they left ──
  rocketSpeed: 36,
  rocketLifeTicks: Math.round(1.7 * TICK_HZ),
  /** how hard a rocket can turn, radians a second */
  rocketTurn: 2.4,
  rocketRadius: 0.9,
  rocketDamage: 45,
  /** who a rocket will go for: this far ahead, and within this much of the nose (near, and per unit of distance) */
  rocketSeekRange: 60,
  rocketSeekNear: 3,
  rocketSeekSpread: 0.32,
  // ── the shockwave: everything close, in every direction ──
  shockRadius: 9,
  shockDamage: 22,
  /** and it bogs them down for this long */
  shockStallTicks: 42,
  // ── the shield: no damage at all while it is up ──
  bubbleTicks: 5 * TICK_HZ,
  // ── overdrive: a long boost, and a ram that always counts ──
  overdriveTicks: 4 * TICK_HZ,
  overdriveRam: 40,
  /** a kart that has just been rammed cannot be rammed again for this long */
  ramCooldownTicks: 30,
  /** closing speed below this is a shove, not a ram */
  ramMin: 5,
  ramPerSpeed: 2.2,
  ramMax: 22,
  /** the share of a ram the rammer takes itself */
  ramSelf: 0.3,
  /** a wall hit hard enough to spin you */
  wallDamage: 10,
  wreckTicks: Math.round(2.5 * TICK_HZ),
  shieldTicks: 110,
  /** whoever hurt a kart this recently gets the wreck when it goes */
  creditTicks: 5 * TICK_HZ,
  repair: 45,
  repairCooldownTicks: 6 * TICK_HZ,
  /** what a kart takes off a rival it wrecks: this much armour, and a full magazine */
  spoils: 25,
  /**
   * "To the death": how many wrecks a kart has in it (the race itself is told through
   * RaceConfig.lives). Two, from dev/combatprobe.ts: with three nobody was ever put out, with
   * one about half the field went every race.
   */
  lives: 2,
} as const;

export interface Mine {
  id: number;
  x: number;
  z: number;
  owner: number;
  armTick: number;
  dieTick: number;
}

export interface Rocket {
  id: number;
  x: number;
  z: number;
  /** unit direction of flight */
  dx: number;
  dz: number;
  owner: number;
  /** the seat it leans toward, or -1 to fly straight */
  target: number;
  dieTick: number;
}

/** What a kart can be carrying. The number is what is stored on the kart. */
export const ITEM = { none: 0, mine: 1, rocket: 2, shock: 3, shield: 4, overdrive: 5 } as const;
export type ItemName = 'mine' | 'rocket' | 'shock' | 'shield' | 'overdrive';
export const ITEM_NAMES: readonly ('' | ItemName)[] = ['', 'mine', 'rocket', 'shock', 'shield', 'overdrive'];
/** How many uses one crate gives. */
export const ITEM_CHARGES: Readonly<Record<ItemName, number>> = { mine: 2, rocket: 2, shock: 1, shield: 1, overdrive: 1 };

/** The name of what this kart is carrying, or '' for nothing. */
export function itemOf(k: Kart): '' | ItemName {
  return k.charges > 0 ? ITEM_NAMES[k.item] ?? '' : '';
}

const hit = { t: 0, cx: 0, cz: 0 };

/** Guns, mines and ramming are live. */
export function weaponsHot(s: RaceState): boolean {
  return s.combat && s.phase === 'racing' && s.phaseTick >= COMBAT.safeTicks;
}

/** A kart that can be hurt right now: racing, not already a wreck, not shielded. */
export function canBeHit(k: Kart): boolean {
  return !k.finished && k.wreckTicks === 0 && k.blinkTicks === 0;
}

/** Take armour off a kart. `by` is the seat responsible, or -1 for the scenery or itself. */
export function damage(s: RaceState, seat: number, amount: number, by: number): void {
  if (!s.combat || amount <= 0) return;
  const k = s.karts[seat];
  if (!k || !canBeHit(k)) return;
  if (k.bubbleTicks > 0) {
    // the shield takes it; say so now and then (guns land ten times a second)
    if (s.tick - k.blockTick >= 12) {
      k.blockTick = s.tick;
      s.events.push({ type: 'blocked', seat, by });
    }
    return;
  }
  k.armor -= amount;
  if (by >= 0 && by !== seat) {
    k.hitBy = by;
    k.hitTick = s.tick;
  }
  if (k.armor > 0) return;
  // wrecked
  k.armor = 0;
  k.wreckTicks = COMBAT.wreckTicks;
  k.wrecks++;
  k.drifting = false;
  k.driftDir = 0;
  k.charge = 0;
  k.boostTicks = 0;
  k.stunTicks = 0;
  k.overTicks = 0;
  let credit = -1;
  if (k.hitBy >= 0 && k.hitBy !== seat && s.tick - k.hitTick <= COMBAT.creditTicks) {
    credit = k.hitBy;
    const winner = s.karts[credit]!;
    winner.kills++;
    // the spoils, if the winner is in a state to use them
    if (canBeHit(winner) || winner.blinkTicks > 0) {
      winner.armor = Math.min(COMBAT.armor, winner.armor + COMBAT.spoils);
      winner.ammo = COMBAT.magazine;
    }
  }
  k.hitBy = -1;
  // to the death: that was one of its lives
  if (s.lives > 0) {
    k.lives--;
    if (k.lives <= 0) {
      k.lives = 0;
      k.out = true;
      k.outTick = s.tick;
    }
  }
  s.events.push({ type: 'wreck', seat, by: credit, out: k.out });
}

/**
 * The seat this kart's guns would hit if they fired now, or -1. The nearest rival that is in
 * range, close enough to the line of the nose, and not behind a big solid thing.
 */
export function gunTarget(s: RaceState, track: Track, seat: number): number {
  const k = s.karts[seat]!;
  // the guns point where the nose points, not where the kart is sliding
  const fx = dcos(k.heading);
  const fz = dsin(k.heading);
  let best = -1;
  let bestD = COMBAT.range * COMBAT.range;
  for (let j = 0; j < s.karts.length; j++) {
    if (j === seat) continue;
    const o = s.karts[j]!;
    if (!canBeHit(o)) continue;
    const dx = o.x - k.x;
    const dz = o.z - k.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= bestD) continue;
    const along = dx * fx + dz * fz;
    if (along <= 0) continue;
    const off = Math.abs(dx * fz - dz * fx);
    if (off > COMBAT.aimNear + COMBAT.aimSpread * along) continue;
    let covered = false;
    for (const c of track.circles) {
      if (c.r < COMBAT.coverRadius) continue;
      if (segDist2(c.x, c.z, k.x, k.z, o.x, o.z, hit) < c.r * c.r) {
        covered = true;
        break;
      }
    }
    if (covered) continue;
    best = j;
    bestD = d2;
  }
  return best;
}

/**
 * Who a rocket fired by this kart now would go for, or -1: the nearest rival in a wide cone
 * ahead. Nothing gives cover from being chosen; the rocket still has to get there.
 */
export function rocketTarget(s: RaceState, seat: number): number {
  const k = s.karts[seat]!;
  const fx = dcos(k.heading);
  const fz = dsin(k.heading);
  let best = -1;
  let bestD = COMBAT.rocketSeekRange * COMBAT.rocketSeekRange;
  for (let j = 0; j < s.karts.length; j++) {
    if (j === seat) continue;
    const o = s.karts[j]!;
    if (!canBeHit(o)) continue;
    const dx = o.x - k.x;
    const dz = o.z - k.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= bestD) continue;
    const along = dx * fx + dz * fz;
    if (along <= 0) continue;
    if (Math.abs(dx * fz - dz * fx) > COMBAT.rocketSeekNear + COMBAT.rocketSeekSpread * along) continue;
    best = j;
    bestD = d2;
  }
  return best;
}

/** Spend one of whatever this kart is carrying. */
function useItem(s: RaceState, seat: number): void {
  const k = s.karts[seat]!;
  const fx = dcos(k.heading);
  const fz = dsin(k.heading);
  if (k.item === ITEM.mine) {
    if (k.y >= 0.3) return; // not in mid-air
    const id = ++s.mineSeq;
    s.mines.push({ id, owner: seat, x: k.x - fx * 1.5, z: k.z - fz * 1.5, armTick: s.tick + COMBAT.mineArmTicks, dieTick: s.tick + COMBAT.mineLifeTicks });
    s.events.push({ type: 'mine_drop', seat, id });
    if (s.mines.length > COMBAT.maxMines) {
      const old = s.mines.shift()!;
      s.events.push({ type: 'mine_gone', id: old.id });
    }
  } else if (k.item === ITEM.rocket) {
    const id = ++s.rocketSeq;
    const target = rocketTarget(s, seat);
    s.rockets.push({ id, owner: seat, target, x: k.x + fx * 1.4, z: k.z + fz * 1.4, dx: fx, dz: fz, dieTick: s.tick + COMBAT.rocketLifeTicks });
    s.events.push({ type: 'rocket', seat, id, target });
  } else if (k.item === ITEM.shock) {
    let hits = 0;
    for (let j = 0; j < s.karts.length; j++) {
      if (j === seat) continue;
      const o = s.karts[j]!;
      if (!canBeHit(o)) continue;
      const dx = o.x - k.x;
      const dz = o.z - k.z;
      if (dx * dx + dz * dz > COMBAT.shockRadius * COMBAT.shockRadius) continue;
      hits++;
      if (o.bubbleTicks === 0) o.stallTicks = Math.max(o.stallTicks, COMBAT.shockStallTicks);
      damage(s, j, COMBAT.shockDamage, seat);
    }
    s.events.push({ type: 'shock', seat, x: k.x, z: k.z, hits });
  } else if (k.item === ITEM.shield) {
    k.bubbleTicks = COMBAT.bubbleTicks;
    s.events.push({ type: 'shield_up', seat });
  } else if (k.item === ITEM.overdrive) {
    k.overTicks = COMBAT.overdriveTicks;
    k.boostTicks = Math.max(k.boostTicks, COMBAT.overdriveTicks);
    s.events.push({ type: 'overdrive', seat });
  } else return;
  k.charges--;
  if (k.charges <= 0) {
    k.charges = 0;
    k.item = ITEM.none;
  }
}

/** Guns, whatever is in the slot, crates and the repair strip, once per tick after the karts have moved. */
export function stepCombat(s: RaceState, track: Track, inputs: readonly DriveInput[]): void {
  if (s.phaseTick === COMBAT.safeTicks) s.events.push({ type: 'hot' });
  const hot = s.phaseTick >= COMBAT.safeTicks;
  const kit = track.combat;

  for (let i = 0; i < s.karts.length; i++) {
    const k = s.karts[i]!;
    const inp = inputs[i];
    const able = hot && !k.finished && k.wreckTicks === 0 && k.blinkTicks === 0;

    // ── guns ──
    if (k.gunTicks > 0) k.gunTicks--;
    k.idleTicks++;
    if (able && inp?.fire === true && k.ammo > 0 && k.gunTicks === 0) {
      k.ammo--;
      k.gunTicks = COMBAT.shotTicks;
      k.idleTicks = 0;
      const target = gunTarget(s, track, i);
      s.events.push({ type: 'shot', seat: i, hit: target });
      if (target >= 0) damage(s, target, COMBAT.damage, i);
    } else if (k.ammo < COMBAT.magazine && k.idleTicks >= COMBAT.reloadDelayTicks && (k.idleTicks - COMBAT.reloadDelayTicks) % COMBAT.reloadTicks === 0) {
      k.ammo++;
    }

    // ── the slot: one press, one use ──
    if (k.bubbleTicks > 0) k.bubbleTicks--;
    if (k.overTicks > 0) k.overTicks--;
    const use = inp?.use === true;
    const pressed = use && !k.prevUse;
    k.prevUse = use;
    if (pressed && able && k.charges > 0) useItem(s, i);

    if (k.finished || k.wreckTicks > 0 || !kit) continue;

    // ── crates: each holds one thing, and taking it replaces whatever was in the slot ──
    if (k.y < 0.5) {
      const reach = COMBAT.crateRadius + KART.radius;
      for (let c = 0; c < kit.crates.length; c++) {
        if (s.tick < s.crateReady[c]!) continue;
        const p = kit.crates[c]!;
        const dx = k.x - p.x;
        const dz = k.z - p.z;
        if (dx * dx + dz * dz >= reach * reach) continue;
        const item = ITEM[p.item];
        const full = ITEM_CHARGES[p.item];
        if (k.item === item && k.charges >= full) continue; // already carrying a full load of it: leave it for somebody else
        k.item = item;
        k.charges = full;
        s.crateReady[c] = s.tick + COMBAT.crateRespawnTicks;
        s.events.push({ type: 'crate', seat: i, index: c, item: p.item });
        break;
      }
    }

    // ── the repair strip ──
    const r = kit.repair;
    if (k.armor < COMBAT.armor && k.y < 0.5 && s.tick - k.repairTick >= COMBAT.repairCooldownTicks && k.x > r.x0 && k.x < r.x1 && k.z > r.z0 && k.z < r.z1) {
      const before = k.armor;
      k.armor = Math.min(COMBAT.armor, k.armor + COMBAT.repair);
      k.repairTick = s.tick;
      s.events.push({ type: 'repair', seat: i, amount: k.armor - before });
    }
  }

  // ── mines on the ground ──
  const reach = COMBAT.mineRadius + KART.radius;
  for (let m = s.mines.length - 1; m >= 0; m--) {
    const mine = s.mines[m]!;
    if (s.tick >= mine.dieTick) {
      s.mines.splice(m, 1);
      s.events.push({ type: 'mine_gone', id: mine.id });
      continue;
    }
    if (s.tick < mine.armTick) continue;
    for (let i = 0; i < s.karts.length; i++) {
      const k = s.karts[i]!;
      if (!canBeHit(k) || k.y > 0.5) continue;
      const dx = k.x - mine.x;
      const dz = k.z - mine.z;
      if (dx * dx + dz * dz >= reach * reach) continue;
      s.mines.splice(m, 1);
      s.events.push({ type: 'mine_hit', seat: i, owner: mine.owner, id: mine.id, x: mine.x, z: mine.z });
      if (k.bubbleTicks === 0) {
        k.vx *= 0.5;
        k.vz *= 0.5;
      }
      damage(s, i, COMBAT.mineDamage, mine.owner);
      // still running: it spins once, like a hard wall hit
      if (k.wreckTicks === 0 && k.stunTicks === 0 && k.bubbleTicks === 0) k.stunTicks = KART.stunTicks;
      break;
    }
  }

  // ── rockets in flight ──
  const turn = COMBAT.rocketTurn / TICK_HZ;
  const ct = dcos(turn);
  const st = dsin(turn);
  const step = COMBAT.rocketSpeed / TICK_HZ;
  const b = track.bounds;
  for (let r = s.rockets.length - 1; r >= 0; r--) {
    const rk = s.rockets[r]!;
    // lean toward the target while it can still be hit
    const t = rk.target >= 0 ? s.karts[rk.target] : undefined;
    if (t && canBeHit(t)) {
      const tx = t.x - rk.x;
      const tz = t.z - rk.z;
      const cross = rk.dx * tz - rk.dz * tx;
      const dot = rk.dx * tx + rk.dz * tz;
      // (dead ahead: leave it; otherwise one notch toward)
      if (cross > 0.05 || cross < -0.05 || dot < 0) {
        const sgn = cross >= 0 ? 1 : -1;
        const nx = rk.dx * ct - rk.dz * st * sgn;
        rk.dz = rk.dx * st * sgn + rk.dz * ct;
        rk.dx = nx;
      }
    }
    rk.x += rk.dx * step;
    rk.z += rk.dz * step;
    let gone = s.tick >= rk.dieTick || rk.x < b.x0 || rk.x > b.x1 || rk.z < b.z0 || rk.z > b.z1;
    let struck = -1;
    if (!gone) {
      const reachR = COMBAT.rocketRadius + KART.radius;
      for (let i = 0; i < s.karts.length; i++) {
        if (i === rk.owner) continue;
        const k = s.karts[i]!;
        if (!canBeHit(k) || k.y > 0.9) continue;
        const dx = k.x - rk.x;
        const dz = k.z - rk.z;
        if (dx * dx + dz * dz >= reachR * reachR) continue;
        struck = i;
        break;
      }
      // big solid things stop a rocket as they stop a bullet
      if (struck < 0) {
        for (const c of track.circles) {
          if (c.r < COMBAT.coverRadius) continue;
          const dx = rk.x - c.x;
          const dz = rk.z - c.z;
          if (dx * dx + dz * dz < c.r * c.r) {
            gone = true;
            break;
          }
        }
      }
    }
    if (struck < 0 && !gone) continue;
    s.rockets.splice(r, 1);
    s.events.push({ type: 'rocket_hit', seat: struck, owner: rk.owner, id: rk.id, x: rk.x, z: rk.z });
    if (struck >= 0) {
      const k = s.karts[struck]!;
      if (k.bubbleTicks === 0) {
        // thrown along the rocket's path
        k.vx += rk.dx * 5;
        k.vz += rk.dz * 5;
      }
      damage(s, struck, COMBAT.rocketDamage, rk.owner);
      if (k.wreckTicks === 0 && k.stunTicks === 0 && k.bubbleTicks === 0) k.stunTicks = KART.stunTicks;
    }
  }
}

/** Two karts have just collided with this closing speed along the normal from a to b. */
export function ram(s: RaceState, a: number, b: number, closing: number, nx: number, nz: number): void {
  if (!weaponsHot(s)) return;
  const ka = s.karts[a]!;
  const kb = s.karts[b]!;
  if (!canBeHit(ka) || !canBeHit(kb)) return;
  // overdrive: whatever it touches has been rammed, and it does not feel a thing
  if ((ka.overTicks > 0) !== (kb.overTicks > 0)) {
    if (closing <= 1) return;
    const attacker = ka.overTicks > 0 ? a : b;
    const victim = attacker === a ? b : a;
    const v = s.karts[victim]!;
    if (s.tick - v.ramTick < COMBAT.ramCooldownTicks) return;
    v.ramTick = s.tick;
    s.events.push({ type: 'ram', seat: victim, by: attacker, damage: COMBAT.overdriveRam });
    damage(s, victim, COMBAT.overdriveRam, attacker);
    return;
  }
  if (closing <= COMBAT.ramMin) return;
  const amount = Math.min(COMBAT.ramMax, (closing - COMBAT.ramMin) * COMBAT.ramPerSpeed);
  // whoever was moving harder into the other is the rammer
  const va = ka.vx * nx + ka.vz * nz;
  const vb = -(kb.vx * nx + kb.vz * nz);
  const attacker = va >= vb ? a : b;
  const victim = attacker === a ? b : a;
  const v = s.karts[victim]!;
  if (s.tick - v.ramTick < COMBAT.ramCooldownTicks) return;
  v.ramTick = s.tick;
  s.events.push({ type: 'ram', seat: victim, by: attacker, damage: amount });
  damage(s, victim, amount, attacker);
  damage(s, attacker, amount * COMBAT.ramSelf, -1);
}

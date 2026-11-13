/**
 * Backyard Dash — the combat layer.
 *
 * Every kart carries the same kit: armour, twin forward guns with a small magazine, and room for
 * two mines. Nothing here is chosen, bought or random. Pure and deterministic like the rest of
 * the simulation (core/dmath arithmetic only); it runs only when the race was created with
 * `combat: true`, and a race without it plays exactly as it did before this file existed.
 *
 * The rules in one paragraph: guns are locked for a few seconds after GO. Hold FIRE and the guns
 * shoot straight ahead; a rival inside a narrow cone, in range and not behind something big,
 * loses armour. The magazine refills by itself once you stop shooting. Crates on the road refill
 * your mines; a mine dropped behind you arms after a moment and takes a large bite out of
 * whoever drives over it, you included. Hard rams hurt the kart that is hit, hard wall hits
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
  carry: 2,
  mineDamage: 35,
  mineRadius: 1.1,
  mineArmTicks: 36,
  mineLifeTicks: 20 * TICK_HZ,
  maxMines: 10,
  crateRadius: 1.0,
  crateRespawnTicks: 15 * TICK_HZ,
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

/** Guns, mines, crates and the repair strip, once per tick after the karts have moved. */
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

    // ── mines ──
    const drop = inp?.drop === true;
    const pressed = drop && !k.prevDrop;
    k.prevDrop = drop;
    if (pressed && able && k.mines > 0 && k.y < 0.3) {
      k.mines--;
      const id = ++s.mineSeq;
      s.mines.push({
        id, owner: i,
        x: k.x - dcos(k.heading) * 1.5, z: k.z - dsin(k.heading) * 1.5,
        armTick: s.tick + COMBAT.mineArmTicks, dieTick: s.tick + COMBAT.mineLifeTicks,
      });
      s.events.push({ type: 'mine_drop', seat: i, id });
      if (s.mines.length > COMBAT.maxMines) {
        const old = s.mines.shift()!;
        s.events.push({ type: 'mine_gone', id: old.id });
      }
    }

    if (k.finished || k.wreckTicks > 0 || !kit) continue;

    // ── crates: a refill of mines ──
    if (k.mines < COMBAT.carry && k.y < 0.5) {
      const reach = COMBAT.crateRadius + KART.radius;
      for (let c = 0; c < kit.crates.length; c++) {
        if (s.tick < s.crateReady[c]!) continue;
        const p = kit.crates[c]!;
        const dx = k.x - p.x;
        const dz = k.z - p.z;
        if (dx * dx + dz * dz >= reach * reach) continue;
        k.mines = COMBAT.carry;
        s.crateReady[c] = s.tick + COMBAT.crateRespawnTicks;
        s.events.push({ type: 'crate', seat: i, index: c });
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
      k.vx *= 0.5;
      k.vz *= 0.5;
      damage(s, i, COMBAT.mineDamage, mine.owner);
      // still running: it spins once, like a hard wall hit
      if (k.wreckTicks === 0 && k.stunTicks === 0) k.stunTicks = KART.stunTicks;
      break;
    }
  }
}

/** Two karts have just collided with this closing speed along the normal from a to b. */
export function ram(s: RaceState, a: number, b: number, closing: number, nx: number, nz: number): void {
  if (!weaponsHot(s) || closing <= COMBAT.ramMin) return;
  const ka = s.karts[a]!;
  const kb = s.karts[b]!;
  if (!canBeHit(ka) || !canBeHit(kb)) return;
  const amount = Math.min(COMBAT.ramMax, (closing - COMBAT.ramMin) * COMBAT.ramPerSpeed);
  // whoever was moving harder into the other is the rammer
  const va = ka.vx * nx + ka.vz * nz;
  const vb = -(kb.vx * nx + kb.vz * nz);
  const attacker = va >= vb ? a : b;
  const victim = attacker === a ? b : a;
  s.events.push({ type: 'ram', seat: victim, by: attacker, damage: amount });
  damage(s, victim, amount, attacker);
  damage(s, attacker, amount * COMBAT.ramSelf, -1);
}

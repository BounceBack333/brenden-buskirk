/**
 * "Buddy" — the labelled bot partner for solo play.
 *
 * It plays through exactly the same PlayerInput as a person and only ever looks at the public
 * simulation state, so it cannot do anything a human could not. It is deliberately imperfect:
 * a partner who never misses leaves the human with nothing to contribute.
 */
import { Rng, clamp } from '../../core/dmath';
import { TICK_HZ, TIMING, TUNE } from './rules';
import { arenaOf, catcherSeat, forecastFlight, forecastLaunch, noInput } from './sim';
import type { CourierState, PlayerInput } from './sim';

export interface BotOptions {
  seed: number;
  /** 0 = clumsy … 1 = sharp */
  skill: number;
}

interface LaunchPlan {
  aimQ: number;
  powerQ: number;
  startTick: number;
  holdTicks: number;
}

export class BuddyBot {
  private rng: Rng;
  private skill: number;
  private out: PlayerInput = noInput();

  // catcher memory
  private targetX = NaN;
  private nextThink = 0;
  private readError = 0;
  /** a per-flight misjudgement that only partly corrects as the flyer comes down */
  private flightBias = 0;
  private biasLaunch = -1;

  // launcher memory
  private plan: LaunchPlan | null = null;
  private planLaunch = -1;
  private scan: { launch: number; aimQ: number; powerQ: number; mood: number; picks: { aimQ: number; powerQ: number; score: number }[] } | null = null;
  private holdUmbrella = false;
  private nextUmbrellaThink = 0;

  constructor(opts: BotOptions) {
    this.rng = new Rng(opts.seed);
    this.skill = clamp(opts.skill, 0, 1);
  }

  /** Produce this tick's input for `seat`. */
  think(s: CourierState, seat: 0 | 1): PlayerInput {
    const o = this.out;
    o.pull = false;
    o.umbrella = false;
    o.move = 0;
    o.dive = false;
    if (s.phase === 'done' || s.phase === 'outcome') return o;
    if (seat === s.launcherSeat) this.thinkLauncher(s, o);
    else if (seat === catcherSeat(s)) this.thinkCatcher(s, o);
    return o;
  }

  // ── catching ──

  private thinkCatcher(s: CourierState, o: PlayerInput): void {
    const c = s.catcher;
    const arena = arenaOf(s);
    const period = 3 + Math.round((1 - this.skill) * 9);
    let landTicks = 9999;

    if (s.tick >= this.nextThink) {
      this.nextThink = s.tick + period;
      if (s.phase === 'flight') {
        const f = s.flyer;
        const holding = f.open > 0.5;
        const fc = forecastFlight(
          s,
          { x: f.x, y: f.y, vx: f.vx, vy: f.vy, open: f.open, budget: f.budget, spent: f.spent },
          360,
          holding ? () => true : null,
          null,
        );
        landTicks = fc.landTicks;
        if (this.biasLaunch !== s.launchIndex) {
          this.biasLaunch = s.launchIndex;
          this.flightBias = this.rng.gauss() * (0.24 + (1 - this.skill) * 0.9);
        }
        if (!Number.isNaN(fc.landX)) {
          // The further away the landing is in time, the worse the read; some of the
          // misjudgement survives right to the end, like a real outfielder's.
          const far = Math.min(1, fc.landTicks / 90);
          const blur = (1 - this.skill) * 0.9 * far;
          this.targetX = fc.landX + this.rng.gauss() * blur + this.flightBias * (0.45 + 0.55 * far);
        }
        this.lastLandTicks = fc.landTicks;
      } else if (s.aim.pulling && s.aim.powerQ >= TIMING.minPowerQ) {
        // Reading the bend of the spoon: a rough guess, refreshed now and then.
        const fc = forecastLaunch(s, s.aim.aimQ, s.aim.powerQ, 360);
        if (s.tick % (period * 6) < period) this.readError = this.rng.gauss() * (0.8 + (1 - this.skill) * 2);
        if (!Number.isNaN(fc.landX)) this.targetX = fc.landX + this.readError;
      } else {
        this.targetX = (arena.laneMin + arena.laneMax) / 2;
      }
    }
    landTicks = s.phase === 'flight' ? this.lastLandTicks - (s.tick - (this.nextThink - period)) : 9999;

    if (Number.isNaN(this.targetX)) return;
    const tx = clamp(this.targetX, arena.laneMin, arena.laneMax);
    const d = tx - c.x;
    o.move = Math.round(clamp(d / 0.4, -1, 1) * 127);

    if (s.phase === 'flight' && c.mode === 'run' && landTicks > 2 && landTicks < 20) {
      const runReach = (TUNE.catcher.maxSpeed * landTicks) / TICK_HZ;
      const need = Math.abs(d);
      if (need > runReach + 0.25 && need < runReach + 2.4 && this.rng.next() < 0.25 + this.skill * 0.6) {
        o.move = d > 0 ? 127 : -127;
        o.dive = true;
      }
    }
  }
  private lastLandTicks = 9999;

  // ── launching ──

  private thinkLauncher(s: CourierState, o: PlayerInput): void {
    if (s.phase === 'intro' || s.phase === 'aim') {
      if (this.planLaunch !== s.launchIndex) {
        // A few forecasts per tick, spread over the intro, instead of one big hitch.
        const done = this.scanStep(s, s.phase === 'intro' ? 24 : 120);
        if (!done) return;
        this.plan = this.finishPlan(s);
        this.planLaunch = s.launchIndex;
        this.holdUmbrella = false;
      }
      if (s.phase === 'intro') return;
      const p = this.plan!;
      const t = s.tick - p.startTick;
      if (t < 0) return;
      const drawTicks = 54;
      if (t < drawTicks + p.holdTicks) {
        const k = Math.min(1, t / drawTicks);
        const ease = k * k * (3 - 2 * k);
        // settle onto the aim with a small visible wobble so a human catcher can read it
        const wobble = (1 - ease) * 60 * (((t >> 3) & 1) === 0 ? 1 : -1);
        o.pull = true;
        o.aimQ = Math.round(clamp(p.aimQ + wobble, 0, 1023));
        o.powerQ = Math.round(clamp(p.powerQ * ease, 0, 255));
      }
      // otherwise: pull is false → the sim sees the release and launches
      return;
    }
    if (s.phase === 'flight') {
      const f = s.flyer;
      if (f.spent || f.budget <= 0) return;
      if (s.tick >= this.nextUmbrellaThink) {
        this.nextUmbrellaThink = s.tick + 5 + Math.round((1 - this.skill) * 6);
        const start = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, open: f.open, budget: f.budget, spent: f.spent };
        const closed = forecastFlight(s, start, 300, null, null);
        const opened = forecastFlight(s, start, 300, () => true, null);
        const cx = s.catcher.bx;
        const eClosed = Number.isNaN(closed.landX) ? 99 : Math.abs(closed.landX - cx);
        const eOpen = Number.isNaN(opened.landX) ? 99 : Math.abs(opened.landX - cx);
        // Only bother when it clearly helps, and never on the way up.
        const margin = this.holdUmbrella ? -0.1 : 0.35;
        this.holdUmbrella = f.vy < 1.1 && eOpen + margin < eClosed;
      }
      o.umbrella = this.holdUmbrella;
    }
  }

  /** Evaluate up to `budget` candidate launches. Returns true when the whole grid is scanned. */
  private scanStep(s: CourierState, budget: number): boolean {
    const arena = arenaOf(s);
    if (!this.scan || this.scan.launch !== s.launchIndex) {
      // Each launch Buddy fancies a slightly different spot, so the catcher has to move.
      const mood = clamp(s.catcher.x + this.rng.gauss() * 2.5, arena.laneMin + 1.2, arena.laneMax - 1.2);
      this.scan = { launch: s.launchIndex, aimQ: 60, powerQ: 48, mood, picks: [] };
    }
    const sc = this.scan;
    while (budget-- > 0 && sc.aimQ <= 960) {
      const f = forecastLaunch(s, sc.aimQ, sc.powerQ, 300);
      if (!f.dead && !Number.isNaN(f.landX) && f.landX >= arena.laneMin + 0.8 && f.landX <= arena.laneMax - 0.8) {
        let score = 100 - Math.abs(f.landX - sc.mood) * 4;
        score += f.rings * 45;
        if (f.jelly) score += 12;
        if (f.landTicks < 95) score -= (95 - f.landTicks) * 0.8; // give the catcher time
        sc.picks.push({ aimQ: sc.aimQ, powerQ: sc.powerQ, score });
      }
      sc.powerQ += 9;
      if (sc.powerQ > 255) {
        sc.powerQ = 48;
        sc.aimQ += 30;
      }
    }
    return sc.aimQ > 960;
  }

  private finishPlan(s: CourierState): LaunchPlan {
    const picks = this.scan ? this.scan.picks : [];
    this.scan = null;
    picks.sort((a, b) => b.score - a.score);
    const pool = Math.max(1, Math.min(picks.length, 1 + Math.round((1 - this.skill) * 10)));
    const pick = picks.length > 0 ? picks[Math.floor(this.rng.next() * pool)]! : { aimQ: 520, powerQ: 180, score: 0 };
    const slop = 1 - this.skill;
    return {
      aimQ: Math.round(clamp(pick.aimQ + this.rng.gauss() * slop * 34, 0, 1023)),
      powerQ: Math.round(clamp(pick.powerQ + this.rng.gauss() * slop * 20, TIMING.minPowerQ + 8, 255)),
      startTick: s.tick + 24 + this.rng.int(0, 30) + (s.phase === 'intro' ? TIMING.intro - s.phaseTick : 0),
      holdTicks: 26 + this.rng.int(0, 22),
    };
  }
}

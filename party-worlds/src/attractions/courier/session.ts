/**
 * One round of Catapult Courier on this device: owns the simulation state, gathers inputs for
 * each seat (touch, or the labelled bot), steps the sim and tells the view/HUD what happened.
 */
import type { Hud } from '../../ui/hud';
import { BuddyBot } from './bot';
import type { CourierControls } from './controls';
import { catcherSeat, createCourier, noInput, stepCourier } from './sim';
import type { CourierState, PlayerInput } from './sim';
import { setupOf } from './sim';
import type { CourierView } from './view';

export type SeatKind = 'human' | 'bot';

export interface SessionConfig {
  seats: [SeatKind, SeatKind];
  names: [string, string];
  arenaId: string;
  launches: number;
  botSkill: number;
  seed: number;
  firstLauncher: 0 | 1;
}

export class CourierSession {
  state: CourierState;
  paused = false;
  onDone: ((s: CourierState) => void) | null = null;
  /** total simulated ticks, for the perf overlay */
  ticks = 0;

  private bots: [BuddyBot | null, BuddyBot | null];
  private inputs: [PlayerInput, PlayerInput] = [noInput(), noInput()];
  private doneFired = false;
  private catcherTravel = 0;
  private lastCatcherX = 0;

  constructor(
    private view: CourierView,
    private controls: CourierControls,
    private hud: Hud,
    readonly config: SessionConfig,
  ) {
    this.state = createCourier({ arenaId: config.arenaId, launches: config.launches, firstLauncher: config.firstLauncher });
    this.bots = [
      config.seats[0] === 'bot' ? new BuddyBot({ seed: config.seed * 3 + 1, skill: config.botSkill }) : null,
      config.seats[1] === 'bot' ? new BuddyBot({ seed: config.seed * 5 + 2, skill: config.botSkill }) : null,
    ];
    controls.humans = [config.seats[0] === 'human', config.seats[1] === 'human'];
    controls.reset();
    controls.enabled = true;
    view.beginRound(this.state);
    this.lastCatcherX = this.state.catcher.x;
    this.announce();
  }

  private announce(): void {
    const s = this.state;
    const L = s.launcherSeat;
    const C = catcherSeat(s);
    const wind = setupOf(s).wind;
    const windText = wind === 0 ? '' : wind < 0 ? ' · headwind!' : ' · tailwind!';
    const last = s.launchIndex === s.launches - 1 ? ' · last one!' : '';
    this.hud.showBanner(
      `${this.config.names[L]} launches`,
      `${this.config.names[C]} catches · ${s.launchIndex + 1} of ${s.launches}${windText}${last}`,
      1900,
    );
  }

  tick(): void {
    const s = this.state;
    if (this.paused || s.phase === 'done') return;
    this.controls.sample(s);
    for (const seat of [0, 1] as const) {
      const bot = this.bots[seat];
      this.inputs[seat] = bot ? bot.think(s, seat) : this.controls.inputs[seat];
    }
    this.view.beforeTick(s);
    stepCourier(s, this.inputs);
    this.ticks++;
    this.view.afterTick(s);

    // the HUD's hints fade once the player has actually done the thing
    const C = catcherSeat(s);
    for (const e of s.events) {
      if (e.type === 'phase' && e.phase === 'intro') this.announce();
      else if (e.type === 'launch' && this.config.seats[s.launcherSeat] === 'human') this.hud.learn('pull');
      else if (e.type === 'umbrella' && e.open && this.config.seats[s.launcherSeat] === 'human') this.hud.learn('umbrella');
      else if (e.type === 'dive' && this.config.seats[C] === 'human') this.hud.learn('dive');
    }
    if (this.config.seats[C] === 'human') {
      this.catcherTravel += Math.abs(s.catcher.x - this.lastCatcherX);
      if (this.catcherTravel > 6) this.hud.learn('run');
    }
    this.lastCatcherX = s.catcher.x;

    if ((s.phase as string) === 'done' && !this.doneFired) {
      this.doneFired = true;
      this.controls.enabled = false;
      this.controls.reset();
      this.onDone?.(s);
    }
  }

  dispose(): void {
    this.controls.enabled = false;
    this.controls.reset();
  }
}

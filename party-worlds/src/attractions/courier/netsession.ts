/**
 * One online round of Catapult Courier, seen from one player's device.
 *
 * The server is the authority. This class keeps what you see responsive anyway:
 *   - every local tick it sends your input and steps a local copy of the round with it,
 *   - every snapshot it rewinds to the server's state and replays your not-yet-acknowledged
 *     inputs on top (the same deterministic sim, so the replay normally lands exactly where
 *     the local copy already was),
 *   - it never predicts past a catch or a miss: outcomes and scores only ever come from the server.
 */
import type { Hud } from '../../ui/hud';
import type { RoomClient, SnapMsg } from '../../net/client';
import { packInput, unpackInput } from '../../net/protocol';
import type { CourierControls } from './controls';
import { catcherSeat, cloneCourier, createCourier, noInput, setupOf, stepCourier } from './sim';
import type { CourierEvent, CourierState, PlayerInput } from './sim';
import type { CourierView } from './view';

const LAUNCHER_ACTIONS = new Set(['launch', 'aim_cancel', 'umbrella', 'umbrella_spent']);
const CATCHER_ACTIONS = new Set(['dive', 'skid', 'step']);

export class NetCourierSession {
  state: CourierState;
  paused = false;
  onDone: ((s: CourierState) => void) | null = null;
  ticks = 0;
  /** how many snapshots needed a visible correction (for the debug overlay and tests) */
  corrections = 0;
  snapshots = 0;

  private pending: { n: number; input: PlayerInput }[] = [];
  private n = 0;
  private other: PlayerInput = noInput();
  private inputs: [PlayerInput, PlayerInput] = [noInput(), noInput()];
  private predictedLaunch = -1;
  private gotFirstSnap = false;
  private doneFired = false;
  private readonly you: 0 | 1;

  constructor(
    private view: CourierView,
    private controls: CourierControls,
    private hud: Hud,
    private client: RoomClient,
    you: 0 | 1,
    private names: [string, string],
    start: { arenaId: string; launches: number; firstLauncher: 0 | 1 },
  ) {
    this.you = you;
    this.state = createCourier({ arenaId: start.arenaId, launches: start.launches, firstLauncher: start.firstLauncher });
    controls.humans = [you === 0, you === 1];
    view.localSeats = [you === 0, you === 1];
    controls.reset();
    controls.enabled = true;
    view.beginRound(this.state);
    this.announce(this.state);
    client.onSnap = (msg) => this.onSnap(msg);
    client.onPaused = (seat, left) => {
      this.paused = true;
      this.hud.showBanner(`${this.names[seat]} lost connection`, `Holding the round · ${left} s`, 1500);
    };
    client.onResumed = (bot) => {
      this.paused = false;
      if (bot) this.hud.showBanner('Buddy is stepping in', 'A bot finishes this round for them', 2200);
    };
  }

  private announce(s: CourierState): void {
    const L = s.launcherSeat;
    const C = catcherSeat(s);
    const wind = setupOf(s).wind;
    const windText = wind === 0 ? '' : wind < 0 ? ' · headwind!' : ' · tailwind!';
    const who = L === this.you ? 'You launch' : `${this.names[L]} launches`;
    const sub = C === this.you ? 'You catch' : `${this.names[C]} catches`;
    this.hud.showBanner(who, `${sub} · ${s.launchIndex + 1} of ${s.launches}${windText}`, 1900);
  }

  /** Phases in which stepping ahead of the server is safe: no outcome, no role swap. */
  private canPredict(s: CourierState): boolean {
    return s.phase === 'intro' || s.phase === 'aim' || s.phase === 'flight';
  }

  private pair(mine: PlayerInput): readonly [PlayerInput, PlayerInput] {
    this.inputs[this.you] = mine;
    this.inputs[this.you === 0 ? 1 : 0] = this.other;
    return this.inputs;
  }

  private isOwnAction(e: CourierEvent, s: CourierState): boolean {
    if (s.launcherSeat === this.you) return LAUNCHER_ACTIONS.has(e.type);
    return CATCHER_ACTIONS.has(e.type);
  }

  /** Local 60 Hz tick: send input, step the local copy. */
  tick(): void {
    if (!this.gotFirstSnap || this.doneFired) return;
    const s = this.state;
    this.controls.sample(s);
    if (this.paused) return;
    const mine: PlayerInput = { ...this.controls.inputs[this.you] };
    this.client.send({ t: 'input', n: this.n, i: packInput(mine) });
    this.pending.push({ n: this.n, input: mine });
    this.n++;
    if (this.pending.length > 45) this.pending.shift();
    this.ticks++;

    if (!this.canPredict(s)) return;
    this.view.beforeTick(s);
    stepCourier(s, this.pair(mine));
    // Only things I caused are presented from the local copy; the rest waits for the server.
    const own: CourierEvent[] = [];
    for (const e of s.events) {
      if (!this.isOwnAction(e, s)) continue;
      own.push(e);
      if (e.type === 'launch') {
        this.predictedLaunch = s.launchIndex;
        this.hud.learn('pull');
      } else if (e.type === 'umbrella' && e.open) this.hud.learn('umbrella');
      else if (e.type === 'dive') this.hud.learn('dive');
    }
    if (own.length) this.view.applyEvents(s, own);
  }

  private onSnap(msg: SnapMsg): void {
    this.snapshots++;
    const auth: CourierState = { ...msg.s, events: [] };
    unpackInput(msg.other, this.other);
    while (this.pending.length && this.pending[0]!.n <= msg.ack) this.pending.shift();

    // Rewind to the server's truth and replay what it has not seen yet.
    const next = cloneCourier(auth);
    for (const p of this.pending) {
      if (!this.canPredict(next)) break;
      stepCourier(next, this.pair(p.input));
    }
    const prev = this.state;
    if (this.gotFirstSnap && this.canPredict(prev) && this.canPredict(next)) {
      const err = Math.abs(prev.flyer.x - next.flyer.x) + Math.abs(prev.flyer.y - next.flyer.y) + Math.abs(prev.catcher.x - next.catcher.x);
      if (err > 0.05) this.corrections++;
    }
    this.state = next;
    this.gotFirstSnap = true;

    // Present the server's events, except my own actions that were already shown locally.
    const show: CourierEvent[] = [];
    for (const e of msg.ev) {
      if (e.type === 'launch') {
        if (auth.launcherSeat === this.you && this.predictedLaunch === auth.launchIndex) continue;
      } else if (this.isOwnAction(e, auth)) {
        continue;
      }
      show.push(e);
      if (e.type === 'phase' && e.phase === 'intro') this.announce(auth);
    }
    if (show.length) this.view.applyEvents(next, show);

    if (auth.phase === 'done' && !this.doneFired) {
      this.doneFired = true;
      this.controls.enabled = false;
      this.controls.reset();
      this.onDone?.(next);
    }
  }

  dispose(): void {
    this.controls.enabled = false;
    this.controls.reset();
    this.client.onSnap = null;
    this.client.onPaused = null;
    this.client.onResumed = null;
  }
}

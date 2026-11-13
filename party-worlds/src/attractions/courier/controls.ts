/**
 * Catapult Courier — turns touches / mouse / keys into PlayerInput for each human seat.
 *
 * Launcher: drag back anywhere in your area, let go to fly. In the air, hold to open the umbrella.
 * Catcher:  drag left/right to run. Dive with the DIVE button, a quick tap, or a second finger.
 *
 * One human → the whole screen is theirs. Two humans on one screen → seat 0 owns the left half,
 * seat 1 the right half, whatever their role this launch.
 */
import { DEG, clamp } from '../../core/dmath';
import type { Pointers, Ptr } from '../../core/pointers';
import type { Settings } from '../../core/profile';
import type { StageSize } from '../../core/viewport';
import { TIMING, TUNE } from './rules';
import { catcherSeat, noInput } from './sim';
import type { CourierState, PlayerInput } from './sim';

export interface StickVisual {
  seat: 0 | 1;
  active: boolean;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export interface PullVisual {
  seat: 0 | 1;
  active: boolean;
  sx: number;
  sy: number;
  x: number;
  y: number;
  power01: number;
}

export class CourierControls {
  readonly inputs: [PlayerInput, PlayerInput] = [noInput(), noInput()];
  /** which seats are driven by this device's touches */
  humans: [boolean, boolean] = [true, false];
  stick: StickVisual = { seat: 0, active: false, ox: 0, oy: 0, x: 0, y: 0 };
  pull: PullVisual = { seat: 0, active: false, sx: 0, sy: 0, x: 0, y: 0, power01: 0 };
  /** set by the DIVE button for a seat */
  diveButton: [boolean, boolean] = [false, false];
  enabled = false;

  private state: CourierState | null = null;
  private size: StageSize = { width: 1280, height: 720, rotated: false };
  private pullPtr: Ptr | null = null;
  private stickPtr: Ptr | null = null;
  private umbrellaPtrs = new Set<number>();
  private umbrellaLatched = false;
  private tapDive: [number, number] = [0, 0]; // ticks of synthetic dive press remaining
  private keyPull = 0;

  constructor(private pointers: Pointers, private settings: Settings) {}

  attach(): void {
    this.pointers.onDown = (p) => this.onDown(p);
    this.pointers.onMove = (p) => this.onMove(p);
    this.pointers.onUp = (p, cancelled) => this.onUp(p, cancelled);
    this.pointers.onKey = (code, down) => this.onKey(code, down);
  }

  detach(): void {
    this.pointers.onDown = null;
    this.pointers.onMove = null;
    this.pointers.onUp = null;
    this.pointers.onKey = null;
    this.reset();
  }

  setStageSize(size: StageSize): void {
    this.size = size;
  }

  reset(): void {
    this.pullPtr = null;
    this.stickPtr = null;
    this.umbrellaPtrs.clear();
    this.umbrellaLatched = false;
    this.stick.active = false;
    this.pull.active = false;
    this.pull.power01 = 0;
    this.keyPull = 0;
    this.tapDive = [0, 0];
    this.inputs[0] = noInput();
    this.inputs[1] = noInput();
  }

  private shared(): boolean {
    return this.humans[0] && this.humans[1];
  }

  /** Which human seat owns a point on the stage, or null. */
  private seatAt(x: number): 0 | 1 | null {
    if (this.shared()) return x < this.size.width / 2 ? 0 : 1;
    if (this.humans[0]) return 0;
    if (this.humans[1]) return 1;
    return null;
  }

  private onDown(p: Ptr): void {
    const s = this.state;
    if (!this.enabled || !s) return;
    const seat = this.seatAt(p.x);
    if (seat === null) return;
    if (seat === s.launcherSeat) {
      if (s.phase === 'aim' || s.phase === 'intro') {
        if (!this.pullPtr) {
          this.pullPtr = p;
          p.role = 'pull';
          this.pull.seat = seat;
          this.pull.active = true;
          this.pull.sx = p.x;
          this.pull.sy = p.y;
          this.pull.x = p.x;
          this.pull.y = p.y;
          this.pull.power01 = 0;
        }
      } else if (s.phase === 'flight') {
        p.role = 'umbrella';
        if (this.settings.umbrellaToggle) this.umbrellaLatched = !this.umbrellaLatched;
        else this.umbrellaPtrs.add(p.id);
      }
    } else if (seat === catcherSeat(s)) {
      if (!this.stickPtr) {
        this.stickPtr = p;
        p.role = 'stick';
        this.stick.seat = seat;
        this.stick.active = true;
        this.stick.ox = p.x;
        this.stick.oy = p.y;
        this.stick.x = p.x;
        this.stick.y = p.y;
      } else {
        // a second finger in the catcher's area is a dive
        p.role = 'dive';
        this.tapDive[seat] = 3;
      }
    }
  }

  private onMove(p: Ptr): void {
    if (p === this.pullPtr) {
      this.pull.x = p.x;
      this.pull.y = p.y;
    } else if (p === this.stickPtr) {
      const r = this.stickRadius();
      this.stick.x = p.x;
      this.stick.y = p.y;
      // floating stick: the origin trails the thumb so you never run out of travel
      const dx = p.x - this.stick.ox;
      if (dx > r) this.stick.ox = p.x - r;
      else if (dx < -r) this.stick.ox = p.x + r;
    }
  }

  private onUp(p: Ptr, cancelled: boolean): void {
    if (p === this.pullPtr) {
      this.pullPtr = null;
      this.pull.active = false;
      if (cancelled) this.pull.power01 = 0;
    } else if (p === this.stickPtr) {
      this.stickPtr = null;
      this.stick.active = false;
      // a quick tap without travel is a dive (one-thumb play)
      const quick = performance.now() - p.downAt < 220 && p.moved < this.size.height * 0.04;
      if (quick && !cancelled) this.tapDive[this.stick.seat] = 3;
    }
    this.umbrellaPtrs.delete(p.id);
  }

  private onKey(code: string, down: boolean): void {
    const s = this.state;
    if (!this.enabled || !s) return;
    if (down && this.settings.umbrellaToggle && (code === 'Space' || code === 'KeyW' || code === 'ArrowUp')) {
      if (s.phase === 'flight') this.umbrellaLatched = !this.umbrellaLatched;
    }
  }

  private stickRadius(): number {
    return Math.max(28, this.size.height * 0.1);
  }

  /** Build this tick's inputs for the human seats. Call once per simulation tick. */
  sample(s: CourierState): void {
    this.state = s;
    const keys = this.pointers.keys;
    for (const seat of [0, 1] as const) {
      if (!this.humans[seat]) continue;
      const inp = this.inputs[seat];
      inp.pull = false;
      inp.umbrella = false;
      inp.move = 0;
      inp.dive = false;

      if (seat === s.launcherSeat) {
        if (s.phase === 'aim' || s.phase === 'intro') {
          if (this.pullPtr && this.pull.seat === seat) {
            const dx = this.pull.sx - this.pull.x;
            const dy = this.pull.y - this.pull.sy; // screen y is down; pulling down launches up
            const len = Math.sqrt(dx * dx + dy * dy);
            const maxPull = this.size.height * 0.36;
            const power = clamp(len / maxPull, 0, 1);
            let ang = Math.atan2(dy, Math.max(dx, 0.0001)) / DEG;
            if (len < 6) ang = (TUNE.aimMinDeg + TUNE.aimMaxDeg) / 2;
            ang = clamp(ang, TUNE.aimMinDeg, TUNE.aimMaxDeg);
            inp.pull = s.phase === 'aim';
            inp.aimQ = Math.round(((ang - TUNE.aimMinDeg) / (TUNE.aimMaxDeg - TUNE.aimMinDeg)) * 1023);
            inp.powerQ = Math.round(power * 255);
            this.pull.power01 = power;
          } else if (keys.has('Space') && !this.shared()) {
            // keyboard fallback: hold space to draw, release to fire at a fixed 48°
            this.keyPull = Math.min(1, this.keyPull + 1 / 70);
            inp.pull = s.phase === 'aim';
            inp.aimQ = 500;
            inp.powerQ = Math.round(this.keyPull * 255);
            this.pull.power01 = this.keyPull;
          } else {
            this.keyPull = 0;
            if (!this.pullPtr) this.pull.power01 = 0;
          }
        } else if (s.phase === 'flight') {
          if (this.pullPtr) {
            // the launch finger lifted or the timer fired; forget the pull
            this.pullPtr.role = '';
            this.pullPtr = null;
            this.pull.active = false;
          }
          const keyHold = !this.shared() && (keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp'));
          inp.umbrella = this.settings.umbrellaToggle
            ? this.umbrellaLatched
            : this.umbrellaPtrs.size > 0 || keyHold;
          this.pull.power01 = 0;
        } else {
          this.umbrellaLatched = false;
          this.umbrellaPtrs.clear();
        }
      } else if (seat === catcherSeat(s)) {
        let axis = 0;
        if (this.stickPtr && this.stick.seat === seat) {
          const r = this.stickRadius();
          const dx = this.stick.x - this.stick.ox;
          const dead = r * 0.14;
          if (Math.abs(dx) > dead) axis = clamp((Math.abs(dx) - dead) / (r - dead), 0, 1) * (dx > 0 ? 1 : -1);
        }
        if (!this.shared() || seat === 0) {
          if (keys.has('KeyA') || keys.has('ArrowLeft')) axis = -1;
          if (keys.has('KeyD') || keys.has('ArrowRight')) axis = 1;
        }
        inp.move = Math.round(axis * 127);
        const keyDive = (!this.shared() || seat === 0) && (keys.has('ShiftLeft') || keys.has('KeyS') || keys.has('ArrowDown') || keys.has('Enter'));
        inp.dive = this.diveButton[seat] || keyDive || this.tapDive[seat] > 0;
        if (this.tapDive[seat] > 0) this.tapDive[seat]--;
      }
    }
    if (s.phase === 'outcome' || s.phase === 'done') {
      this.umbrellaLatched = false;
    }
  }

  /** True while a real (above-threshold) pull is in progress; used for hints. */
  get pullingHard(): boolean {
    return this.pull.active && this.pull.power01 * 255 >= TIMING.minPowerQ;
  }
}

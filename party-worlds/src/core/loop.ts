/**
 * Fixed-step game loop: simulation ticks at exactly 60 Hz regardless of display rate,
 * rendering interpolates with `alpha`. Big frame gaps (tab switch, phone call) are clamped
 * so the sim never spirals trying to catch up.
 */
export interface LoopHandlers {
  /** advance the simulation exactly one tick */
  tick(): void;
  /** draw; alpha = how far between the previous tick and the current one, dt = real seconds since last frame */
  frame(alpha: number, dt: number): void;
  /**
   * Called once, after the loop has stopped itself, because tick or frame keeps throwing
   * (see FAULT_LIMIT). Without it a throw is not caught at all.
   */
  fault?(error: unknown): void;
}

/**
 * An occasional bad frame is survivable; a game that keeps failing has stopped working.
 * Each failed frame adds one to a count and each clean frame takes FAULT_LEAK off it, so the
 * loop stops after this many failures in a row, or a little later if more than about one
 * frame in three is failing.
 */
export const FAULT_LIMIT = 20;
const FAULT_LEAK = 0.5;

export class FixedLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private faults = 0;
  /** 1 = normal. The view may lower this briefly for hit-stop after an outcome is resolved. */
  timeScale = 1;
  /** rolling frame time in ms, for the perf overlay */
  frameMs = 16.7;

  constructor(private handlers: LoopHandlers, private stepSeconds = 1 / 60) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.faults = 0;
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
      this.acc += dt * this.timeScale;
      if (!this.handlers.fault) {
        this.advance(dt);
        return;
      }
      try {
        this.advance(dt);
        this.faults = Math.max(0, this.faults - FAULT_LEAK);
      } catch (error) {
        // The next frame is already booked, so a bad frame costs one frame. A tick that failed
        // is tried again then, without a backlog building up behind it.
        this.acc = Math.min(this.acc, this.stepSeconds);
        if (this.faults === 0) console.error(error);
        this.faults++;
        if (this.faults >= FAULT_LIMIT) {
          this.stop();
          this.handlers.fault(error);
        }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private advance(dt: number): void {
    let steps = 0;
    while (this.acc >= this.stepSeconds && steps < 6) {
      this.handlers.tick();
      this.acc -= this.stepSeconds;
      steps++;
    }
    if (steps === 6) this.acc = 0;
    this.handlers.frame(this.acc / this.stepSeconds, dt);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }
}

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
}

export class FixedLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
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
    const loop = (now: number): void => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;
      this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
      this.acc += dt * this.timeScale;
      let steps = 0;
      while (this.acc >= this.stepSeconds && steps < 6) {
        this.handlers.tick();
        this.acc -= this.stepSeconds;
        steps++;
      }
      if (steps === 6) this.acc = 0;
      this.handlers.frame(this.acc / this.stepSeconds, dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  get isRunning(): boolean {
    return this.running;
  }
}

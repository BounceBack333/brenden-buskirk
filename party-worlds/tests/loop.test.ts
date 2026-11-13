import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAULT_LIMIT, FixedLoop } from '../src/core/loop';

/** The loop is driven by hand here: each `step(ms)` is one display frame that far after the last. */
describe('fixed loop', () => {
  let queue: Array<(now: number) => void> = [];
  let now = 0;
  const step = (ms: number): void => {
    now += ms;
    const run = queue;
    queue = [];
    for (const f of run) f(now);
  };

  beforeEach(() => {
    queue = [];
    now = 1000;
    vi.stubGlobal('requestAnimationFrame', (f: (now: number) => void) => queue.push(f));
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ticks sixty times a second whatever the display rate', () => {
    for (const frameMs of [1000 / 30, 1000 / 60, 1000 / 120, 1000 / 144]) {
      let ticks = 0;
      let frames = 0;
      const loop = new FixedLoop({ tick: () => ticks++, frame: () => frames++ });
      loop.start();
      const n = Math.round(2000 / frameMs);
      for (let i = 0; i < n; i++) step(frameMs);
      loop.stop();
      expect(frames).toBe(n);
      expect(Math.abs(ticks - 120)).toBeLessThanOrEqual(1);
    }
  });

  it('does not try to catch up after a long gap', () => {
    let ticks = 0;
    const loop = new FixedLoop({ tick: () => ticks++, frame: () => undefined });
    loop.start();
    step(5000); // a phone call, a tab switch
    expect(ticks).toBeLessThanOrEqual(6);
    loop.stop();
  });

  it('gives interpolation a fraction of a tick, and slows with timeScale', () => {
    const alphas: number[] = [];
    let ticks = 0;
    const loop = new FixedLoop({ tick: () => ticks++, frame: (a) => alphas.push(a) });
    loop.timeScale = 0.5;
    loop.start();
    for (let i = 0; i < 120; i++) step(1000 / 60);
    loop.stop();
    expect(Math.abs(ticks - 60)).toBeLessThanOrEqual(1);
    for (const a of alphas) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('survives a bad frame and carries on', () => {
    let frames = 0;
    let faults = 0;
    const loop = new FixedLoop({
      tick: () => undefined,
      frame: () => {
        frames++;
        if (frames === 5) throw new Error('one bad frame');
      },
      fault: () => faults++,
    });
    loop.start();
    for (let i = 0; i < 60; i++) step(1000 / 60);
    expect(frames).toBe(60);
    expect(faults).toBe(0);
    expect(loop.isRunning).toBe(true);
    loop.stop();
  });

  it('stops and reports once when every frame fails', () => {
    const seen: unknown[] = [];
    let attempts = 0;
    const loop = new FixedLoop({
      tick: () => {
        attempts++;
        throw new Error('broken');
      },
      frame: () => undefined,
      fault: (e) => seen.push(e),
    });
    loop.start();
    for (let i = 0; i < 200; i++) step(1000 / 60);
    expect(seen.length).toBe(1);
    expect((seen[0] as Error).message).toBe('broken');
    expect(loop.isRunning).toBe(false);
    expect(attempts).toBe(FAULT_LIMIT);
  });

  it('forgives a failure now and then', () => {
    let frames = 0;
    let faults = 0;
    const loop = new FixedLoop({
      tick: () => undefined,
      frame: () => {
        frames++;
        if (frames % 10 === 0) throw new Error('one frame in ten');
      },
      fault: () => faults++,
    });
    loop.start();
    for (let i = 0; i < FAULT_LIMIT * 60; i++) step(1000 / 60);
    expect(faults).toBe(0);
    expect(loop.isRunning).toBe(true);
    loop.stop();
  });

  it('stops a game that fails every other frame too', () => {
    let frames = 0;
    let faults = 0;
    const loop = new FixedLoop({
      tick: () => undefined,
      frame: () => {
        frames++;
        if (frames % 2 === 0) throw new Error('every other frame');
      },
      fault: () => faults++,
    });
    loop.start();
    for (let i = 0; i < FAULT_LIMIT * 10; i++) step(1000 / 60);
    expect(faults).toBe(1);
    expect(loop.isRunning).toBe(false);
  });

  it('tries a failed tick again on the next frame, without a backlog', () => {
    let calls = 0;
    let done = 0;
    const loop = new FixedLoop({
      tick: () => {
        calls++;
        if (calls <= 3) throw new Error('not yet');
        done++;
      },
      frame: () => undefined,
      fault: () => undefined,
    });
    loop.start();
    for (let i = 0; i < 10; i++) step(1000 / 60);
    loop.stop();
    // three frames lost to the failures; no burst of catch-up ticks afterwards
    expect(done).toBeGreaterThanOrEqual(6);
    expect(done).toBeLessThanOrEqual(8);
  });

  it('lets a throw through when nobody asked to be told', () => {
    const loop = new FixedLoop({ tick: () => undefined, frame: () => { throw new Error('loud'); } });
    loop.start();
    expect(() => step(1000 / 60)).toThrow('loud');
    loop.stop();
  });
});

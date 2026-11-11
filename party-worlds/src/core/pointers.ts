/**
 * Multi-touch pointer tracking in stage space, plus a tiny keyboard state for desktop play.
 * Gameplay listens on the canvas only; DOM buttons sit above it and handle their own taps.
 */
import type { Viewport } from './viewport';

export interface Ptr {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  /** performance.now() at press */
  downAt: number;
  /** free slot for whoever claims this pointer */
  role: string;
  moved: number;
}

export class Pointers {
  readonly active = new Map<number, Ptr>();
  readonly keys = new Set<string>();
  onDown: ((p: Ptr) => void) | null = null;
  onMove: ((p: Ptr) => void) | null = null;
  onUp: ((p: Ptr, cancelled: boolean) => void) | null = null;
  onKey: ((code: string, down: boolean) => void) | null = null;

  constructor(private el: HTMLElement, private viewport: Viewport) {
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.cancel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS: stop rubber-band scroll and double-tap zoom while playing
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      this.onKey?.(e.code, true);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.onKey?.(e.code, false);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.releaseAll();
    });
  }

  private down = (e: PointerEvent): void => {
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not all pointers can be captured */
    }
    const pos = this.viewport.toStage(e.clientX, e.clientY);
    const p: Ptr = {
      id: e.pointerId, x: pos.x, y: pos.y, startX: pos.x, startY: pos.y,
      downAt: performance.now(), role: '', moved: 0,
    };
    this.active.set(p.id, p);
    this.onDown?.(p);
  };

  private move = (e: PointerEvent): void => {
    const p = this.active.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const pos = this.viewport.toStage(e.clientX, e.clientY);
    p.moved += Math.abs(pos.x - p.x) + Math.abs(pos.y - p.y);
    p.x = pos.x;
    p.y = pos.y;
    this.onMove?.(p);
  };

  private up = (e: PointerEvent): void => this.finish(e, false);
  private cancel = (e: PointerEvent): void => this.finish(e, true);

  private finish(e: PointerEvent, cancelled: boolean): void {
    const p = this.active.get(e.pointerId);
    if (!p) return;
    const pos = this.viewport.toStage(e.clientX, e.clientY);
    p.x = pos.x;
    p.y = pos.y;
    this.active.delete(e.pointerId);
    this.onUp?.(p, cancelled);
  }

  releaseAll(): void {
    for (const p of [...this.active.values()]) {
      this.active.delete(p.id);
      this.onUp?.(p, true);
    }
  }
}

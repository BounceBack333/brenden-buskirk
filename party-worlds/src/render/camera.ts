/**
 * Camera rig. Gameplay code never positions the camera directly: it says "this world rectangle
 * (on the z = 0 plane) must be visible" and the rig eases there. That keeps framing decisions
 * about what the player needs to see, not about camera maths.
 */
import * as THREE from 'three';

export interface Frame {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export class CameraRig {
  private cx = 0;
  private cy = 5;
  private half = 12; // half of the visible height at z = 0
  private tx = 0;
  private ty = 5;
  private th = 12;
  private shakeAmt = 0;
  private shakeT = 0;
  private punch = 0;
  /** how quickly the rig eases to a new frame (1/s) */
  rate = 4;
  reducedMotion = false;
  private readonly tmp = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Ask for a world rectangle to be visible. `snap` jumps there immediately. */
  setFrame(f: Frame, snap = false): void {
    const aspect = this.camera.aspect || 16 / 9;
    const w = Math.max(1, f.x1 - f.x0);
    const h = Math.max(1, f.y1 - f.y0);
    this.th = Math.max(h / 2, w / (2 * aspect));
    this.tx = (f.x0 + f.x1) / 2;
    // If the frame is wider than it is tall, the spare vertical room goes above (sky), not below (table).
    this.ty = f.y0 + this.th;
    if (snap || this.reducedMotion) {
      this.cx = this.tx;
      this.cy = this.ty;
      this.half = this.th;
    }
  }

  /** A short, decaying shake. Ignored with reduced motion. */
  shake(amount: number): void {
    if (this.reducedMotion) return;
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  /** A quick push-in that relaxes (catch impact). Ignored with reduced motion. */
  punchIn(amount: number): void {
    if (this.reducedMotion) return;
    this.punch = Math.max(this.punch, amount);
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * this.rate);
    this.cx += (this.tx - this.cx) * k;
    this.cy += (this.ty - this.cy) * k;
    this.half += (this.th - this.half) * k;
    this.shakeAmt *= Math.exp(-dt * 9);
    this.punch *= Math.exp(-dt * 6);
    this.shakeT += dt;

    const cam = this.camera;
    const half = this.half * (1 - this.punch * 0.12);
    const dist = half / Math.tan((cam.fov * Math.PI) / 360);
    const sx = this.shakeAmt * Math.sin(this.shakeT * 71) * 0.5;
    const sy = this.shakeAmt * Math.cos(this.shakeT * 53) * 0.5;
    // slight look-down so the table top reads as a surface
    cam.position.set(this.cx + sx, this.cy + dist * 0.085 + sy, dist);
    cam.lookAt(this.cx + sx, this.cy - dist * 0.012 + sy, 0);
    cam.near = Math.max(0.5, dist * 0.08);
    cam.far = dist + 320;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** World point (on any z) → stage pixel coordinates. */
  project(x: number, y: number, z: number, stageW: number, stageH: number): { x: number; y: number } {
    this.tmp.set(x, y, z).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * stageW, y: (-this.tmp.y * 0.5 + 0.5) * stageH };
  }

  /** Stage pixel → world point on the z = 0 plane. */
  unproject(px: number, py: number, stageW: number, stageH: number): { x: number; y: number } {
    const cam = this.camera;
    this.tmp.set((px / stageW) * 2 - 1, -((py / stageH) * 2 - 1), 0.5).unproject(cam);
    const dir = this.tmp.sub(cam.position);
    const t = -cam.position.z / dir.z;
    return { x: cam.position.x + dir.x * t, y: cam.position.y + dir.y * t };
  }

  get visibleHalfHeight(): number {
    return this.half;
  }
  get centerX(): number {
    return this.cx;
  }
  get centerY(): number {
    return this.cy;
  }
}

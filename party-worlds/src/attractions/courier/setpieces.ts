/**
 * Catapult Courier — small view-only pieces that belong to this attraction rather than to the
 * world kit: the cake cliff at the end of the lane, the aim arc, the landing shadow.
 */
import * as THREE from 'three';
import { PALETTE, mat, mesh, shadows } from '../../kit/materials';

/** The cake cliff the sim treats as a wall at x = xMax. Face sits exactly on that x. */
export function buildCakeCliff(xMax: number): THREE.Group {
  const g = new THREE.Group();
  const depth = 26;
  const width = 22;
  const layerH = 5.2;
  const cx = xMax + width / 2;
  const sponge = mat.clay(PALETTE.sponge, { roughness: 0.9 });
  const cream = mat.glossy(PALETTE.frostingWhite, { roughness: 0.45 });
  const pink = mat.glossy(PALETTE.frosting, { roughness: 0.35 });
  for (let i = 0; i < 3; i++) {
    const y = i * (layerH + 0.7);
    const layer = mesh(new THREE.BoxGeometry(width, layerH, depth), sponge, [cx, y + layerH / 2, -depth / 2 + 6]);
    g.add(layer);
    const filling = mesh(new THREE.BoxGeometry(width + 0.3, 0.7, depth + 0.3), i % 2 === 0 ? cream : pink, [cx, y + layerH + 0.35, -depth / 2 + 6]);
    g.add(filling);
  }
  // frosting drips down the face the flyers hit
  const dripMat = pink;
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const top = 3 * (layerH + 0.7);
  for (let z = -5.2; z <= 5.6; z += 0.95) {
    const len = 1.2 + rnd() * 3.4;
    const r = 0.36 + rnd() * 0.16;
    const drip = mesh(new THREE.CapsuleGeometry(r, len, 6, 14), dripMat, [xMax + 0.02, top - len / 2 - 0.1, z + rnd() * 0.3]);
    g.add(drip);
  }
  const cap = mesh(new THREE.BoxGeometry(width + 0.6, 0.9, depth + 0.6), pink, [cx, top + 0.3, -depth / 2 + 6]);
  g.add(cap);
  shadows(g, true, true);
  return g;
}

/** Dotted aim arc. A fixed pool of little beads; unused ones are hidden. */
export class AimArc {
  readonly mesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly capacity: number;

  constructor(capacity = 44) {
    this.capacity = capacity;
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 8), material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.hide();
  }

  /** points: flat [x0, y0, x1, y1, …]; beads shrink along the arc. */
  set(points: readonly number[], count: number, big = 0.34, small = 0.12): void {
    const n = Math.min(count, this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      if (i < n) {
        const t = n > 1 ? i / (n - 1) : 0;
        const s = big + (small - big) * t;
        this.m.makeScale(s, s, s);
        this.m.setPosition(points[i * 2]!, points[i * 2 + 1]!, 0.6);
      } else {
        this.m.makeScale(0, 0, 0);
      }
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = n > 0;
  }

  hide(): void {
    if (!this.mesh.visible && this.mesh.count > 0) return;
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  }
}

/** A soft blob on the cloth directly under the flyer: the catcher's best depth cue. */
export function buildDropShadow(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(59,42,74,0.55)');
  grad.addColorStop(0.6, 'rgba(59,42,74,0.28)');
  grad.addColorStop(1, 'rgba(59,42,74,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  m.renderOrder = 2;
  m.visible = false;
  return m;
}

/** A dashed ring on the cloth used by the open "aim assist" setting to mark the predicted landing. */
export function buildLandingMarker(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 9;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  m.renderOrder = 2;
  m.visible = false;
  return m;
}

/**
 * Depth haze: a soft warm veil just behind the play plane. Everything behind it (the party
 * dressing) loses a little contrast, so the things you actually play with read first.
 * It fades out toward the cloth so there is no visible seam on the table.
 */
export function buildDepthHaze(xMin: number, xMax: number, z = -2.3): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,236,208,0)');
  g.addColorStop(0.1, 'rgba(255,236,208,0.34)');
  g.addColorStop(1, 'rgba(255,236,208,0.46)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = xMax - xMin + 120;
  const h = 70;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }),
  );
  m.position.set((xMin + xMax) / 2, h / 2 - 0.02, z);
  m.renderOrder = 1;
  return m;
}

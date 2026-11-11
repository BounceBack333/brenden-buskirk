/**
 * Small geometry / colour toolbox shared by the Birthday Continental props.
 * Nothing here holds gameplay state; everything is deterministic (seeded) so two clients
 * always build the same table.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../../kit/materials';

export type Rand = () => number;

/** mulberry32: tiny seeded generator. Never use Math.random for anything that has a shape. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
/** Frame-rate independent exponential approach factor. */
export const damp = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

const _c = new THREE.Color();
/** Mix two '#rrggbb' colours (in the working colour space) and return '#rrggbb'. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  ca.lerp(_c.set(b), t);
  return `#${ca.getHexString()}`;
}

// ───────────────────────────── vertex-colour materials ─────────────────────────────

type VcKind = 'clay' | 'glossy' | 'fabric' | 'metal' | 'paper' | 'satin';
const vcCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * The shared look, but white + vertexColors so many differently coloured static parts can be
 * merged into one draw call. Built by cloning the kit material so roughness etc. stay in sync.
 */
export function vcMat(kind: VcKind, side: THREE.Side = THREE.FrontSide): THREE.MeshStandardMaterial {
  const key = `${kind}:${side}`;
  let m = vcCache.get(key);
  if (!m) {
    const base =
      kind === 'clay' ? mat.clay('#ffffff')
      : kind === 'glossy' ? mat.glossy('#ffffff')
      : kind === 'fabric' ? mat.fabric('#ffffff')
      : kind === 'metal' ? mat.metal('#ffffff')
      : kind === 'satin' ? mat.glossy('#ffffff', { roughness: 0.42 })
      : mat.clay('#ffffff', { roughness: 0.62 });
    m = base.clone();
    m.vertexColors = true;
    m.side = side;
    vcCache.set(key, m);
  }
  return m;
}

/** A private (un-cached) copy of a kit material, for props that tint/fade themselves. */
export function own<T extends THREE.Material>(m: T): T {
  return m.clone() as T;
}

// ───────────────────────────── geometry helpers ─────────────────────────────

export interface Xf {
  p?: [number, number, number];
  r?: [number, number, number];
  s?: number | [number, number, number];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function matrixOf(x: Xf): THREE.Matrix4 {
  _p.set(x.p?.[0] ?? 0, x.p?.[1] ?? 0, x.p?.[2] ?? 0);
  _e.set(x.r?.[0] ?? 0, x.r?.[1] ?? 0, x.r?.[2] ?? 0);
  _q.setFromEuler(_e);
  if (typeof x.s === 'number') _s.setScalar(x.s);
  else _s.set(x.s?.[0] ?? 1, x.s?.[1] ?? 1, x.s?.[2] ?? 1);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

/** Bake a transform into a geometry (returns the same geometry for chaining). */
export function xf<T extends THREE.BufferGeometry>(geo: T, x: Xf): T {
  geo.applyMatrix4(matrixOf(x));
  return geo;
}

/** Give every vertex the same colour. */
export function paint<T extends THREE.BufferGeometry>(geo: T, color: string | THREE.Color): T {
  const c = typeof color === 'string' ? new THREE.Color(color) : color;
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Colour each vertex from a function of its position. */
export function paintBy<T extends THREE.BufferGeometry>(geo: T, fn: (x: number, y: number, z: number, out: THREE.Color) => void): T {
  const pos = geo.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function normalise(geo: THREE.BufferGeometry, keepUv: boolean): THREE.BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  if (!geo.index) {
    const n = geo.getAttribute('position').count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!geo.getAttribute('color')) paint(geo, '#ffffff');
  for (const name of Object.keys(geo.attributes)) {
    if (name === 'position' || name === 'normal' || name === 'color') continue;
    if (name === 'uv' && keepUv) continue;
    geo.deleteAttribute(name);
  }
  if (keepUv && !geo.getAttribute('uv')) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
  }
  geo.morphAttributes = {};
  return geo;
}

/**
 * Collects coloured sub-parts and merges them into ONE geometry (one draw call).
 * Use one batch per material class (clay / glossy / metal …).
 */
export class Batch {
  private parts: THREE.BufferGeometry[] = [];
  constructor(private keepUv = false) {}

  add(geo: THREE.BufferGeometry, color?: string | THREE.Color | null, x?: Xf): this {
    if (x) geo.applyMatrix4(matrixOf(x));
    if (color) paint(geo, color);
    this.parts.push(normalise(geo, this.keepUv));
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  geometry(): THREE.BufferGeometry {
    if (this.parts.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    if (!merged) throw new Error('birthday kit: geometry merge failed');
    return merged;
  }

  mesh(material: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

export interface GridOpts {
  /** wrap the u direction (shared seam vertices → perfectly smooth normals, no uv) */
  closeU?: boolean;
  /** write uv = (u, v). With closeU the seam column is duplicated and its normals averaged. */
  uv?: boolean;
  /** reverse triangle winding */
  flip?: boolean;
  /** per-vertex colour */
  color?: (u: number, v: number, out: THREE.Color) => void;
}

/**
 * Parametric surface on a regular (nu × nv) grid. f(u, v) with u, v in 0..1.
 * Winding: (u × v) is the outward direction unless `flip`.
 */
export function gridSurface(
  nu: number,
  nv: number,
  f: (u: number, v: number, out: THREE.Vector3) => void,
  opts: GridOpts = {},
): THREE.BufferGeometry {
  const wrap = !!opts.closeU && !opts.uv;
  const cols = wrap ? nu : nu + 1;
  const rows = nv + 1;
  const pos = new Float32Array(cols * rows * 3);
  const uv = opts.uv ? new Float32Array(cols * rows * 2) : null;
  const col = opts.color ? new Float32Array(cols * rows * 3) : null;
  const v3 = new THREE.Vector3();
  const c = new THREE.Color();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = i / nu;
      const v = j / nv;
      f(u, v, v3);
      const k = j * cols + i;
      pos[k * 3] = v3.x;
      pos[k * 3 + 1] = v3.y;
      pos[k * 3 + 2] = v3.z;
      if (uv) {
        uv[k * 2] = u;
        uv[k * 2 + 1] = v;
      }
      if (col && opts.color) {
        opts.color(u, v, c);
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
      }
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = wrap ? (i + 1) % nu : i + 1;
      const a = j * cols + i;
      const b = j * cols + i1;
      const d = (j + 1) * cols + i;
      const e = (j + 1) * cols + i1;
      if (opts.flip) idx.push(a, d, b, b, d, e);
      else idx.push(a, b, d, b, e, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(cols * rows > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
  geo.computeVertexNormals();
  if (opts.closeU && opts.uv) weldSeamNormals(geo, cols, rows);
  return geo;
}

/** Average the normals of the first and last column of a duplicated-seam grid. */
export function weldSeamNormals(geo: THREE.BufferGeometry, cols: number, rows: number): void {
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    const i0 = j * cols;
    const i1 = j * cols + cols - 1;
    a.fromBufferAttribute(n, i0);
    b.fromBufferAttribute(n, i1);
    a.add(b).normalize();
    n.setXYZ(i0, a.x, a.y, a.z);
    n.setXYZ(i1, a.x, a.y, a.z);
  }
  n.needsUpdate = true;
}

/** Lathe from a list of [radius, y] points, smooth, with enough segments to hide facets. */
export function lathe(profile: Array<[number, number]>, segments = 28): THREE.LatheGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  return new THREE.LatheGeometry(pts, segments);
}

/** Resample a hand-drawn [r, y] profile through a smooth spline. */
export function smoothProfile(points: Array<[number, number]>, samples: number): Array<[number, number]> {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const p = curve.getPoint(i / samples);
    out.push([Math.max(0, p.x), p.y]);
  }
  return out;
}

/**
 * Pleat wave around a paper cup: 0 in the valley … 1 on the crest. A softened triangle wave —
 * crisp enough to read as folded paper, round enough to stay toy-like.
 */
export function pleat(theta: number, count: number): number {
  const s = 0.5 + 0.5 * Math.cos(theta * count);
  // blend sine with a sharper ridge
  return 0.55 * s + 0.45 * s * s * (3 - 2 * s);
}

/** Canvas helper. Only call from inside builders (never at module load: tests run in node). */
export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('birthday kit: 2d canvas unavailable');
  return { canvas, ctx };
}

export function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: boolean; srgb?: boolean; anisotropy?: number; mipmaps?: boolean } = {},
): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.mipmaps === false) {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Dispose every geometry under a root plus any materials/textures the prop owns privately. */
export function disposer(root: THREE.Object3D, owned: Array<THREE.Material | THREE.Texture> = []): () => void {
  return () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const o of owned) o.dispose();
  };
}

/**
 * A thin tube through a list of points that is cheap to re-shape every frame
 * (strings, cords). Call update() after moving the points.
 */
export class PolyTube {
  readonly geo = new THREE.BufferGeometry();
  readonly points: THREE.Vector3[] = [];
  private pos: Float32Array;
  private attr: THREE.BufferAttribute;

  constructor(count: number, private radius: number, private radial = 5) {
    for (let i = 0; i < count; i++) this.points.push(new THREE.Vector3());
    this.pos = new Float32Array(count * radial * 3);
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.geo.setAttribute('position', this.attr);
    const idx: number[] = [];
    for (let i = 0; i < count - 1; i++) {
      for (let k = 0; k < radial; k++) {
        const k1 = (k + 1) % radial;
        const a = i * radial + k;
        const b = i * radial + k1;
        const c = (i + 1) * radial + k;
        const d = (i + 1) * radial + k1;
        idx.push(a, b, c, b, d, c);
      }
    }
    this.geo.setIndex(idx);
  }

  update(): void {
    const n = this.points.length;
    const t = new THREE.Vector3();
    const n1 = new THREE.Vector3();
    const n2 = new THREE.Vector3();
    const ref = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const p = this.points[i]!;
      const a = this.points[Math.max(0, i - 1)]!;
      const b = this.points[Math.min(n - 1, i + 1)]!;
      t.subVectors(b, a);
      if (t.lengthSq() < 1e-10) t.set(0, 1, 0);
      t.normalize();
      ref.set(0, 0, 1);
      if (Math.abs(t.z) > 0.9) ref.set(1, 0, 0);
      n1.crossVectors(t, ref).normalize();
      n2.crossVectors(t, n1).normalize();
      for (let k = 0; k < this.radial; k++) {
        const ang = (k / this.radial) * TAU;
        const c = Math.cos(ang) * this.radius;
        const s = Math.sin(ang) * this.radius;
        const o = (i * this.radial + k) * 3;
        this.pos[o] = p.x + n1.x * c + n2.x * s;
        this.pos[o + 1] = p.y + n1.y * c + n2.y * s;
        this.pos[o + 2] = p.z + n1.z * c + n2.z * s;
      }
    }
    this.attr.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

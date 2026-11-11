/**
 * Geometry toolbox for the character kit.
 *
 * A whole character is ONE SkinnedMesh: every part (body, limbs, hair, eyes, lids, mouths…)
 * is baked into a single vertex-coloured geometry and bound to a bone. Rigid parts are bound
 * 100% to one bone; bendy parts (ears, tails, long hair) blend between two. That keeps a
 * character at a handful of draw calls and lets squash-and-stretch run through plain bone scale.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../kit/materials';

/** Material slots (geometry groups). Looks come from kit/materials so characters match the world. */
export const M_CLAY = 0;
export const M_FABRIC = 1;
export const M_GLOSSY = 2;

export type ColorFn = (p: THREE.Vector3, out: THREE.Color) => void;
export type Paint = string | ColorFn;
export interface SkinW {
  a: number;
  b: number;
  /** weight of bone b (bone a gets 1 - w) */
  w: number;
}
export type WeightFn = (p: THREE.Vector3, out: SkinW) => void;

let sharedMaterials: THREE.Material[] | null = null;

/**
 * Vertex-coloured twins of mat.clay / mat.fabric / mat.glossy, shared by every character
 * (like the kit's own material cache they live for the lifetime of the page).
 */
export function skinMaterials(): THREE.Material[] {
  if (!sharedMaterials) {
    const twin = (base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => {
      const m = base.clone();
      m.color.set('#ffffff');
      m.vertexColors = true;
      return m;
    };
    sharedMaterials = [twin(mat.clay('#ffffff')), twin(mat.fabric('#ffffff')), twin(mat.glossy('#ffffff'))];
    sharedMaterials[0].name = 'character-clay';
    sharedMaterials[1].name = 'character-fabric';
    sharedMaterials[2].name = 'character-glossy';
  }
  return sharedMaterials;
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _w: SkinW = { a: 0, b: 0, w: 0 };
const ONE = new THREE.Vector3(1, 1, 1);

export class SkinBuilder {
  readonly bones: THREE.Bone[] = [];
  /** model-space bind matrices */
  readonly binds: THREE.Matrix4[] = [];
  readonly restP: THREE.Vector3[] = [];
  readonly restQ: THREE.Quaternion[] = [];
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly si: number[] = [];
  private readonly sw: number[] = [];
  private readonly idx: number[][] = [[], [], []];
  private vcount = 0;

  /** Add a bone whose rest pivot (and optional rest orientation) is given in MODEL space. parent < 0 = detached root. */
  bone(name: string, parent: number, pivot: THREE.Vector3, quat?: THREE.Quaternion): number {
    const bind = new THREE.Matrix4().compose(pivot, quat ?? new THREE.Quaternion(), ONE);
    const b = new THREE.Bone();
    b.name = name;
    if (parent >= 0) {
      _m.copy(this.binds[parent]).invert().multiply(bind);
      _m.decompose(b.position, b.quaternion, b.scale);
      b.scale.set(1, 1, 1);
      this.bones[parent].add(b);
    } else {
      b.position.copy(pivot);
      if (quat) b.quaternion.copy(quat);
    }
    this.bones.push(b);
    this.binds.push(bind);
    this.restP.push(b.position.clone());
    this.restQ.push(b.quaternion.clone());
    return this.bones.length - 1;
  }

  /** Model-space pivot of a bone in the bind pose. */
  pivot(bone: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.setFromMatrixPosition(this.binds[bone]);
  }

  /** Add geometry authored in MODEL space (bind pose). The geometry is consumed. */
  add(geo: THREE.BufferGeometry, bone: number | WeightFn, paint: Paint, matId: number = M_CLAY): void {
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    const base = this.vcount;
    const flat = typeof paint === 'string' ? _c.set(paint).clone() : null;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      _n.fromBufferAttribute(n, i);
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      if (flat) this.col.push(flat.r, flat.g, flat.b);
      else {
        (paint as ColorFn)(_v, _c);
        this.col.push(_c.r, _c.g, _c.b);
      }
      if (typeof bone === 'number') {
        this.si.push(bone, 0, 0, 0);
        this.sw.push(1, 0, 0, 0);
      } else {
        _w.a = 0;
        _w.b = 0;
        _w.w = 0;
        bone(_v, _w);
        const wb = Math.min(1, Math.max(0, _w.w));
        this.si.push(_w.a, _w.b, 0, 0);
        this.sw.push(1 - wb, wb, 0, 0);
      }
    }
    const out = this.idx[matId];
    const index = geo.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) out.push(base + index.getX(i));
    } else {
      for (let i = 0; i < p.count; i++) out.push(base + i);
    }
    this.vcount += p.count;
    geo.dispose();
  }

  /** Add geometry authored in a bone's LOCAL rest frame. */
  addLocal(geo: THREE.BufferGeometry, bone: number, paint: Paint, matId: number = M_CLAY): void {
    geo.applyMatrix4(this.binds[bone]);
    this.add(geo, bone, paint, matId);
  }

  /** Model-space rest orientation of every bone. */
  bindQuats(): THREE.Quaternion[] {
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    return this.binds.map((b) => {
      const q = new THREE.Quaternion();
      b.decompose(p, q, s);
      return q;
    });
  }

  get triangles(): number {
    return (this.idx[0].length + this.idx[1].length + this.idx[2].length) / 3;
  }

  build(name: string): THREE.SkinnedMesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    const all: number[] = [];
    for (let g = 0; g < 3; g++) {
      const part = this.idx[g];
      if (part.length === 0) continue;
      geo.addGroup(all.length, part.length, g);
      for (let i = 0; i < part.length; i++) all.push(part[i]);
    }
    geo.setIndex(this.vcount > 65535 ? new THREE.Uint32BufferAttribute(all, 1) : new THREE.Uint16BufferAttribute(all, 1));
    // Bones move the vertices far from the bind pose; give culling/raycasts a generous static bound.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 2.5);
    geo.boundingBox = new THREE.Box3(new THREE.Vector3(-2.5, -1.9, -2.5), new THREE.Vector3(2.5, 3.1, 2.5));

    const mesh = new THREE.SkinnedMesh(geo, skinMaterials());
    mesh.name = name;
    const inverses = this.binds.map((b) => b.clone().invert());
    const skeleton = new THREE.Skeleton(this.bones, inverses);
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

// ───────────────────────────── primitives ─────────────────────────────

export function v3(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

/** Orientation whose local +x points along `x`, with local +y as close to `upHint` as possible. */
export function frameQuat(x: THREE.Vector3, upHint: THREE.Vector3 = new THREE.Vector3(0, 1, 0)): THREE.Quaternion {
  const X = x.clone().normalize();
  let Z = new THREE.Vector3().crossVectors(X, upHint);
  if (Z.lengthSq() < 1e-8) Z = new THREE.Vector3().crossVectors(X, new THREE.Vector3(0, 0, 1));
  Z.normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

/** Orientation whose local +y points along `y` (for chains: ears, tails), local +x near `xHint`. */
export function frameQuatY(y: THREE.Vector3, xHint: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): THREE.Quaternion {
  const Y = y.clone().normalize();
  let Z = new THREE.Vector3().crossVectors(xHint, Y);
  if (Z.lengthSq() < 1e-8) Z = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), Y);
  Z.normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

export interface Xf {
  p?: [number, number, number] | THREE.Vector3;
  /** Euler XYZ radians */
  r?: [number, number, number];
  q?: THREE.Quaternion;
  s?: [number, number, number] | number;
}

const _xp = new THREE.Vector3();
const _xq = new THREE.Quaternion();
const _xs = new THREE.Vector3();
const _xe = new THREE.Euler();

/** Scale → rotate → translate a geometry in place. */
export function xf<T extends THREE.BufferGeometry>(geo: T, t: Xf): T {
  if (t.p instanceof THREE.Vector3) _xp.copy(t.p);
  else if (t.p) _xp.set(t.p[0], t.p[1], t.p[2]);
  else _xp.set(0, 0, 0);
  if (t.q) _xq.copy(t.q);
  else if (t.r) _xq.setFromEuler(_xe.set(t.r[0], t.r[1], t.r[2], 'XYZ'));
  else _xq.identity();
  if (typeof t.s === 'number') _xs.set(t.s, t.s, t.s);
  else if (t.s) _xs.set(t.s[0], t.s[1], t.s[2]);
  else _xs.set(1, 1, 1);
  geo.applyMatrix4(_m.compose(_xp, _xq, _xs));
  return geo;
}

/** Ellipsoid centred on the origin (analytic normals, so no seam). */
export function ellipsoid(rx: number, ry: number, rz: number, ws = 12, hs = 8): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.deleteAttribute('uv');
  g.scale(rx, ry, rz);
  return g;
}

/** Capsule along Y, centred; `len` is the distance between the two cap centres. */
export function capsule(r: number, len: number, radial = 10, capSeg = 3): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, capSeg, radial, 1);
  g.deleteAttribute('uv');
  return g;
}

/** Re-weld and recompute smooth normals (after sculpting a primitive). */
export function smooth(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const g = mergeVertices(geo, 1e-5);
  g.computeVertexNormals();
  if (g !== geo) geo.dispose();
  return g;
}

/** Move every vertex with `fn`, then rebuild smooth normals. */
export function sculpt(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3) => void): THREE.BufferGeometry {
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    fn(_v);
    p.setXYZ(i, _v.x, _v.y, _v.z);
  }
  return smooth(geo);
}

export interface RingOpts {
  /** wrap columns around (closed tube / sphere). Default true. */
  wrap?: boolean;
  poleStart?: boolean;
  poleEnd?: boolean;
  /** A point inside the shape; triangles are wound to face away from it. Default: vertex centroid. */
  inside?: THREE.Vector3;
}

/**
 * Generic quad-strip surface: `cols` columns × `rings` rings, positions from fn(col, ring).
 * Shared vertices everywhere (no seams); winding is fixed up automatically.
 */
export function ringSurface(
  cols: number, rings: number,
  fn: (i: number, j: number, out: THREE.Vector3) => void,
  opts: RingOpts = {},
): THREE.BufferGeometry {
  const wrap = opts.wrap ?? true;
  const pos: number[] = [];
  const start: number[] = [];
  const isPole: boolean[] = [];
  const tmp = new THREE.Vector3();
  for (let j = 0; j < rings; j++) {
    const pole = (j === 0 && !!opts.poleStart) || (j === rings - 1 && !!opts.poleEnd);
    start.push(pos.length / 3);
    isPole.push(pole);
    const count = pole ? 1 : cols;
    for (let i = 0; i < count; i++) {
      fn(i, j, tmp);
      pos.push(tmp.x, tmp.y, tmp.z);
    }
  }
  const at = (i: number, j: number): number => (isPole[j] ? start[j] : start[j] + (i % cols));
  const idx: number[] = [];
  const quads = wrap ? cols : cols - 1;
  for (let j = 0; j < rings - 1; j++) {
    for (let i = 0; i < quads; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i, j + 1);
      const d = at(i + 1, j + 1);
      if (a !== b && a !== c && b !== c) idx.push(a, c, b);
      if (b !== c && b !== d && c !== d) idx.push(b, c, d);
    }
  }
  // orientation
  const inside = opts.inside ? opts.inside.clone() : new THREE.Vector3();
  if (!opts.inside) {
    for (let i = 0; i < pos.length; i += 3) inside.x += pos[i], inside.y += pos[i + 1], inside.z += pos[i + 2];
    inside.multiplyScalar(3 / pos.length);
  }
  let vol = 0;
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    A.set(pos[idx[t] * 3], pos[idx[t] * 3 + 1], pos[idx[t] * 3 + 2]);
    B.set(pos[idx[t + 1] * 3], pos[idx[t + 1] * 3 + 1], pos[idx[t + 1] * 3 + 2]);
    C.set(pos[idx[t + 2] * 3], pos[idx[t + 2] * 3 + 1], pos[idx[t + 2] * 3 + 2]);
    B.sub(A);
    C.sub(A);
    tmp.crossVectors(B, C);
    vol += tmp.dot(A.sub(inside));
  }
  if (vol < 0) {
    for (let t = 0; t < idx.length; t += 3) {
      const k = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Surface of revolution about Y from a profile of [radius, y] pairs. r≈0 at an end closes it with a pole. */
export function lathe(profile: Array<[number, number]>, seg = 16, scaleX = 1, scaleZ = 1): THREE.BufferGeometry {
  const n = profile.length;
  return ringSurface(seg, n, (i, j, out) => {
    const a = (i / seg) * Math.PI * 2;
    const [r, y] = profile[j];
    out.set(Math.cos(a) * r * scaleX, y, Math.sin(a) * r * scaleZ);
  }, { poleStart: profile[0][0] < 1e-5, poleEnd: profile[n - 1][0] < 1e-5 });
}

export interface TubeOpts {
  radial?: number;
  /** samples along the curve (default 3 per control segment) */
  segments?: number;
  /** cross-section scale along the binormal (1 = round, <1 = flat like an ear) */
  flat?: number;
  /** direction the flat face should look toward at the start (cross-section normal axis) */
  up?: THREE.Vector3;
  /** how far the rounded tips stick out, in radii (default 0.6) */
  tip?: number;
}

/** Tapered tube through control points (Catmull-Rom) with rounded tips. */
export function tube(pts: THREE.Vector3[], radii: number[], opts: TubeOpts = {}): THREE.BufferGeometry {
  const radial = opts.radial ?? 8;
  const S = opts.segments ?? (pts.length - 1) * 3;
  const flat = opts.flat ?? 1;
  const tip = opts.tip ?? 0.6;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const P: THREE.Vector3[] = [];
  const T: THREE.Vector3[] = [];
  const N: THREE.Vector3[] = [];
  const R: number[] = [];
  for (let s = 0; s <= S; s++) {
    const u = s / S;
    P.push(curve.getPoint(u));
    T.push(curve.getTangent(u).normalize());
    const f = u * (radii.length - 1);
    const k = Math.min(radii.length - 2, Math.floor(f));
    const t = f - k;
    R.push(radii[k] + (radii[k + 1] - radii[k]) * (t * t * (3 - 2 * t)));
  }
  const up = opts.up ? opts.up.clone() : new THREE.Vector3(0, 0, 1);
  let n0 = up.clone().addScaledVector(T[0], -up.dot(T[0]));
  if (n0.lengthSq() < 1e-6) n0 = new THREE.Vector3(1, 0, 0).addScaledVector(T[0], -T[0].x);
  N.push(n0.normalize());
  for (let s = 1; s <= S; s++) {
    const n = N[s - 1].clone().addScaledVector(T[s], -N[s - 1].dot(T[s]));
    N.push(n.normalize());
  }
  const B = new THREE.Vector3();
  return ringSurface(radial, S + 3, (i, j, out) => {
    if (j === 0) {
      out.copy(P[0]).addScaledVector(T[0], -R[0] * tip);
      return;
    }
    if (j === S + 2) {
      out.copy(P[S]).addScaledVector(T[S], R[S] * tip);
      return;
    }
    const s = j - 1;
    const a = (i / radial) * Math.PI * 2;
    B.crossVectors(T[s], N[s]);
    out.copy(P[s]).addScaledVector(N[s], Math.cos(a) * R[s] * flat).addScaledVector(B, Math.sin(a) * R[s]);
  }, { poleStart: true, poleEnd: true });
}

/** Quick placed ellipsoid. */
export function blob(
  rx: number, ry: number, rz: number, p: [number, number, number] | THREE.Vector3,
  r?: [number, number, number], ws = 10, hs = 7,
): THREE.BufferGeometry {
  return xf(ellipsoid(rx, ry, rz, ws, hs), { p, r });
}

/** Chain frame: local +y along `y`, local +z as close to `zHint` as possible (planar chains such as tails). */
export function frameQuatYZ(y: THREE.Vector3, zHint: THREE.Vector3 = new THREE.Vector3(0, 0, 1)): THREE.Quaternion {
  const Y = y.clone().normalize();
  let X = new THREE.Vector3().crossVectors(Y, zHint);
  if (X.lengthSq() < 1e-8) X = new THREE.Vector3().crossVectors(Y, new THREE.Vector3(1, 0, 0));
  X.normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

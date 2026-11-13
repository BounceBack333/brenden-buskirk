/**
 * Face construction shared by people and pets: the head surface, 3D eyes with real lids,
 * brows, cheeks and the swappable human mouths. Everything here only BUILDS geometry and
 * bones; the expression logic that drives them lives in rig.ts.
 */
import * as THREE from 'three';
import type { ColorFn, Paint } from './geo';
import { M_CLAY, M_GLOSSY, SkinBuilder, ellipsoid, frameQuat, ringSurface, tube, xf } from './geo';
import { mixHex } from './util';

const DEG = Math.PI / 180;

/**
 * A head as a function of direction: a soft "rounded cube" (super-ellipsoid) with a little
 * extra cheek. Features are placed by azimuth (0 = straight ahead, + toward +z) and elevation.
 */
export class HeadShape {
  constructor(
    readonly c: THREE.Vector3,
    readonly rx: number,
    readonly ry: number,
    readonly rz: number,
    /** 2 = ellipsoid, higher = boxier */
    readonly n = 2.5,
    readonly jowl = 0.08,
    /** narrowing toward the crown, 0..0.2 */
    readonly taper = 0.04,
    /** narrowing toward the chin, 0..0.4: a jawline (grown-ups have one) */
    readonly chin = 0,
  ) {}

  point(az: number, el: number, lift = 0, out = new THREE.Vector3()): THREE.Vector3 {
    const ce = Math.cos(el);
    const dx = ce * Math.cos(az);
    const dy = Math.sin(el);
    const dz = ce * Math.sin(az);
    const n = this.n;
    const k = Math.pow(Math.pow(Math.abs(dx), n) + Math.pow(Math.abs(dy), n) + Math.pow(Math.abs(dz), n), -1 / n);
    let x = dx * k;
    const y = dy * k;
    let z = dz * k;
    if (y < 0) {
      const b = Math.sin(Math.min(1, -y) * Math.PI);
      const t = Math.min(1, -y);
      z *= (1 + this.jowl * b) * (1 - this.chin * t * t);
      x *= (1 + this.jowl * 0.45 * b) * (1 - this.chin * 0.3 * t * t);
    } else {
      z *= 1 - this.taper * y;
      x *= 1 - this.taper * 0.6 * y;
    }
    return out.set(this.c.x + x * this.rx + dx * lift, this.c.y + y * this.ry + dy * lift, this.c.z + z * this.rz + dz * lift);
  }

  normal(az: number, el: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = 2e-3;
    const a = this.point(az + e, el, 0, new THREE.Vector3()).sub(this.point(az - e, el, 0, new THREE.Vector3()));
    const b = this.point(az, el + e, 0, new THREE.Vector3()).sub(this.point(az, el - e, 0, new THREE.Vector3()));
    out.crossVectors(b, a).normalize();
    return out;
  }

  /** Azimuth / elevation of a model-space point as seen from the head centre. */
  dirOf(p: THREE.Vector3): { az: number; el: number } {
    const x = (p.x - this.c.x) / this.rx;
    const y = (p.y - this.c.y) / this.ry;
    const z = (p.z - this.c.z) / this.rz;
    const l = Math.hypot(x, y, z) || 1;
    return { az: Math.atan2(z, x), el: Math.asin(Math.max(-1, Math.min(1, y / l))) };
  }

  /** The skull itself. */
  geometry(cols = 24, rows = 16): THREE.BufferGeometry {
    return ringSurface(cols, rows + 1, (i, j, out) => {
      const az = (i / cols) * Math.PI * 2;
      const el = -Math.PI / 2 + (j / rows) * Math.PI;
      this.point(az, el, 0, out);
    }, { poleStart: true, poleEnd: true, inside: this.c });
  }
}

/** Piecewise-smooth lookup over |azimuth| in degrees: keys are [azDeg 0..180, value]. */
export function keyed(azRad: number, keys: ReadonlyArray<readonly [number, number]>): number {
  let a = Math.abs((((azRad / DEG) + 180) % 360 + 360) % 360 - 180);
  if (a <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (a <= keys[i][0]) {
      const t = (a - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      const s = t * t * (3 - 2 * t);
      return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * s;
    }
  }
  a = keys[keys.length - 1][1];
  return a;
}

export interface ShellOpts {
  cols: number;
  /** ring positions from the boundary (0) to the pole (1) */
  rings?: number[];
  /** boundary elevation (radians) for an azimuth */
  boundary: (az: number) => number;
  /** shell thickness for a direction; s = 0 at the boundary … 1 at the pole */
  thickness: (az: number, el: number, s: number) => number;
  /** +1: cap over the crown, -1: cap under the chin */
  pole?: 1 | -1;
}

/** A thick cap hugging the head: hair, hats, beards. Its rim is a clean edge with visible thickness. */
export function shell(head: HeadShape, o: ShellOpts): THREE.BufferGeometry {
  const rings = o.rings ?? [0.07, 0.2, 0.4, 0.62, 0.84];
  const pole = o.pole ?? 1;
  // ring list: tucked rim, rim wall, …rings…, pole
  const total = rings.length + 3;
  return ringSurface(o.cols, total, (i, j, out) => {
    const az = (i / o.cols) * Math.PI * 2;
    const elB = o.boundary(az);
    if (j === 0) {
      head.point(az, elB, -0.008, out);
      return;
    }
    if (j === 1) {
      head.point(az, elB, Math.max(0.004, o.thickness(az, elB, 0) * 0.6), out);
      return;
    }
    const s = j === total - 1 ? 1 : rings[j - 2];
    const el = elB + (pole * Math.PI / 2 - elB) * s;
    head.point(az, el, Math.max(0.004, o.thickness(az, el, s)), out);
  }, { poleEnd: true, inside: head.c });
}

// ───────────────────────────── eyes ─────────────────────────────

export interface EyeRig {
  eye: number;
  lidU: number;
  lidD: number;
  iris: number;
  pupil: number;
}

export interface EyeOpts {
  iris: string;
  lid: Paint;
  lash: Paint;
  white?: string;
  /** cat-style vertical slit (pupil pre-narrowed sideways) */
  slit?: number;
  /** iris angular radius in degrees */
  irisDeg?: number;
  pupilDeg?: number;
}

function capFn(R: number, angles: number[]): (i: number, j: number, out: THREE.Vector3, cols: number) => void {
  return (i, j, out, cols) => {
    const th = angles[j] * DEG;
    const ph = (i / cols) * Math.PI * 2;
    out.set(R * Math.cos(th), R * Math.sin(th) * Math.cos(ph), R * Math.sin(th) * Math.sin(ph));
  };
}

function cap(R: number, angles: number[], cols: number): THREE.BufferGeometry {
  const f = capFn(R, angles);
  return ringSurface(cols, angles.length, (i, j, out) => f(i, j, out, cols), { poleStart: true, inside: new THREE.Vector3() });
}

/**
 * One eyeball, built in its own rest frame (local +x = gaze, +z = hinge of the lids).
 * Lid bones rotate about local z; the value is the elevation of the lid edge.
 */
export function buildEye(sb: SkinBuilder, parent: number, centre: THREE.Vector3, gaze: THREE.Vector3, r: number, o: EyeOpts): EyeRig {
  const q = frameQuat(gaze);
  const eye = sb.bone('eye', parent, centre, q);
  const lidU = sb.bone('lidU', eye, centre, q);
  const lidD = sb.bone('lidD', eye, centre, q);
  const iris = sb.bone('iris', eye, centre, q);
  const pupil = sb.bone('pupil', iris, centre, q);

  sb.addLocal(cap(r, [0, 16, 33, 50, 68, 86], 14), eye, o.white ?? '#fffaf2', M_GLOSSY);

  // iris: darker limbal ring toward the edge
  const irisDeg = o.irisDeg ?? 35;
  const rim = new THREE.Color(mixHex(o.iris, '#0a0610', 0.5));
  const lightCore = new THREE.Color(mixHex(o.iris, '#ffffff', 0.14));
  const g = gaze.clone().normalize();
  const cosMid = Math.cos(irisDeg * 0.62 * DEG);
  const cosRim = Math.cos(irisDeg * DEG);
  const tmp = new THREE.Vector3();
  const irisPaint: ColorFn = (p, out) => {
    const c = tmp.copy(p).sub(centre).normalize().dot(g);
    const t = Math.max(0, Math.min(1, (cosMid - c) / (cosMid - cosRim)));
    out.copy(lightCore).lerp(rim, t * t);
  };
  sb.addLocal(cap(r * 1.014, [0, irisDeg * 0.62, irisDeg], 14), iris, irisPaint, M_GLOSSY);

  const pupilDeg = o.pupilDeg ?? 19;
  const pg = cap(r * 1.03, [0, pupilDeg * 0.55, pupilDeg], 12);
  if (o.slit && o.slit < 1) {
    const pa = pg.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      v.z *= o.slit;
      v.y *= 1.25;
      v.normalize().multiplyScalar(r * 1.03);
      pa.setXYZ(i, v.x, v.y, v.z);
    }
    pg.computeVertexNormals();
  }
  sb.addLocal(pg, pupil, '#1d1620', M_GLOSSY);

  // catch-lights: fixed on the eye (they do not travel with the iris), one big, one small
  const hl = (dir: THREE.Vector3, deg: number, cols: number): THREE.BufferGeometry => {
    const gq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    return xf(cap(r * 1.05, [0, deg], cols), { q: gq });
  };
  sb.addLocal(hl(new THREE.Vector3(1, 0.36, 0.3), 8.5, 8), eye, '#ffffff', M_GLOSSY);
  sb.addLocal(hl(new THREE.Vector3(1, -0.3, -0.26), 4, 6), eye, '#ffffff', M_GLOSSY);

  // lids: quarter-sphere wedges hinged on local z. Bind pose = edge at elevation 0.
  const R = r * 1.085;
  const tSeg = 10;
  const lid = (sign: 1 | -1, angles: number[]): THREE.BufferGeometry =>
    ringSurface(tSeg + 1, angles.length, (i, j, out) => {
      const t = (i / tSeg) * Math.PI;
      const a = angles[j] * DEG;
      out.set(R * Math.sin(t) * Math.cos(a), sign * R * Math.sin(t) * Math.sin(a), R * Math.cos(t));
    }, { wrap: false, inside: new THREE.Vector3() });
  sb.addLocal(lid(1, [0, 9]), lidU, o.lash, M_CLAY);
  sb.addLocal(lid(1, [9, 34, 62, 92]), lidU, o.lid, M_CLAY);
  sb.addLocal(lid(-1, [0, 30, 60, 92]), lidD, o.lid, M_CLAY);
  return { eye, lidU, lidD, iris, pupil };
}

/** A brow: rest frame x = out of the face, y = up, z = along the brow. */
export function buildBrow(
  sb: SkinBuilder, parent: number, pos: THREE.Vector3, normal: THREE.Vector3,
  halfLen: number, thick: number, paint: Paint, matId: number, side: 1 | -1,
): number {
  const b = sb.bone('brow', parent, pos, frameQuat(normal));
  const g = ellipsoid(thick * 0.8, thick, halfLen, 6, 8);
  // gentle arch, thicker toward the nose
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / halfLen;
    const inner = -z * side; // +1 at the nose end
    p.setY(i, p.getY(i) * (1 + 0.25 * inner) + thick * 0.9 * (1 - z * z));
    p.setX(i, p.getX(i) - halfLen * 0.22 * z * z);
  }
  g.computeVertexNormals();
  sb.addLocal(g, b, paint, matId);
  return b;
}

/** Blush / puffable cheek. Rest frame x = out of the face. */
export function buildCheek(sb: SkinBuilder, parent: number, pos: THREE.Vector3, normal: THREE.Vector3, r: number, paint: Paint, matId: number): number {
  const b = sb.bone('cheek', parent, pos, frameQuat(normal));
  sb.addLocal(xf(ellipsoid(r * 0.42, r * 0.85, r, 10, 6), { p: [-r * 0.2, 0, 0] }), b, paint, matId);
  return b;
}

// ───────────────────────────── human mouths ─────────────────────────────

export interface MouthSet {
  smile: number;
  open: number;
  o: number;
  grit: number;
  wobble: number;
}

/** Flat-ish dome with a custom outline, in the mouth frame (x = out). */
function plate(outline: (phi: number, out: { y: number; z: number }) => void, bulge: number, curve: number, cols = 14): THREE.BufferGeometry {
  const o = { y: 0, z: 0 };
  const scales = [0, 0.62, 1, 1];
  const lifts = [bulge, bulge * 0.8, bulge * 0.15, -0.006];
  return ringSurface(cols, 4, (i, j, out) => {
    const phi = (i / cols) * Math.PI * 2;
    outline(phi, o);
    const s = scales[j];
    const y = o.y * s;
    const z = o.z * s;
    out.set(lifts[j] - curve * z * z, y, z);
  }, { poleStart: true, inside: new THREE.Vector3(-1, 0, 0) });
}

/**
 * The five swappable mouths, each on its own bone so it can be scaled in and out.
 * `curve` wraps them around the face (≈ 1 / (2 · head half-width)).
 */
export function buildMouths(sb: SkinBuilder, parent: number, pos: THREE.Vector3, normal: THREE.Vector3, size: number, line: string, curve: number): MouthSet {
  const q = frameQuat(normal);
  const mk = (name: string): number => sb.bone('mouth-' + name, parent, pos, q);
  const smile = mk('smile');
  const open = mk('open');
  const o = mk('o');
  const grit = mk('grit');
  const wobble = mk('wobble');
  const w = size;
  const up = new THREE.Vector3(1, 0, 0);

  // smile: a fat rounded arc
  {
    const pts: THREE.Vector3[] = [];
    for (let k = -2; k <= 2; k++) {
      const z = (k / 2) * w;
      const u = k / 2;
      pts.push(new THREE.Vector3(0.004 - curve * z * z, -w * 0.5 * (1 - u * u) + w * 0.22, z));
    }
    sb.addLocal(tube(pts, [0.15 * w, 0.2 * w, 0.21 * w, 0.2 * w, 0.15 * w], { radial: 6, segments: 8, flat: 0.6, up }), smile, line, M_CLAY);
  }
  // open: a "D" with tongue and a strip of teeth
  {
    const dark = '#5a1a2b';
    sb.addLocal(plate((phi, out) => {
      const s = Math.sin(phi);
      out.z = Math.cos(phi) * w * 0.95;
      out.y = s >= 0 ? s * w * 0.3 + w * 0.12 : s * w * 0.95 + w * 0.12;
    }, 0.004, curve), open, dark, M_CLAY);
    sb.addLocal(xf(ellipsoid(0.006, w * 0.33, w * 0.52, 8, 5), { p: [0.006, -w * 0.52, 0] }), open, '#ff7f93', M_CLAY);
    sb.addLocal(xf(ellipsoid(0.005, w * 0.13, w * 0.62, 8, 4), { p: [0.007 - curve * w * w * 0.2, w * 0.28, 0] }), open, '#fffaf0', M_CLAY);
  }
  // small "o"
  sb.addLocal(xf(ellipsoid(0.007, w * 0.4, w * 0.34, 10, 5), { p: [0.002, -w * 0.05, 0] }), o, '#5a1a2b', M_CLAY);
  // gritted teeth
  {
    const box = (hw: number, hh: number) => (phi: number, out: { y: number; z: number }) => {
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const e = 0.42; // super-ellipse exponent → rounded rectangle
      out.z = Math.sign(c) * Math.pow(Math.abs(c), e) * hw;
      out.y = Math.sign(s) * Math.pow(Math.abs(s), e) * hh;
    };
    sb.addLocal(plate(box(w * 1.0, w * 0.46), 0.004, curve, 16), grit, line, M_CLAY);
    sb.addLocal(xf(plate(box(w * 0.84, w * 0.3), 0.004, curve, 16), { p: [0.004, 0, 0] }), grit, '#fffaf0', M_CLAY);
    sb.addLocal(xf(ellipsoid(0.004, w * 0.045, w * 0.8, 6, 4), { p: [0.0075, 0, 0] }), grit, line, M_CLAY);
  }
  // wobble: a nervous squiggle
  {
    const pts: THREE.Vector3[] = [];
    const n = 6;
    for (let k = 0; k <= n; k++) {
      const u = (k / n) * 2 - 1;
      const z = u * w * 0.95;
      const y = Math.sin(u * Math.PI * 1.5) * w * 0.2 * (1 - 0.3 * u * u);
      pts.push(new THREE.Vector3(0.004 - curve * z * z, y, z));
    }
    sb.addLocal(tube(pts, [0.14 * w, 0.17 * w, 0.17 * w, 0.17 * w, 0.17 * w, 0.17 * w, 0.14 * w], { radial: 5, segments: 12, flat: 0.6, up }), wobble, line, M_CLAY);
  }
  return { smile, open, o, grit, wobble };
}

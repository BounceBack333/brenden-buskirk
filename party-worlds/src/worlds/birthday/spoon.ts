/**
 * The spoon catapult: a real teaspoon gripped by a wooden clothespin that lies on a domino.
 * Root origin = the table point directly under the passenger seat.
 *
 *   handle tip in the clothespin jaws (left)  ────ski-jump────►  bowl + seat (right, y = 1.95)
 *
 * setPull() drags the bowl back along the launch line; the handle is re-swept along a
 * length-preserving curve every frame so it visibly bows like a drawn fishing rod.
 */
import * as THREE from 'three';
import type { SpoonCatapult } from '../../kit/contracts';
import { PALETTE, Spring, mat, mesh } from '../../kit/materials';
import { Batch, clamp, gridSurface, vcMat, xf } from './util';

/** Gameplay-facing numbers (mirrored by the dev page's debug overlay). */
export const SPOON = {
  seatY: 1.95,
  pullDistance: 1.6,
  minSeatY: 0.55,
} as const;

const BOWL = { tip: 1.45, back: 1.25, halfW: 0.98, depth: 0.36 };
/** where the handle meets the bowl, in bowl space, and the direction it arrives from */
const NECK = { x: -1.1, y: 0.3, angle: (27 * Math.PI) / 180 };
/** where the handle leaves the clothespin jaws, in root space */
const CLAMP = { x: -6.9, y: 0.9, tipX: -7.85 };

const WOOD = '#e7bf87';
const WOOD_DARK = '#c99a5e';

function bowlGeometry(): THREE.BufferGeometry {
  const outline = (theta: number, out: { x: number; z: number }): void => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const ax = c > 0 ? BOWL.tip : BOWL.back;
    // egg: a touch narrower toward the tip
    const bz = BOWL.halfW * (1 - 0.13 * Math.max(0, c) ** 2);
    out.x = ax * c;
    out.z = bz * s;
  };
  const o = { x: 0, z: 0 };
  const th = 0.075;
  return gridSurface(40, 14, (u, v, out) => {
    outline(u * Math.PI * 2, o);
    if (v <= 0.46) {
      // inside, centre → rim
      const t = v / 0.46;
      out.set(o.x * t, BOWL.depth * Math.pow(t, 2.3), o.z * t);
    } else if (v <= 0.54) {
      // rolled lip
      const t = (v - 0.46) / 0.08;
      const a = t * Math.PI;
      const k = 1 + 0.02 * (1 - Math.cos(a));
      out.set(o.x * k, BOWL.depth + 0.022 * Math.sin(a) - th * 0.35 * t, o.z * k);
    } else {
      // underside, rim → centre
      const t = 1 - (v - 0.54) / 0.46;
      const k = t * 1.04;
      out.set(o.x * k, BOWL.depth * Math.pow(t, 2.5) - th * (1 - 0.65 * Math.pow(t, 6)), o.z * k);
    }
  }, { closeU: true });
}

/** Side profile of one clothespin prong. Jaw tip at x = 0, tail at x = -4.7, inner face on y = 0. */
function prongGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.01);
  s.lineTo(-0.5, 0.0);
  // clothesline notch
  s.absarc(-0.82, 0.0, 0.17, 0, Math.PI, false);
  s.lineTo(-1.42, 0.0);
  s.absarc(-1.55, 0.0, 0.08, 0, Math.PI, false);
  s.lineTo(-1.82, 0.0);
  // spring seat
  s.absarc(-2.02, -0.02, 0.2, 0.1, Math.PI - 0.1, false);
  // tail thins on the inside so the legs stand apart
  s.lineTo(-2.5, 0.03);
  s.lineTo(-4.62, 0.2);
  s.quadraticCurveTo(-4.72, 0.22, -4.7, 0.28);
  s.lineTo(-4.66, 0.32);
  s.lineTo(-2.12, 0.33);
  // groove for the spring arm
  s.lineTo(-1.3, 0.33);
  s.lineTo(-1.22, 0.27);
  s.lineTo(-1.14, 0.33);
  s.lineTo(-0.62, 0.32);
  s.quadraticCurveTo(-0.12, 0.26, 0, 0.11);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.56, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8,
  });
  g.translate(0, 0, -0.28);
  return g;
}

function springWire(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  // coil: three turns around z
  const pts: THREE.Vector3[] = [];
  const turns = 3;
  const n = turns * 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.17, Math.sin(a) * 0.17, -0.2 + (i / n) * 0.4));
  }
  out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.036, 5, false));
  // arms: out to each side, then over the outer face of each prong
  for (const side of [1, -1]) {
    const z = side * 0.33;
    const arm = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.17, 0, side * 0.2),
      new THREE.Vector3(0.3, side * 0.12, z),
      new THREE.Vector3(0.78, side * 0.33, z),
      new THREE.Vector3(0.8, side * 0.345, z * 0.6),
      new THREE.Vector3(0.8, side * 0.345, -z),
    ], false, 'catmullrom', 0.2);
    out.push(new THREE.TubeGeometry(arm, 14, 0.036, 5, false));
  }
  return out;
}

function dominoGeometry(batch: Batch, glossy: Batch): void {
  const L = 3.2;
  const W = 1.6;
  const H = 0.5;
  const body = new THREE.ExtrudeGeometry(roundedRect(L, W, 0.14), {
    depth: H - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6,
  });
  body.rotateX(-Math.PI / 2);
  body.translate(0, 0.06, 0);
  glossy.add(body, PALETTE.navy);
  // centre bar + pips (5 | 3) on the top face
  const top = H + 0.004;
  batch.add(new THREE.BoxGeometry(0.05, 0.012, W * 0.78), PALETTE.paper, { p: [0, top, 0] });
  const pip = (x: number, z: number): void => {
    batch.add(new THREE.CylinderGeometry(0.115, 0.115, 0.014, 12), PALETTE.paper, { p: [x, top, z] });
  };
  for (const [x, z] of [[-1.15, -0.45], [-1.15, 0.45], [-0.75, 0], [-0.35, -0.45], [-0.35, 0.45]] as const) pip(x, z);
  for (const [x, z] of [[0.35, -0.45], [0.75, 0], [1.15, 0.45]] as const) pip(x, z);
}

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Swept handle: rings of an oval section along the centre-line, rebuilt in place when it bends. */
class Handle {
  static readonly FIXED = 5; // rings inside the jaws (never move)
  static readonly FLEX = 24;
  static readonly RADIAL = 10;
  readonly geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private rings = Handle.FIXED + Handle.FLEX + 1;
  private restLength = 0;
  private b0 = new THREE.Vector2();
  private b1 = new THREE.Vector2();
  private b2 = new THREE.Vector2();
  private b3 = new THREE.Vector2();

  constructor() {
    const R = Handle.RADIAL;
    this.pos = new Float32Array(this.rings * R * 3);
    const idx: number[] = [];
    for (let i = 0; i < this.rings - 1; i++) {
      for (let k = 0; k < R; k++) {
        const k1 = (k + 1) % R;
        const a = i * R + k;
        const b = i * R + k1;
        const c = (i + 1) * R + k;
        const d = (i + 1) * R + k1;
        idx.push(a, c, b, b, c, d);
      }
    }
    this.geo.setIndex(idx);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
  }

  private bez(t: number, out: THREE.Vector2, tan?: THREE.Vector2): void {
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.set(
      a * this.b0.x + b * this.b1.x + c * this.b2.x + d * this.b3.x,
      a * this.b0.y + b * this.b1.y + c * this.b2.y + d * this.b3.y,
    );
    if (tan) {
      tan.set(
        3 * mt * mt * (this.b1.x - this.b0.x) + 6 * mt * t * (this.b2.x - this.b1.x) + 3 * t * t * (this.b3.x - this.b2.x),
        3 * mt * mt * (this.b1.y - this.b0.y) + 6 * mt * t * (this.b2.y - this.b1.y) + 3 * t * t * (this.b3.y - this.b2.y),
      ).normalize();
    }
  }

  private setControls(nx: number, ny: number, nAngle: number, s: number): void {
    this.b0.set(CLAMP.x, CLAMP.y);
    this.b1.set(CLAMP.x + s, CLAMP.y);
    this.b2.set(nx - Math.cos(nAngle) * s, ny - Math.sin(nAngle) * s);
    this.b3.set(nx, ny);
  }

  private length(): number {
    let len = 0;
    const p = new THREE.Vector2();
    const q = new THREE.Vector2();
    this.bez(0, q);
    for (let i = 1; i <= 16; i++) {
      this.bez(i / 16, p);
      len += p.distanceTo(q);
      q.copy(p);
    }
    return len;
  }

  /** nx, ny = neck point in root space; nAngle = direction the handle travels into the bowl. */
  update(nx: number, ny: number, nAngle: number): void {
    const chord = Math.hypot(nx - CLAMP.x, ny - CLAMP.y);
    if (this.restLength === 0) {
      this.setControls(nx, ny, nAngle, chord / 3);
      this.restLength = this.length();
    } else {
      // tangent length that keeps the metal the same length: longer tangents = more bow
      let lo = chord * 0.12;
      let hi = this.restLength * 1.25;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        this.setControls(nx, ny, nAngle, mid);
        if (this.length() < this.restLength) lo = mid;
        else hi = mid;
      }
      this.setControls(nx, ny, nAngle, (lo + hi) / 2);
    }

    const R = Handle.RADIAL;
    const c = new THREE.Vector2();
    const t = new THREE.Vector2();
    for (let i = 0; i < this.rings; i++) {
      let along: number; // 0 tip … 1 neck, for the section profile
      if (i < Handle.FIXED) {
        const f = i / Handle.FIXED;
        c.set(CLAMP.tipX + (CLAMP.x - CLAMP.tipX) * f, CLAMP.y);
        t.set(1, 0);
        along = f * 0.14;
      } else {
        const f = (i - Handle.FIXED) / Handle.FLEX;
        this.bez(f, c, t);
        along = 0.14 + f * 0.86;
      }
      // teaspoon handle: paddle at the tip, waist toward the neck, flare into the bowl
      const tipRound = Math.sqrt(clamp(along / 0.07, 0, 1));
      let w = 0.42 - 0.22 * Math.sin(Math.min(1, along / 0.86) * Math.PI * 0.5) ** 1.5;
      if (along > 0.86) w += ((along - 0.86) / 0.14) ** 2 * 0.2;
      w *= 0.25 + 0.75 * tipRound;
      const th = (0.058 + 0.014 * along) * (0.5 + 0.5 * tipRound);
      for (let k = 0; k < R; k++) {
        const a = (k / R) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // squarish oval: flat top and bottom, rounded edges
        const oz = Math.sign(ca) * Math.pow(Math.abs(ca), 0.6) * w;
        const on = Math.sign(sa) * Math.pow(Math.abs(sa), 0.75) * th;
        const o = (i * R + k) * 3;
        this.pos[o] = c.x - t.y * on;
        this.pos[o + 1] = c.y + t.x * on;
        this.pos[o + 2] = oz;
      }
    }
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}

export function buildSpoonCatapult(): SpoonCatapult {
  const root = new THREE.Group();
  root.name = 'spoon-catapult';

  // ── the anchor: domino base plate, clothespin on top ──
  const anchor = new THREE.Group();
  const clay = new Batch();
  const glossy = new Batch();
  const metal = new Batch();

  const domino = new Batch();
  const dominoGloss = new Batch();
  dominoGeometry(domino, dominoGloss);
  const dominoX: [number, number, number] = [-8.75, 0, 0.02];
  clay.add(domino.geometry(), null, { p: dominoX, r: [0, 0.07, 0] });
  glossy.add(dominoGloss.geometry(), null, { p: dominoX, r: [0, 0.07, 0] });

  // clothespin: jaw tips at CLAMP.x, lying on the domino. Gripping the handle opens the jaws a hair.
  const pinY = 0.5;
  const jawGap = 0.13;
  const open = Math.atan(jawGap / 2.02);
  const fulcrum = new THREE.Vector3(CLAMP.x - 2.02, pinY + 0.33, 0);
  const lower = prongGeometry();
  lower.scale(1, -1, 1); // mirror → inner face up, lying flat on the domino
  flipWinding(lower);
  lower.translate(2.02 + fulcrum.x, fulcrum.y, 0);
  const upper = prongGeometry();
  upper.translate(2.02, 0, 0);
  upper.rotateZ(open);
  upper.translate(fulcrum.x, fulcrum.y, 0);
  clay.add(lower, WOOD);
  clay.add(upper, WOOD);
  for (const g of springWire()) metal.add(g, PALETTE.steel, { p: [fulcrum.x, fulcrum.y, 0] });

  // a doubled rubber band round the jaws: the "kid built this" accent
  const band = (x: number, tilt: number): void => {
    const hw = 0.33;
    const hh = 0.42;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pts.push(new THREE.Vector3(0, Math.sign(sa) * Math.pow(Math.abs(sa), 0.45) * hh, Math.sign(ca) * Math.pow(Math.abs(ca), 0.45) * hw));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 28, 0.04, 5, true);
    glossy.add(tube, PALETTE.coral, { p: [x, fulcrum.y + 0.05, 0], r: [0, 0, tilt] });
  };
  band(CLAMP.x - 0.42, 0.1);
  band(CLAMP.x - 0.55, -0.12);

  const anchorClay = clay.mesh(vcMat('clay'));
  const anchorGloss = glossy.mesh(vcMat('satin'));
  const anchorMetal = metal.mesh(vcMat('metal'));
  anchor.add(anchorClay, anchorGloss, anchorMetal);
  root.add(anchor);

  // ── the spoon ──
  const steel = mat.metal(PALETTE.steel);
  const handle = new Handle();
  const handleMesh = mesh(handle.geo, steel);
  handleMesh.castShadow = true;
  handleMesh.receiveShadow = true;
  handleMesh.frustumCulled = false;
  root.add(handleMesh);

  const bowl = new THREE.Group();
  const bowlMesh = mesh(bowlGeometry(), steel);
  bowlMesh.castShadow = true;
  bowlMesh.receiveShadow = true;
  bowl.add(bowlMesh);
  // neck fairing: hides the join between the swept handle and the bowl
  const fairing = mesh(xf(new THREE.SphereGeometry(0.2, 14, 10), { s: [1.5, 0.42, 1.25] }), steel, [NECK.x + 0.02, NECK.y - 0.01, 0]);
  fairing.rotation.z = NECK.angle * 0.7;
  fairing.castShadow = true;
  bowl.add(fairing);
  const seat = new THREE.Object3D();
  seat.name = 'seat';
  bowl.add(seat);
  root.add(bowl);

  // ── state ──
  let aim = Math.PI / 4;
  let held = false;
  let time = 0;
  /** visual pull: 0 rest, 1 fully drawn, negative = flung past rest */
  const spring = new Spring(0, 1350, 12.5);
  const jolt = new Spring(0, 520, 13);

  function pose(p: number): void {
    const pe = p >= 0 ? p : p * 0.6;
    const ax = Math.cos(aim);
    const ay = Math.sin(aim);
    const sx = -ax * SPOON.pullDistance * pe;
    let sy = SPOON.seatY - ay * SPOON.pullDistance * pe;
    if (sy < SPOON.minSeatY) sy = SPOON.minSeatY;
    // cup the passenger toward the aim line: flat shots lean the bowl forward the most
    const psi = Math.PI / 2 - aim;
    let tilt = pe * (0.12 + 0.55 * psi);
    if (held && pe > 0) tilt += Math.sin(time * 47) * 0.006 * pe; // tension tremble
    // never dig the bowl tip into the cloth
    const maxTilt = Math.asin(clamp((sy - 0.2) / BOWL.tip, -1, 1));
    if (tilt > maxTilt) tilt = maxTilt;
    bowl.position.set(sx, sy, 0);
    bowl.rotation.z = -tilt;
    const c = Math.cos(-tilt);
    const s = Math.sin(-tilt);
    const nx = sx + NECK.x * c - NECK.y * s;
    const ny = sy + NECK.x * s + NECK.y * c;
    handle.update(nx, ny, NECK.angle - tilt);
  }
  pose(0);

  return {
    root,
    seat,
    setPull(pull01: number, aimRad: number): void {
      aim = aimRad;
      const p = clamp(pull01, 0, 1);
      if (p > 0.002) {
        held = true;
        spring.value = p;
        spring.velocity = 0;
        spring.target = p;
      } else if (held) {
        // let go without a launch: relax back with the same springy metal
        held = false;
        spring.target = 0;
      }
    },
    fire(power01: number): void {
      const power = clamp(power01, 0, 1);
      held = false;
      spring.target = 0;
      if (spring.value < power * 0.5) spring.value = Math.max(spring.value, power * 0.85);
      spring.velocity = -power * 26;
      jolt.kick(4 + power * 9);
    },
    update(dt: number): void {
      time += dt;
      if (!held) spring.update(dt);
      const j = jolt.update(dt);
      // the whole anchor hops a hair and the pin chatters when the spoon lets go
      anchor.position.y = Math.max(0, j) * 0.06;
      anchor.rotation.z = j * 0.012;
      pose(spring.value);
    },
  };
}

function flipWinding(geo: THREE.BufferGeometry): void {
  const idx = geo.getIndex();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      idx.setX(i, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
  } else {
    const pos = geo.getAttribute('position');
    const tmp = new THREE.Vector3();
    const tmp2 = new THREE.Vector3();
    for (const name of Object.keys(geo.attributes)) {
      const at = geo.getAttribute(name) as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 3) {
        if (at.itemSize === 3) {
          tmp.fromBufferAttribute(at, i);
          tmp2.fromBufferAttribute(at, i + 2);
          at.setXYZ(i, tmp2.x, tmp2.y, tmp2.z);
          at.setXYZ(i + 2, tmp.x, tmp.y, tmp.z);
        } else if (at.itemSize === 2) {
          const ax = at.getX(i);
          const ay = at.getY(i);
          at.setXY(i, at.getX(i + 2), at.getY(i + 2));
          at.setXY(i + 2, ax, ay);
        }
      }
    }
  }
  geo.computeVertexNormals();
}

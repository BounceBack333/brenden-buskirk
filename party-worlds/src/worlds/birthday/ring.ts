/**
 * Ring gate: a giant iced donut hung from above on two ribbons.
 * Origin at the hole centre; the hole axis is along x; the clear opening is exactly
 * `innerRadius` (icing and sprinkles never intrude on it).
 *
 * The donut is turned `yaw` radians toward the camera about the vertical axis so the hole reads
 * as a hoop from the side-on gameplay camera. The opening's vertical extent on the z = 0 plane —
 * the only thing the simulation tests — is unaffected by that turn. Pass { yaw: 0 } for a
 * strictly edge-on donut.
 */
import * as THREE from 'three';
import type { RingGate } from '../../kit/contracts';
import { PALETTE, Spring, mat } from '../../kit/materials';
import { softDiscTexture } from './textures';
import { Batch, TAU, clamp01, damp, gridSurface, mixHex, own, seeded, vcMat } from './util';

const SPRINKLE_COLORS = [PALETTE.frostingWhite, PALETTE.butter, PALETTE.teal, PALETTE.sky, PALETTE.grape, PALETTE.sunflower, PALETTE.mint];
const RIBBON_LENGTH = 30;
const X_SQUASH = 0.84; // donuts are a little flatter than round

export function ringTubeRadius(innerRadius: number): number {
  return 0.4 * innerRadius + 0.1;
}

export function buildRingGate(innerRadius: number, opts: { yaw?: number } = {}): RingGate {
  const root = new THREE.Group();
  root.name = 'ring-gate';
  const yaw = opts.yaw ?? 0.5;
  const a = ringTubeRadius(innerRadius);
  const Rm = innerRadius + a;
  const rnd = seeded(Math.round(innerRadius * 1000) + 17);

  const swing = new THREE.Group(); // idle sway + celebrate spin
  root.add(swing);

  /** point on the donut: th = angle round the ring (0 = top), ps = angle round the tube (PI/2 = iced face) */
  const tubePoint = (th: number, ps: number, extra: number, out: THREE.Vector3): void => {
    const lump = 1 + (0.035 * Math.sin(3 * th + 1) + 0.02 * Math.sin(7 * th + 2)) * Math.max(0, Math.cos(ps));
    const rad = Rm + (a * lump + extra) * Math.cos(ps);
    out.set(-(a + extra) * X_SQUASH * Math.sin(ps), rad * Math.cos(th), rad * Math.sin(th));
  };

  // ── dough ──
  const doughCol = new THREE.Color('#e2a257');
  const doughPale = new THREE.Color('#f7d9a2');
  const doughGeo = gridSurface(40, 12, (u, v, out) => tubePoint(u * TAU, v * TAU, 0, out), {
    closeU: true,
    flip: true,
    color: (_u, v, out) => {
      // the pale "proof line" every fried ring has round its equator
      const band = Math.pow(Math.abs(Math.cos(v * TAU)), 10);
      out.copy(doughCol).lerp(doughPale, band * 0.85);
    },
  });
  weldV(doughGeo, 40, 12);
  const doughMat = own(vcMat('clay'));
  const dough = new THREE.Mesh(doughGeo, doughMat);
  dough.castShadow = true;
  dough.receiveShadow = true;
  swing.add(dough);

  // ── icing with a dripping edge ──
  const icingT = 0.05 + 0.02 * a;
  const edge = (th: number, sign: number): number => {
    const w = 1.2 + 0.2 * Math.sin(5 * th + 0.7 + sign) + 0.12 * Math.sin(11 * th + sign * 2) + 0.08 * Math.sin(17 * th);
    return Math.PI / 2 + sign * Math.min(w, sign > 0 ? 1.18 : 1.5);
  };
  const icingMat = own(mat.glossy(PALETTE.frosting, { roughness: 0.2 }));
  icingMat.emissive = new THREE.Color('#fff2c4');
  icingMat.emissiveIntensity = 0;
  const icingGeo = gridSurface(40, 7, (u, v, out) => {
    const th = u * TAU;
    const ps = edge(th, -1) + (edge(th, 1) - edge(th, -1)) * v;
    tubePoint(th, ps, icingT * Math.pow(Math.sin(Math.PI * v), 0.55), out);
  }, { closeU: true, flip: true });
  const icing = new THREE.Mesh(icingGeo, icingMat);
  icing.castShadow = true;
  swing.add(icing);

  // ── sprinkles ──
  const SPRINKLES = 32;
  const sprinkleGeo = new THREE.CapsuleGeometry(0.03 + 0.012 * a, 0.12 + 0.04 * a, 1, 5);
  const sprinkleMat = own(mat.glossy('#ffffff', { roughness: 0.3 }));
  const sprinkles = new THREE.InstancedMesh(sprinkleGeo, sprinkleMat, SPRINKLES);
  {
    const p = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const p3 = new THREE.Vector3();
    const n = new THREE.Vector3();
    const t = new THREE.Vector3();
    const b = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let i = 0; i < SPRINKLES; i++) {
      const th = ((i + rnd() * 0.8) / SPRINKLES) * TAU;
      const ps = Math.PI / 2 + (rnd() - 0.5) * 1.5;
      tubePoint(th, ps, icingT * 0.95, p);
      tubePoint(th + 0.01, ps, icingT * 0.95, p2);
      tubePoint(th, ps + 0.01, icingT * 0.95, p3);
      t.subVectors(p2, p).normalize();
      b.subVectors(p3, p).normalize();
      n.crossVectors(t, b).normalize();
      // random direction in the tangent plane
      const ang = rnd() * Math.PI;
      t.multiplyScalar(Math.cos(ang)).addScaledVector(b, Math.sin(ang)).normalize();
      b.crossVectors(n, t).normalize();
      m.makeBasis(b, t, n);
      q.setFromRotationMatrix(m);
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      sprinkles.setMatrixAt(i, m);
      sprinkles.setColorAt(i, c.set(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]!));
    }
    sprinkles.instanceMatrix.needsUpdate = true;
    if (sprinkles.instanceColor) sprinkles.instanceColor.needsUpdate = true;
  }
  swing.add(sprinkles);

  // ── ribbons: a band round the tube, then straight up out of frame ──
  const ribbonMat = own(vcMat('satin', THREE.DoubleSide));
  const ribbonBatch = new Batch();
  const ribbonColor = PALETTE.sunflower;
  const ribbonDark = mixHex(PALETTE.sunflower, PALETTE.coral, 0.35);
  for (const side of [-1, 1]) {
    const th = side * 0.52;
    const er = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
    const tt = new THREE.Vector3(0, -Math.sin(th), Math.cos(th));
    const band = new THREE.TorusGeometry(a * 1.05 + icingT * 0.5, 0.045, 6, 26);
    band.scale(X_SQUASH, 1, 3.4);
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), er, tt);
    basis.setPosition(er.clone().multiplyScalar(Rm));
    band.applyMatrix4(basis);
    ribbonBatch.add(band, ribbonDark);
    // the long tail: a strip with a lazy twist so it catches the light like satin
    const w = 0.34;
    const top = er.clone().multiplyScalar(Rm + a * 1.02);
    const strip = gridSurface(1, 20, (u, v, out) => {
      const y = v * RIBBON_LENGTH;
      const tw = 0.5 * Math.sin(v * 9 + side) * (0.3 + v);
      const half = (u - 0.5) * w;
      out.set(top.x + Math.sin(tw) * half + 0.05 * Math.sin(v * 14 + side * 2), top.y + y, top.z + Math.cos(tw) * half * side);
    });
    ribbonBatch.add(strip, ribbonColor);
    // a small bow knot where it ties
    const knot = new THREE.SphereGeometry(0.13, 10, 8);
    ribbonBatch.add(knot, ribbonDark, { p: [top.x, top.y + 0.02, top.z], s: [1.2, 0.8, 1.2] });
    for (const lr of [-1, 1]) {
      const loop = new THREE.TorusGeometry(0.17, 0.05, 5, 12);
      loop.scale(1, 0.62, 1.6);
      ribbonBatch.add(loop, ribbonColor, { p: [top.x, top.y + 0.06, top.z + lr * 0.2], r: [0, Math.PI / 2, lr * 0.5] });
    }
  }
  const ribbons = new THREE.Mesh(ribbonBatch.geometry(), ribbonMat);
  ribbons.castShadow = true;
  swing.add(ribbons);

  // ── celebrate: halo + sprinkle burst ──
  const haloMat = new THREE.MeshBasicMaterial({
    map: softDiscTexture(0.35), color: PALETTE.butter, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), haloMat);
  halo.position.z = -0.4;
  halo.visible = false;
  halo.renderOrder = 3;
  root.add(halo);

  const BURST = 28;
  const burst = new THREE.InstancedMesh(sprinkleGeo, mat.glossy('#ffffff', { roughness: 0.3 }), BURST);
  burst.visible = false;
  burst.frustumCulled = false;
  root.add(burst);
  const parts: Array<{ p: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler }> = [];
  for (let i = 0; i < BURST; i++) {
    parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler() });
    burst.setColorAt(i, new THREE.Color(SPRINKLE_COLORS[(i * 3 + 1) % SPRINKLE_COLORS.length]!));
  }
  if (burst.instanceColor) burst.instanceColor.needsUpdate = true;

  // ── state ──
  const spin = new Spring(0, 46, 9.5);
  const pulse = new Spring(0, 260, 12);
  let time = rnd() * 10;
  let burstT = 9;
  let flash = 0;
  let collected = false;
  let dim = 0;
  const dimColor = new THREE.Color('#9c8f95');
  const white = new THREE.Color('#ffffff');
  const frosting = new THREE.Color(PALETTE.frosting);
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();

  function applyDim(): void {
    const t = dim;
    doughMat.color.copy(white).lerp(dimColor, t * 0.85);
    icingMat.color.copy(frosting).lerp(dimColor, t * 0.85);
    sprinkleMat.color.copy(white).lerp(dimColor, t * 0.9);
    ribbonMat.color.copy(white).lerp(dimColor, t * 0.7);
    const op = 1 - 0.55 * t;
    for (const m of [doughMat, icingMat, sprinkleMat, ribbonMat]) {
      const transparent = t > 0.01;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = op;
    }
  }

  return {
    root,
    celebrate(): void {
      spin.target += TAU;
      pulse.kick(7);
      flash = 1;
      burstT = 0;
      burst.visible = true;
      halo.visible = true;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      for (let i = 0; i < BURST; i++) {
        const part = parts[i]!;
        const th = (i / BURST) * TAU + rnd() * 0.3;
        // start on the ring (in its turned plane), fly outward
        const ry = Math.cos(th);
        const rz = Math.sin(th);
        const sp = 4.5 + rnd() * 5;
        part.p.set(rz * Rm * sy, ry * Rm, rz * Rm * cy);
        part.v.set(rz * sy * sp + (rnd() - 0.5) * 4, ry * sp + 2.5, rz * cy * sp * 0.6);
        part.spin.set(rnd() * 14 - 7, rnd() * 14 - 7, rnd() * 14 - 7);
        part.rot.set(rnd() * 6, rnd() * 6, rnd() * 6);
      }
    },
    setCollected(value: boolean): void {
      collected = value;
    },
    update(dt: number): void {
      time += dt;
      const s = spin.update(dt);
      const p = pulse.update(dt);
      swing.rotation.y = yaw + s + Math.sin(time * 0.8) * 0.07;
      swing.rotation.z = Math.sin(time * 1.15 + 1) * 0.018;
      swing.scale.setScalar(1 + p * 0.07 - dim * 0.05);

      // flash
      flash = Math.max(0, flash - dt * 2.6);
      icingMat.emissiveIntensity = flash * flash * 0.9;
      if (halo.visible) {
        const k = 1 - flash;
        halo.scale.setScalar((Rm + a) * (1.1 + 1.3 * k));
        haloMat.opacity = 0.8 * flash;
        if (flash <= 0) halo.visible = false;
      }

      // sprinkle burst
      if (burst.visible) {
        burstT += dt;
        const life = 0.95;
        const k = burstT / life;
        if (k >= 1) {
          burst.visible = false;
        } else {
          for (let i = 0; i < BURST; i++) {
            const part = parts[i]!;
            part.v.y -= 15 * dt;
            part.v.multiplyScalar(1 - 1.4 * dt);
            part.p.addScaledVector(part.v, dt);
            part.rot.x += part.spin.x * dt;
            part.rot.y += part.spin.y * dt;
            part.rot.z += part.spin.z * dt;
            tmpQ.setFromEuler(part.rot);
            tmpS.setScalar(1.5 * (1 - k * k));
            tmpM.compose(part.p, tmpQ, tmpS);
            burst.setMatrixAt(i, tmpM);
          }
          burst.instanceMatrix.needsUpdate = true;
        }
      }

      // dim once collected — but let the celebration finish first
      const target = collected && flash < 0.25 ? 1 : 0;
      const before = dim;
      dim += (target - dim) * damp(collected ? 5 : 9, dt);
      if (Math.abs(target - dim) < 0.004) dim = target;
      if (dim !== before || (dim === 0 && doughMat.opacity !== 1)) applyDim();
    },
  };
}

/** A torus grid wraps in v as well: fuse the duplicated last row onto the first so it shades seamlessly. */
function weldV(geo: THREE.BufferGeometry, nu: number, nv: number): void {
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i < nu; i++) {
    const i0 = i;
    const i1 = nv * nu + i;
    a.fromBufferAttribute(n, i0);
    b.fromBufferAttribute(n, i1);
    a.add(b).normalize();
    n.setXYZ(i0, a.x, a.y, a.z);
    n.setXYZ(i1, a.x, a.y, a.z);
  }
  n.needsUpdate = true;
}

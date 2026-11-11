/**
 * Wobbly jelly on a small plate.
 * Origin on the table under its centre. The bouncy surface is a half-sphere of exactly
 * `radius` centred on the origin (top at y = radius).
 *
 * Optional `capHeight` (< radius) builds a shallow cap of the same sphere instead — top at
 * y = capHeight, sphere centre at (0, capHeight - radius, 0) — which is the shape the Courier
 * simulation's wide "trampoline" jellies collide with (see jellyCircle() in rules.ts).
 */
import * as THREE from 'three';
import type { JellyDome } from '../../kit/contracts';
import { PALETTE, Spring, mat } from '../../kit/materials';
import { Batch, clamp01, gridSurface, lathe, mixHex, own, seeded, smoothProfile, TAU, vcMat } from './util';

const SEG_U = 36;
const SEG_V = 12;

export function buildJellyDome(radius: number, capHeight: number = radius, color: string = PALETTE.grape): JellyDome {
  const root = new THREE.Group();
  root.name = 'jelly-dome';
  const H = Math.min(capHeight, radius);
  const cy = H - radius; // sphere centre height (0 for the true half-sphere)
  const phiMax = Math.acos(clampCos(-cy / radius)); // polar angle where the sphere meets the table
  const baseR = radius * Math.sin(phiMax);

  // ── plate ──
  const plateR = baseR * 1.2 + 0.25;
  const lip = Math.min(0.2, 0.08 + radius * 0.04);
  // profile runs underside → rim → well so the lathe normals face outward
  const plate = lathe(smoothProfile([
    [0, 0.0], [baseR * 0.8, 0.0], [plateR * 0.9, lip * 0.35], [plateR + 0.015, lip - 0.015], [plateR, lip],
    [plateR * 0.93, lip * 0.75], [baseR * 1.04, 0.04], [baseR * 0.95, 0.035], [0, 0.035],
  ], 22), 40);
  const plateBatch = new Batch();
  plateBatch.add(plate, PALETTE.frostingWhite);
  // painted rim line
  plateBatch.add(new THREE.TorusGeometry(plateR * 0.955, 0.022, 5, 48), PALETTE.sunflower, { r: [Math.PI / 2, 0, 0], p: [0, lip * 0.86, 0] });
  const plateMesh = plateBatch.mesh(vcMat('glossy'));
  root.add(plateMesh);

  // ── fruit suspended inside (gives the translucency something to show) ──
  const fruit = new THREE.Group();
  const fruitBatch = new Batch();
  const rnd = seeded(Math.round(radius * 1000) + Math.round(H * 77));
  const fruitColors = [PALETTE.berry, PALETTE.sunflower, PALETTE.coral, PALETTE.butter];
  const count = 5;
  const fruitRest: Array<{ h01: number }> = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rnd() * 0.8;
    const rr = baseR * (0.18 + rnd() * 0.36);
    const y = H * (0.2 + rnd() * 0.42);
    const sz = Math.min(0.34, 0.12 + radius * 0.07) * (0.8 + rnd() * 0.5);
    const g = new THREE.SphereGeometry(sz, 10, 8);
    fruitBatch.add(g, fruitColors[i % fruitColors.length]!, { p: [Math.cos(a) * rr, y, Math.sin(a) * rr], s: [1, 0.72, 0.9], r: [rnd(), rnd(), rnd()] });
    fruitRest.push({ h01: y / H });
  }
  const fruitMesh = fruitBatch.mesh(vcMat('glossy'));
  fruitMesh.castShadow = false;
  fruit.add(fruitMesh);
  root.add(fruit);

  // ── the jelly ──
  const jellyMat = own(mat.jelly(color, 0.78));
  jellyMat.emissive = new THREE.Color(mixHex(color, PALETTE.berry, 0.3));
  jellyMat.emissiveIntensity = 0.22; // fakes light scattering through the body
  const geo = gridSurface(SEG_U, SEG_V, (u, v, out) => {
    const phi = v * phiMax;
    const th = u * TAU;
    const r = radius * Math.sin(phi);
    // sits on the plate's well, not inside it
    out.set(r * Math.cos(th), Math.max(0.035, cy + radius * Math.cos(phi)), r * Math.sin(th));
  }, { closeU: true });
  const dome = new THREE.Mesh(geo, jellyMat);
  dome.castShadow = true;
  dome.renderOrder = 2;
  root.add(dome);
  // deep core: a smaller, darker body inside so the dome has depth instead of looking like glass
  const coreMat = own(mat.jelly(mixHex(color, PALETTE.ink, 0.25), 0.5));
  coreMat.depthWrite = false;
  const core = new THREE.Mesh(geo, coreMat);
  core.scale.setScalar(0.72);
  core.renderOrder = 1;
  root.add(core);

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const rest = (posAttr.array as Float32Array).slice();

  // squash = vertical bounce mode, swayX/Z = the top slewing sideways, ripple = surface ring
  const squash = new Spring(0, 410, 7.2);
  const swayX = new Spring(0, 330, 6.4);
  const twist = new Spring(0, 260, 7);
  let rippleT = 9;
  let rippleAmp = 0;
  let time = 0;

  function deform(sq: number, sx: number, tw: number): void {
    const arr = posAttr.array as Float32Array;
    const rip = rippleAmp * Math.exp(-rippleT * 4.2);
    for (let i = 0; i < posAttr.count; i++) {
      const o = i * 3;
      const x0 = rest[o]!;
      const y0 = rest[o + 1]!;
      const z0 = rest[o + 2]!;
      const h = clamp01(y0 / H);
      // volume-ish preserving squash: shorter → fatter around the waist
      const waist = Math.sin(Math.min(1, h * 1.15) * Math.PI);
      const bulge = 1 + sq * 0.34 * (0.35 + 0.65 * waist) * (h > 0.02 ? 1 : 0.15);
      const lean = Math.pow(h, 1.4);
      const ring = rip * Math.sin(h * 9 - rippleT * 26) * 0.045 * radius * (1 - h) * h * 4;
      const ca = Math.cos(tw * lean);
      const sa = Math.sin(tw * lean);
      const xb = x0 * bulge;
      const zb = z0 * bulge;
      const rr = Math.hypot(xb, zb) || 1;
      arr[o] = xb * ca - zb * sa + sx * lean * radius + (xb / rr) * ring;
      arr[o + 1] = y0 * (1 - sq * 0.42 * Math.pow(h, 0.8)) - Math.abs(sx) * lean * radius * 0.12;
      arr[o + 2] = xb * sa + zb * ca + (zb / rr) * ring;
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    fruit.position.x = sx * radius * 0.4;
    fruit.scale.set(1 + sq * 0.2, 1 - sq * 0.36, 1 + sq * 0.2);
    core.position.x = sx * radius * 0.3;
    core.scale.set(0.72 * (1 + sq * 0.3), 0.72 * (1 - sq * 0.4), 0.72 * (1 + sq * 0.3));
  }

  return {
    root,
    boing(strength: number, dirX: number): void {
      const s = 0.25 + 0.75 * clamp01(strength);
      const d = Math.max(-1, Math.min(1, dirX));
      squash.kick(15.5 * s);
      swayX.kick(-d * 7.5 * s - (d === 0 ? 1.2 * s : 0));
      twist.kick((d >= 0 ? 1 : -1) * 2.6 * s);
      rippleT = 0;
      rippleAmp = s;
    },
    update(dt: number): void {
      time += dt;
      rippleT += dt;
      const sq = squash.update(dt);
      const sx = swayX.update(dt);
      const tw = twist.update(dt);
      // it never sits perfectly still: a slow breathing jiggle
      const idle = Math.sin(time * 2.1) * 0.012 + Math.sin(time * 3.7 + 1) * 0.006;
      const idleX = Math.sin(time * 1.3 + 0.5) * 0.012;
      deform(sq + idle, sx + idleX, tw);
    },
  };
}

function clampCos(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/**
 * Things that lie flat on the cloth: the catcher's lace-paper runway and the frosting splats
 * left behind by a miss.
 */
import * as THREE from 'three';
import type { Animated } from '../../kit/contracts';
import { Spring, mat } from '../../kit/materials';
import { doilyTexture } from './textures';
import { Batch, TAU, gridSurface, mixHex, own, seeded, vcMat } from './util';

/** Gameplay-facing numbers (mirrored by the dev page's debug overlay). */
export const RUNWAY = {
  halfWidth: 1.3,
  y: 0.014,
} as const;

/**
 * The catcher's lane: a lace-paper runner from local x = 0 to x = length, z in [-1.3, 1.3],
 * lying just above the cloth. Scalloped, punched edge; two soft ribbon lines; a stitched centre.
 */
export function buildRunway(length: number): Animated {
  const root = new THREE.Group();
  root.name = 'runway';
  const tex = doilyTexture(length, RUNWAY.halfWidth);
  const paper = own(mat.fabric('#ffffff'));
  paper.map = tex;
  paper.alphaTest = 0.5;
  paper.roughness = 0.9;
  const geo = new THREE.PlaneGeometry(length, RUNWAY.halfWidth * 2, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(length / 2, RUNWAY.y, 0);
  const m = new THREE.Mesh(geo, paper);
  m.receiveShadow = true;
  m.castShadow = false;
  root.add(m);
  return {
    root,
    update(): void {
      /* paper lies still */
    },
  };
}

/**
 * A frosting splat on the cloth (y ≈ 0.02), about 1.6 wide, irregular and seeded.
 * It lands with a quick squelch (grows + settles) the first time it is updated.
 */
export function buildSplat(color: string, seed: number): Animated {
  const root = new THREE.Group();
  root.name = 'splat';
  const rnd = seeded(seed * 7919 + 13);
  const arms: Array<{ a: number; len: number; sharp: number }> = [];
  const n = 6 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    arms.push({ a: ((i + rnd() * 0.7) / n) * TAU, len: 0.18 + rnd() * 0.5, sharp: 5 + rnd() * 9 });
  }
  const core = 0.36 + rnd() * 0.06;
  const outline = (th: number): number => {
    let r = core * (1 + 0.08 * Math.sin(th * 3 + seed));
    for (const arm of arms) {
      const d = Math.cos(th - arm.a);
      if (d > 0) r += arm.len * Math.pow(d, arm.sharp) * core * 2.2;
    }
    return r;
  };
  // normalise so the widest reach is 0.8 → about 1.6 across
  let maxR = 0;
  for (let i = 0; i < 90; i++) maxR = Math.max(maxR, outline((i / 90) * TAU));
  const k = 0.8 / maxR;

  const batch = new Batch();
  const deep = new THREE.Color(mixHex(color, '#7a2e4a', 0.14));
  const base = new THREE.Color(color);
  const light = new THREE.Color(mixHex(color, '#ffffff', 0.3));
  const blob = gridSurface(48, 6, (u, v, out) => {
    const th = u * TAU;
    const rr = outline(th) * k;
    const t = v; // 0 centre → 1 edge
    // thick in the middle, a rounded bead at the rim, thinner out along the arms
    const thin = core * k / rr;
    const h = (0.075 * Math.pow(1 - t * t, 0.55) + 0.03 * Math.exp(-(((t - 0.82) / 0.13) ** 2))) * (0.45 + 0.55 * thin);
    out.set(rr * t * Math.cos(th), t >= 1 ? 0 : h, rr * t * Math.sin(th));
  }, {
    closeU: true,
    color: (_u, v, out) => {
      out.copy(light).lerp(base, Math.min(1, v * 1.5));
      if (v > 0.9) out.lerp(deep, 0.5);
    },
  });
  batch.add(blob, null);
  // flung droplets
  const drops = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < drops; i++) {
    const arm = arms[i % arms.length]!;
    const a = arm.a + (rnd() - 0.5) * 0.25;
    const dist = (outline(a) * k) + 0.1 + rnd() * 0.28;
    const s = 0.045 + rnd() * 0.06;
    const g = new THREE.SphereGeometry(s, 10, 6);
    g.scale(1.3, 0.45, 1);
    g.rotateY(-a);
    batch.add(g, color, { p: [Math.cos(a) * dist, s * 0.2, Math.sin(a) * dist] });
  }
  const m = batch.mesh(vcMat('glossy'));
  m.castShadow = false;
  m.position.y = 0.02;
  root.add(m);

  const grow = new Spring(0.25, 210, 13);
  grow.target = 1;
  let settled = false;
  m.scale.set(0.25, 2.2, 0.25);
  return {
    root,
    update(dt: number): void {
      if (settled) return;
      const g = grow.update(dt);
      m.scale.set(g, Math.max(0.6, 1 + (1 - g) * 1.6), g);
      if (Math.abs(g - 1) < 0.002 && Math.abs(grow.velocity) < 0.01) {
        m.scale.set(1, 1, 1);
        settled = true;
      }
    },
  };
}

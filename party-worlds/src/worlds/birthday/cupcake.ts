/**
 * Cupcakes. The gameplay obstacle (exact collision silhouette) and the shared builder the table
 * scene uses for its paler, decorative ones.
 */
import * as THREE from 'three';
import type { Animated } from '../../kit/contracts';
import { PALETTE, Spring } from '../../kit/materials';
import { Batch, TAU, clamp01, gridSurface, lerp, mixHex, pleat, smoothstep, vcMat } from './util';

export interface CupcakeLook {
  radius: number;
  /** total height: wrapper block + frosting dome of `radius` */
  height: number;
  /** wrapper base radius as a fraction of radius (1 = straight sides, as the obstacle needs) */
  taper?: number;
  wrapper: string;
  frosting: string;
  topping?: 'cherry' | 'candle' | 'none';
  toppingColor?: string;
  /** mesh density: 1 hero, 0.6 background */
  detail?: number;
  spin?: number;
}

/**
 * Adds one cupcake to the given batches, origin on the table under its centre.
 * `paper` should be rendered matte, `cream` glossy.
 */
export function addCupcake(paper: Batch, cream: Batch, look: CupcakeLook, at: [number, number, number] = [0, 0, 0]): void {
  const r = look.radius;
  const wrapH = Math.max(0.2, look.height - r);
  const taper = look.taper ?? 1;
  const detail = look.detail ?? 1;
  const spin = look.spin ?? 0;
  const pleats = Math.max(12, Math.round(18 * Math.sqrt(r)));
  const depth = 0.07 * r;

  // wrapper: crests sit exactly on the collision width
  const wCol = new THREE.Color(look.wrapper);
  const wDeep = new THREE.Color(mixHex(look.wrapper, PALETTE.ink, 0.22));
  const wrapper = gridSurface(pleats * (detail >= 1 ? 4 : 3), detail >= 1 ? 4 : 2, (u, v, out) => {
    const th = u * TAU + spin;
    const rr = r * lerp(taper, 1, v) - depth * (1 - pleat(th, pleats)) * lerp(0.35, 1, v);
    out.set(rr * Math.cos(th), wrapH * v, rr * Math.sin(th));
  }, {
    closeU: true,
    flip: true,
    color: (u, v, out) => {
      const w = pleat(u * TAU + spin, pleats);
      out.copy(wDeep).lerp(wCol, 0.2 + 0.8 * w);
      if (v > 0.93) out.lerp(new THREE.Color('#ffffff'), 0.25); // lighter crimped lip
    },
  });
  paper.add(wrapper, null, { p: at });

  // frosting: a piped spiral inside a hemisphere of exactly `radius`
  const ridges = 7;
  const coils = 3;
  const hasCherry = (look.topping ?? 'cherry') === 'cherry';
  const fCol = new THREE.Color(look.frosting);
  const fDeep = new THREE.Color(mixHex(look.frosting, PALETTE.berry, 0.2));
  const nu = Math.round(44 * detail);
  const nv = Math.round(13 * detail);
  const frostR = (th: number, phi: number): number => {
    const coil = 0.5 - 0.5 * Math.cos(coils * 4 * phi + th); // helical rope: 3 turns pole → rim
    const rope = 0.5 - 0.5 * Math.cos(ridges * th + 7 * phi);
    let k = 1 - 0.105 * coil - 0.045 * rope * (0.4 + 0.6 * coil);
    // a dimple at the crown for the cherry to sit in
    if (hasCherry) k -= 0.2 * (1 - smoothstep(0.0, 0.5, phi));
    return r * k;
  };
  const frosting = gridSurface(nu, nv, (u, v, out) => {
    const th = u * TAU + spin;
    const phi = v * (Math.PI / 2);
    const rr = frostR(th, phi);
    out.set(rr * Math.sin(phi) * Math.cos(th), wrapH + rr * Math.cos(phi), rr * Math.sin(phi) * Math.sin(th));
  }, {
    closeU: true,
    color: (u, v, out) => {
      const th = u * TAU + spin;
      const phi = v * (Math.PI / 2);
      const coil = 0.5 - 0.5 * Math.cos(coils * 4 * phi + th);
      out.copy(fCol).lerp(fDeep, coil * 0.55);
    },
  });
  cream.add(frosting, null, { p: at });

  const topColor = look.toppingColor ?? '#e5364f';
  if (hasCherry) {
    const cr = 0.25 * r;
    const cherry = new THREE.SphereGeometry(cr, Math.round(16 * detail), Math.round(12 * detail));
    cream.add(cherry, topColor, { p: [at[0], at[1] + wrapH + r - cr - 0.02 * r, at[2]] });
  } else if (look.topping === 'candle') {
    // stays inside the hemisphere: a stubby candle sunk into the swirl
    const ch = 0.3 * r;
    paper.add(new THREE.CylinderGeometry(0.07 * r, 0.07 * r, ch, 10), topColor, { p: [at[0], at[1] + wrapH + r * 0.8 - ch / 2 + 0.08 * r, at[2]] });
  }
}

/**
 * Obstacle cupcake. Origin on the table under its centre. The wrapper is a straight-sided block
 * exactly 2 * radius wide from y = 0 to y = height - radius; the frosting's outline is the circle
 * of `radius` centred at (0, height - radius); the cherry stays inside that circle.
 * `bump()` is an optional extra (not in the contract): a frosting jiggle for the view's hit event.
 */
export function buildCupcake(radius: number, height: number): Animated & { bump(strength: number): void } {
  const root = new THREE.Group();
  root.name = 'cupcake';
  const paper = new Batch();
  const cream = new Batch();
  addCupcake(paper, cream, {
    radius, height, taper: 1, wrapper: PALETTE.teal, frosting: PALETTE.frosting, topping: 'cherry',
  });
  const wrapperMesh = paper.mesh(vcMat('paper'));
  const top = new THREE.Group();
  const wrapH = Math.max(0.2, height - radius);
  // pivot the frosting about the top of the wrapper so a jiggle keeps it seated
  top.position.y = wrapH;
  const creamMesh = cream.mesh(vcMat('glossy'));
  creamMesh.position.y = -wrapH;
  top.add(creamMesh);
  root.add(wrapperMesh, top);

  const wobX = new Spring(0, 240, 8);
  const squash = new Spring(0, 300, 9);
  return {
    root,
    bump(strength: number): void {
      const s = 0.3 + 0.7 * clamp01(strength);
      wobX.kick(4 * s);
      squash.kick(5 * s);
    },
    update(dt: number): void {
      const w = wobX.update(dt);
      const q = squash.update(dt);
      top.rotation.z = w * 0.09;
      top.scale.set(1 + q * 0.05, 1 - q * 0.08, 1 + q * 0.05);
    },
  };
}

// Placeholder props so the game shell can be exercised before the real world kit lands.
// Enabled only with STUBS=1 (see vite.config.ts). Never shipped.
import * as THREE from 'three';
import type {
  Animated, Balloon, CatchBasket, CocktailUmbrella, JellyDome, RingGate, SpoonCatapult, TableFan, TableScene, WindStreamers,
} from '../../src/kit/contracts';
import { PALETTE, mat, mesh, shadows } from '../../src/kit/materials';

const still = (root: THREE.Group): Animated => ({ root, update: () => undefined });

export function buildTableScene(opts: { xMin: number; xMax: number }): TableScene {
  const root = new THREE.Group();
  const w = opts.xMax - opts.xMin + 50;
  root.add(mesh(new THREE.BoxGeometry(w, 1, 34), mat.fabric(PALETTE.cloth), [(opts.xMin + opts.xMax) / 2, -0.5, -5]));
  shadows(root, false, true);
  return { root, groundY: 0, update: () => undefined };
}
export function buildSpoonCatapult(): SpoonCatapult {
  const root = new THREE.Group();
  const seat = new THREE.Object3D();
  seat.position.set(0, 1.95, 0);
  const bowl = mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.metal());
  const handle = mesh(new THREE.BoxGeometry(7, 0.2, 0.6), mat.metal(), [-3.5, 1.0, 0]);
  handle.rotation.z = 0.28;
  root.add(seat, handle);
  seat.add(bowl);
  shadows(root);
  return {
    root, seat,
    setPull(p, aim) { seat.position.set(-Math.cos(aim) * p * 1.6, Math.max(0.55, 1.95 - Math.sin(aim) * p * 1.6), 0); },
    fire() { seat.position.set(0, 1.95, 0); },
    update: () => undefined,
  };
}
export function buildCatchBasket(): CatchBasket {
  const root = new THREE.Group();
  root.add(mesh(new THREE.CylinderGeometry(0.85, 0.55, 0.9, 20, 1, true), new THREE.MeshStandardMaterial({ color: PALETTE.coral, side: THREE.DoubleSide }), [0, 0.45, 0]));
  shadows(root);
  return { root, thump: () => undefined, rattle: () => undefined, update: () => undefined };
}
export function buildCocktailUmbrella(color = PALETTE.berry): CocktailUmbrella {
  const root = new THREE.Group();
  const canopy = mesh(new THREE.ConeGeometry(0.95, 0.4, 12, 1, true), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }), [0, 0.95, 0]);
  root.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95), mat.clay(PALETTE.cocoa), [0, 0.475, 0]), canopy);
  return { root, setOpen(o) { canopy.scale.set(0.15 + o * 0.85, 1 + (1 - o) * 1.2, 0.15 + o * 0.85); }, setWear: () => undefined, update: () => undefined };
}
export function buildJellyDome(radius: number): JellyDome {
  const root = new THREE.Group();
  root.add(mesh(new THREE.SphereGeometry(radius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.jelly(PALETTE.berry)));
  let w = 0;
  return { root, boing(s) { w = s; }, update(dt) { w *= Math.exp(-dt * 5); root.children[0]!.scale.y = 1 - w * 0.3 * Math.cos(w * 20); } };
}
export function buildBalloon(radius: number, color: string, _len: number): Balloon {
  const root = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(radius, 20, 14), mat.glossy(color));
  root.add(b);
  let popped = false;
  return { root, bump: () => undefined, pop() { popped = true; b.visible = false; }, get popped() { return popped; }, update: () => undefined };
}
export function buildRingGate(innerRadius: number): RingGate {
  const root = new THREE.Group();
  const t = mesh(new THREE.TorusGeometry(innerRadius + 0.45, 0.45, 12, 28), mat.glossy(PALETTE.frosting));
  t.rotation.y = Math.PI / 2;
  root.add(t);
  return { root, celebrate: () => undefined, setCollected(c) { t.visible = !c; }, update: () => undefined };
}
export function buildTableFan(): TableFan {
  const root = new THREE.Group();
  root.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.1), mat.clay(PALETTE.teal), [0, 1.55, 0]), mesh(new THREE.TorusGeometry(1, 0.12, 8, 20), mat.clay(PALETTE.navy), [0, 3.1, 0]));
  return { root, setStrength: () => undefined, update: () => undefined };
}
export function buildWindStreamers(_w: number, _h: number): WindStreamers {
  return { root: new THREE.Group(), setWind: () => undefined, update: () => undefined };
}
export function buildRunway(length: number): Animated {
  const root = new THREE.Group();
  root.add(mesh(new THREE.BoxGeometry(length, 0.04, 2.6), mat.fabric(PALETTE.paper), [length / 2, 0.02, 0]));
  shadows(root, false, true);
  return still(root);
}
export function buildCupcake(radius: number, height: number): Animated {
  const root = new THREE.Group();
  root.add(mesh(new THREE.BoxGeometry(radius * 2, height - radius, radius * 2), mat.clay(PALETTE.coral), [0, (height - radius) / 2, 0]), mesh(new THREE.SphereGeometry(radius, 16, 12), mat.glossy(PALETTE.frosting), [0, height - radius, 0]));
  return still(root);
}
export function buildSplat(color: string, _seed: number): Animated {
  const root = new THREE.Group();
  const m = mesh(new THREE.CircleGeometry(0.8, 16), mat.glossy(color), [0, 0.03, 0]);
  m.rotation.x = -Math.PI / 2;
  root.add(m);
  return still(root);
}

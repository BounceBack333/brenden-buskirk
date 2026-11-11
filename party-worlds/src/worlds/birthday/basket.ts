/**
 * The catch basket: a pleated paper cupcake liner, bold coral with a paler inside and a bright
 * rolled rim, so it reads instantly as "land here".
 * Origin at bottom centre. Inner opening exactly 1.7 wide at height 0.9; base 1.1 wide.
 */
import * as THREE from 'three';
import type { CatchBasket } from '../../kit/contracts';
import { PALETTE, Spring } from '../../kit/materials';
import { clamp01, gridSurface, lerp, mixHex, pleat, TAU, vcMat } from './util';

/** Gameplay-facing numbers (mirrored by the dev page's debug overlay and TUNE.basket in the sim). */
export const BASKET = {
  halfOpen: 0.85,
  depth: 0.9,
  halfBase: 0.55,
} as const;

const PLEATS = 18;
const COLS = PLEATS * 6;
const WALL = 0.03;

interface LinerOpts {
  outer: string;
  outerDeep: string;
  inner: string;
  rim: string;
}

/** v ranges of the single closed surface */
const V_BASE = 0.07; // underside disc
const V_OUT = 0.5; // outer wall bottom → top
const V_LIP = 0.56; // rolled rim
const V_IN = 0.93; // inner wall top → bottom, then the floor to the centre

function wallRadius(h01: number): number {
  // slightly bellied flare from the base to the rim
  return lerp(BASKET.halfBase, BASKET.halfOpen, Math.pow(h01, 0.85));
}
function pleatDepth(h01: number): number {
  return lerp(0.012, 0.095, Math.pow(h01, 0.8));
}

function linerPoint(u: number, v: number, out: THREE.Vector3): { h01: number; wall: boolean } {
  const th = u * TAU;
  const c = Math.cos(th);
  const s = Math.sin(th);
  // pleats ripple about the nominal wall, so the mean opening is exactly 2 * halfOpen
  const w = pleat(th, PLEATS) - 0.5;
  let r: number;
  let y: number;
  let h01 = 0;
  let wall = false;
  if (v <= V_BASE) {
    const t = v / V_BASE;
    r = (BASKET.halfBase + WALL) * t;
    y = 0.012 * (1 - t);
  } else if (v <= V_OUT) {
    h01 = (v - V_BASE) / (V_OUT - V_BASE);
    r = wallRadius(h01) + pleatDepth(h01) * w + WALL;
    y = BASKET.depth * h01;
    wall = true;
  } else if (v <= V_LIP) {
    const t = (v - V_OUT) / (V_LIP - V_OUT);
    h01 = 1;
    // roll over the top: outside → inside, bulging up and a little outward
    r = wallRadius(1) + pleatDepth(1) * w + WALL * (1 - t) + 0.012 * Math.sin(t * Math.PI);
    y = BASKET.depth + 0.03 * Math.sin(t * Math.PI);
    wall = true;
  } else if (v <= V_IN) {
    const t = (v - V_LIP) / (V_IN - V_LIP);
    h01 = 1 - t;
    r = wallRadius(h01) + pleatDepth(h01) * w;
    y = lerp(BASKET.depth, 0.04, t);
    wall = true;
  } else {
    const t = (v - V_IN) / (1 - V_IN);
    r = BASKET.halfBase * (1 - t);
    y = 0.04;
  }
  out.set(r * c, y, r * s);
  return { h01, wall };
}

function linerColor(o: LinerOpts): (u: number, v: number, out: THREE.Color) => void {
  const outer = new THREE.Color(o.outer);
  const deep = new THREE.Color(o.outerDeep);
  const inner = new THREE.Color(o.inner);
  const innerDeep = new THREE.Color(mixHex(o.inner, o.outer, 0.35));
  const rim = new THREE.Color(o.rim);
  return (u, v, out) => {
    const w = pleat(u * TAU, PLEATS);
    if (v <= V_BASE) out.copy(deep);
    else if (v <= V_OUT - 0.045) out.copy(deep).lerp(outer, 0.25 + 0.75 * w); // valleys a shade deeper
    else if (v <= V_LIP + 0.03) out.copy(rim);
    else if (v <= V_IN) out.copy(innerDeep).lerp(inner, 0.3 + 0.7 * w);
    else out.copy(inner);
  };
}

export function buildCatchBasket(): CatchBasket {
  const root = new THREE.Group();
  root.name = 'catch-basket';
  const body = new THREE.Group();
  root.add(body);

  const rows = 20;
  const info: Array<{ h01: number; wall: boolean; theta: number }> = [];
  const geo = gridSurface(COLS, rows, (u, v, out) => {
    const i = linerPoint(u, v, out);
    info.push({ h01: i.h01, wall: i.wall, theta: u * TAU });
  }, {
    closeU: true,
    flip: true,
    color: linerColor({
      outer: PALETTE.coral,
      outerDeep: mixHex(PALETTE.coral, PALETTE.berry, 0.45),
      inner: '#ffd9cc',
      rim: PALETTE.frostingWhite,
    }),
  });
  const liner = new THREE.Mesh(geo, vcMat('satin'));
  liner.castShadow = true;
  liner.receiveShadow = true;
  body.add(liner);

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const rest = (posAttr.array as Float32Array).slice();

  const squash = new Spring(0, 420, 13);
  const sway = new Spring(0, 300, 12);
  let rattleT = 99;
  let rattleDir = 1;
  let rattleAmp = 0;
  let deformed = false;

  function deform(): void {
    const arr = posAttr.array as Float32Array;
    const env = Math.exp(-rattleT * 8.5) * rattleAmp;
    const wave = Math.sin(rattleT * 58);
    const wave2 = Math.sin(rattleT * 91 + 1.3);
    const side = rattleDir >= 0 ? 0 : Math.PI;
    for (let i = 0; i < info.length; i++) {
      const o = i * 3;
      const inf = info[i]!;
      let x = rest[o]!;
      let y = rest[o + 1]!;
      let z = rest[o + 2]!;
      if (inf.wall && env > 0.0005) {
        const facing = Math.max(0, Math.cos(inf.theta - side));
        const k = facing * facing * inf.h01 * inf.h01;
        const dr = env * k * (0.11 * wave + 0.035 * wave2 * Math.cos(inf.theta * 5));
        const r = Math.hypot(x, z) || 1;
        x += (x / r) * dr;
        z += (z / r) * dr;
        y += env * k * 0.07 * wave2;
      }
      arr[o] = x;
      arr[o + 1] = y;
      arr[o + 2] = z;
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return {
    root,
    thump(strength: number): void {
      squash.kick(5 + 13 * clamp01(strength));
    },
    rattle(dir: number): void {
      rattleDir = dir >= 0 ? 1 : -1;
      rattleT = 0;
      rattleAmp = 1;
      sway.kick(-rattleDir * 5.5);
    },
    update(dt: number): void {
      const s = squash.update(dt);
      const w = sway.update(dt);
      // squash from the base so it stays planted on the carry anchor
      const sy = 1 - 0.36 * s;
      const sxz = 1 + 0.2 * s;
      body.scale.set(sxz, Math.max(0.5, sy), sxz);
      body.rotation.z = w * 0.14;
      rattleT += dt;
      const active = Math.exp(-rattleT * 8.5) * rattleAmp > 0.004;
      if (active) {
        deform();
        deformed = true;
      } else if (deformed) {
        rattleAmp = 0;
        deform();
        deformed = false;
      }
    },
  };
}

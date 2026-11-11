/**
 * The Birthday Continental: the table top, its set dressing and the out-of-focus party room.
 *
 * Staging rules this file obeys:
 *  - table top is y = 0; cloth covers x in [xMin - 40, xMax + 46], z in [-28, 12] and drapes over
 *    the front edge;
 *  - ALL set dressing sits at z <= -3.5, so nothing can come between a +z camera and the
 *    gameplay plane;
 *  - the nearest row (z > -8) stays flat, the tall things live deep and toward the sides, so the
 *    catcher lane and the flight corridor have calm cloth / soft room behind them;
 *  - decoration is one step paler and more matte than anything interactive.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { TableScene } from '../../kit/contracts';
import { PALETTE, mat } from '../../kit/materials';
import { addCupcake } from './cupcake';
import {
  GINGHAM_TILE, ROOM_WALL, bokehTexture, ginghamTexture, roomBackdropTexture, softDiscTexture, softFlagTexture,
  softSlabTexture, sprinkleTexture, weaveBumpTexture, wrapPatternTexture,
} from './textures';
import { Batch, TAU, type Rand, gridSurface, lathe, lerp, mixHex, own, paintBy, seeded, smoothProfile, vcMat, xf } from './util';

/** Nearest any set dressing may come to the gameplay plane. */
export const DRESSING_Z_MAX = -3.5;
const Z_BACK = -28;
const Z_FRONT = 12;

/** One step paler: mix toward the cloth cream. */
const pale = (hex: string, t = 0.38): string => mixHex(hex, PALETTE.cream, t);

interface Batches {
  clay: Batch;
  glossy: Batch;
  paper: Batch;
  metal: Batch;
  dots: Batch;
  stripes: Batch;
  curl: Batch;
}

// ───────────────────────────── cloth ─────────────────────────────

function buildCloth(x0: number, x1: number): THREE.Mesh {
  // cross-section from the back edge, across the top, round the front edge and down the drape
  const bevel = 0.9;
  const section: Array<{ z: number; y: number; wave: number }> = [
    { z: Z_BACK - 0.4, y: -7, wave: 0 },
    { z: Z_BACK, y: 0, wave: 0 },
    { z: Z_FRONT - bevel, y: 0, wave: 0 },
  ];
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    section.push({ z: Z_FRONT - bevel + bevel * Math.sin(a), y: -bevel + bevel * Math.cos(a), wave: 0.02 * i });
  }
  section.push({ z: Z_FRONT + 0.05, y: -3.2, wave: 0.3 });
  section.push({ z: Z_FRONT + 0.1, y: -7, wave: 0.65 });
  section.push({ z: Z_FRONT + 0.1, y: -12.5, wave: 0.95 });
  section.push({ z: Z_FRONT + 0.1, y: -22, wave: 1.25 });
  // arc length along the section drives v so the gingham flows over the edge without stretching
  const dist: number[] = [0];
  for (let i = 1; i < section.length; i++) {
    dist.push(dist[i - 1]! + Math.hypot(section[i]!.z - section[i - 1]!.z, section[i]!.y - section[i - 1]!.y));
  }
  const nu = Math.ceil((x1 - x0) / 1.6);
  const nv = section.length - 1;
  const geo = gridSurface(nu, nv, (u, v, out) => {
    const s = section[Math.round(v * nv)]!;
    const x = lerp(x0, x1, u);
    // soft hanging folds, deeper toward the hem
    const fold = Math.sin(x * 0.52 + 0.8 * Math.sin(x * 0.11)) + 0.45 * Math.sin(x * 1.13 + 2);
    out.set(x, s.y, s.z + s.wave * fold * 0.62);
  }, { flip: true, uv: true });
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const k = j * (nu + 1) + i;
      uv.setXY(k, lerp(x0, x1, i / nu) / GINGHAM_TILE, -dist[j]! / GINGHAM_TILE);
    }
  }
  const cloth = own(mat.fabric('#ffffff'));
  cloth.map = ginghamTexture();
  cloth.bumpMap = weaveBumpTexture();
  cloth.bumpScale = 0.35;
  // the weave is far finer than the check: give the bump its own tiling through a second uv set
  const uv2 = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    uv2[i * 2] = uv.getX(i) * 9;
    uv2[i * 2 + 1] = uv.getY(i) * 9;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv2, 2));
  cloth.bumpMap.channel = 1;
  const m = new THREE.Mesh(geo, cloth);
  m.name = 'cloth';
  m.receiveShadow = true;
  return m;
}

// ───────────────────────────── set dressing pieces ─────────────────────────────

function addPresent(b: Batches, pattern: 'dots' | 'stripes' | 'plain', size: [number, number, number], color: string, ribbon: string, at: [number, number, number], yaw: number, lid = true): void {
  const [w, h, d] = size;
  const box = new RoundedBoxGeometry(w, h, d, 2, 0.14);
  scaleUv(box, Math.max(w, d) / 2.2, h / 2.2);
  const target = pattern === 'dots' ? b.dots : pattern === 'stripes' ? b.stripes : b.paper;
  const base: [number, number, number] = [at[0], at[1] + h / 2, at[2]];
  target.add(box, color, { p: base, r: [0, yaw, 0] });
  if (lid) {
    const lidGeo = new RoundedBoxGeometry(w + 0.22, h * 0.2, d + 0.22, 2, 0.1);
    scaleUv(lidGeo, Math.max(w, d) / 2.2, 0.4);
    target.add(lidGeo, mixHex(color, '#ffffff', 0.18), { p: [at[0], at[1] + h * 0.92, at[2]], r: [0, yaw, 0] });
  }
  // ribbon cross
  const rw = Math.min(w, d) * 0.16;
  const top = at[1] + h + (lid ? h * 0.02 : 0);
  const pad = lid ? 0.3 : 0.08;
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(at[0], at[1], at[2]);
  const bandA = new THREE.BoxGeometry(rw, h + 0.1, d + pad);
  bandA.translate(0, h / 2 + 0.03, 0);
  bandA.applyMatrix4(m);
  b.glossy.add(bandA, ribbon);
  const bandB = new THREE.BoxGeometry(w + pad, h + 0.1, rw);
  bandB.translate(0, h / 2 + 0.03, 0);
  bandB.applyMatrix4(m);
  b.glossy.add(bandB, ribbon);
  // bow: two loops, a knot, two tails
  const bs = Math.min(w, d) * 0.2;
  for (const side of [-1, 1]) {
    const loop = new THREE.TorusGeometry(bs, bs * 0.3, 6, 14);
    loop.scale(1.25, 0.8, 1);
    loop.rotateX(Math.PI / 2 - 0.5);
    loop.rotateY(0.4 * side);
    loop.translate(side * bs * 1.15, top + bs * 0.55, 0);
    loop.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw + 0.5).setPosition(at[0], 0, at[2]));
    b.glossy.add(loop, ribbon);
  }
  b.glossy.add(new THREE.SphereGeometry(bs * 0.42, 10, 8), mixHex(ribbon, PALETTE.ink, 0.12), { p: [at[0], top + bs * 0.45, at[2]] });
}

function scaleUv(geo: THREE.BufferGeometry, su: number, sv: number): void {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

function addPartyHat(b: Batches, r: number, h: number, color: string, pom: string, pattern: 'dots' | 'stripes', at: [number, number, number], rot: [number, number, number]): void {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])).setPosition(at[0], at[1], at[2]);
  const cone = new THREE.ConeGeometry(r, h, 30, 3, true);
  cone.translate(0, h / 2, 0);
  scaleUv(cone, 5, 2.4);
  cone.applyMatrix4(m);
  (pattern === 'dots' ? b.dots : b.stripes).add(cone, color);
  // crepe ruffle round the brim
  const ruffle = gridSurface(36, 3, (u, v, out) => {
    const th = u * TAU;
    const a = v * Math.PI;
    const rr = r + 0.02 + 0.14 * r * Math.sin(a) * (0.75 + 0.25 * Math.cos(th * 12));
    out.set(rr * Math.cos(th), 0.03 + 0.16 * r * (1 - Math.cos(a)), rr * Math.sin(th));
  }, { closeU: true, flip: true });
  ruffle.applyMatrix4(m);
  b.paper.add(ruffle, pom);
  // pom-pom
  const ball = new THREE.SphereGeometry(r * 0.26, 12, 9);
  const p = ball.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const k = 1 + 0.1 * Math.sin(p.getX(i) * 31 + p.getY(i) * 17 + p.getZ(i) * 23);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  ball.computeVertexNormals();
  ball.translate(0, h + r * 0.1, 0);
  ball.applyMatrix4(m);
  b.paper.add(ball, pom);
}

function addPlate(b: Batches, r: number, rim: string, at: [number, number, number]): void {
  const plate = lathe(smoothProfile([
    [0, 0], [r * 0.5, 0], [r * 0.66, 0.02], [r * 0.98, 0.3], [r, 0.34], [r * 0.97, 0.37], [r * 0.66, 0.13], [r * 0.56, 0.08], [0, 0.07],
  ], 20), 44);
  const white = new THREE.Color(PALETTE.frostingWhite);
  const band = new THREE.Color(rim);
  paintBy(plate, (x, _y, z, out) => {
    const d = Math.hypot(x, z) / r;
    out.copy(white);
    if (d > 0.84 && d < 0.93) out.copy(band);
  });
  b.glossy.add(plate, null, { p: at });
}

function addCrumbs(b: Batches, rnd: Rand, count: number, radius: number, at: [number, number, number], color: string): void {
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * radius;
    const s = 0.06 + rnd() * 0.12;
    const g = new THREE.IcosahedronGeometry(s, 0);
    g.scale(1, 0.7, 1);
    b.clay.add(g, mixHex(color, PALETTE.cocoa, rnd() * 0.2), { p: [at[0] + Math.cos(a) * d, at[1] + s * 0.5, at[2] + Math.sin(a) * d], r: [rnd() * 3, rnd() * 3, 0] });
  }
}

/** A cut wedge of layer cake lying on a plate. */
function addCakeSlice(b: Batches, at: [number, number, number], yaw: number): void {
  const len = 3.0;
  const half = 0.95;
  const h = 1.7;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(len, -half);
  shape.quadraticCurveTo(len + 0.25, 0, len, half);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, steps: 6, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  const sponge = new THREE.Color(pale(PALETTE.sponge, 0.15));
  const cream = new THREE.Color(PALETTE.frostingWhite);
  const jam = new THREE.Color(pale(PALETTE.berry, 0.25));
  const icing = new THREE.Color(pale(PALETTE.frosting, 0.2));
  paintBy(g, (x, y, z, out) => {
    const back = Math.hypot(x, z) > len - 0.12; // outer crust is iced
    const t = y / h;
    if (t > 0.9 || back) out.copy(icing);
    else if (Math.abs(t - 0.5) < 0.05) out.copy(jam);
    else if (Math.abs(t - 0.5) < 0.1) out.copy(cream);
    else out.copy(sponge);
  });
  b.clay.add(g, null, { p: [at[0], at[1] + 0.02, at[2]], r: [0, yaw, 0] });
}

function addFork(b: Batches, at: [number, number, number], yaw: number): void {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(at[0], at[1], at[2]);
  const add = (g: THREE.BufferGeometry): void => {
    g.applyMatrix4(m);
    b.metal.add(g, PALETTE.steel);
  };
  add(xf(new RoundedBoxGeometry(5.2, 0.12, 0.5, 2, 0.06), { p: [-1.6, 0.1, 0] }));
  add(xf(new RoundedBoxGeometry(1.5, 0.12, 1.25, 2, 0.06), { p: [1.7, 0.16, 0], r: [0, 0, 0.1] }));
  for (let i = 0; i < 4; i++) {
    add(xf(new RoundedBoxGeometry(2.1, 0.1, 0.17, 1, 0.04), { p: [3.4, 0.33, -0.54 + i * 0.36], r: [0, 0, 0.12] }));
  }
}

function addStreamerCurl(b: Batches, rnd: Rand, color: string, at: [number, number, number], yaw: number, turns: number): void {
  const rad = 0.42 + rnd() * 0.18;
  const pitch = 0.62;
  const w = 0.3;
  const g = gridSurface(1, Math.round(turns * 18), (u, v, out) => {
    const a = v * turns * TAU;
    const along = v * turns * pitch + (u - 0.5) * w;
    // loosens toward one end like a real curled streamer
    const rr = rad * (0.65 + 0.5 * v);
    out.set(along, rr + rr * Math.cos(a) * 1.0 + 0.03, rr * Math.sin(a));
  });
  b.curl.add(g, color, { p: at, r: [0, yaw, 0] });
}

function addSugarCube(b: Batches, at: [number, number, number], rot: [number, number, number]): void {
  const g = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
  b.clay.add(g, '#fffdf8', { p: [at[0], at[1] + 0.5, at[2]], r: rot });
}

// ───────────────────────────── the cake cliff ─────────────────────────────

/** rounded-square plan: a cake big enough to be geography */
function squircle(th: number, half: number, out: { x: number; z: number }): void {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const n = 5;
  const r = half / Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), 1 / n);
  out.x = r * c;
  out.z = r * s;
}

interface CandleSpot { x: number; y: number; z: number; h: number }

function buildCake(b: Batches, cx: number, cz: number, half: number, root: THREE.Group, candles: CandleSpot[]): void {
  const o = { x: 0, z: 0 };
  const white = PALETTE.frostingWhite;
  const glaze = pale(PALETTE.frosting, 0.12);
  const piping = pale(PALETTE.coral, 0.3);
  const tiers = [
    { half, y0: 0.35, h: 8.6 },
    { half: half * 0.68, y0: 8.95, h: 6.8 },
  ];
  // gold cake board
  const boardRows = [{ k: 0.985, y: 0 }, { k: 1, y: 0.3 }, { k: 0.975, y: 0.35 }, { k: 0, y: 0.35 }];
  const board = gridSurface(72, 3, (u, v, out) => {
    const row = boardRows[Math.round(v * 3)]!;
    squircle(u * TAU, (half + 1.3) * row.k, o);
    out.set(cx + o.x, row.y, cz + o.z);
  }, { closeU: true, flip: true });
  b.metal.add(board, PALETTE.sunflower);

  const wallBatch = new Batch(true);
  for (let t = 0; t < tiers.length; t++) {
    const tier = tiers[t]!;
    const yTop = tier.y0 + tier.h;
    // wall, funfetti-flecked
    const wall = gridSurface(96, 2, (u, v, out) => {
      squircle(u * TAU, tier.half, o);
      out.set(cx + o.x, tier.y0 + tier.h * v, cz + o.z);
    }, { closeU: true, uv: true, flip: true });
    const uv = wall.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * tier.half * 1.1, uv.getY(i) * tier.h * 0.16);
    wallBatch.add(wall, '#ffffff');
    // glazed top
    const top = gridSurface(96, 1, (u, v, out) => {
      squircle(u * TAU, tier.half * v, o);
      out.set(cx + o.x, yTop + 0.05, cz + o.z);
    }, { closeU: true });
    b.glossy.add(top, glaze);
    // glaze running over the edge in drips
    const drip = gridSurface(120, 4, (u, v, out) => {
      const th = u * TAU;
      const n1 = Math.sin(th * 19 + t * 2) * 0.5 + Math.sin(th * 31 + 1.3) * 0.3 + Math.sin(th * 7 + t) * 0.2;
      const len = 0.55 + 2.3 * Math.pow(Math.max(0, n1 + 0.25), 2.2);
      const prof = [
        { r: -0.5, y: 0.06 }, { r: 0.1, y: 0.06 }, { r: 0.17, y: -0.35 * len }, { r: 0.19, y: -0.8 * len }, { r: 0.02, y: -len },
      ][Math.round(v * 4)]!;
      squircle(th, tier.half + prof.r, o);
      out.set(cx + o.x, yTop + prof.y, cz + o.z);
    }, { closeU: true });
    b.glossy.add(drip, glaze);
    // piped rope round the foot of the tier
    const rope = (y: number, baseR: number, tube: number, bumps: number, color: string): void => {
      const g = gridSurface(144, 6, (u, v, out) => {
        const th = u * TAU;
        const a = v * TAU;
        const fat = tube * (0.72 + 0.28 * Math.abs(Math.sin(u * bumps * Math.PI)));
        squircle(th, baseR + Math.cos(a) * fat, o);
        out.set(cx + o.x, y + Math.sin(a) * fat + fat * 0.6, cz + o.z);
      }, { closeU: true, flip: true });
      b.glossy.add(g, color);
    };
    rope(tier.y0 - 0.05, tier.half + 0.2, 0.52, t === 0 ? 46 : 32, piping);
  }
  const wallMat = own(vcMat('glossy'));
  wallMat.roughness = 0.5;
  wallMat.map = sprinkleTexture();
  const wallMesh = wallBatch.mesh(wallMat);
  wallMesh.name = 'cake-walls';
  root.add(wallMesh);

  // candles: a row on the lower ledge (the ones the gameplay camera sees) + a ring on top
  const ledgeY = tiers[0]!.y0 + tiers[0]!.h + 0.05;
  const topY = tiers[1]!.y0 + tiers[1]!.h + 0.05;
  const ledgeR = (tiers[0]!.half + tiers[1]!.half) / 2;
  const spots: CandleSpot[] = [];
  for (const th of [Math.PI * 0.84, Math.PI * 1.0, Math.PI * 1.14, Math.PI * 0.68, Math.PI * 0.5, Math.PI * 0.34]) {
    squircle(th, ledgeR, o);
    spots.push({ x: cx + o.x, y: ledgeY, z: cz + o.z, h: 3.5 });
  }
  for (let i = 0; i < 5; i++) {
    const th = (i / 5) * TAU + 0.4;
    spots.push({ x: cx + Math.cos(th) * tiers[1]!.half * 0.5, y: topY, z: cz + Math.sin(th) * tiers[1]!.half * 0.5, h: 3.9 });
  }
  const candleColors = [pale(PALETTE.sky, 0.1), pale(PALETTE.butter, 0.05), pale(PALETTE.mint, 0.05), pale(PALETTE.frosting, 0.05)];
  spots.forEach((s, i) => {
    const body = new THREE.CylinderGeometry(0.27, 0.27, s.h, 14, 10);
    const cA = new THREE.Color(candleColors[i % candleColors.length]!);
    const cB = new THREE.Color(PALETTE.frostingWhite);
    paintBy(body, (x, y, z, out) => {
      // barber-pole twist
      const a = Math.atan2(z, x) + y * 2.6;
      out.copy(Math.sin(a * 2) > 0 ? cA : cB);
    });
    b.glossy.add(body, null, { p: [s.x, s.y + s.h / 2, s.z] });
    // piped rosette holder + wick
    const rosette = new THREE.SphereGeometry(0.5, 12, 6);
    b.glossy.add(rosette, piping, { p: [s.x, s.y + 0.08, s.z], s: [1, 0.42, 1] });
    b.clay.add(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 5), PALETTE.ink, { p: [s.x, s.y + s.h + 0.14, s.z] });
    candles.push({ x: s.x, y: s.y + s.h + 0.24, z: s.z, h: s.h });
  });
}

// ───────────────────────────── room ─────────────────────────────

function unlit(map: THREE.Texture, opts: { additive?: boolean; opacity?: number; color?: string } = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    color: opts.color ?? '#ffffff',
    transparent: true,
    opacity: opts.opacity ?? 1,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

interface FlagDef { x: number; y: number; z: number; size: number; phase: number; lean: number }
interface BokehDef { base: THREE.Color; speed: number; phase: number; depth: number }

// ───────────────────────────── scene ─────────────────────────────

export function buildTableScene(opts: { xMin: number; xMax: number }): TableScene {
  const { xMin, xMax } = opts;
  const span = xMax - xMin;
  const X0 = xMin - 40;
  const X1 = xMax + 46;
  const at = (f: number): number => xMin + f * span;
  const rnd = seeded(20260611);
  const root = new THREE.Group();
  root.name = 'birthday-table';

  root.add(buildCloth(X0, X1));

  const b: Batches = {
    clay: new Batch(), glossy: new Batch(), paper: new Batch(), metal: new Batch(),
    dots: new Batch(true), stripes: new Batch(true), curl: new Batch(),
  };

  // ── the cake cliff, far right ──
  const cakeHalf = 10;
  const cakeX = xMax + 0.8 + cakeHalf;
  const cakeZ = DRESSING_Z_MAX - cakeHalf - 1.3; // the board overhangs the cake by 1.3
  const candles: CandleSpot[] = [];
  buildCake(b, cakeX, cakeZ, cakeHalf, root, candles);

  // ── presents: deep and toward the sides ──
  addPresent(b, 'dots', [6.4, 4.8, 6.0], pale(PALETTE.butter, 0.2), pale(PALETTE.coral, 0.15), [at(-0.14), 0, -16.5], 0.35);
  addPresent(b, 'stripes', [3.6, 2.6, 3.6], pale(PALETTE.mint, 0.15), PALETTE.frostingWhite, [at(-0.15), 4.9, -16.3], -0.3);
  addPresent(b, 'stripes', [5.0, 3.6, 4.6], pale(PALETTE.sky, 0.3), pale(PALETTE.butter, 0.1), [at(0.69), 0, -19.5], -0.25);
  addPresent(b, 'dots', [3.4, 5.6, 3.4], pale(PALETTE.frosting, 0.25), PALETTE.frostingWhite, [at(0.45), 0, -21.5], 0.5, false);
  addPresent(b, 'plain', [4.2, 2.4, 3.2], pale(PALETTE.grape, 0.55), pale(PALETTE.butter, 0.1), [at(0.3), 0, -22.5], 0.15);
  addPresent(b, 'dots', [4.6, 3.4, 4.2], pale(PALETTE.mint, 0.3), pale(PALETTE.coral, 0.2), [at(-0.42), 0, -12.5], -0.5);

  // ── party hats ──
  addPartyHat(b, 1.5, 4.0, pale(PALETTE.coral, 0.3), PALETTE.frostingWhite, 'dots', [at(0.14), 0, -13.5], [0, 0.4, 0]);
  addPartyHat(b, 1.4, 3.7, pale(PALETTE.teal, 0.45), pale(PALETTE.butter, 0.1), 'stripes', [at(0.6), 1.36, -14.5], [0, 0.5, Math.PI / 2 - 0.36]);
  addPartyHat(b, 1.5, 4.0, pale(PALETTE.sunflower, 0.4), pale(PALETTE.sky, 0.2), 'stripes', [at(-0.28), 0, -20], [0, 1.2, 0]);
  addPartyHat(b, 1.3, 3.5, pale(PALETTE.grape, 0.5), PALETTE.frostingWhite, 'dots', [at(0.88), 0, -17.5], [0, 2.2, 0]);

  // ── cupcakes: the mid row ──
  const cupcakes: Array<[number, number, string, string, 'cherry' | 'candle' | 'none', number]> = [
    [0.25, -10.0, pale(PALETTE.butter, 0.15), PALETTE.frostingWhite, 'cherry', 1.0],
    [0.34, -14.5, pale(PALETTE.sky, 0.3), pale(PALETTE.frosting, 0.3), 'none', 0.95],
    [0.5, -11.5, pale(PALETTE.frosting, 0.3), PALETTE.frostingWhite, 'candle', 1.05],
    [0.74, -9.5, pale(PALETTE.mint, 0.2), pale(PALETTE.butter, 0.35), 'cherry', 1.0],
    [0.81, -15.0, pale(PALETTE.butter, 0.2), pale(PALETTE.frosting, 0.25), 'none', 0.95],
    [0.94, -11.0, pale(PALETTE.sky, 0.3), PALETTE.frostingWhite, 'cherry', 1.0],
    [0.02, -9.0, pale(PALETTE.mint, 0.25), pale(PALETTE.frosting, 0.3), 'cherry', 1.0],
    [-0.2, -8.0, pale(PALETTE.frosting, 0.3), PALETTE.frostingWhite, 'none', 1.0],
    [-0.5, -15.5, pale(PALETTE.butter, 0.2), PALETTE.frostingWhite, 'cherry', 1.0],
  ];
  for (const [f, z, wrapper, frosting, topping, k] of cupcakes) {
    addCupcake(b.paper, b.glossy, {
      radius: 1.2 * k, height: 3.0 * k, taper: 0.76, wrapper, frosting, topping,
      toppingColor: topping === 'candle' ? pale(PALETTE.sky, 0.1) : pale('#e5364f', 0.12), detail: 0.6, spin: rnd() * 3,
    }, [at(f) + (rnd() - 0.5) * 1.2, 0, z]);
  }

  // ── plates, crumbs, a cut slice, a fork: the flat near row ──
  const plateA: [number, number, number] = [at(0.42), 0, -7.2];
  addPlate(b, 3.3, pale(PALETTE.coral, 0.35), plateA);
  addCakeSlice(b, [plateA[0] - 1.3, 0.1, plateA[2] + 0.2], 0.5);
  addCrumbs(b, rnd, 16, 2.4, [plateA[0], 0.09, plateA[2]], PALETTE.sponge);
  addFork(b, [plateA[0] + 5.0, 0, plateA[2] - 0.6], 0.25);
  const plateB: [number, number, number] = [at(0.86), 0, -6.4];
  addPlate(b, 2.9, pale(PALETTE.teal, 0.4), plateB);
  addCrumbs(b, rnd, 22, 2.0, [plateB[0], 0.09, plateB[2]], PALETTE.sponge);
  addCrumbs(b, rnd, 10, 2.4, [plateB[0] - 4.2, 0, plateB[2] - 1.5], PALETTE.sponge);
  const plateC: [number, number, number] = [at(-0.36), 0, -7.5];
  addPlate(b, 3.1, pale(PALETTE.sunflower, 0.3), plateC);
  addCrumbs(b, rnd, 14, 2.1, [plateC[0], 0.09, plateC[2]], PALETTE.sponge);

  // ── loose sugar cubes + streamer curls ──
  addSugarCube(b, [at(0.1), 0, -6.2], [0, 0.4, 0]);
  addSugarCube(b, [at(0.125), 0, -7.0], [0, -0.3, 0]);
  addSugarCube(b, [at(0.108), 1.0, -6.5], [0, 0.9, 0]);
  addStreamerCurl(b, rnd, pale(PALETTE.teal, 0.3), [at(0.58), 0, -5.6], 0.3, 4.5);
  addStreamerCurl(b, rnd, pale(PALETTE.sunflower, 0.2), [at(0.2), 0, -17.5], -0.5, 5);
  addStreamerCurl(b, rnd, pale(PALETTE.berry, 0.4), [at(0.98), 0, -5.2], 2.6, 3.5);
  addStreamerCurl(b, rnd, pale(PALETTE.sky, 0.2), [at(-0.3), 0, -5.5], 0.9, 4);

  // ── merge the dressing: seven draw calls for the lot ──
  const dotsMat = own(vcMat('paper'));
  dotsMat.map = wrapPatternTexture('dots');
  const stripesMat = own(vcMat('paper'));
  stripesMat.map = wrapPatternTexture('stripes');
  const dressing = new THREE.Group();
  dressing.name = 'dressing';
  dressing.add(
    b.clay.mesh(vcMat('clay')),
    b.glossy.mesh(vcMat('satin')),
    b.paper.mesh(vcMat('paper')),
    b.metal.mesh(vcMat('metal')),
    b.dots.mesh(dotsMat),
    b.stripes.mesh(stripesMat),
    b.curl.mesh(vcMat('paper', THREE.DoubleSide)),
  );
  root.add(dressing);

  // ── a glass of lemonade with a paper straw, back left ──
  {
    const gx = at(0.0) - 1.5;
    const gz = -18.5;
    const R = 2.5;
    const H = 8.6;
    const glass = lathe(smoothProfile([
      [0, 0], [R * 0.8, 0], [R * 0.86, 0.12], [R, H], [R * 0.955, H], [R * 0.81, 0.5], [0, 0.5],
    ], 14), 36);
    const glassMat = own(mat.jelly('#eef8ff', 0.2));
    glassMat.depthWrite = false;
    const gm = new THREE.Mesh(glass, glassMat);
    gm.position.set(gx, 0, gz);
    gm.renderOrder = 2;
    const drink = lathe([[0, 0.52], [R * 0.8, 0.52], [R * 0.925, H * 0.72], [0, H * 0.72]], 32);
    const dm = new THREE.Mesh(drink, mat.jelly(pale(PALETTE.butter, 0.1), 0.82));
    dm.position.set(gx, 0, gz);
    dm.renderOrder = 1;
    dm.castShadow = true;
    const straw = new THREE.CylinderGeometry(0.2, 0.2, 10.5, 12, 26);
    const sA = new THREE.Color(pale(PALETTE.coral, 0.2));
    const sB = new THREE.Color(PALETTE.frostingWhite);
    paintBy(straw, (x, y, z, out) => {
      out.copy(Math.sin((Math.atan2(z, x) + y * 3.2) * 1) > 0 ? sA : sB);
    });
    const sm = new THREE.Mesh(straw, vcMat('paper'));
    sm.position.set(gx + 0.5, 5.7, gz + 0.2);
    sm.rotation.z = -0.24;
    sm.castShadow = true;
    root.add(dm, sm, gm);
  }

  // ── confetti on the cloth (z <= -3.5 only: the stage itself stays clean) ──
  {
    const count = 340;
    const geo = new THREE.CircleGeometry(0.17, 8);
    geo.rotateX(-Math.PI / 2);
    const confetti = new THREE.InstancedMesh(geo, mat.clay('#ffffff', { roughness: 0.6 }), count);
    confetti.name = 'confetti';
    const colors = [PALETTE.coral, PALETTE.teal, PALETTE.sunflower, PALETTE.sky, PALETTE.frosting, PALETTE.grape, PALETTE.mint, PALETTE.butter].map((c) => new THREE.Color(pale(c, 0.22)));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // denser toward the middle of the party, thinning to the edges
      const fx = (rnd() + rnd() + rnd()) / 3;
      const x = lerp(X0 + 14, xMax + 0.4, fx);
      const z = lerp(DRESSING_Z_MAX - 0.2, Z_BACK + 1.5, Math.pow(rnd(), 1.25));
      // nothing may sit under the cake
      const underCake = x > cakeX - cakeHalf - 1.6 && z < cakeZ + cakeHalf + 1.6;
      p.set(underCake ? x - 22 * rnd() - 3 : x, 0.012 + rnd() * 0.01, z);
      e.set((rnd() - 0.5) * 0.14, rnd() * TAU, (rnd() - 0.5) * 0.14);
      q.setFromEuler(e);
      const k = 0.7 + rnd() * 0.8;
      s.set(k, 1, k * (rnd() < 0.3 ? 0.45 : 1));
      m.compose(p, q, s);
      confetti.setMatrixAt(i, m);
      confetti.setColorAt(i, colors[i % colors.length]!);
    }
    confetti.instanceMatrix.needsUpdate = true;
    if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
    confetti.receiveShadow = true;
    root.add(confetti);
  }

  // ── candle flames ──
  const flameGeo = lathe(smoothProfile([[0, 0], [0.2, 0.12], [0.25, 0.34], [0.16, 0.66], [0.05, 0.98], [0, 1.1]], 10), 10);
  const flameOuter = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: '#ffb23c', transparent: true, opacity: 0.92, depthWrite: false, fog: false }), candles.length);
  const flameCore = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: '#fff3c0', fog: false }), candles.length);
  const glowGeo = new THREE.PlaneGeometry(1, 1);
  const flameGlow = new THREE.InstancedMesh(glowGeo, unlit(softDiscTexture(0), { additive: true, opacity: 0.5, color: '#ffc163' }), candles.length);
  flameOuter.frustumCulled = false;
  flameCore.frustumCulled = false;
  flameGlow.frustumCulled = false;
  flameGlow.renderOrder = 2;
  flameOuter.renderOrder = 1;
  root.add(flameCore, flameOuter, flameGlow);
  const flamePhase = candles.map(() => rnd() * 10);

  // ── the room: one painted wall + soft layers with real parallax ──
  const room = new THREE.Group();
  room.name = 'room';
  const midX = (xMin + xMax) / 2;
  {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_WALL.width, ROOM_WALL.yTop - ROOM_WALL.yBottom),
      new THREE.MeshBasicMaterial({ map: roomBackdropTexture(), fog: false, toneMapped: false, depthWrite: false }),
    );
    wall.position.set(midX, (ROOM_WALL.yTop + ROOM_WALL.yBottom) / 2, -170);
    wall.renderOrder = -10;
    room.add(wall);
  }
  // soft slabs: chair backs beyond the far edge of the table, off to the sides
  {
    const slabMat = unlit(softSlabTexture(), { opacity: 0.5, color: '#c98863' });
    for (const [x, y, w, h] of [[at(-0.62), 2, 30, 46], [at(1.42), 4, 34, 52], [at(0.32), -12, 54, 30]] as const) {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, h), slabMat);
      slab.position.set(x, y, -62);
      slab.renderOrder = -9;
      room.add(slab);
    }
  }
  // huge defocused balloons drifting near the ceiling
  const farBalloons = new THREE.Group();
  {
    const tex = softDiscTexture(0.62);
    const defs: Array<[number, number, number, string]> = [
      [-0.55, 44, 13, PALETTE.coral], [-0.38, 52, 11, PALETTE.butter], [-0.47, 34, 10, PALETTE.sky],
      [0.38, 56, 12, PALETTE.teal], [0.52, 49, 10, PALETTE.frosting],
      [1.25, 40, 13, PALETTE.sunflower], [1.42, 50, 12, PALETTE.coral], [1.36, 30, 9, PALETTE.mint],
    ];
    for (const [f, y, r, color] of defs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2.2), unlit(tex, { opacity: 0.5, color: pale(color, 0.25) }));
      m.position.set(at(f), y, -120);
      m.renderOrder = -8;
      farBalloons.add(m);
    }
    room.add(farBalloons);
  }
  // bunting: two swags of soft pennants
  const flags: FlagDef[] = [];
  const flagColors = [PALETTE.coral, PALETTE.butter, PALETTE.teal, PALETTE.frosting, PALETTE.sky, PALETTE.sunflower].map((c) => new THREE.Color(pale(c, 0.15)));
  const swags: Array<{ x0: number; x1: number; y: number; sag: number; z: number; size: number; n: number }> = [
    { x0: at(-1.1), x1: at(0.62), y: 43, sag: 9, z: -84, size: 8.5, n: 15 },
    { x0: at(0.3), x1: at(2.2), y: 50, sag: 11, z: -100, size: 9.5, n: 16 },
  ];
  for (const sw of swags) {
    for (let i = 0; i < sw.n; i++) {
      const t = (i + 0.5) / sw.n;
      const y = sw.y - sw.sag * 4 * t * (1 - t);
      const slope = (-sw.sag * 4 * (1 - 2 * t)) / (sw.x1 - sw.x0);
      flags.push({ x: lerp(sw.x0, sw.x1, t), y, z: sw.z, size: sw.size, phase: rnd() * TAU, lean: Math.atan(slope) });
    }
  }
  const bunting = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.42, 0), unlit(softFlagTexture(), { opacity: 0.72 }), flags.length);
  bunting.frustumCulled = false;
  bunting.renderOrder = -7;
  flags.forEach((_f, i) => bunting.setColorAt(i, flagColors[i % flagColors.length]!));
  if (bunting.instanceColor) bunting.instanceColor.needsUpdate = true;
  room.add(bunting);
  // the strings themselves, as soft as the flags
  {
    const pts: number[] = [];
    for (const sw of swags) {
      for (let i = 0; i < 24; i++) {
        for (const t of [i / 24, (i + 1) / 24]) pts.push(lerp(sw.x0, sw.x1, t), sw.y - sw.sag * 4 * t * (1 - t) + 0.3, sw.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#f3c8a2', transparent: true, opacity: 0.6, fog: false, depthWrite: false }));
    line.renderOrder = -7;
    line.frustumCulled = false;
    room.add(line);
  }
  // bokeh: fairy lights strung across the room + stray glints
  const bokehDefs: BokehDef[] = [];
  const bokehCount = 46;
  const bokeh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), unlit(bokehTexture(), { additive: true, opacity: 0.3 }), bokehCount);
  bokeh.frustumCulled = false;
  bokeh.renderOrder = -6;
  {
    const m = new THREE.Matrix4();
    const warm = [new THREE.Color('#ffe7a8'), new THREE.Color('#ffd27a'), new THREE.Color('#ffc9b0'), new THREE.Color('#fff4d6'), new THREE.Color('#bfeee0')];
    for (let i = 0; i < bokehCount; i++) {
      let x: number;
      let y: number;
      let z: number;
      let size: number;
      if (i < 28) {
        // a sagging string of lights
        const t = i / 27;
        x = lerp(at(-1.0), at(2.0), t) + (rnd() - 0.5) * 3;
        y = 34 - 10 * 4 * t * (1 - t) * 0.8 + (rnd() - 0.5) * 2 + 6 * Math.sin(t * 9);
        z = -70 - rnd() * 8;
        size = 3.4 + rnd() * 2.2;
      } else {
        x = lerp(at(-1.0), at(2.0), rnd());
        y = 4 + rnd() * 44;
        z = -48 - rnd() * 70;
        size = 2.4 + rnd() * 5.5;
      }
      m.makeScale(size, size, 1).setPosition(x, y, z);
      bokeh.setMatrixAt(i, m);
      const base = warm[i % warm.length]!.clone().multiplyScalar(0.45 + rnd() * 0.55);
      bokehDefs.push({ base, speed: 0.5 + rnd() * 1.6, phase: rnd() * TAU, depth: z });
      bokeh.setColorAt(i, base);
    }
    bokeh.instanceMatrix.needsUpdate = true;
    if (bokeh.instanceColor) bokeh.instanceColor.needsUpdate = true;
  }
  room.add(bokeh);
  root.add(room);

  // ── idle life ──
  let time = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();

  function update(dt: number): void {
    time += dt;
    // bunting: every pennant swings from its string, a slow wave runs down the line
    for (let i = 0; i < flags.length; i++) {
      const f = flags[i]!;
      const swing = Math.sin(time * 0.9 + f.phase) * 0.1 + Math.sin(time * 0.37 + f.x * 0.05) * 0.09;
      e.set(0, 0, f.lean + swing);
      q.setFromEuler(e);
      p.set(f.x, f.y + Math.sin(time * 0.5 + f.x * 0.04) * 0.5, f.z);
      s.set(f.size * (0.92 + 0.08 * Math.cos(time * 1.3 + f.phase)), f.size * 1.2, 1);
      m4.compose(p, q, s);
      bunting.setMatrixAt(i, m4);
    }
    bunting.instanceMatrix.needsUpdate = true;
    // bokeh shimmer
    for (let i = 0; i < bokehDefs.length; i++) {
      const d = bokehDefs[i]!;
      const k = 0.72 + 0.28 * Math.sin(time * d.speed + d.phase) * Math.sin(time * d.speed * 0.37 + d.phase * 2);
      bokeh.setColorAt(i, col.copy(d.base).multiplyScalar(k));
    }
    if (bokeh.instanceColor) bokeh.instanceColor.needsUpdate = true;
    // far balloons breathe on their strings
    for (let i = 0; i < farBalloons.children.length; i++) {
      const c = farBalloons.children[i]!;
      c.rotation.z = Math.sin(time * 0.3 + i * 1.7) * 0.05;
    }
    // candle flames: lick, lean, flicker
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]!;
      const ph = flamePhase[i]!;
      const flick = 1 + 0.13 * Math.sin(time * 11 + ph) + 0.08 * Math.sin(time * 23.7 + ph * 2) + 0.05 * Math.sin(time * 5.3 + ph);
      const lean = 0.1 * Math.sin(time * 2.3 + ph) + 0.05 * Math.sin(time * 7.1 + ph);
      e.set(0, 0, lean);
      q.setFromEuler(e);
      p.set(c.x, c.y, c.z);
      s.set(1.25 * (2 - flick), 1.25 * flick, 1.25 * (2 - flick));
      m4.compose(p, q, s);
      flameOuter.setMatrixAt(i, m4);
      p.set(c.x, c.y + 0.06, c.z);
      s.multiplyScalar(0.55);
      m4.compose(p, q, s);
      flameCore.setMatrixAt(i, m4);
      const g = 4.6 * (0.85 + 0.15 * flick);
      m4.makeScale(g, g, 1).setPosition(c.x, c.y + 0.7, c.z + 0.3);
      flameGlow.setMatrixAt(i, m4);
    }
    flameOuter.instanceMatrix.needsUpdate = true;
    flameCore.instanceMatrix.needsUpdate = true;
    flameGlow.instanceMatrix.needsUpdate = true;
  }
  update(0);

  return { root, groundY: 0, update };
}

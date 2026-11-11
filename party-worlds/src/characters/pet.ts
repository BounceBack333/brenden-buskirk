/**
 * Dogs and cats: true quadrupeds with a big head, stubby legs and expressive ears and tail.
 * Silhouette levers: ear type, tail type, muzzle length, leg length (stature), fluff.
 * Coat patterns are painted per vertex from a few simple region rules.
 * Every pet wears a little courier harness: a strap, a ring for the umbrella and a telescoping
 * stand with a cradle that carries the basket (so pets never have to stand upright).
 */
import * as THREE from 'three';
import type { CharacterSpec } from '../kit/contracts';
import { RIG } from '../kit/contracts';
import { PALETTE } from '../kit/materials';
import { HeadShape, buildBrow, buildCheek, buildEye } from './face';
import type { ColorFn, WeightFn } from './geo';
import { M_CLAY, M_FABRIC, M_GLOSSY, SkinBuilder, blob, capsule, ellipsoid, frameQuatY, frameQuatYZ, lathe, ringSurface, tube, v3, xf } from './geo';
import type { BodyDesc, ChainDesc } from './types';
import { clamp01, lerp, luma, mixHex, mulberry32, smoothstep } from './util';

const DEG = Math.PI / 180;
type Part = 'body' | 'neck' | 'head' | 'muzzle' | 'jaw' | 'leg' | 'paw' | 'tail' | 'earR' | 'earL' | 'tuft';

/** Skin weights for a tube built along `pts`: blends root → bones[0] → bones[1] … by distance along the curve. */
function chainWeights(pts: THREE.Vector3[], rootBone: number, bones: number[], at: number[]): WeightFn {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const samples: THREE.Vector3[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) samples.push(curve.getPoint(i / N));
  return (p, w) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i <= N; i++) {
      const d = samples[i].distanceToSquared(p);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const u = best / N;
    if (u <= at[0]) {
      w.a = rootBone;
      w.b = bones[0];
      w.w = at[0] > 0 ? u / at[0] : 1;
      return;
    }
    for (let k = 0; k < bones.length - 1; k++) {
      if (u <= at[k + 1]) {
        w.a = bones[k];
        w.b = bones[k + 1];
        w.w = (u - at[k]) / (at[k + 1] - at[k]);
        return;
      }
    }
    w.a = bones[bones.length - 1];
    w.b = w.a;
    w.w = 0;
  };
}

export function buildPet(spec: CharacterSpec): BodyDesc {
  const sb = new SkinBuilder();
  const dog = spec.species === 'dog';
  const fluff = spec.fluff ?? 0.4;
  const snout = spec.snout ?? (dog ? 0.5 : 0.1);
  const pattern = spec.pattern ?? 'solid';
  const earType = spec.earType ?? (dog ? 'floppy' : 'pointy');
  const tailType = spec.tail ?? 'long';
  const primary = spec.primary;
  const secondary = spec.secondary;

  // ── proportions ──
  const girth = (dog ? 0.9 : 0.85) + 0.24 * spec.build + 0.1 * fluff;
  const legLen = dog ? lerp(0.1, 0.25, spec.stature) : lerp(0.115, 0.215, spec.stature);
  const ry = (dog ? 0.15 : 0.136) * girth;
  const rz = (dog ? 0.146 : 0.13) * girth;
  const halfLen = dog ? 0.262 + 0.06 * (1 - spec.stature) : 0.245 + 0.02 * (1 - spec.stature);
  const bodyY = legLen + ry * 0.78;
  const bx = -0.105;
  const chest = dog ? 0.1 : 0.03;
  const prof = (xs: number): number => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(xs), 2.5)), 1 / 2.5) * (1 + chest * xs);
  const pawY = 0.04;
  const legTop = bodyY - ry * 0.3;
  const frontX = bx + halfLen * 0.6;
  const hindX = bx - halfLen * 0.62;
  const frontZ = rz * 0.58;
  const hindZ = rz * 0.64;
  const legR = (dog ? 0.05 : 0.043) * (1 + 0.4 * fluff) * (0.9 + 0.2 * spec.build);

  const hs = 1 + 0.05 * fluff;
  const hrx = (dog ? 0.18 : 0.166) * hs;
  const hry = (dog ? 0.172 : 0.158) * hs;
  const hrz = (dog ? 0.184 : 0.198) * hs;
  const hc = v3(bx + halfLen + 0.085, bodyY + ry + (dog ? 0.078 : 0.07), 0);
  const head = new HeadShape(hc, hrx, hry, hrz, dog ? 2.2 : 2.15, dog ? 0.08 : 0.17, dog ? 0.08 : 0.05);
  const HP = (azDeg: number, elDeg: number, lift = 0): THREE.Vector3 => head.point(azDeg * DEG, elDeg * DEG, lift);
  const HN = (azDeg: number, elDeg: number): THREE.Vector3 => head.normal(azDeg * DEG, elDeg * DEG);
  const neckP = v3(bx + halfLen * 0.74, bodyY + ry * 0.45, 0);

  // ── coat painting ──
  const P = new THREE.Color(primary);
  const S = new THREE.Color(secondary);
  const pale = new THREE.Color(mixHex(primary, '#fff6e6', 0.55));
  const dark = new THREE.Color(mixHex(primary, '#2a1a14', 0.5));
  const E = 0.014;
  const above = (x: number): number => smoothstep(-E, E, x);
  const rnd = mulberry32(pattern === 'spots' ? 4242 : 977);
  const spots: Array<{ c: THREE.Vector3; r: number }> = [];
  if (pattern === 'spots') {
    for (let i = 0; i < 16; i++) {
      const xs = -0.85 + rnd() * 1.7;
      const a = (rnd() * 1.5 - 0.75) * Math.PI; // back and flanks, not the belly
      const r = prof(xs);
      spots.push({ c: v3(bx + xs * halfLen, bodyY + Math.cos(a) * r * ry, Math.sin(a) * r * rz), r: 0.035 + rnd() * 0.03 });
    }
    for (let i = 0; i < 7; i++) {
      spots.push({ c: head.point((rnd() * 2 - 1) * 2.6, (rnd() * 1.3 - 0.3), 0), r: 0.03 + rnd() * 0.025 });
    }
    spots.push({ c: v3(frontX, legTop - 0.03, frontZ + legR), r: 0.04 }, { c: v3(hindX, legTop - 0.02, -hindZ - legR), r: 0.045 });
  }
  const patches: Array<{ c: THREE.Vector3; r: number }> = [
    { c: hc.clone().add(v3(0.03, 0.09, 0.15)), r: 0.175 },
    { c: v3(bx - 0.03, bodyY + ry * 0.95, 0.04), r: 0.2 },
    { c: v3(bx - halfLen * 0.92, bodyY + 0.02, -0.07), r: 0.17 },
  ];
  const tmpD = new THREE.Vector3();

  /**
   * How a point on a body part is coloured. `u` (0..1) is used by tails (base → tip).
   */
  const coatAt = (p: THREE.Vector3, part: Part, u: number, out: THREE.Color): void => {
    let s = 0; // toward secondary
    let l = 0; // toward pale
    let d = 0; // toward dark
    const lowBody = above(bodyY - 0.42 * ry - p.y);
    let az = 0;
    let el = 0;
    if (part === 'head') {
      const dir = head.dirOf(p);
      az = dir.az / DEG;
      el = dir.el / DEG;
    }
    const aaz = Math.abs(az);
    switch (pattern) {
      case 'solid':
        if (part === 'muzzle' || part === 'jaw') s = 0.5;
        else if (part === 'tuft') s = 0.35;
        else if (part === 'earR' || part === 'earL') d = 0.2;
        else if (part === 'tail') s = 0.45 * smoothstep(0.6, 0.95, u);
        else if (part === 'body') l = 0.3 * lowBody;
        else if (part === 'paw') l = 0.15;
        break;
      case 'patches': {
        for (const pt of patches) s = Math.max(s, smoothstep(pt.r + E, pt.r - E, tmpD.copy(p).sub(pt.c).length()));
        if (part === 'earR') s = 1;
        if (part === 'tail') s = Math.max(s, smoothstep(0.45, 0.3, u));
        if (part === 'muzzle' || part === 'jaw') l = 0.3;
        if (part === 'body') l = 0.25 * lowBody * (1 - s);
        break;
      }
      case 'mask':
        if (part === 'head') {
          const lower = smoothstep(11, 3, el - 5 * Math.cos(az * DEG)) * smoothstep(118, 96, aaz);
          const blaze = smoothstep(17, 10, aaz) * smoothstep(60, 48, el);
          s = Math.max(lower, blaze);
        } else if (part === 'muzzle' || part === 'jaw' || part === 'paw' || part === 'tuft') s = 1;
        else if (part === 'body') s = Math.max(above(bodyY - 0.2 * ry - p.y), above(p.x - (bx + halfLen * 0.6)) * above(bodyY + 0.3 * ry - p.y));
        else if (part === 'neck') s = above(p.x - (neckP.x + 0.035)) * above(bodyY + ry * 1.2 - p.y);
        else if (part === 'leg') s = above(legTop - legLen * 0.2 - p.y);
        else if (part === 'tail') s = smoothstep(0.55, 0.8, u);
        break;
      case 'socks':
        if (part === 'paw') s = 1;
        else if (part === 'leg') s = above(pawY + legLen * 0.5 - p.y);
        else if (part === 'muzzle' || part === 'jaw') s = 0.9;
        else if (part === 'head') s = 0.9 * smoothstep(-6, -20, el) * smoothstep(105, 75, aaz);
        else if (part === 'body' || part === 'tuft') s = 0.9 * above(p.x - (bx + halfLen * 0.66)) * above(bodyY + 0.1 * ry - p.y);
        else if (part === 'tail') s = smoothstep(0.78, 0.92, u);
        break;
      case 'tabby':
        if (part === 'body') {
          const up = smoothstep(bodyY - 0.55 * ry, bodyY - 0.1 * ry, p.y);
          const stripe = smoothstep(0.1, 0.5, Math.sin((p.x - bx) * 44 + Math.sin(p.y * 15 + 1.3) * 0.8 + Math.abs(p.z) * 7));
          s = stripe * up;
          l = 0.6 * (1 - up);
        } else if (part === 'leg') s = smoothstep(0.1, 0.55, Math.sin(p.y * 62 + 1.2));
        else if (part === 'paw') l = 0.35;
        else if (part === 'tail') s = Math.max(smoothstep(0.0, 0.45, Math.sin(u * 24 - 0.6)), smoothstep(0.82, 0.92, u));
        else if (part === 'head') {
          const forehead = smoothstep(0.25, 0.6, Math.cos(az * DEG * 7.5)) * smoothstep(24, 36, el) * smoothstep(82, 62, aaz);
          const cheek = smoothstep(0.2, 0.6, Math.sin(el * DEG * 17 + 1.0)) * smoothstep(48, 62, aaz) * smoothstep(118, 100, aaz) * smoothstep(6, -2, el) * smoothstep(-34, -24, el);
          s = Math.max(forehead, cheek);
          l = 0.5 * smoothstep(-12, -30, el) * smoothstep(80, 50, aaz);
        } else if (part === 'muzzle' || part === 'jaw') l = 0.75;
        else if (part === 'neck') l = 0.5 * above(p.x - (neckP.x + 0.05)) * above(bodyY + ry - p.y);
        else if (part === 'earR' || part === 'earL') d = 0.18;
        else if (part === 'tuft') l = 0.6;
        break;
      case 'tuxedo':
        if (part === 'muzzle' || part === 'jaw' || part === 'paw' || part === 'tuft') s = 1;
        else if (part === 'body') s = Math.max(above(bodyY - 0.3 * ry - p.y) * above(p.x - (bx - halfLen * 0.25)), above(p.x - (bx + halfLen * 0.62)) * above(bodyY + 0.35 * ry - p.y));
        else if (part === 'neck') s = above(p.x - (neckP.x + 0.03)) * above(bodyY + ry * 1.25 - p.y);
        else if (part === 'leg') s = above(pawY + legLen * 0.32 - p.y);
        else if (part === 'tail') s = smoothstep(0.84, 0.93, u);
        else if (part === 'head') {
          const width = lerp(38, 5, clamp01((el + 22) / 62));
          const blaze = smoothstep(width + 4, width - 3, aaz) * smoothstep(50, 42, el);
          const chin = smoothstep(-14, -24, el) * smoothstep(84, 66, aaz);
          s = Math.max(blaze, chin);
        }
        break;
      case 'spots':
        for (const sp of spots) s = Math.max(s, smoothstep(sp.r + E * 0.8, sp.r - E * 0.8, tmpD.copy(p).sub(sp.c).length()));
        if (part === 'earL') s = 1;
        if (part === 'tail') s = Math.max(s, smoothstep(0.3, 0.42, u) * smoothstep(0.62, 0.5, u));
        if (part === 'muzzle' || part === 'jaw') l = 0.2;
        break;
      default:
        break;
    }
    out.copy(P).lerp(pale, l).lerp(dark, d).lerp(S, s);
  };
  const coat = (part: Part): ColorFn => (p, out) => coatAt(p, part, 0, out);
  const coatHex = (p: THREE.Vector3, part: Part, mixTo: string, t: number): string => {
    const c = new THREE.Color();
    coatAt(p, part, 0, c);
    return mixHex('#' + c.getHexString(), mixTo, t);
  };

  // ── skeleton ──
  const root = sb.bone('root', -1, v3(0, 0, 0));
  const body = sb.bone('body', root, v3(bx, bodyY, 0));
  const headB = sb.bone('head', body, neckP);
  const legs: Array<{ bone: number; tip: number }> = [];
  for (const [x, z] of [[frontX, frontZ], [frontX, -frontZ], [hindX, hindZ], [hindX, -hindZ]] as Array<[number, number]>) {
    const bone = sb.bone('leg', body, v3(x, legTop, z));
    const tip = sb.bone('paw', bone, v3(x, pawY, z));
    legs.push({ bone, tip });
  }

  // ── trunk ──
  {
    const rings = pattern === 'tabby' || pattern === 'spots' ? 26 : 14;
    const cols = 20;
    sb.add(ringSurface(cols, rings + 1, (i, j, out) => {
      const u = j / rings;
      const xs = 0.45 * (-1 + 2 * u) + 0.55 * -Math.cos(u * Math.PI);
      const r = prof(xs);
      const a = (i / cols) * Math.PI * 2;
      const arch = dog ? 0 : 0.02 * (1 - xs * xs);
      out.set(bx + xs * halfLen, bodyY + Math.cos(a) * r * ry + arch, Math.sin(a) * r * rz);
    }, { poleStart: true, poleEnd: true }), body, coat('body'), M_FABRIC);
  }
  // neck (a little mane for fluffy coats)
  {
    const k = 1 + 0.3 * Math.max(0, fluff - 0.45);
    sb.add(blob(0.11 * k, 0.145 * k, rz * 0.84 * k, [bx + halfLen * 0.83, bodyY + ry * 0.62, 0], [0, 0, -0.5], 10, 7), body, coat('neck'), M_FABRIC);
  }
  // legs + paws
  for (let i = 0; i < 4; i++) {
    const front = i < 2;
    const x = front ? frontX : hindX;
    const z = (i % 2 === 0 ? 1 : -1) * (front ? frontZ : hindZ);
    const r = legR * (front ? 1 : 1.06);
    const bot = pawY + 0.012;
    const n = pattern === 'tabby' ? 7 : 4;
    const prof2: Array<[number, number]> = [[0, bot - 0.02]];
    prof2.push([r * 0.92, bot]);
    for (let q = 1; q <= n; q++) prof2.push([r * (1 + 0.06 * (q / n)), bot + ((legTop - bot) * q) / n]);
    prof2.push([r * 0.8, legTop + r * 0.6], [0, legTop + r]);
    sb.add(xf(lathe(prof2, 10), { p: [x, 0, z] }), legs[i].bone, coat('leg'), M_FABRIC);
    const pw = dog ? 1.45 : 1.3;
    sb.add(blob(r * pw, 0.042, r * (pw - 0.18), [x + r * 0.35, pawY + 0.002, z], undefined, 8, 5), legs[i].tip, coat('paw'), M_FABRIC);
  }

  // ── head ──
  sb.add(head.geometry(24, 14), headB, coat('head'), M_FABRIC);
  const lineC = '#5a1a2b';
  let jaw: number;
  let tongue: number;
  const noseTip = v3(0, 0, 0);
  if (dog) {
    const mrx = 0.085 + 0.075 * snout;
    const mry = 0.066 + 0.008 * snout;
    const mrz = 0.084;
    const mc = hc.clone().add(v3(0.15 + 0.07 * snout, -0.05, 0));
    const mg = ellipsoid(mrx, mry, mrz, 12, 8);
    const mp = mg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i) / mrx;
      if (x > 0) {
        const k = 1 - 0.2 * x * x;
        mp.setY(i, mp.getY(i) * k);
        mp.setZ(i, mp.getZ(i) * k);
      }
    }
    mg.computeVertexNormals();
    sb.add(xf(mg, { p: mc }), headB, coat('muzzle'), M_FABRIC);
    noseTip.copy(mc).add(v3(mrx * 0.9, mry * 0.38, 0));
    sb.add(blob(0.037, 0.031, 0.044, noseTip, undefined, 9, 6), headB, '#2a2028', M_GLOSSY);
    jaw = sb.bone('jaw', headB, hc.clone().add(v3(0.06, -0.082, 0)));
    const jl = 0.07 + 0.065 * snout;
    sb.add(blob(jl, 0.034, 0.064, hc.clone().add(v3(0.115 + 0.065 * snout, -0.104, 0)), undefined, 10, 6), jaw, coat('jaw'), M_FABRIC);
    sb.add(blob(jl * 0.9, 0.02, 0.054, hc.clone().add(v3(0.118 + 0.062 * snout, -0.086, 0)), undefined, 8, 5), jaw, lineC, M_CLAY);
    const tp = hc.clone().add(v3(0.1 + 0.03 * snout, -0.088, 0));
    const tl = 0.15 + 0.1 * snout;
    tongue = sb.bone('tongue', jaw, tp, frameQuatYZ(v3(1, -0.1, 0)));
    const tg = ellipsoid(0.009, tl / 2, 0.036, 8, 6);
    const tpos = tg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < tpos.count; i++) tpos.setZ(i, tpos.getZ(i) * (1.0 + 0.25 * (tpos.getY(i) / (tl / 2))));
    tg.computeVertexNormals();
    sb.addLocal(xf(tg, { p: [0, tl / 2, 0] }), tongue, '#ff7f93', M_CLAY);
    if (fluff > 0.5) {
      // scruffy moustache + brow overhang
      const k = 0.6 + 0.6 * fluff;
      for (const side of [1, -1]) {
        sb.add(blob(0.055 * k, 0.045 * k, 0.045 * k, mc.clone().add(v3(0.02, -0.035, side * 0.06)), [0, 0, -0.3], 7, 5), headB, coat('muzzle'), M_FABRIC);
        sb.add(blob(0.05 * k, 0.03 * k, 0.05 * k, HP(side * 24, 40, 0.012), [0, 0, -0.5], 7, 5), headB, coat('head'), M_FABRIC);
      }
    }
  } else {
    const fx = hrx * 0.84;
    for (const side of [1, -1]) {
      sb.add(blob(0.05, 0.042, 0.052, hc.clone().add(v3(fx, -0.056, side * 0.036)), undefined, 8, 6), headB, coat('muzzle'), M_FABRIC);
    }
    noseTip.copy(hc).add(v3(fx + 0.046, -0.03, 0));
    sb.add(blob(0.019, 0.015, 0.027, noseTip, undefined, 7, 5), headB, '#e88c94', M_GLOSSY);
    jaw = sb.bone('jaw', headB, hc.clone().add(v3(0.07, -0.078, 0)));
    sb.add(blob(0.042, 0.03, 0.05, hc.clone().add(v3(fx - 0.01, -0.1, 0)), undefined, 8, 5), jaw, coat('jaw'), M_FABRIC);
    sb.add(blob(0.03, 0.013, 0.03, hc.clone().add(v3(fx + 0.004, -0.082, 0)), undefined, 6, 4), jaw, lineC, M_CLAY);
    tongue = sb.bone('tongue', jaw, hc.clone().add(v3(fx - 0.01, -0.086, 0)), frameQuatYZ(v3(1, -0.2, 0)));
    sb.addLocal(xf(ellipsoid(0.006, 0.034, 0.02, 6, 5), { p: [0, 0.034, 0] }), tongue, '#ff7f93', M_CLAY);
    // whiskers
    const wc = luma(primary) > 0.72 ? '#b9b1b8' : '#fdfaf3';
    for (const side of [1, -1]) {
      for (let k = -1; k <= 1; k++) {
        const b = hc.clone().add(v3(fx + 0.01, -0.052 + k * 0.012, side * 0.075));
        const t = b.clone().add(v3(-0.03 + Math.abs(k) * -0.01, k * 0.035 + 0.01, side * 0.17));
        const m = b.clone().lerp(t, 0.5).add(v3(0.012, 0.004, 0));
        sb.add(tube([b, m, t], [0.004, 0.003, 0.0012], { radial: 3, segments: 2, tip: 0.2 }), headB, wc, M_CLAY);
      }
    }
    if (fluff > 0.5) {
      const k = 0.5 + 0.7 * fluff;
      for (const side of [1, -1]) {
        sb.add(blob(0.05 * k, 0.07 * k, 0.065 * k, HP(side * 80, -30, -0.005), [side * 0.5, 0, 0], 7, 5), headB, coat('head'), M_FABRIC);
      }
    }
  }

  // eyes
  const er = dog ? 0.06 : 0.067;
  const eyeAz = dog ? 31 : 34;
  const eyeEl = dog ? 10 : 4;
  const eyes: ReturnType<typeof buildEye>[] = [];
  for (const side of [1, -1] as const) {
    const n = HN(side * eyeAz, eyeEl);
    const surf = HP(side * eyeAz, eyeEl, 0);
    const centre = surf.clone().addScaledVector(n, -er * 0.5);
    const gaze = n.clone().multiplyScalar(0.5).add(v3(0.5, 0, 0));
    gaze.y *= 0.3;
    gaze.normalize();
    eyes.push(buildEye(sb, headB, centre, gaze, er, {
      iris: spec.eyeColor,
      lid: coatHex(surf, 'head', '#2a1a14', 0.14),
      lash: coatHex(surf, 'head', '#120a10', 0.72),
      slit: dog ? undefined : 0.42,
      irisDeg: dog ? 43 : 45,
      pupilDeg: dog ? 26 : 30,
    }));
  }
  // brows: little tufts above the eyes
  const browAt = HP(eyeAz - 2, dog ? 37 : 31, 0.004);
  const browBase = pattern === 'socks' || pattern === 'mask' ? secondary : primary;
  const browC = pattern === 'socks' || pattern === 'mask' ? secondary
    : luma(browBase) > 0.7 ? mixHex(browBase, '#7a5a44', 0.42)
      : luma(browBase) < 0.25 ? mixHex(browBase, '#ffffff', 0.22)
        : mixHex(browBase, '#2a1a14', 0.36);
  const brows: number[] = [];
  for (const side of [1, -1] as const) {
    const at = v3(browAt.x, browAt.y, side * browAt.z);
    brows.push(buildBrow(sb, headB, at, HN(side * (eyeAz - 2), dog ? 37 : 31), 0.03, 0.0125, browC, M_FABRIC, side));
  }
  // cheeks (puff when nervous)
  const cheeks: number[] = [];
  for (const side of [1, -1] as const) {
    const at = HP(side * 64, -24, 0);
    cheeks.push(buildCheek(sb, headB, at, HN(side * 64, -24), 0.05, coatHex(at, 'head', '#ffffff', 0.06), M_FABRIC));
  }

  // ── ears ──
  const chains: ChainDesc[] = [];
  const innerEar = mixHex(primary, '#ff9aa8', luma(primary) < 0.3 ? 0.4 : 0.55);
  for (const side of [1, -1] as const) {
    const part: Part = side > 0 ? 'earR' : 'earL';
    const role = side > 0 ? 'earR' : 'earL';
    const k = 1 + 0.15 * fluff;
    if (earType === 'floppy' || earType === 'long') {
      const long = earType === 'long';
      const A = HP(side * (long ? 76 : 72), long ? 38 : 46, -0.012);
      const offs = long
        ? [[0, 0.012, 0.05], [-0.012, -0.1, 0.088], [-0.02, -0.27, 0.072], [-0.02, -0.37, 0.055]]
        : [[0, 0.02, 0.055], [-0.008, -0.065, 0.1], [-0.012, -0.19, 0.086], [-0.012, -0.25, 0.07]];
      const pts = [A.clone(), ...offs.map(([x, y, z]) => A.clone().add(v3(x, y, side * z)))];
      const radii = long ? [0.04, 0.072, 0.095, 0.085, 0.035] : [0.04, 0.07, 0.085, 0.07, 0.03];
      const e1 = sb.bone('ear1', headB, A, frameQuatY(v3(0, -0.5, side * 0.86)));
      const e2 = sb.bone('ear2', e1, pts[2].clone().lerp(pts[3], long ? 0.35 : 0.2), frameQuatY(v3(0, -1, side * -0.08)));
      sb.add(tube(pts, radii.map((r) => r * k), { radial: 8, segments: 8, flat: 0.36, up: v3(0, 1, 0) }), chainWeights(pts, headB, [e1, e2], [0.12, long ? 0.55 : 0.5]), coat(part), M_FABRIC);
      chains.push({ role, bones: [e1, e2], stiff: long ? 55 : 70, damp: long ? 5 : 6, gain: long ? 0.42 : 0.36, limit: 1.1, hang: 1 });
    } else if (earType === 'pointy') {
      const B = HP(side * (dog ? 46 : 50), dog ? 56 : 50, -0.022);
      const dir = v3(dog ? 0.02 : 0.03, 1, side * (dog ? 0.34 : 0.44)).normalize();
      const h = (dog ? 0.215 : 0.185) * k;
      const r = (dog ? 0.09 : 0.1) * k;
      const q = frameQuatY(dir);
      const e1 = sb.bone('ear1', headB, B, q);
      const e2 = sb.bone('ear2', e1, B.clone().addScaledVector(dir, h * 0.5), q);
      const w: WeightFn = (p, o) => {
        const u = tmpD.copy(p).sub(B).dot(dir) / h;
        o.a = e1;
        o.b = e2;
        o.w = smoothstep(0.25, 0.85, u);
      };
      const cone = lathe([[r, 0], [r * 0.87, h * 0.28], [r * 0.52, h * 0.66], [r * 0.15, h * 0.95], [0, h]], 8, 0.42, 1);
      sb.add(xf(cone, { p: B, q }), w, coat(part), M_FABRIC);
      const inner = lathe([[r * 0.62, 0], [r * 0.52, h * 0.2], [r * 0.3, h * 0.5], [0, h * 0.74]], 6, 0.3, 1);
      const ip = B.clone().add(v3(0.018, 0.012, 0).applyQuaternion(q));
      sb.add(xf(inner, { p: ip, q }), w, innerEar, M_FABRIC);
      chains.push({ role, bones: [e1, e2], stiff: 190, damp: 10, gain: 0.16, limit: 0.7, hang: 0 });
    } else {
      // folded: upright with the tip tipping forward
      const B = HP(side * 52, 54, -0.016);
      const offs = [[0, 0.09, 0.03], [0.045, 0.135, 0.04], [0.1, 0.1, 0.046], [0.12, 0.055, 0.046]];
      const pts = [B.clone(), ...offs.map(([x, y, z]) => B.clone().add(v3(x * k, y * k, side * z)))];
      const e1 = sb.bone('ear1', headB, B, frameQuatY(v3(0, 1, side * 0.3)));
      const e2 = sb.bone('ear2', e1, pts[2].clone(), frameQuatY(v3(0.8, -0.5, 0), v3(0, 0, 1)));
      sb.add(tube(pts, [0.075, 0.07, 0.058, 0.04, 0.015].map((r) => r * k), { radial: 8, segments: 8, flat: 0.4, up: v3(1, 0, 0) }), chainWeights(pts, headB, [e1, e2], [0.1, 0.55]), coat(part), M_FABRIC);
      chains.push({ role, bones: [e1, e2], stiff: 120, damp: 8, gain: 0.26, limit: 0.8, hang: 0.3 });
    }
  }

  // ── tail ──
  {
    const T0 = v3(bx - halfLen * 0.93, bodyY + ry * 0.42, 0);
    const tk = 1 + 0.5 * fluff;
    let offs: number[][];
    let radii: number[];
    let flat = 1;
    let stiff = 80;
    let gain = 0.3;
    if (tailType === 'stub') {
      offs = [[-0.035, 0.03], [-0.07, 0.065]];
      radii = [0.05 * tk, 0.05 * tk, 0.035 * tk];
      stiff = 260;
      gain = 0.12;
    } else if (tailType === 'curl') {
      offs = [[-0.1, 0.1], [-0.085, 0.25], [0.035, 0.285], [0.085, 0.185], [0.03, 0.125]];
      radii = [0.052, 0.058, 0.06, 0.055, 0.046, 0.03].map((r) => r * tk);
      stiff = 150;
      gain = 0.14;
    } else if (tailType === 'plume') {
      offs = [[-0.11, 0.11], [-0.15, 0.31], [-0.05, 0.47], [0.09, 0.47]];
      radii = [0.06, 0.1, 0.135, 0.115, 0.04].map((r) => r * (0.85 + 0.3 * fluff));
      flat = 0.6;
      stiff = 60;
      gain = 0.28;
    } else if (dog) {
      offs = [[-0.1, 0.06], [-0.2, 0.17], [-0.26, 0.31], [-0.27, 0.4]];
      radii = [0.044, 0.04, 0.034, 0.026, 0.016].map((r) => r * tk);
    } else {
      offs = [[-0.1, 0.09], [-0.14, 0.25], [-0.085, 0.4], [-0.11, 0.52], [-0.16, 0.57]];
      radii = [0.04, 0.038, 0.037, 0.036, 0.034, 0.026].map((r) => r * tk);
      stiff = 65;
    }
    const pts = [T0.clone().add(v3(0.05, -0.02, 0)), T0.clone(), ...offs.map(([x, y]) => T0.clone().add(v3(x, y, 0)))];
    radii = [radii[0] * 0.9, ...radii];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const at = tailType === 'stub' ? [0.3] : [0.2, 0.5, 0.75];
    const bones: number[] = [];
    let parent = body;
    for (const u of at) {
      const b = sb.bone('tail', parent, curve.getPoint(u), frameQuatYZ(curve.getTangent(u)));
      bones.push(b);
      parent = b;
    }
    const wf = chainWeights(pts, body, bones, at);
    const samples: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) samples.push(curve.getPoint(i / 24));
    const paint: ColorFn = (p, out) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i <= 24; i++) {
        const d = samples[i].distanceToSquared(p);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      coatAt(p, 'tail', best / 24, out);
    };
    sb.add(tube(pts, radii, { radial: tailType === 'plume' ? 10 : 8, segments: tailType === 'stub' ? 5 : 11, flat, up: v3(0, 0, 1) }), wf, paint, M_FABRIC);
    chains.push({ role: 'tail', bones, stiff, damp: tailType === 'stub' ? 12 : 6, gain, limit: 0.8, hang: tailType === 'plume' || tailType === 'long' ? 0.25 : 0 });
  }

  // ── fluff ──
  if (fluff > 0.3) {
    const k = fluff;
    sb.add(blob(0.07 + 0.05 * k, 0.09 + 0.05 * k, rz * (0.72 + 0.18 * k), [bx + halfLen * 0.84, bodyY - 0.012, 0], [0, 0, -0.25], 9, 6), body, coat('tuft'), M_FABRIC);
  }
  if (fluff > 0.55) {
    const k = fluff;
    for (const side of [1, -1]) {
      sb.add(blob(0.085 * k, 0.1 * k, 0.07 * k, [hindX - 0.015, bodyY - 0.035, side * rz * 0.72], undefined, 8, 5), body, coat('body'), M_FABRIC);
    }
  }

  // ── collar / bandana ──
  const neckAxis = v3(0.62, 0.78, 0).normalize();
  const nc = v3(bx + halfLen * 0.9, bodyY + ry * 0.86, 0);
  const collarR = (dog ? 0.122 : 0.11) * (0.92 + 0.12 * girth) * (1 + 0.22 * Math.max(0, fluff - 0.45));
  {
    const tor = new THREE.TorusGeometry(collarR, 0.02, 6, 16);
    tor.deleteAttribute('uv');
    tor.scale(1, 1, 1.5);
    sb.add(xf(tor, { p: nc, q: new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), neckAxis) }), body, spec.accent, M_FABRIC);
    const cf = nc.clone().add(v3(neckAxis.y, -neckAxis.x, 0).multiplyScalar(collarR + 0.012));
    const cloth = sb.bone('cloth', body, cf, frameQuatYZ(v3(0.12, -1, 0)));
    if (dog) {
      // a triangle of cloth: full width at the collar, a point at the bottom
      const hy = 0.085;
      const hw = 0.115;
      const g = ellipsoid(0.016, hy, hw, 8, 6);
      const gp = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < gp.count; i++) {
        const y = gp.getY(i);
        const c = Math.sqrt(Math.max(1e-4, 1 - (y / hy) * (y / hy)));
        const zr = Math.max(-1, Math.min(1, gp.getZ(i) / (hw * c)));
        gp.setZ(i, zr * hw * clamp01((y + hy) / (2 * hy)));
      }
      g.computeVertexNormals();
      sb.add(xf(g, { p: cf.clone().add(v3(0.014, -0.07, 0)), r: [0, 0, 0.14] }), cloth, spec.accent, M_FABRIC);
    } else {
      sb.add(blob(0.03, 0.03, 0.03, cf.clone().add(v3(0.008, -0.028, 0)), undefined, 8, 6), cloth, '#ffc94a', M_GLOSSY);
    }
    chains.push({ role: 'cloth', bones: [cloth], stiff: 90, damp: 6, gain: 0.3, limit: 0.8, hang: 0.6 });
  }

  // ── courier harness ──
  const strapC = luma(primary) < 0.3 ? '#efe3cf' : PALETTE.navy;
  const steel = '#c5ccd6';
  const hxs = 0.16;
  const hx = bx + hxs * halfLen;
  const hr = prof(hxs);
  {
    const tor = new THREE.TorusGeometry(1, 0.02, 5, 18);
    tor.deleteAttribute('uv');
    // torus lies in XY (axis z): turn the axis to x, then fit to the trunk's cross-section
    tor.rotateY(Math.PI / 2);
    const tp = tor.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      const z = tp.getZ(i);
      const l = Math.hypot(y, z);
      const tubeOff = l - 1;
      const ny = y / l;
      const nz = z / l;
      tp.setXYZ(i, tp.getX(i) * 1.7, ny * (hr * ry + 0.006) + ny * tubeOff * 0.55, nz * (hr * rz + 0.006) + nz * tubeOff * 0.55);
    }
    tor.computeVertexNormals();
    sb.add(xf(tor, { p: [hx, bodyY + (dog ? 0 : 0.02 * (1 - hxs * hxs)), 0] }), body, strapC, M_CLAY);
  }
  const backY = bodyY + hr * ry + (dog ? 0 : 0.02);
  sb.add(blob(0.07, 0.022, 0.058, [hx, backY + 0.008, 0], undefined, 8, 5), body, PALETTE.butter, M_CLAY);
  const ring = v3(hx - 0.04, backY + 0.052, 0);
  {
    const tor = new THREE.TorusGeometry(0.034, 0.0095, 5, 12);
    tor.deleteAttribute('uv');
    sb.add(xf(tor, { p: ring }), body, steel, M_GLOSSY);
  }
  const socket = v3(hx + 0.022, backY + 0.02, 0);
  const anchor = v3(0, RIG.CARRY_Y, 0);
  const standLen = anchor.distanceTo(socket);
  const stand = sb.bone('stand', -1, anchor, frameQuatYZ(socket.clone().sub(anchor)));
  sb.addLocal(xf(capsule(0.017, standLen - 0.02, 8, 2), { p: [0, standLen / 2 + 0.01, 0] }), stand, steel, M_GLOSSY);
  sb.addLocal(xf(capsule(0.027, 0.1, 8, 2), { p: [0, standLen - 0.06, 0] }), stand, PALETTE.butter, M_CLAY);
  const cradle = sb.bone('cradle', -1, anchor);
  sb.add(xf(lathe([[0, -0.034], [0.055, -0.034], [0.13, -0.01], [0.142, 0], [0.126, -0.003], [0.05, -0.018], [0, -0.018]], 14), { p: anchor }), cradle, PALETTE.butter, M_CLAY);

  const mesh = sb.build(`character:${spec.id}`);
  return {
    species: spec.species,
    mesh,
    bones: sb.bones,
    restP: sb.restP,
    restQ: sb.restQ,
    root,
    body,
    head: headB,
    limbs: [
      { bone: legs[0].bone, tip: legs[0].tip, restLen: legTop - pawY },
      { bone: legs[1].bone, tip: legs[1].tip, restLen: legTop - pawY },
      { bone: legs[2].bone, tip: legs[2].tip, restLen: legTop - pawY },
      { bone: legs[3].bone, tip: legs[3].tip, restLen: legTop - pawY },
    ],
    face: {
      eyes: [eyes[0], eyes[1]],
      brows: [brows[0], brows[1]],
      cheeks: [cheeks[0], cheeks[1]],
      jaw,
      tongue,
    },
    chains,
    headScale: 1,
    hair: -1,
    hat: -1,
    topY: hc.y + hry,
    headY: hc.y,
    skullTopY: hc.y + hry,
    stand,
    cradle,
    socket,
    ring,
    standLen,
    bindQ: sb.bindQuats(),
    dims: {
      hipY: legTop, shoulderY: legTop, shoulderZ: frontZ, hipZ: hindZ, frontX, hindX,
      belly: Math.max(0.02, bodyY - ry - 0.012), seatY: bodyY - ry,
      rumpX: bx - halfLen * 0.72, rumpY: bodyY - ry * 0.82,
      headCX: hc.x, headCY: hc.y, headR: hry, chinY: hc.y - hry,
    },
    triangles: sb.triangles,
  };
}

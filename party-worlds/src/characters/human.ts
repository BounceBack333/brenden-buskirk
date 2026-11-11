/**
 * People. Proportions follow the art bible (head ≈ 42% of height, short limbs, mitten hands)
 * with our own shape language: a soft rounded-cube head with real cheeks, a bell-shaped jumper
 * body and chunky shoes. Recognition comes from hair silhouette + colour blocking + face furniture.
 */
import * as THREE from 'three';
import type { CharacterSpec } from '../kit/contracts';
import { PALETTE } from '../kit/materials';
import { HeadShape, buildBrow, buildCheek, buildEye, buildMouths, keyed, shell } from './face';
import type { ColorFn, Paint } from './geo';
import { M_CLAY, M_FABRIC, M_GLOSSY, SkinBuilder, blob, capsule, ellipsoid, frameQuatY, lathe, ringSurface, tube, v3, xf } from './geo';
import type { BodyDesc, ChainDesc } from './types';
import { clamp01, luma, mixHex, mulberry32, smoothstep } from './util';

const DEG = Math.PI / 180;

function gauss(x: number): number {
  return Math.exp(-x * x);
}

function signedDeg(az: number): number {
  let a = az / DEG;
  a = ((a + 180) % 360 + 360) % 360 - 180;
  return a;
}

function topOf(geo: THREE.BufferGeometry): number {
  const p = geo.getAttribute('position');
  let m = -Infinity;
  for (let i = 0; i < p.count; i++) m = Math.max(m, p.getY(i));
  return m;
}

/** Closed loop of tube in the plane x = cx (glasses frames). e = 1 round, < 1 squarer. */
function frameLoop(c: THREE.Vector3, hw: number, hh: number, e: number, tubeR: number, seg: number): THREE.BufferGeometry {
  const cross = 5;
  return ringSurface(seg, cross + 1, (i, j, out) => {
    const phi = (i / seg) * Math.PI * 2;
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    const z = Math.sign(cs) * Math.pow(Math.abs(cs), e) * hw;
    const y = Math.sign(sn) * Math.pow(Math.abs(sn), e) * hh;
    const l = Math.hypot(y, z) || 1;
    const a = (j / cross) * Math.PI * 2;
    out.set(c.x + Math.sin(a) * tubeR, c.y + y + (y / l) * Math.cos(a) * tubeR, c.z + z + (z / l) * Math.cos(a) * tubeR);
  });
}

export function buildHuman(spec: CharacterSpec): BodyDesc {
  const sb = new SkinBuilder();
  const k = 0.86 + 0.24 * spec.stature; // body length
  const g = 0.86 + 0.34 * spec.build; // girth
  const little = spec.stature < 0.2;
  const hairStyle = spec.hairStyle ?? 'short';
  const hat = spec.hat ?? 'none';
  const glasses = spec.glasses ?? 'none';
  const facial = spec.facialHair ?? 'none';

  // ── proportions ──
  const hipY = 0.235 * k;
  const y0 = hipY - 0.045;
  const shY = hipY + 0.33 * k;
  const neckY = shY + 0.025;
  const ry = 0.215;
  const rx = 0.198;
  const rz = 0.214 * (0.97 + 0.07 * spec.build);
  const cy = neckY + ry - 0.035;
  const head = new HeadShape(v3(0.004, cy, 0), rx, ry, rz, little ? 2.3 : 2.55, 0.07 + 0.06 * spec.build, 0.05);
  const P = (azDeg: number, elDeg: number, lift = 0): THREE.Vector3 => head.point(azDeg * DEG, elDeg * DEG, lift);
  const Nrm = (azDeg: number, elDeg: number): THREE.Vector3 => head.normal(azDeg * DEG, elDeg * DEG);

  // ── colours ──
  const skin = spec.primary;
  const hair = spec.secondary;
  const top = spec.accent;
  const bottom = spec.bottom ?? '#2f3b5c';
  const darkSkin = luma(skin) < 0.48;
  const noseC = mixHex(skin, '#8a2f2a', 0.17);
  const lidC = mixHex(skin, '#5a2a22', 0.1);
  const lashC = mixHex(skin, '#160c12', 0.86);
  const lineC = mixHex(skin, '#2a0a16', darkSkin ? 0.86 : 0.8);
  const blushC = mixHex(skin, '#ff4a66', darkSkin ? 0.3 : 0.36);
  const browC = luma(hair) > 0.72 ? mixHex(hair, '#8d8288', luma(skin) > 0.6 ? 0.45 : 0.1) : hair;
  const shoeC = luma(bottom) < 0.36 ? '#f4ead8' : '#3a2f3d';
  const hatC = bottom;

  // ── skeleton ──
  const root = sb.bone('root', -1, v3(0, 0, 0));
  const torso = sb.bone('torso', root, v3(0, hipY, 0));
  const headB = sb.bone('head', torso, v3(0, neckY, 0));
  const armLen = 0.25 * (0.88 + 0.12 * k);
  const armY = shY - 0.045;
  const sz = 0.118 * g + 0.032;
  const hz = 0.076 * g;
  const armR = sb.bone('armR', torso, v3(0, armY, sz));
  const handR = sb.bone('handR', armR, v3(0, armY - armLen, sz));
  const armL = sb.bone('armL', torso, v3(0, armY, -sz));
  const handL = sb.bone('handL', armL, v3(0, armY - armLen, -sz));
  const footY = 0.045;
  const legR = sb.bone('legR', torso, v3(0, hipY, hz));
  const footR = sb.bone('footR', legR, v3(0, footY, hz));
  const legL = sb.bone('legL', torso, v3(0, hipY, -hz));
  const footL = sb.bone('footL', legL, v3(0, footY, -hz));

  // ── torso: a little bell-shaped jumper ──
  const waistY = hipY + 0.05 * k;
  const topC = new THREE.Color(top);
  const bottomC = new THREE.Color(bottom);
  const hemC = new THREE.Color(mixHex(top, luma(top) > 0.55 ? '#3b2a4a' : '#ffffff', 0.22));
  const torsoPaint: ColorFn = (p, out) => {
    if (p.y < waistY) out.copy(bottomC);
    else if (p.y < waistY + 0.022) out.copy(hemC);
    else out.copy(topC);
  };
  {
    const prof: Array<[number, number]> = [
      [0, y0], [0.085 * g, y0 + 0.012], [0.142 * g, y0 + 0.045], [0.166 * g, waistY - 0.003],
      [0.169 * g, waistY], [0.169 * g, waistY + 0.021], [0.168 * g, waistY + 0.024],
      [0.16 * g, hipY + 0.17 * k], [0.136 * g, shY - 0.055], [0.112 * g, shY - 0.012], [0.072, shY + 0.02], [0, shY + 0.036],
    ];
    const geo = lathe(prof, 20, 0.86, 1);
    // tummy for stockier builds
    const belly = Math.max(0, spec.build - 0.45) * 0.09;
    if (belly > 0) {
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      const mid = hipY + 0.1 * k;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        if (x > 0) p.setX(i, x + belly * (x / (0.15 * g)) * gauss((p.getY(i) - mid) / (0.11 * k)));
      }
      geo.computeVertexNormals();
    }
    sb.add(geo, torso, torsoPaint, M_FABRIC);
  }

  // ── arms + mitten hands ──
  const armRad = 0.045 + 0.007 * spec.build;
  for (const side of [1, -1] as const) {
    const arm = side > 0 ? armR : armL;
    const hand = side > 0 ? handR : handL;
    const z = side * sz;
    const len = armLen - 0.045;
    sb.add(xf(capsule(armRad, len, 8, 3), { p: [0, armY - len / 2, z] }), arm, top, M_FABRIC);
    sb.add(blob(0.05, 0.056, 0.046, [0.004, armY - armLen, z], undefined, 9, 6), hand, skin, M_CLAY);
    sb.add(blob(0.021, 0.024, 0.02, [0.04, armY - armLen + 0.014, z], undefined, 6, 4), hand, skin, M_CLAY);
  }

  // ── legs + shoes ──
  const legRad = 0.06 * (0.9 + 0.2 * spec.build);
  for (const side of [1, -1] as const) {
    const leg = side > 0 ? legR : legL;
    const foot = side > 0 ? footR : footL;
    const z = side * hz;
    const len = Math.max(0.02, hipY - 0.075);
    sb.add(xf(capsule(legRad, len, 10, 3), { p: [0, hipY - len / 2, z] }), leg, bottom, M_FABRIC);
    sb.add(blob(0.092, 0.05, 0.068, [0.03, 0.046, z], undefined, 10, 6), foot, shoeC, M_CLAY);
  }

  // ── head ──
  const skinC = new THREE.Color(skin);
  const stubC = new THREE.Color(mixHex(skin, hair, 0.5));
  const skullPaint: ColorFn = (p, out) => {
    out.copy(skinC);
    if (facial === 'stubble') {
      const d = head.dirOf(p);
      const f = smoothstep(-4, -24, d.el / DEG) * smoothstep(120, 96, Math.abs(d.az) / DEG);
      out.lerp(stubC, f * 0.7);
    }
  };
  sb.add(head.geometry(24, 14), headB, skullPaint, M_CLAY);
  const skullTopY = cy + ry;
  // ears, nose
  for (const side of [1, -1] as const) {
    sb.add(blob(0.03, 0.046, 0.022, P(side * 92, -6, 0.004), undefined, 7, 5), headB, noseC, M_CLAY);
  }
  sb.add(blob(0.03, 0.027, 0.032, P(0, -13, 0.014), undefined, 8, 6), headB, noseC, M_CLAY);

  // eyes
  const er = little ? 0.07 : 0.066;
  const eyeAz = 27;
  const eyeEl = -3;
  const eyes: ReturnType<typeof buildEye>[] = [];
  const eyeFront: THREE.Vector3[] = [];
  for (const side of [1, -1] as const) {
    const n = Nrm(side * eyeAz, eyeEl);
    const centre = P(side * eyeAz, eyeEl, 0).addScaledVector(n, -er * 0.52);
    const gaze = n.clone().multiplyScalar(0.42).add(v3(0.58, 0, 0));
    gaze.y = 0;
    gaze.normalize();
    eyes.push(buildEye(sb, headB, centre, gaze, er, { iris: spec.eyeColor, lid: lidC, lash: lashC }));
    eyeFront.push(centre.clone().addScaledVector(gaze, er));
  }
  // brows
  const browThick = facial === 'mustache' || facial === 'beard' ? 0.0145 : 0.0115;
  const brows: number[] = [];
  for (const side of [1, -1] as const) {
    brows.push(buildBrow(sb, headB, P(side * eyeAz, 21, 0.004), Nrm(side * eyeAz, 21), 0.043, browThick, browC, M_FABRIC, side));
  }
  // cheeks
  const cheeks: number[] = [];
  for (const side of [1, -1] as const) {
    cheeks.push(buildCheek(sb, headB, P(side * 52, -27, 0), Nrm(side * 52, -27), 0.044, blushC, M_CLAY));
  }
  // mouth (sits further out on a beard)
  const mouthLift = facial === 'beard' ? 0.034 : 0.002;
  const mouths = buildMouths(sb, headB, P(0, -37, mouthLift), Nrm(0, -37), 0.056, lineC, 1 / (2.6 * rz));

  // ── hair ──
  const hairB = sb.bone('hair', headB, v3(0, cy, 0));
  // (mixes are done on the sRGB hex values so dark hair stays dark)
  const hairLight = new THREE.Color(mixHex(hair, '#ffffff', 0.09));
  const hairDark = new THREE.Color(mixHex(hair, '#0d0810', 0.22));
  const hairPaint: ColorFn = (p, out) => {
    out.copy(hairDark).lerp(hairLight, clamp01((p.y - (cy - ry)) / (2.5 * ry)));
  };
  let topY = skullTopY;
  const chains: ChainDesc[] = [];
  const addHair = (geo: THREE.BufferGeometry, bone: number | Parameters<SkinBuilder['add']>[1], paint: Paint = hairPaint): void => {
    topY = Math.max(topY, topOf(geo));
    sb.add(geo, bone, paint, M_FABRIC);
  };

  const capB = (az: number): number => keyed(az, [[0, 31], [70, 26], [120, 15], [180, 9]]) * DEG;
  const beanB = (az: number): number => keyed(az, [[0, 33], [80, 24], [130, 9], [180, 1]]) * DEG;
  const hatB = hat === 'cap' ? capB : hat === 'beanie' ? beanB : null;
  const underHat = (az: number, el: number): boolean => hatB !== null && el > hatB(az) - 3 * DEG;
  const lim = (az: number, el: number, th: number): number => (underHat(az, el) ? Math.min(th, 0.016) : th);
  const hatted = hatB !== null;
  let crownLift = 0; // hair thickness at the very top (where a party hat sits)

  if (hairStyle !== 'bald') {
    chains.push({ role: 'hair', bones: [hairB], stiff: 150, damp: 11, gain: 0.05, limit: 0.12, hang: 0 });
  }

  if (hairStyle === 'short') {
    crownLift = 0.046;
    addHair(shell(head, {
      cols: 24,
      boundary: (az) => (keyed(az, [[0, 50], [35, 46], [60, 30], [80, 12], [100, 4], [130, -22], [180, -34]]) - 13 * gauss((signedDeg(az) - 22) / 20)) * DEG,
      thickness: (az, el) => lim(az, el, 0.026 + 0.02 * Math.max(0, Math.sin(el)) + 0.024 * gauss((signedDeg(az) - 24) / 28) * gauss((el / DEG - 46) / 18)),
    }), hairB);
    if (!hatted) {
      // a soft quiff so the silhouette is not a helmet
      addHair(blob(0.085, 0.04, 0.07, P(20, 62, 0.03), [0.25, 0.3, -0.35], 9, 6), hairB);
    }
  } else if (hairStyle === 'spiky') {
    crownLift = 0.03;
    addHair(shell(head, {
      cols: 24,
      boundary: (az) => keyed(az, [[0, 52], [40, 47], [62, 30], [80, 12], [100, 4], [130, -20], [180, -30]]) * DEG,
      thickness: (az, el) => lim(az, el, 0.027),
    }), hairB);
    const spikes: Array<[number, number, number]> = [
      [0, 60, 0.14], [-34, 58, 0.11], [34, 58, 0.11], [0, 84, 0.16], [-62, 68, 0.12], [62, 68, 0.12],
      [140, 62, 0.12], [-140, 62, 0.12], [180, 36, 0.1], [95, 40, 0.085], [-95, 40, 0.085],
    ];
    for (const [az, el, len] of spikes) {
      if (underHat(az * DEG, el * DEG)) continue;
      const base = P(az, el, 0.004);
      const dir = base.clone().sub(head.c).normalize().add(v3(0.4, 0.3, 0)).normalize();
      const r = len * 0.42;
      const cone = lathe([[r, 0], [r * 0.86, len * 0.25], [r * 0.52, len * 0.62], [r * 0.2, len * 0.92], [0, len]], 6);
      addHair(xf(cone, { p: base, q: new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir) }), hairB);
    }
  } else if (hairStyle === 'curly') {
    crownLift = 0.075;
    addHair(shell(head, {
      cols: 24,
      boundary: (az) => keyed(az, [[0, 45], [40, 40], [70, 16], [90, -2], [130, -24], [180, -32]]) * DEG,
      thickness: (az, el) => lim(az, el, 0.04),
    }), hairB);
    const rnd = mulberry32(7717);
    const clumps: Array<[number, number]> = [
      [0, 50], [40, 44], [-40, 44], [74, 22], [-74, 22], [108, 4], [-108, 4], [150, -10], [-150, -10],
      [62, 64], [-62, 64], [128, 40], [-128, 40], [180, 30], [0, 82], [180, 72],
    ];
    for (const [az, el] of clumps) {
      const r = 0.062 + rnd() * 0.016;
      if (underHat(az * DEG, el * DEG)) continue;
      addHair(blob(r, r * 0.92, r, P(az + (rnd() - 0.5) * 8, el + (rnd() - 0.5) * 6, 0.02), undefined, 7, 5), hairB);
    }
  } else if (hairStyle === 'afro') {
    crownLift = 0.15;
    addHair(shell(head, {
      cols: 28,
      rings: [0.06, 0.17, 0.33, 0.5, 0.68, 0.85],
      boundary: (az) => keyed(az, [[0, 40], [45, 30], [75, 2], [95, -16], [130, -28], [180, -34]]) * DEG,
      thickness: (az, el) => lim(az, el, (0.118 + 0.035 * Math.max(0, Math.sin(el))) * (1 + 0.07 * Math.sin(az * 7) * Math.cos(el * 5))),
    }), hairB);
  } else if (hairStyle === 'bun' || hairStyle === 'ponytail') {
    crownLift = 0.024;
    addHair(shell(head, {
      cols: 24,
      boundary: (az) => keyed(az, [[0, 55], [40, 50], [65, 36], [85, 16], [100, 6], [130, -16], [180, -26]]) * DEG,
      thickness: (az, el) => lim(az, el, 0.022 + 0.014 * gauss(signedDeg(az) / 40) * gauss((el / DEG - 55) / 16)),
    }), hairB);
    if (hairStyle === 'bun') {
      const at = hatted ? P(180, 4, 0.04) : P(180, 56, 0.05);
      const out = at.clone().sub(head.c).normalize();
      const bun = sb.bone('bun', hairB, at.clone().addScaledVector(out, -0.05), frameQuatY(out));
      addHair(blob(0.088, 0.08, 0.088, at, undefined, 12, 8), bun);
      chains.push({ role: 'sway', bones: [bun], stiff: 170, damp: 9, gain: 0.1, limit: 0.3, hang: 0 });
    } else {
      const r0 = hatted ? P(180, 2, 0) : P(180, 36, 0);
      const pts = [r0.clone(), r0.clone().add(v3(-0.07, 0.035, 0)), r0.clone().add(v3(-0.15, -0.03, 0)), r0.clone().add(v3(-0.19, -0.15, 0)), r0.clone().add(v3(-0.17, -0.27, 0))];
      const a = sb.bone('ponyA', hairB, r0.clone().add(v3(-0.03, 0.01, 0)), frameQuatY(v3(-0.8, -0.45, 0)));
      const b = sb.bone('ponyB', a, r0.clone().add(v3(-0.17, -0.07, 0)), frameQuatY(v3(-0.05, -1, 0)));
      addHair(tube(pts, [0.036, 0.058, 0.068, 0.052, 0.014], { radial: 8, segments: 9, up: v3(0, 0, 1) }), (p, w) => {
        const u = clamp01((r0.x - p.x) / 0.19 * 0.45 + (r0.y + 0.035 - p.y) / 0.3 * 0.55);
        if (u < 0.22) {
          w.a = hairB;
          w.b = a;
          w.w = u / 0.22;
        } else {
          w.a = a;
          w.b = b;
          w.w = clamp01((u - 0.22) / 0.4);
        }
      });
      sb.add(blob(0.024, 0.046, 0.046, r0.clone().add(v3(-0.036, 0.017, 0)), [0, 0, -0.45], 8, 5), a, top, M_FABRIC);
      chains.push({ role: 'sway', bones: [a, b], stiff: 70, damp: 5.5, gain: 0.28, limit: 0.9, hang: 0.8 });
    }
  } else if (hairStyle === 'long') {
    crownLift = 0.04;
    addHair(shell(head, {
      cols: 24,
      boundary: (az) => keyed(az, [[0, 57], [25, 50], [48, 30], [66, 6], [80, -18], [100, -36], [180, -44]]) * DEG,
      thickness: (az, el) => lim(az, el, 0.03 + 0.012 * Math.max(0, Math.sin(el))),
    }), hairB);
    // the curtain down to the shoulders
    const a = sb.bone('hairA', hairB, v3(-0.03, cy - 0.09, 0), frameQuatY(v3(0, -1, 0)));
    const b = sb.bone('hairB', a, v3(-0.05, neckY - 0.05, 0), frameQuatY(v3(0, -1, 0)));
    const N = 15;
    const tipY = shY - 0.085;
    const ys = [cy - 0.02, cy - 0.11, neckY - 0.015, (neckY + tipY) / 2 - 0.01, tipY, tipY - 0.004];
    const fs = [1.0, 1.05, 1.0, 0.99, 0.9, 0.45];
    const tmp = new THREE.Vector3();
    const curtain = ringSurface(N, ys.length, (i, j, out) => {
      const az = (68 + (i / (N - 1)) * 224) * DEG;
      head.point(az, -12 * DEG, 0.034, tmp);
      const edge = i === 0 || i === N - 1 ? 0.84 : 1;
      const f = fs[j] * edge;
      out.set(head.c.x + (tmp.x - head.c.x) * f - 0.012 * j, ys[j], tmp.z * f);
    }, { wrap: false, inside: v3(0, (ys[0] + tipY) / 2, 0) });
    const yTop = cy - 0.02;
    addHair(curtain, (p, w) => {
      const u = clamp01((yTop - p.y) / (yTop - tipY));
      if (u < 0.3) {
        w.a = hairB;
        w.b = a;
        w.w = u / 0.3;
      } else {
        w.a = a;
        w.b = b;
        w.w = (u - 0.3) / 0.7;
      }
    });
    chains.push({ role: 'sway', bones: [a, b], stiff: 60, damp: 6, gain: 0.2, limit: 0.6, hang: 0.5 });
  }

  // ── facial hair ──
  if (facial === 'mustache' || facial === 'beard') {
    const big = facial === 'mustache' ? 1.2 : 1.0;
    const c = P(0, -24, 0.012);
    const st = sb.bone('stache', headB, c, frameQuatY(v3(0, 1, 0)));
    for (const side of [1, -1] as const) {
      sb.add(blob(0.024 * big, 0.027 * big, 0.06 * big, P(side * 12, -25.5, 0.014), [side * -0.42, side * -0.25, 0], 8, 5), st, hairPaint, M_FABRIC);
    }
    chains.push({ role: 'stache', bones: [st], stiff: 220, damp: 9, gain: 0.05, limit: 0.2, hang: 0 });
  }
  if (facial === 'beard') {
    const N = 15;
    const sList = [0.12, 0.32, 0.56, 0.8];
    const bound = (az: number): number => keyed(az, [[0, -26], [30, -23], [60, -15], [85, -2], [104, 6], [180, 6]]) * DEG;
    const th = (az: number, el: number): number => {
      const ends = smoothstep(112, 86, Math.abs(signedDeg(az)));
      return 0.004 + ends * (0.03 + 0.03 * gauss(signedDeg(az) / 42) * smoothstep(-34, -78, el / DEG));
    };
    const geo = ringSurface(N, sList.length + 3, (i, j, out) => {
      const az = (-112 + (i / (N - 1)) * 224) * DEG;
      const elB = bound(az);
      if (j === 0) head.point(az, elB, -0.008, out);
      else if (j === 1) head.point(az, elB, th(az, elB) * 0.6, out);
      else {
        const s = j === sList.length + 2 ? 1 : sList[j - 2];
        const el = elB + (-Math.PI / 2 - elB) * s;
        head.point(az, el, th(az, el), out);
      }
    }, { wrap: false, poleEnd: true, inside: head.c });
    sb.add(geo, headB, hairPaint, M_FABRIC);
  }

  // ── glasses ──
  if (glasses !== 'none') {
    const round = glasses === 'round';
    const frameC = round ? '#4a3328' : glasses === 'square' ? PALETTE.navy : '#1d1a24';
    const xg = Math.max(eyeFront[0].x, eyeFront[1].x) + 0.016;
    const hw = round ? 0.074 : 0.08;
    const hh = round ? 0.074 : 0.062;
    const e = round ? 1 : 0.5;
    const gy = eyeFront[0].y + 0.002;
    const gz = Math.abs(eyeFront[0].z) + 0.006;
    for (const side of [1, -1] as const) {
      const c = v3(xg, gy, side * gz);
      sb.add(frameLoop(c, hw, hh, e, glasses === 'shades' ? 0.007 : 0.0085, 18), headB, frameC, M_GLOSSY);
      if (glasses === 'shades') {
        sb.add(xf(ellipsoid(0.007, hh * 0.98, hw * 0.98, 12, 5), { p: c }), headB, '#231f2e', M_GLOSSY);
        sb.add(blob(0.004, 0.011, 0.024, [xg + 0.006, gy + hh * 0.42, side * gz + 0.02], [0.5, 0, 0], 6, 4), headB, '#8d8fb5', M_GLOSSY);
      }
      // temple arm back to the ear
      sb.add(tube([v3(xg, gy + 0.012, side * (gz + hw)), v3(0.03, gy + 0.004, side * (rz + 0.012))], [0.006, 0.006], { radial: 4, segments: 2 }), headB, frameC, M_GLOSSY);
    }
    sb.add(tube([v3(xg, gy + 0.014, -(gz - hw)), v3(xg + 0.006, gy + 0.026, 0), v3(xg, gy + 0.014, gz - hw)], [0.007, 0.007, 0.007], { radial: 4, segments: 4 }), headB, frameC, M_GLOSSY);
  }

  // ── hats ──
  let hatBone = -1;
  if (hat === 'cap') {
    const main = hatC;
    const brimC = mixHex(hatC, '#1a1420', 0.32);
    const g1 = shell(head, { cols: 24, rings: [0.3, 0.62, 0.86], boundary: capB, thickness: () => 0.036 });
    topY = Math.max(topY, topOf(g1));
    sb.add(g1, hairB, main, M_FABRIC);
    const bp = P(0, 27, 0.03);
    sb.add(xf(ellipsoid(0.125, 0.014, 0.14, 12, 5), { p: [bp.x + 0.07, bp.y - 0.014, 0], r: [0, 0, -0.2] }), hairB, brimC, M_FABRIC);
    sb.add(blob(0.02, 0.012, 0.02, P(0, 90, 0.04), undefined, 6, 4), hairB, brimC, M_FABRIC);
    topY += 0.008;
  } else if (hat === 'beanie') {
    const cuffC = new THREE.Color(mixHex(hatC, '#ffffff', 0.38));
    const mainC = new THREE.Color(hatC);
    const paint: ColorFn = (p, out) => {
      const d = head.dirOf(p);
      out.copy(d.el < beanB(d.az) + 15 * DEG ? cuffC : mainC);
    };
    const g1 = shell(head, {
      cols: 24, rings: [0.1, 0.2, 0.215, 0.45, 0.72, 0.9], boundary: beanB,
      thickness: (_az, _el, s) => (s < 0.21 ? 0.052 : 0.04),
    });
    topY = Math.max(topY, topOf(g1));
    sb.add(g1, hairB, paint, M_FABRIC);
    const tip = P(0, 90, 0.04);
    const pom = sb.bone('pom', hairB, tip, frameQuatY(v3(0, 1, 0)));
    const pg = blob(0.055, 0.055, 0.055, [tip.x - 0.01, tip.y + 0.035, 0], undefined, 9, 6);
    topY = Math.max(topY, topOf(pg));
    sb.add(pg, pom, mixHex(hatC, '#ffffff', 0.6), M_FABRIC);
    chains.push({ role: 'pom', bones: [pom], stiff: 120, damp: 7, gain: 0.25, limit: 0.7, hang: 0 });
  } else if (hat === 'party') {
    const baseY = P(0, 90, crownLift).y - 0.022;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0, 0.1));
    hatBone = sb.bone('hat', hairB, v3(-0.01, baseY, 0.01), q);
    const A = top === PALETTE.berry ? PALETTE.grape : PALETTE.berry;
    const stripeA = new THREE.Color(A);
    const stripeB = new THREE.Color(PALETTE.butter);
    const inv = sb.binds[hatBone].clone().invert();
    const H = 0.25;
    const R = 0.105;
    const bands = [0.0, 0.075, 0.15];
    const tmp = new THREE.Vector3();
    const paint: ColorFn = (p, out) => {
      const y = tmp.copy(p).applyMatrix4(inv).y;
      let n = 0;
      for (const bnd of bands) if (y > bnd + 0.0004) n++;
      out.copy(n % 2 === 1 ? stripeA : stripeB);
    };
    const rAt = (y: number): number => R * (1 - y / H) + 0.012 * (y / H);
    const prof: Array<[number, number]> = [[R + 0.006, 0], [R + 0.004, 0.006]];
    for (let i = 0; i < bands.length; i++) {
      const y = bands[i];
      if (i > 0) prof.push([rAt(y), y]);
      prof.push([rAt(y + 0.0008), y + 0.0008]);
    }
    prof.push([rAt(H - 0.02), H - 0.02], [0, H]);
    const cone = lathe(prof, 14);
    cone.applyMatrix4(sb.binds[hatBone]);
    topY = Math.max(topY, topOf(cone));
    sb.add(cone, hatBone, paint, M_CLAY);
    const tipW = v3(0, H, 0).applyMatrix4(sb.binds[hatBone]);
    const pom = sb.bone('pom', hatBone, tipW, q);
    const pg = blob(0.036, 0.036, 0.036, tipW.clone().add(v3(0, 0.012, 0)), undefined, 8, 5);
    topY = Math.max(topY, topOf(pg));
    sb.add(pg, pom, PALETTE.teal, M_FABRIC);
    chains.push({ role: 'pom', bones: [pom], stiff: 160, damp: 7, gain: 0.3, limit: 0.8, hang: 0 });
  }

  const mesh = sb.build(`character:${spec.id}`);
  return {
    species: 'human',
    mesh,
    bones: sb.bones,
    restP: sb.restP,
    restQ: sb.restQ,
    root,
    body: torso,
    head: headB,
    limbs: [
      { bone: armR, tip: handR, restLen: armLen },
      { bone: armL, tip: handL, restLen: armLen },
      { bone: legR, tip: footR, restLen: hipY - footY },
      { bone: legL, tip: footL, restLen: hipY - footY },
    ],
    face: {
      eyes: [eyes[0], eyes[1]],
      brows: [brows[0], brows[1]],
      cheeks: [cheeks[0], cheeks[1]],
      mouths,
      shades: glasses === 'shades',
    },
    chains,
    hair: hairB,
    hat: hatBone,
    topY,
    headY: cy,
    skullTopY,
    stand: -1,
    cradle: -1,
    socket: v3(0, 0, 0),
    ring: v3(0, 0, 0),
    standLen: 0,
    bindQ: sb.bindQuats(),
    dims: {
      hipY, shoulderY: armY, shoulderZ: sz, hipZ: hz, frontX: 0, hindX: 0,
      belly: y0, seatY: y0, rumpX: 0, rumpY: y0,
      headCX: head.c.x, headCY: cy, headR: ry, chinY: cy - ry,
    },
    triangles: sb.triangles,
  };
}

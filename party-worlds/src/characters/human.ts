/**
 * People, and person-shaped drivers who are not people.
 *
 * Grown-ups are the default: about four heads tall, shoulders wider than the head, a neck, a
 * jawline, eyes a sensible size, a nose with a bridge. The head is built at the size the face,
 * hair, glasses and hats were designed for and then worn smaller (BodyDesc.headScale), so every
 * piece of face furniture still fits. `age: 'kid'` keeps the original big-head proportions.
 * `creature` swaps the head's character (bear, fox, rabbit, frog, robot, alien, masked wrestler)
 * on the same adult body. Recognition comes from silhouette + colour blocking + face furniture.
 */
import * as THREE from 'three';
import type { CharacterSpec } from '../kit/contracts';
import { PALETTE } from '../kit/materials';
import { HeadShape, buildBrow, buildCheek, buildEye, buildMouths, keyed, shell } from './face';
import type { ColorFn, Paint } from './geo';
import { M_CLAY, M_FABRIC, M_GLOSSY, SkinBuilder, blob, capsule, ellipsoid, frameQuatY, lathe, ringSurface, sculpt, tube, v3, xf } from './geo';
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
  const adult = spec.age !== 'kid';
  const creature = adult ? spec.creature ?? 'none' : 'none';
  const outfit = spec.outfit ?? 'tee';
  const furry = creature === 'bear' || creature === 'fox' || creature === 'rabbit';
  const plain = creature === 'none' || creature === 'luchador'; // a human face under there
  const hs = adult ? 0.6 : 1; // the head is built full size and worn at this scale
  const k = adult ? 0.93 + 0.12 * spec.stature : 0.86 + 0.24 * spec.stature; // body length
  const g = adult ? 0.9 + 0.3 * spec.build : 0.86 + 0.34 * spec.build; // girth
  const little = !adult && spec.stature < 0.2;
  const hairStyle = creature !== 'none' ? 'bald' : spec.hairStyle ?? 'short';
  const hat = spec.hat ?? 'none';
  const glasses = spec.glasses ?? 'none';
  const facial = creature !== 'none' ? 'none' : spec.facialHair ?? 'none';

  // ── proportions ──
  const hipY = (adult ? 0.42 : 0.235) * k;
  const y0 = hipY - (adult ? 0.05 : 0.045);
  const shY = hipY + (adult ? 0.29 : 0.33) * k;
  const neckY = shY + (adult ? 0.065 : 0.025); // head pivot: the top of the neck
  let ry = adult ? 0.225 : 0.215;
  let rx = adult ? 0.19 : 0.198;
  let rz = (adult ? 0.18 : 0.214) * (0.97 + 0.07 * spec.build);
  let boxy = adult ? 2.45 : little ? 2.3 : 2.55;
  let jowl = adult ? 0.02 + 0.07 * spec.build : 0.07 + 0.06 * spec.build;
  let crown = adult ? 0.07 : 0.05;
  let chin = adult ? 0.2 - 0.08 * spec.build : 0;
  if (creature === 'bear') { ry = 0.212; rz = 0.205; boxy = 2.3; chin = 0.04; jowl = 0.1; }
  else if (creature === 'fox') { rz = 0.19; chin = 0.3; jowl = 0.02; }
  else if (creature === 'rabbit') { ry = 0.215; rz = 0.19; chin = 0.1; jowl = 0.09; }
  else if (creature === 'frog') { ry = 0.185; rx = 0.2; rz = 0.225; boxy = 2.2; chin = 0.05; jowl = 0.12; crown = 0.02; }
  else if (creature === 'robot') { ry = 0.19; rx = 0.185; rz = 0.2; boxy = 5.5; chin = 0; jowl = 0; crown = 0; }
  else if (creature === 'alien') { ry = 0.25; rz = 0.2; boxy = 2.2; chin = 0.42; jowl = 0; crown = -0.16; }
  const cy = neckY + ry - (adult ? 0.045 : 0.035);
  const head = new HeadShape(v3(0.004, cy, 0), rx, ry, rz, boxy, jowl, crown, chin);
  const P = (azDeg: number, elDeg: number, lift = 0): THREE.Vector3 => head.point(azDeg * DEG, elDeg * DEG, lift);
  const Nrm = (azDeg: number, elDeg: number): THREE.Vector3 => head.normal(azDeg * DEG, elDeg * DEG);

  // ── colours ──
  const skin = spec.primary;
  const hair = spec.secondary;
  const top = spec.accent;
  const bottom = spec.bottom ?? '#2f3b5c';
  const darkSkin = luma(skin) < 0.48;
  const noseC = mixHex(skin, '#8a2f2a', adult ? 0.08 : 0.17);
  const lidC = mixHex(skin, '#5a2a22', 0.1);
  const lashC = mixHex(skin, '#160c12', 0.86);
  const lineC = mixHex(skin, '#2a0a16', darkSkin ? 0.86 : 0.8);
  const blushC = mixHex(skin, '#ff4a66', !adult ? (darkSkin ? 0.3 : 0.36) : plain && creature === 'none' ? 0.1 : furry ? 0.12 : 0);
  const browC = !plain || creature === 'luchador'
    ? mixHex(skin, '#0e0c14', 0.6)
    : luma(hair) > 0.72 ? mixHex(hair, '#8d8288', luma(skin) > 0.6 ? 0.45 : 0.1) : hair;
  const shoeC = luma(bottom) < 0.36 ? '#f4ead8' : '#3a2f3d';
  const hatC = bottom;

  // ── skeleton ──
  const root = sb.bone('root', -1, v3(0, 0, 0));
  const torso = sb.bone('torso', root, v3(0, hipY, 0));
  const headB = sb.bone('head', torso, v3(0, neckY, 0));
  const armLen = adult ? 0.34 * (0.9 + 0.1 * k) : 0.25 * (0.88 + 0.12 * k);
  const armY = shY - (adult ? 0.035 : 0.045);
  const sz = adult ? 0.15 * g + 0.03 : 0.118 * g + 0.032;
  const hz = adult ? 0.068 * g : 0.076 * g;
  const armR = sb.bone('armR', torso, v3(0, armY, sz));
  const handR = sb.bone('handR', armR, v3(0, armY - armLen, sz));
  const armL = sb.bone('armL', torso, v3(0, armY, -sz));
  const handL = sb.bone('handL', armL, v3(0, armY - armLen, -sz));
  const footY = 0.045;
  const legR = sb.bone('legR', torso, v3(0, hipY, hz));
  const footR = sb.bone('footR', legR, v3(0, footY, hz));
  const legL = sb.bone('legL', torso, v3(0, hipY, -hz));
  const footL = sb.bone('footL', legL, v3(0, footY, -hz));

  // ── torso ──
  const waistY = hipY + (adult ? 0.035 : 0.05) * k;
  const skinC = new THREE.Color(skin);
  const topC = new THREE.Color(top);
  const bottomC = new THREE.Color(bottom);
  const hemC = new THREE.Color(adult ? mixHex(bottom, '#0c0a12', 0.55) : mixHex(top, luma(top) > 0.55 ? '#3b2a4a' : '#ffffff', 0.22));
  const torsoPaint: ColorFn = (p, out) => {
    if (p.y < waistY) out.copy(bottomC);
    else if (p.y < waistY + 0.022) out.copy(hemC);
    else out.copy(topC);
  };
  const chestX = 0.148 * g * 0.66; // how far forward the chest comes (grown-ups)
  {
    const prof: Array<[number, number]> = adult
      ? [
        [0, y0], [0.07 * g, y0 + 0.012], [0.118 * g, y0 + 0.05], [0.128 * g, waistY - 0.003],
        [0.13 * g, waistY], [0.13 * g, waistY + 0.019], [0.128 * g, waistY + 0.022],
        [(0.11 + 0.024 * spec.build) * g, hipY + 0.11 * k], [0.148 * g, hipY + 0.2 * k],
        [0.156 * g, shY - 0.045], [0.14 * g, shY - 0.008], [0.088, shY + 0.022], [0.052, shY + 0.04], [0, shY + 0.046],
      ]
      : [
        [0, y0], [0.085 * g, y0 + 0.012], [0.142 * g, y0 + 0.045], [0.166 * g, waistY - 0.003],
        [0.169 * g, waistY], [0.169 * g, waistY + 0.021], [0.168 * g, waistY + 0.024],
        [0.16 * g, hipY + 0.17 * k], [0.136 * g, shY - 0.055], [0.112 * g, shY - 0.012], [0.072, shY + 0.02], [0, shY + 0.036],
      ];
    const geo = adult ? lathe(prof, 26, 0.66, 1) : lathe(prof, 20, 0.86, 1);
    // tummy for stockier builds
    const belly = Math.max(0, spec.build - 0.45) * (adult ? 0.11 : 0.09);
    if (belly > 0) {
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      const mid = hipY + 0.1 * k;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        if (x > 0) p.setX(i, x + belly * (x / (0.15 * g)) * gauss((p.getY(i) - mid) / (0.11 * k)));
      }
      geo.computeVertexNormals();
    }
    sb.add(geo, torso, torsoPaint, creature === 'robot' ? M_GLOSSY : M_FABRIC);
  }
  if (adult) {
    // a neck, so the head sits on something
    const nr = 0.04 + 0.014 * spec.build;
    sb.add(xf(capsule(nr, 0.07, 10, 2), { p: [-0.004, shY + 0.045, 0] }), torso, skin, creature === 'robot' ? M_GLOSSY : M_CLAY);
    const chestY = hipY + 0.2 * k;
    const dark = mixHex(top, '#0c0a12', 0.45);
    const shirt = luma(top) > 0.72 ? mixHex(top, '#1b1a26', 0.82) : '#f3eee4';
    if (creature === 'robot') {
      // chest plate with two lamps
      sb.add(blob(0.014, 0.06, 0.075, [chestX + 0.004, chestY + 0.015, 0], undefined, 8, 5), torso, top, M_GLOSSY);
      for (const side of [1, -1] as const) sb.add(blob(0.012, 0.014, 0.014, [chestX + 0.014, chestY + 0.03, side * 0.035], undefined, 6, 4), torso, spec.eyeColor, M_GLOSSY);
    } else if (outfit === 'jacket') {
      // worn open over a shirt, collar up
      sb.add(blob(0.012, 0.115 * k, 0.034, [chestX - 0.004, chestY - 0.01, 0], undefined, 8, 6), torso, shirt, M_FABRIC);
      for (const side of [1, -1] as const) {
        sb.add(blob(0.022, 0.03, 0.04, [0.035, shY + 0.03, side * 0.06], [side * 0.5, 0, 0.35], 7, 5), torso, dark, M_FABRIC);
        sb.add(blob(0.012, 0.1 * k, 0.012, [chestX + 0.002, chestY - 0.012, side * 0.04], undefined, 6, 5), torso, dark, M_FABRIC);
      }
    } else if (outfit === 'suit') {
      // shirt front, lapels and a tie
      sb.add(blob(0.012, 0.075 * k, 0.045, [chestX - 0.006, chestY + 0.03, 0], undefined, 8, 6), torso, shirt, M_FABRIC);
      sb.add(blob(0.014, 0.07 * k, 0.014, [chestX + 0.004, chestY + 0.012, 0], undefined, 6, 5), torso, mixHex(bottom, '#b3202e', 0.7), M_GLOSSY);
      sb.add(blob(0.015, 0.016, 0.02, [chestX - 0.004, chestY + 0.085 * k, 0], undefined, 6, 4), torso, mixHex(bottom, '#b3202e', 0.7), M_GLOSSY);
      for (const side of [1, -1] as const) sb.add(blob(0.012, 0.085 * k, 0.022, [chestX - 0.002, chestY + 0.022, side * 0.052], [side * -0.28, 0, 0], 7, 5), torso, dark, M_FABRIC);
    } else if (outfit === 'hoodie') {
      // hood down behind the neck, drawstrings, a pouch
      const shade = mixHex(top, '#0c0a12', 0.2);
      sb.add(blob(0.075, 0.062, 0.115, [-0.075, shY + 0.012, 0], [0, 0, 0.35], 10, 6), torso, shade, M_FABRIC);
      for (const side of [1, -1] as const) sb.add(tube([v3(chestX - 0.012, shY - 0.012, side * 0.03), v3(chestX + 0.006, chestY + 0.01, side * 0.026)], [0.006, 0.006], { radial: 4, segments: 2 }), torso, '#f3eee4', M_FABRIC);
      sb.add(blob(0.012, 0.035, 0.075, [0.128 * g * 0.66 + 0.002 + Math.max(0, spec.build - 0.45) * 0.09, hipY + 0.085 * k, 0], undefined, 8, 5), torso, shade, M_FABRIC);
    }
  }

  // ── arms + hands ──
  const armRad = adult ? 0.04 + 0.012 * spec.build : 0.045 + 0.007 * spec.build;
  const sleeveTo = !adult || outfit === 'hoodie' || outfit === 'jacket' || outfit === 'suit' || creature === 'robot' ? 1 : outfit === 'tank' ? 0 : 0.42;
  for (const side of [1, -1] as const) {
    const arm = side > 0 ? armR : armL;
    const hand = side > 0 ? handR : handL;
    const z = side * sz;
    const len = armLen - (adult ? 0.04 : 0.045);
    const armMat = creature === 'robot' ? M_GLOSSY : M_FABRIC;
    if (sleeveTo >= 1 || sleeveTo <= 0) {
      sb.add(xf(capsule(armRad, len, 8, 3), { p: [0, armY - len / 2, z] }), arm, sleeveTo >= 1 ? top : skin, sleeveTo >= 1 ? armMat : M_CLAY);
    } else {
      const sl = len * sleeveTo;
      sb.add(xf(capsule(armRad * 0.9, len, 8, 3), { p: [0, armY - len / 2, z] }), arm, skin, M_CLAY);
      sb.add(xf(capsule(armRad * 1.12, sl, 8, 3), { p: [0, armY - sl / 2, z] }), arm, top, armMat);
    }
    if (adult) {
      sb.add(blob(0.04, 0.046, 0.036, [0.004, armY - armLen, z], undefined, 9, 6), hand, skin, M_CLAY);
      sb.add(blob(0.017, 0.02, 0.016, [0.032, armY - armLen + 0.012, z], undefined, 6, 4), hand, skin, M_CLAY);
    } else {
      sb.add(blob(0.05, 0.056, 0.046, [0.004, armY - armLen, z], undefined, 9, 6), hand, skin, M_CLAY);
      sb.add(blob(0.021, 0.024, 0.02, [0.04, armY - armLen + 0.014, z], undefined, 6, 4), hand, skin, M_CLAY);
    }
  }

  // ── legs + shoes ──
  const legRad = (adult ? 0.056 : 0.06) * (0.9 + (adult ? 0.25 : 0.2) * spec.build);
  for (const side of [1, -1] as const) {
    const leg = side > 0 ? legR : legL;
    const foot = side > 0 ? footR : footL;
    const z = side * hz;
    const len = Math.max(0.02, hipY - 0.075);
    sb.add(xf(capsule(legRad, len, 10, 3), { p: [0, hipY - len / 2, z] }), leg, bottom, M_FABRIC);
    if (adult) sb.add(blob(0.085, 0.042, 0.058, [0.03, 0.04, z], undefined, 10, 6), foot, shoeC, M_CLAY);
    else sb.add(blob(0.092, 0.05, 0.068, [0.03, 0.046, z], undefined, 10, 6), foot, shoeC, M_CLAY);
  }

  // ── head ──
  const stubC = new THREE.Color(mixHex(skin, hair, 0.5));
  const secondC = new THREE.Color(hair);
  const maskTrim = new THREE.Color(mixHex(top, '#ffffff', 0.82));
  const eyeAz = creature === 'frog' ? 36 : creature === 'alien' ? 31 : adult ? 25 : 27;
  const eyeEl = creature === 'frog' ? 40 : creature === 'alien' ? -1 : adult ? 3 : -3;
  const skullPaint: ColorFn = (p, out) => {
    out.copy(skinC);
    const d = head.dirOf(p);
    const az = d.az / DEG;
    const el = d.el / DEG;
    if (facial === 'stubble') {
      const f = smoothstep(-4, -24, el) * smoothstep(120, 96, Math.abs(az));
      out.lerp(stubC, f * 0.7);
    } else if (creature === 'fox') {
      // white cheeks and chin
      out.lerp(secondC, smoothstep(-6, -20, el) * smoothstep(118, 86, Math.abs(az)));
    } else if (creature === 'luchador') {
      // the mask: everything but the mouth; a pale flash round each eye
      const mouthHole = Math.abs(az) < 24 && el < -29 && el > -54;
      if (!mouthHole) {
        out.copy(secondC);
        const de = Math.hypot((Math.abs(az) - eyeAz) * 0.8, el - eyeEl - 2);
        if (de < 19) out.copy(maskTrim);
        if (Math.abs(az) < 7 && el > 22) out.copy(maskTrim);
      }
    }
  };
  sb.add(head.geometry(adult ? 28 : 24, adult ? 16 : 14), headB, skullPaint, creature === 'robot' ? M_GLOSSY : M_CLAY);
  const skullTopY = cy + ry;
  // ears, nose
  if (plain) {
    const earC = creature === 'luchador' ? hair : noseC;
    for (const side of [1, -1] as const) {
      sb.add(blob(adult ? 0.026 : 0.03, adult ? 0.05 : 0.046, adult ? 0.02 : 0.022, P(side * 92, adult ? -2 : -6, 0.004), undefined, 7, 5), headB, earC, M_CLAY);
    }
    if (adult) {
      // a nose with a bridge, not a button
      const nc = creature === 'luchador' ? hair : noseC;
      sb.add(blob(0.034, 0.03, 0.033, P(0, -16, 0.02), undefined, 8, 6), headB, nc, M_CLAY);
      sb.add(blob(0.02, 0.055, 0.02, P(0, -3, 0.008), undefined, 6, 5), headB, creature === 'luchador' ? hair : skin, M_CLAY);
    } else {
      sb.add(blob(0.03, 0.027, 0.032, P(0, -13, 0.014), undefined, 8, 6), headB, noseC, M_CLAY);
    }
  }

  // muzzles, snouts and nostrils for everyone who is not a person
  let mouthEl = adult ? -40 : -37;
  let mouthLift = facial === 'beard' ? 0.034 : 0.002;
  let mouthSize = adult ? 0.06 : 0.056;
  const darkNose = '#241a1c';
  if (creature === 'bear') {
    sb.add(blob(0.07, 0.062, 0.09, P(0, -25, 0.03), undefined, 10, 7), headB, hair, M_FABRIC);
    sb.add(blob(0.03, 0.024, 0.038, P(0, -16, 0.1), undefined, 8, 5), headB, darkNose, M_GLOSSY);
    mouthEl = -35; mouthLift = 0.082; mouthSize = 0.05;
  } else if (creature === 'fox') {
    sb.add(blob(0.105, 0.052, 0.064, P(0, -23, 0.05), [0, 0, -0.1], 10, 7), headB, hair, M_FABRIC);
    sb.add(blob(0.026, 0.022, 0.03, P(0, -19, 0.155), undefined, 8, 5), headB, darkNose, M_GLOSSY);
    for (const side of [1, -1] as const) sb.add(blob(0.045, 0.04, 0.07, P(side * 74, -30, 0.012), [0, side * 0.5, 0], 7, 5), headB, hair, M_FABRIC);
    mouthEl = -33; mouthLift = 0.1; mouthSize = 0.045;
  } else if (creature === 'rabbit') {
    sb.add(blob(0.055, 0.05, 0.08, P(0, -25, 0.03), undefined, 9, 6), headB, hair, M_FABRIC);
    sb.add(blob(0.018, 0.016, 0.024, P(0, -17, 0.085), undefined, 7, 5), headB, '#e98aa0', M_GLOSSY);
    sb.add(blob(0.012, 0.024, 0.024, P(0, -40, 0.062), undefined, 6, 4), headB, '#fffaf2', M_GLOSSY);
    mouthEl = -33; mouthLift = 0.07; mouthSize = 0.04;
  } else if (creature === 'frog') {
    for (const side of [1, -1] as const) sb.add(blob(0.008, 0.008, 0.008, P(side * 8, 8, 0.002), undefined, 5, 4), headB, mixHex(skin, '#0a1a10', 0.7), M_CLAY);
    mouthEl = -30; mouthSize = 0.095;
  } else if (creature === 'robot') {
    for (const side of [1, -1] as const) sb.add(blob(0.022, 0.03, 0.03, P(side * 90, 0, 0.012), undefined, 8, 5), headB, top, M_GLOSSY);
    mouthEl = -44; mouthSize = 0.062;
  } else if (creature === 'alien') {
    for (const side of [1, -1] as const) sb.add(blob(0.006, 0.009, 0.006, P(side * 6, -22, 0.002), undefined, 5, 4), headB, mixHex(skin, '#0a1410', 0.75), M_CLAY);
    mouthEl = -52; mouthSize = 0.034;
  }

  // eyes
  const er = creature === 'frog' ? 0.074 : creature === 'alien' ? 0.08 : creature === 'robot' ? 0.054 : furry ? 0.046 : adult ? 0.05 : little ? 0.07 : 0.066;
  const eyes: ReturnType<typeof buildEye>[] = [];
  const eyeFront: THREE.Vector3[] = [];
  for (const side of [1, -1] as const) {
    const n = Nrm(side * eyeAz, eyeEl);
    const sink = creature === 'frog' ? 0.2 : creature === 'alien' ? 0.62 : 0.52;
    const centre = P(side * eyeAz, eyeEl, 0).addScaledVector(n, -er * sink);
    const gaze = n.clone().multiplyScalar(creature === 'frog' ? 0.75 : 0.42).add(v3(0.58, 0, 0));
    if (creature !== 'frog') gaze.y = 0;
    gaze.normalize();
    eyes.push(buildEye(sb, headB, centre, gaze, er, creature === 'alien'
      ? { iris: spec.eyeColor, lid: lidC, lash: lidC, white: '#0c0b14', irisDeg: 64, pupilDeg: 34 }
      : creature === 'robot'
        ? { iris: spec.eyeColor, lid: mixHex(skin, '#0c0c14', 0.3), lash: mixHex(skin, '#0c0c14', 0.3), white: '#10131c', irisDeg: 50, pupilDeg: 12 }
        : { iris: spec.eyeColor, lid: creature === 'luchador' ? mixHex(top, '#ffffff', 0.82) : lidC, lash: lashC }));
    eyeFront.push(centre.clone().addScaledVector(gaze, er));
  }
  // brows
  const browEl = creature === 'frog' ? 62 : adult ? 19 : 21;
  const browThick = adult ? 0.015 + 0.004 * spec.build : facial === 'mustache' || facial === 'beard' ? 0.0145 : 0.0115;
  const brows: number[] = [];
  for (const side of [1, -1] as const) {
    brows.push(buildBrow(sb, headB, P(side * eyeAz, browEl, 0.004), Nrm(side * eyeAz, browEl), adult ? 0.047 : 0.043, browThick, browC, M_FABRIC, side));
  }
  // cheeks (a blush on a kid; barely there on a grown-up)
  const cheeks: number[] = [];
  for (const side of [1, -1] as const) {
    cheeks.push(buildCheek(sb, headB, P(side * 52, adult ? -25 : -27, 0), Nrm(side * 52, adult ? -25 : -27), adult ? 0.036 : 0.044, creature === 'luchador' ? hair : blushC, M_CLAY));
  }
  // mouth (sits further out on a beard or a muzzle)
  const mouths = buildMouths(sb, headB, P(0, mouthEl, mouthLift), Nrm(0, mouthEl), mouthSize, lineC, 1 / (2.6 * rz));

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
  const helmB = (az: number): number => keyed(az, [[0, 27], [46, 25], [64, 4], [82, -20], [120, -33], [180, -38]]) * DEG;
  const brimB = (): number => 27 * DEG;
  const hatB = hat === 'cap' ? capB : hat === 'beanie' ? beanB : hat === 'helmet' ? helmB : hat === 'cowboy' ? brimB : null;
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

  if (hairStyle === 'buzz' || hairStyle === 'mohawk') {
    crownLift = hairStyle === 'mohawk' && !hatted ? 0.09 : 0.012;
    addHair(shell(head, {
      cols: 24,
      boundary: (az) => keyed(az, [[0, 48], [40, 44], [62, 30], [80, 12], [100, 4], [130, -20], [180, -30]]) * DEG,
      thickness: (az, el) => lim(az, el, 0.011),
    }), hairB);
    if (hairStyle === 'mohawk' && !hatted) {
      // a ridge from the forehead over the crown to the nape
      const ridge: Array<[number, number, number]> = [[0, 52, 0.07], [0, 68, 0.095], [0, 84, 0.105], [180, 80, 0.1], [180, 62, 0.09], [180, 44, 0.075], [180, 26, 0.055]];
      for (const [az, el, h] of ridge) {
        const base = P(az, el, 0);
        const dir = base.clone().sub(head.c).normalize();
        addHair(xf(ellipsoid(0.05, h, 0.026, 8, 6), { p: base.clone().addScaledVector(dir, h * 0.45), q: new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir) }), hairB);
      }
    }
  }

  // ── ears and aerials for the drivers who are not people ──
  const up = v3(0, 1, 0);
  if (creature === 'bear') {
    for (const side of [1, -1] as const) {
      const c = P(side * 52, 60, 0.03);
      const ear = blob(0.03, 0.06, 0.06, c, undefined, 9, 6);
      topY = Math.max(topY, topOf(ear));
      sb.add(ear, headB, skin, M_FABRIC);
      sb.add(blob(0.014, 0.034, 0.034, c.clone().add(v3(0.022, -0.004, 0)), undefined, 7, 5), headB, hair, M_FABRIC);
    }
  } else if (creature === 'fox') {
    const tipC = new THREE.Color('#2a1a16');
    for (const side of [1, -1] as const) {
      const base = P(side * 40, 56, -0.004);
      const dir = base.clone().sub(head.c).normalize().add(v3(0, 0.55, 0)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const cone = xf(lathe([[0.066, 0], [0.056, 0.05], [0.032, 0.115], [0.008, 0.165], [0, 0.17]], 8, 0.5, 1), { p: base, q });
      topY = Math.max(topY, topOf(cone));
      const paint: ColorFn = (p, out) => { out.copy(p.clone().sub(base).dot(dir) > 0.105 ? tipC : skinC); };
      sb.add(cone, headB, paint, M_FABRIC);
    }
  } else if (creature === 'rabbit') {
    for (const side of [1, -1] as const) {
      const base = P(side * 24, 76, -0.006);
      const dir = v3(-0.22, 1, side * 0.2).normalize();
      const q = frameQuatY(dir);
      const bone = sb.bone(side > 0 ? 'earR' : 'earL', headB, base, q);
      const len = 0.27;
      const ear = xf(sculpt(capsule(0.045, len, 8, 3), (v) => { v.x *= 0.5; }), { p: base.clone().addScaledVector(dir, len / 2 + 0.01), q: new THREE.Quaternion().setFromUnitVectors(up, dir) });
      topY = Math.max(topY, topOf(ear));
      sb.add(ear, bone, skin, M_FABRIC);
      sb.add(xf(sculpt(capsule(0.024, len * 0.7, 6, 2), (v) => { v.x *= 0.4; }), { p: base.clone().addScaledVector(dir, len / 2 + 0.02).add(v3(0.016, 0, 0)), q: new THREE.Quaternion().setFromUnitVectors(up, dir) }), bone, '#e9a3b0', M_FABRIC);
      chains.push({ role: 'sway', bones: [bone], stiff: 90, damp: 7, gain: 0.22, limit: 0.6, hang: 0 });
    }
  } else if (creature === 'robot' || creature === 'alien') {
    const two = creature === 'alien';
    for (const side of two ? ([1, -1] as const) : ([1] as const)) {
      const base = P(two ? side * 30 : 0, two ? 74 : 90, -0.004);
      const dir = two ? v3(0.1, 1, side * 0.35).normalize() : v3(0, 1, 0);
      const bone = sb.bone(two ? (side > 0 ? 'aerialR' : 'aerialL') : 'aerial', headB, base, frameQuatY(dir));
      const len = two ? 0.11 : 0.13;
      const tip = base.clone().addScaledVector(dir, len);
      sb.add(tube([base, tip], [0.009, 0.007], { radial: 5, segments: 2 }), bone, two ? skin : '#c8ccd8', two ? M_CLAY : M_GLOSSY);
      const ball = blob(0.026, 0.026, 0.026, tip, undefined, 8, 5);
      topY = Math.max(topY, topOf(ball));
      sb.add(ball, bone, two ? spec.eyeColor : top, M_GLOSSY);
      chains.push({ role: 'pom', bones: [bone], stiff: 140, damp: 6, gain: 0.3, limit: 0.7, hang: 0 });
    }
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
    const fit = Math.max(0.8, Math.min(1.12, er / 0.066 + 0.1));
    const hw = (round ? 0.074 : 0.08) * fit;
    const hh = (round ? 0.074 : 0.062) * fit;
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
  } else if (hat === 'helmet') {
    // an open-face racing helmet with a stripe and a short peak
    const shellC = new THREE.Color(hatC);
    const stripeC = new THREE.Color(mixHex(top, '#ffffff', luma(top) > 0.7 ? 0 : 0.12));
    const paint: ColorFn = (p, out) => { out.copy(Math.abs(p.z) < 0.036 ? stripeC : shellC); };
    const g1 = shell(head, { cols: 32, rings: [0.1, 0.26, 0.45, 0.65, 0.85], boundary: helmB, thickness: () => 0.05 });
    topY = Math.max(topY, topOf(g1));
    sb.add(g1, hairB, paint, M_GLOSSY);
    const bp = P(0, 27, 0.05);
    sb.add(xf(ellipsoid(0.07, 0.013, 0.135, 12, 5), { p: [bp.x + 0.03, bp.y - 0.004, 0], r: [0, 0, -0.16] }), hairB, mixHex(hatC, '#0c0a12', 0.5), M_GLOSSY);
  } else if (hat === 'cowboy') {
    const baseY = P(0, 27, 0.03).y + 0.012;
    const felt = hatC;
    const band = mixHex(hatC, '#0c0a12', 0.6);
    const brim = sculpt(ellipsoid(0.31, 0.014, 0.3, 22, 5), (v) => { v.y += 0.085 * (v.z / 0.3) * (v.z / 0.3) - 0.03 * (v.x / 0.31) * (v.x / 0.31); });
    sb.add(xf(brim, { p: [0.012, baseY, 0] }), hairB, felt, M_FABRIC);
    const bandC = new THREE.Color(band);
    const feltC = new THREE.Color(felt);
    const paint: ColorFn = (p, out) => { out.copy(p.y < baseY + 0.045 ? bandC : feltC); };
    const crownG = xf(sculpt(lathe([[0.168, 0], [0.165, 0.04], [0.156, 0.11], [0.14, 0.16], [0.09, 0.182], [0, 0.17]], 18), (v) => { if (v.y > 0.1) v.y -= 0.035 * Math.exp(-(v.z * v.z) / 0.004) * ((v.y - 0.1) / 0.08); }), { p: [0.004, baseY, 0], s: [1.12, 1, 0.98] });
    topY = Math.max(topY, topOf(crownG));
    sb.add(crownG, hairB, paint, M_FABRIC);
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
  // everything above the neck is worn at `hs`: report where it ends up
  const worn = (y: number): number => neckY + (y - neckY) * hs;
  return {
    species: 'human',
    headScale: hs,
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
    topY: worn(topY),
    headY: worn(cy),
    skullTopY: worn(skullTopY),
    stand: -1,
    cradle: -1,
    socket: v3(0, 0, 0),
    ring: v3(0, 0, 0),
    standLen: 0,
    bindQ: sb.bindQuats(),
    dims: {
      hipY, shoulderY: armY, shoulderZ: sz, hipZ: hz, frontX: 0, hindX: 0,
      belly: y0, seatY: y0, rumpX: 0, rumpY: y0,
      headCX: head.c.x * hs, headCY: worn(cy), headR: ry * hs, chinY: worn(cy - ry),
    },
    triangles: sb.triangles,
  };
}

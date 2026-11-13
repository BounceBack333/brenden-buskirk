/**
 * Wind: the handheld mini fan that makes it, and the streamers + motes that show it.
 */
import * as THREE from 'three';
import type { TableFan, WindStreamers } from '../../kit/contracts';
import { PALETTE, Spring, mat } from '../../kit/materials';
import { softDiscTexture } from './textures';
import { Batch, TAU, canvasTexture, clamp, clamp01, damp, lathe, lerp, own, seeded, smoothProfile, vcMat } from './util';

/** Gameplay-facing numbers (mirrored by the dev page's debug overlay). */
export const FAN = {
  hubY: 3.1,
  height: 4.0,
  headRadius: 0.9,
} as const;

function streakTexture(): THREE.Texture {
  return canvasTexture(128, 128, (ctx, w) => {
    const c = w / 2;
    ctx.translate(c, c);
    const g = ctx.createRadialGradient(0, 0, c * 0.2, 0, 0, c);
    g.addColorStop(0, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, c, 0, TAU);
    ctx.fill();
    // a few brighter arcs so the blur visibly turns
    for (let i = 0; i < 4; i++) {
      ctx.rotate(TAU / 4);
      const sg = ctx.createLinearGradient(0, 0, c, 0);
      sg.addColorStop(0.2, 'rgba(255,255,255,0)');
      sg.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, c * 0.96, -0.3, 0.3);
      ctx.closePath();
      ctx.fill();
    }
  });
}

export function buildTableFan(): TableFan {
  const root = new THREE.Group();
  root.name = 'table-fan';
  const body = PALETTE.sky;
  const cream = PALETTE.frostingWhite;

  // ── stand + grip (rotationally symmetric, so it does not need the head's turn) ──
  const clay = new Batch();
  const glossy = new Batch();
  clay.add(lathe(smoothProfile([[0, 0], [0.62, 0], [0.7, 0.06], [0.64, 0.15], [0.45, 0.21], [0.36, 0.3]], 10), 24), cream);
  glossy.add(lathe(smoothProfile([
    [0.33, 0.24], [0.36, 0.5], [0.385, 1.1], [0.37, 1.7], [0.3, 2.12], [0.2, 2.3], [0.18, 2.52],
  ], 12), 24), body);
  // band + button + charge light
  clay.add(new THREE.CylinderGeometry(0.395, 0.395, 0.09, 24, 1, true), cream, { p: [0, 0.62, 0] });
  glossy.add(new THREE.SphereGeometry(0.11, 12, 8), PALETTE.coral, { p: [0, 1.45, 0.355], s: [1, 1, 0.45] });
  glossy.add(new THREE.SphereGeometry(0.04, 8, 6), PALETTE.mint, { p: [0, 1.15, 0.375], s: [1, 1, 0.5] });
  // wrist cord lying on the cloth
  const cord = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.3, 0.42, 0.2), new THREE.Vector3(-0.62, 0.2, 0.42), new THREE.Vector3(-0.95, 0.04, 0.75),
    new THREE.Vector3(-1.5, 0.035, 0.95), new THREE.Vector3(-1.85, 0.035, 0.55), new THREE.Vector3(-1.55, 0.035, 0.2),
    new THREE.Vector3(-1.0, 0.04, 0.38), new THREE.Vector3(-0.6, 0.18, 0.3), new THREE.Vector3(-0.31, 0.36, 0.12),
  ]);
  clay.add(new THREE.TubeGeometry(cord, 36, 0.035, 5, false), PALETTE.coral);
  root.add(clay.mesh(vcMat('clay')), glossy.mesh(vcMat('glossy')));

  // ── head: motor, cage, blades. Turned a little toward the camera so the spin is visible ──
  const head = new THREE.Group();
  head.position.set(0, FAN.hubY, 0);
  head.rotation.y = -0.5;
  root.add(head);
  const hClay = new Batch();
  const hGloss = new Batch();
  const R = FAN.headRadius - 0.05;
  // motor housing (axis along x)
  hGloss.add(lathe(smoothProfile([[0, -0.62], [0.3, -0.6], [0.47, -0.42], [0.5, -0.2], [0.44, -0.06], [0.2, 0.0]], 12), 24), body, { r: [0, 0, -Math.PI / 2] });
  // neck elbow into the grip
  hGloss.add(new THREE.SphereGeometry(0.24, 14, 10), body, { p: [-0.2, -0.5, 0] });
  // cage rims
  for (const x of [-0.14, 0.24]) {
    hClay.add(new THREE.TorusGeometry(R, 0.05, 5, 30), cream, { r: [0, Math.PI / 2, 0], p: [x, 0, 0] });
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    hClay.add(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 5), cream, { r: [0, 0, Math.PI / 2], p: [0.05, Math.cos(a) * R, Math.sin(a) * R] });
  }
  // front grille: spokes + one inner ring + badge
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const len = R - 0.16;
    const mid = 0.16 + len / 2;
    hClay.add(new THREE.CylinderGeometry(0.018, 0.018, len, 5), cream, { r: [a, 0, 0], p: [0.25, Math.cos(a) * mid, Math.sin(a) * mid] });
  }
  hClay.add(new THREE.TorusGeometry(R * 0.55, 0.02, 4, 22), cream, { r: [0, Math.PI / 2, 0], p: [0.25, 0, 0] });
  hGloss.add(new THREE.SphereGeometry(0.19, 14, 8), PALETTE.coral, { p: [0.25, 0, 0], s: [0.42, 1, 1] });
  // rear grille: a few spokes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const len = R - 0.42;
    const mid = 0.42 + len / 2;
    hClay.add(new THREE.CylinderGeometry(0.018, 0.018, len, 5), cream, { r: [a, 0, 0], p: [-0.14, Math.cos(a) * mid, Math.sin(a) * mid] });
  }
  head.add(hClay.mesh(vcMat('clay')), hGloss.mesh(vcMat('glossy')));

  // blades
  const spinner = new THREE.Group();
  spinner.position.x = 0.06;
  head.add(spinner);
  const bladeMat = own(mat.glossy(PALETTE.mint, { roughness: 0.3 }));
  bladeMat.transparent = true;
  const bladeBatch = new Batch();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const blade = new THREE.SphereGeometry(1, 10, 6);
    blade.scale(0.03, 0.31, 0.22);
    blade.rotateY(0.42); // pitch
    blade.translate(0, 0.44, 0.03);
    blade.rotateX(a);
    bladeBatch.add(blade, '#ffffff');
  }
  bladeBatch.add(new THREE.CylinderGeometry(0.15, 0.15, 0.14, 12), '#ffffff', { r: [0, 0, Math.PI / 2] });
  const blades = new THREE.Mesh(bladeBatch.geometry(), bladeMat);
  blades.castShadow = true;
  spinner.add(blades);
  const blurMat = new THREE.MeshBasicMaterial({ map: streakTexture(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const blur = new THREE.Mesh(new THREE.CircleGeometry(R * 0.93, 28), blurMat);
  blur.rotation.y = Math.PI / 2;
  blur.position.x = 0.06;
  head.add(blur);

  let strength = 0;
  let omega = 0;
  let time = 0;
  return {
    root,
    setStrength(strength01: number): void {
      strength = clamp01(strength01);
    },
    update(dt: number): void {
      time += dt;
      // motor inertia: spins up fast, coasts down slowly
      const target = strength * 38;
      omega += (target - omega) * damp(target > omega ? 3.2 : 1.1, dt);
      spinner.rotation.x += omega * dt;
      const k = clamp01(omega / 14);
      bladeMat.opacity = 1 - 0.72 * k;
      blurMat.opacity = 0.34 * k;
      blur.rotation.x -= omega * dt * 0.07;
      blur.visible = k > 0.01;
      // a working toy motor hums: the head trembles a hair
      head.rotation.z = Math.sin(time * 33) * 0.006 * k;
      head.position.y = FAN.hubY + Math.sin(time * 41) * 0.004 * k;
    },
  };
}

// ───────────────────────────── wind streamers ─────────────────────────────

const RIBBON_SEGS = 9;
const RIBBON_COLORS = [PALETTE.mint, PALETTE.sky, PALETTE.butter, PALETTE.frosting, PALETTE.paper];
const MOTE_COLORS = ['#ffffff', PALETTE.butter, PALETTE.mint, '#ffffff', PALETTE.frosting];

interface RibbonDef { x: number; y: number; z: number; len: number; width: number; phase: number; gust: number }
interface MoteDef { x: number; y: number; z: number; size: number; speed: number; phase: number; color: THREE.Color }

export function buildWindStreamers(width: number, height: number): WindStreamers {
  const root = new THREE.Group();
  root.name = 'wind-streamers';
  const rnd = seeded(Math.round(width * 31 + height * 17) + 3);
  const hw = width / 2;
  const hh = height / 2;

  // ── ribbons on a jittered grid, tied to hair-thin threads from above ──
  let cols = Math.max(2, Math.round(width / 7.5));
  let rows = Math.max(1, Math.round(height / 6.5));
  while (cols * rows > 30) {
    if (cols > rows) cols--;
    else rows--;
  }
  const ribbons: RibbonDef[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const stagger = j % 2 ? 0.5 : 0;
      const x = -hw + ((i + 0.5 + stagger * 0.6 + (rnd() - 0.5) * 0.5) / cols) * width;
      const y = -hh + ((j + 0.78 + (rnd() - 0.5) * 0.3) / rows) * height;
      ribbons.push({
        x: clamp(x, -hw + 0.6, hw - 0.6), y: Math.min(hh - 0.1, y), z: -1.1 - rnd() * 1.5,
        len: 2.1 + rnd() * 0.9, width: 0.17 + rnd() * 0.05, phase: rnd() * TAU, gust: 0.7 + rnd() * 0.6,
      });
    }
  }
  const vertsPer = (RIBBON_SEGS + 1) * 2;
  const rPos = new Float32Array(ribbons.length * vertsPer * 3);
  const rCol = new Float32Array(ribbons.length * vertsPer * 3);
  const rIdx: number[] = [];
  const col = new THREE.Color();
  const tailCol = new THREE.Color();
  for (let r = 0; r < ribbons.length; r++) {
    col.set(RIBBON_COLORS[r % RIBBON_COLORS.length]!);
    tailCol.copy(col).lerp(new THREE.Color('#ffffff'), 0.35);
    for (let k = 0; k <= RIBBON_SEGS; k++) {
      for (let s = 0; s < 2; s++) {
        const o = (r * vertsPer + k * 2 + s) * 3;
        const c = k / RIBBON_SEGS;
        rCol[o] = lerp(col.r, tailCol.r, c);
        rCol[o + 1] = lerp(col.g, tailCol.g, c);
        rCol[o + 2] = lerp(col.b, tailCol.b, c);
      }
      if (k < RIBBON_SEGS) {
        const a = r * vertsPer + k * 2;
        rIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const rGeo = new THREE.BufferGeometry();
  const rAttr = new THREE.BufferAttribute(rPos, 3);
  rGeo.setAttribute('position', rAttr);
  rGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3));
  rGeo.setIndex(rIdx);
  const ribbonMesh = new THREE.Mesh(rGeo, vcMat('paper', THREE.DoubleSide));
  ribbonMesh.frustumCulled = false;
  root.add(ribbonMesh);

  // threads + tie dots
  const tPos = new Float32Array(ribbons.length * 6);
  for (let r = 0; r < ribbons.length; r++) {
    const d = ribbons[r]!;
    tPos.set([d.x, d.y, d.z, d.x, d.y + 46, d.z], r * 6);
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  const threads = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ color: '#fff6e6', transparent: true, opacity: 0.4, depthWrite: false }));
  threads.frustumCulled = false;
  root.add(threads);

  // ── motes ──
  const moteCount = clamp(Math.round((width * height) / 13), 10, 72);
  const motes: MoteDef[] = [];
  for (let i = 0; i < moteCount; i++) {
    motes.push({
      x: (rnd() - 0.5) * width, y: (rnd() - 0.5) * height, z: -0.7 - rnd() * 2.2,
      size: 0.06 + rnd() * 0.07, speed: 0.55 + rnd() * 0.8, phase: rnd() * TAU,
      color: new THREE.Color(MOTE_COLORS[i % MOTE_COLORS.length]!),
    });
  }
  const mPos = new Float32Array(moteCount * 12);
  const mCol = new Float32Array(moteCount * 16);
  const mUv = new Float32Array(moteCount * 8);
  const mIdx: number[] = [];
  for (let i = 0; i < moteCount; i++) {
    mUv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    const a = i * 4;
    mIdx.push(a, a + 1, a + 2, a, a + 2, a + 3);
  }
  const mGeo = new THREE.BufferGeometry();
  const mAttr = new THREE.BufferAttribute(mPos, 3);
  const mColAttr = new THREE.BufferAttribute(mCol, 4);
  mGeo.setAttribute('position', mAttr);
  mGeo.setAttribute('color', mColAttr);
  mGeo.setAttribute('uv', new THREE.BufferAttribute(mUv, 2));
  mGeo.setIndex(mIdx);
  const moteMat = new THREE.MeshBasicMaterial({
    map: softDiscTexture(0.25), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const moteMesh = new THREE.Mesh(mGeo, moteMat);
  moteMesh.frustumCulled = false;
  moteMesh.renderOrder = 1;
  root.add(moteMesh);

  // ── state: the shown wind chases the real one with a little whip ──
  const wx = new Spring(0, 34, 7.5);
  const wy = new Spring(0, 34, 7.5);
  let time = 0;
  const DROOP = 5.2; // how hard the ribbon's own weight pulls it down, in wind units

  function update(dt: number): void {
    time += dt;
    const vx = wx.update(dt);
    const vy = wy.update(dt);
    const mag = Math.hypot(vx, vy);
    const s01 = clamp01(mag / 14);

    // ribbons
    for (let r = 0; r < ribbons.length; r++) {
      const d = ribbons[r]!;
      const gust = 1 + 0.28 * Math.sin(time * 0.9 * d.gust + d.phase) * s01;
      const fx = vx * gust;
      const fy = vy * gust - DROOP;
      const base = Math.atan2(fy, fx);
      const pull = clamp01(Math.hypot(fx, fy - -DROOP) / 14);
      const amp = 0.05 + 0.5 * pull;
      const speed = 1.3 + 12 * pull;
      const seg = d.len / RIBBON_SEGS;
      let px = d.x;
      let py = d.y;
      for (let k = 0; k <= RIBBON_SEGS; k++) {
        const c = k / RIBBON_SEGS;
        const wave = amp * Math.pow(c, 0.7) * Math.sin(k * 1.05 - time * speed + d.phase);
        const ang = base + wave;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        if (k > 0) {
          px += dx * seg;
          py += dy * seg;
        }
        // twist: the apparent width breathes as the ribbon rolls
        const roll = 0.45 + 0.55 * Math.abs(Math.cos(k * 0.7 + time * speed * 0.35 + d.phase));
        const w = d.width * roll * (1 - 0.35 * c * c);
        const o = (r * vertsPer + k * 2) * 3;
        rPos[o] = px - dy * w;
        rPos[o + 1] = py + dx * w;
        rPos[o + 2] = d.z + 0.05 * Math.sin(k * 0.9 + d.phase);
        rPos[o + 3] = px + dy * w;
        rPos[o + 4] = py - dx * w;
        rPos[o + 5] = d.z - 0.05 * Math.sin(k * 0.9 + d.phase);
      }
    }
    rAttr.needsUpdate = true;
    rGeo.computeVertexNormals();

    // motes: drift with the wind, stretch into streaks as it strengthens
    for (let i = 0; i < moteCount; i++) {
      const m = motes[i]!;
      const sway = Math.sin(time * 0.8 * m.speed + m.phase);
      const mvx = vx * 0.5 * m.speed + sway * 0.18;
      const mvy = vy * 0.5 * m.speed - 0.22 * m.speed + Math.cos(time * 0.6 + m.phase) * 0.1;
      m.x += mvx * dt;
      m.y += mvy * dt;
      if (m.x > hw) m.x -= width;
      else if (m.x < -hw) m.x += width;
      if (m.y > hh) m.y -= height;
      else if (m.y < -hh) m.y += height;
      const sp = Math.hypot(mvx, mvy);
      const ux = sp > 0.001 ? mvx / sp : 1;
      const uy = sp > 0.001 ? mvy / sp : 0;
      const long = m.size + sp * 0.085;
      const wide = m.size * (1 - 0.35 * s01);
      const o = i * 12;
      const ax = ux * long;
      const ay = uy * long;
      const bx = -uy * wide;
      const by = ux * wide;
      mPos[o] = m.x - ax - bx;
      mPos[o + 1] = m.y - ay - by;
      mPos[o + 2] = m.z;
      mPos[o + 3] = m.x + ax - bx;
      mPos[o + 4] = m.y + ay - by;
      mPos[o + 5] = m.z;
      mPos[o + 6] = m.x + ax + bx;
      mPos[o + 7] = m.y + ay + by;
      mPos[o + 8] = m.z;
      mPos[o + 9] = m.x - ax + bx;
      mPos[o + 10] = m.y - ay + by;
      mPos[o + 11] = m.z;
      // fade at the edges of the zone so motes never pop
      const ex = Math.min(1, (hw - Math.abs(m.x)) / 1.5);
      const ey = Math.min(1, (hh - Math.abs(m.y)) / 1.5);
      const alpha = Math.max(0, Math.min(ex, ey)) * (0.34 + 0.4 * s01) * (0.7 + 0.3 * sway);
      for (let v = 0; v < 4; v++) {
        const c = i * 16 + v * 4;
        mCol[c] = m.color.r;
        mCol[c + 1] = m.color.g;
        mCol[c + 2] = m.color.b;
        mCol[c + 3] = alpha;
      }
    }
    mAttr.needsUpdate = true;
    mColAttr.needsUpdate = true;
  }

  const api: WindStreamers = {
    root,
    setWind(x: number, y: number): void {
      wx.target = x;
      wy.target = y;
    },
    update,
  };
  update(0);
  return api;
}

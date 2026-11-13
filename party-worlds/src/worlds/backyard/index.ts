/**
 * Backyard After Dark — the world kit for Backyard Dash, and the tin-toy karts.
 *
 * A patio at night seen from two centimetres up: paving slabs for a road, a garden hose for a
 * banked wall, a flowerbed crossed by a scaffold plank, string lights and a work lamp for light.
 * Presentation only; the simulation owns every position. No external assets.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BackyardDressing, Track } from '../../attractions/dash/track';
import { Spring, mat } from '../../kit/materials';
import { canvasTex, glow, lightPool, rng, speckle } from '../shared';

export interface BackyardWorld {
  readonly root: THREE.Group;
  /** call when the plank's prop is knocked out: the near end drops and the prop flies off */
  openPlank(instant?: boolean): void;
  /** put the plank back up (new race) */
  resetPlank(): void;
  update(dt: number, time: number): void;
}

export function buildBackyardWorld(track: Track): BackyardWorld {
  const root = new THREE.Group();
  root.name = 'backyard';
  const r = rng(77);
  const dressing = track.dressing as BackyardDressing;

  // ── lawn ──
  const grassTex = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#1f5133';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 2600, ['#2c6a3f', '#18402a', '#3b8048', '#245a36'], r, 3);
    ctx.strokeStyle = 'rgba(96,170,96,0.35)';
    for (let i = 0; i < 260; i++) {
      const x = r() * 256;
      const y = r() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 6);
      ctx.stroke();
    }
  });
  grassTex.repeat.set(46, 34);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(320, 240), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(0, 0, 4);
  root.add(lawn);

  // ── the road: paving slabs laid along the centre line ──
  const S = track.samples;
  const N = S.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const edgeL: number[] = [];
  const edgeR: number[] = [];
  for (let i = 0; i <= N; i++) {
    const p = S[i % N]!;
    const nx = -p.tz;
    const nz = p.tx;
    pos.push(p.x - nx * p.hw, 0.02, p.z - nz * p.hw, p.x + nx * p.hw, 0.02, p.z + nz * p.hw);
    uv.push(0, (i * track.ds) / 4.2, p.hw / 2.1, (i * track.ds) / 4.2);
    for (const [arr, side] of [[edgeL, -1], [edgeR, 1]] as const) {
      const a = p.hw - 0.3;
      const b = p.hw - 0.06;
      arr.push(p.x + nx * a * side, 0.04, p.z + nz * a * side, p.x + nx * b * side, 0.04, p.z + nz * b * side);
    }
    if (i < N) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const slabTex = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#8f8a86';
    ctx.fillRect(0, 0, 256, 256);
    const tones = ['#9a9590', '#857f7c', '#a19b93', '#8b8682'];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      ctx.fillStyle = tones[(x + y * 2) % 4]!;
      ctx.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
    }
    speckle(ctx, 256, 256, 1800, ['#6f6a68', '#b4aea6', '#7c7774'], r, 2);
    ctx.strokeStyle = '#4c4a4e';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 0, 128, 128);
    ctx.strokeRect(0, 128, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
  });
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx);
  roadGeo.computeVertexNormals();
  root.add(new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.92 })));
  // edge lines so the road reads at speed, in the dark, on a small screen: glow tape, pink on
  // your left and blue on your right, all the way round
  // (drawn from both sides: the left strip is wound the other way and was culled until this was set)
  for (const [arr, color] of [[edgeL, '#ff5aa5'], [edgeR, '#5fe6ff']] as const) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setIndex(idx);
    root.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide })));
  }
  // finish line
  const s0 = S[0]!;
  const checker = canvasTex(64, 16, (ctx) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#f6f2e8' : '#22242c';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  }, false);
  const fin = new THREE.Mesh(new THREE.PlaneGeometry(1.4, s0.hw * 2), new THREE.MeshBasicMaterial({ map: checker, toneMapped: false }));
  fin.rotation.x = -Math.PI / 2;
  fin.position.set(s0.x, 0.045, s0.z);
  (fin.material as THREE.MeshBasicMaterial).map!.rotation = Math.PI / 2;
  (fin.material as THREE.MeshBasicMaterial).map!.center.set(0.5, 0.5);
  root.add(fin);

  // ── flowerbed ──
  const bed = track.bed;
  const soilTex = canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = '#3d2a20';
    ctx.fillRect(0, 0, 128, 128);
    speckle(ctx, 128, 128, 900, ['#2b1c15', '#553a2a', '#6b4a34', '#241712'], r, 3);
  });
  soilTex.repeat.set(7, 4);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.scale.set(bed.rx, bed.rz, 1);
  soil.position.set(bed.x, 0.012, bed.z);
  root.add(soil);

  const statics: Record<string, THREE.BufferGeometry[]> = { leaf: [], blade: [], stem: [], brick: [], metal: [], terracotta: [], hose: [], white: [], wood: [], petalA: [], petalB: [] };
  const put = (key: string, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rz = 0): void => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    statics[key]!.push(g.index ? g.toNonIndexed() : g);
  };
  // flowers in the bed: towering stems from down here
  const pl = track.plank;
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.86;
    const x = bed.x + Math.cos(a) * d * bed.rx;
    const z = bed.z + Math.sin(a) * d * bed.rz;
    if (Math.abs(z - pl.az) < 2.4) continue; // keep the plank clear
    const h = 3 + r() * 5;
    put('stem', new THREE.CylinderGeometry(0.09, 0.13, h, 5), x, h / 2, z, 0, (r() - 0.5) * 0.2);
    put(i % 2 ? 'petalA' : 'petalB', new THREE.SphereGeometry(0.7 + r() * 0.5, 8, 6), x, h + 0.3, z);
    put('leaf', new THREE.SphereGeometry(0.6, 6, 4).scale(1.6, 0.25, 0.8), x + 0.5, h * 0.4, z, r() * 6);
  }
  // grass tufts along the road edges
  for (let i = 0; i < N; i += 2) {
    const p = S[i]!;
    for (const side of [-1, 1]) {
      if (r() < 0.45) continue;
      const off = p.hw + 0.7 + r() * 2.4;
      const x = p.x - p.tz * off * side;
      const z = p.z + p.tx * off * side;
      const bx = (x - bed.x) / bed.rx;
      const bz = (z - bed.z) / bed.rz;
      if (bx * bx + bz * bz < 1.05) continue;
      const h = 0.8 + r() * 1.3;
      for (let b = 0; b < 4; b++) {
        const bh = h * (0.55 + r() * 0.5);
        put(b % 2 ? 'leaf' : 'blade', new THREE.ConeGeometry(0.085, bh, 3), x + (r() - 0.5) * 0.5, bh * 0.48, z + (r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.9);
      }
    }
  }
  // garden hose: the outside wall of the hairpin, running off toward the tap
  const hz = dressing.hose;
  const hosePts: THREE.Vector3[] = [];
  // (the visible hose covers exactly the arc that is solid, then leaves the yard away from the road)
  for (let i = 0; i <= 24; i++) {
    const a = hz.a0 + ((hz.a1 - hz.a0) * i) / 24;
    hosePts.push(new THREE.Vector3(hz.cx + Math.cos(a) * hz.r, 0.5, hz.cz + Math.sin(a) * hz.r));
  }
  hosePts.push(new THREE.Vector3(47.5, 0.5, 40), new THREE.Vector3(38, 0.5, 46.5), new THREE.Vector3(20, 0.5, 51), new THREE.Vector3(2, 0.5, 56));
  put('metal', new THREE.CylinderGeometry(0.7, 0.45, 1.6, 10).rotateZ(Math.PI / 2), hosePts[0]!.x - 0.6, 0.55, hosePts[0]!.z, 0.2);
  statics.hose!.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 90, 0.55, 10).toNonIndexed());
  // bricks at the chicane
  for (const b of dressing.bricks) {
    const len = Math.hypot(b.x2 - b.x1, b.z2 - b.z1) + b.r * 2;
    put('brick', new RoundedBoxGeometry(len, 1.25, b.r * 2, 2, 0.12), (b.x1 + b.x2) / 2, 0.62, (b.z1 + b.z2) / 2, -Math.atan2(b.z2 - b.z1, b.x2 - b.x1));
  }
  // the big terracotta pot inside the sweeper
  const pot = dressing.pot;
  const potG = new THREE.LatheGeometry([[5.2, 0], [5.6, 0.6], [6.9, 10.5], [7.3, 10.6], [7.3, 11.8], [6.6, 11.8], [6.3, 11.0]].map(([x, y]) => new THREE.Vector2(x!, y!)), 28);
  put('terracotta', potG, pot.x, 0, pot.z);
  for (let i = 0; i < 7; i++) put('leaf', new THREE.SphereGeometry(2.4, 7, 5).scale(1.5, 0.5, 1), pot.x + Math.cos(i) * 5, 13 + (i % 3), pot.z + Math.sin(i) * 5, i);
  // a tennis ball the dog lost, as big as a boulder down here
  const tb = dressing.ball;
  const ballTex = canvasTex(256, 128, (ctx) => {
    ctx.fillStyle = '#c9e04a';
    ctx.fillRect(0, 0, 256, 128);
    speckle(ctx, 256, 128, 1400, ['#b4cc3a', '#d9ee66', '#a9c234'], r, 2);
    ctx.strokeStyle = '#f4f6e6';
    ctx.lineWidth = 7;
    for (const ph of [0, Math.PI]) {
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 4) {
        const y = 64 + Math.sin((x / 256) * Math.PI * 2 + ph) * 34;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, false);
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(tb.r, 28, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.95 }));
  ballMesh.position.set(tb.x, tb.r * 0.96, tb.z);
  ballMesh.rotation.set(0.5, 0.9, 0.3);
  root.add(ballMesh);
  // the aluminium ladder lying along the middle of the lawn (solid: see track.ts)
  const ld = dressing.ladder;
  const ladLen = ld.x1 - ld.x0;
  for (const z of [ld.z0, ld.z1]) put('metal', new RoundedBoxGeometry(ladLen + 1.2, 1.0, ld.rail * 2, 2, 0.14), (ld.x0 + ld.x1) / 2, 0.52, z);
  const rungs = Math.round(ladLen / 6.8);
  for (let i = 0; i <= rungs; i++) {
    const x = ld.x0 + 1.5 + ((ladLen - 3) * i) / rungs;
    put('metal', new THREE.CylinderGeometry(0.36, 0.36, ld.z1 - ld.z0, 8).rotateX(Math.PI / 2), x, 0.56, (ld.z0 + ld.z1) / 2);
  }
  // garden chair legs straddling the straight
  for (const l of dressing.chairLegs) {
    put('white', new THREE.CylinderGeometry(l.r, l.r, 30, 12), l.x, 15, l.z);
    put('white', new THREE.CylinderGeometry(l.r + 0.25, l.r + 0.3, 0.5, 12), l.x, 0.25, l.z);
  }
  put('white', new THREE.BoxGeometry(34, 0.7, 0.7), -7.5, 16, 25.2);
  put('white', new THREE.BoxGeometry(34, 0.7, 0.7), -7.5, 16, 34.8);
  // work lamp on its tripod, flooding the hairpin
  const wl = dressing.workLight;
  put('metal', new THREE.CylinderGeometry(0.2, 0.2, 14, 6), wl.x, 7, wl.z);
  for (let i = 0; i < 3; i++) put('metal', new THREE.CylinderGeometry(0.14, 0.14, 7, 5), wl.x + Math.cos(i * 2.1) * 2, 2.6, wl.z + Math.sin(i * 2.1) * 2, 0, 0.5);
  put('metal', new THREE.BoxGeometry(1.2, 3, 4.6), wl.x - 0.4, 14.6, wl.z);
  // the plank's far-end stone and the fence
  put('brick', new THREE.SphereGeometry(1.5, 9, 6).scale(1.2, 0.5, 1.3), pl.bx - 0.4, 0.2, pl.bz);
  for (let i = 0; i < 26; i++) put('wood', new THREE.BoxGeometry(9.6, 26 + (i % 3), 0.6), -120 + i * 10, 13, -58);
  for (let i = 0; i < 18; i++) put('wood', new THREE.BoxGeometry(0.6, 26 + (i % 2) * 2, 9.6), -92, 13, -50 + i * 10);
  for (let i = 0; i < 18; i++) put('wood', new THREE.BoxGeometry(0.6, 26 + (i % 2) * 2, 9.6), 98, 13, -50 + i * 10);

  const staticMat: Record<string, THREE.Material> = {
    leaf: mat.fabric('#2f7d45'), blade: mat.fabric('#49a05a'), stem: mat.fabric('#3c8a4c'), brick: mat.clay('#a4553f'), metal: mat.metal('#aab2c2'),
    terracotta: mat.clay('#c26a45'), hose: mat.glossy('#2f9d68', { roughness: 0.45 }), white: mat.glossy('#e7e9f2', { roughness: 0.5 }),
    wood: mat.clay('#3a2f3d'), petalA: mat.clay('#ff7a9a'), petalB: mat.clay('#ffd15c'),
  };
  for (const key of Object.keys(statics)) {
    const list = statics[key]!;
    if (!list.length) continue;
    const merged = mergeGeometries(list.map((g) => { g.deleteAttribute('uv'); return g; }), false);
    if (merged) root.add(new THREE.Mesh(merged, staticMat[key]!));
    for (const g of list) g.dispose();
  }

  // ── the plank (a scaffold board across the bed) ──
  const woodTex = canvasTex(256, 64, (ctx) => {
    ctx.fillStyle = '#c99a62';
    ctx.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(110,70,35,${0.15 + r() * 0.3})`;
      ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      const y = r() * 64;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + (r() - 0.5) * 10, 170, y + (r() - 0.5) * 10, 256, y + (r() - 0.5) * 6);
      ctx.stroke();
    }
  });
  woodTex.repeat.set(3, 1);
  const plankLen = pl.ax - pl.bx;
  const plankPivot = new THREE.Group(); // hinged at the far end
  plankPivot.position.set(pl.bx, 0.14, pl.az);
  const board = new THREE.Mesh(new RoundedBoxGeometry(plankLen, 0.2, pl.hw * 2, 2, 0.05), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.8 }));
  board.position.set(plankLen / 2, 0, 0);
  plankPivot.add(board);
  root.add(plankPivot);
  const ramp = new THREE.Mesh(new RoundedBoxGeometry(4.4, 0.2, pl.hw * 2, 2, 0.05), board.material);
  ramp.position.set(pl.bx + 1.6, 0.42, pl.bz);
  ramp.rotation.z = 0.2;
  root.add(ramp);
  // the prop: a clothes peg wedged under the near end
  const prop = new THREE.Group();
  const peg = new THREE.Mesh(new RoundedBoxGeometry(0.5, 2.2, 0.7, 2, 0.1), mat.clay('#f0c88a'));
  peg.position.y = 1.1;
  const pegBand = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 14), mat.metal('#c9d0dc'));
  pegBand.rotation.x = Math.PI / 2;
  pegBand.position.y = 1.3;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), new THREE.MeshBasicMaterial({ color: '#ffd15c', toneMapped: false }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 3.6;
  prop.add(peg, pegBand, arrow);
  prop.position.set(pl.prop.x, 0, pl.prop.z);
  root.add(prop);
  const propGlow = lightPool(pl.prop.x, pl.prop.z, 2.4, '#ffd15c', 0.5);
  root.add(propGlow);

  // ── light: string lights, the work lamp, pools on the ground ──
  const bulbPos: number[] = [];
  const bulbCol: number[] = [];
  const bulbColors = ['#ffcf7a', '#ff8fa8', '#8fe6ff', '#fff2c4', '#b8ff9a'];
  const strands: [number, number, number, number, number, number][] = [
    [-70, 20, 40, 9, 17, 25.2], [9, 17, 25.2, 80, 19, -10], [-70, 20, -30, -24, 17, 25.2], [-80, 19, -46, 60, 20, -44], [-24, 17, 34.8, 60, 18, 46],
  ];
  const lineGeo: number[] = [];
  const c = new THREE.Color();
  for (const [x1, y1, z1, x2, y2, z2] of strands) {
    const n = 16;
    let px = x1, py = y1, pz = z1;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(t * Math.PI) * 5.5;
      const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t - sag, z = z1 + (z2 - z1) * t;
      lineGeo.push(px, py, pz, x, y, z);
      px = x; py = y; pz = z;
      if (i < n) {
        bulbPos.push(x, y - 0.4, z);
        c.set(bulbColors[(i + Math.floor(x1 + 100)) % bulbColors.length]!);
        bulbCol.push(c.r, c.g, c.b);
        if (i % 3 === 0) root.add(lightPool(x, z, 9 + (i % 2) * 3, bulbColors[i % bulbColors.length]!, 0.2));
      }
    }
  }
  const wire = new THREE.BufferGeometry();
  wire.setAttribute('position', new THREE.Float32BufferAttribute(lineGeo, 3));
  root.add(new THREE.LineSegments(wire, new THREE.LineBasicMaterial({ color: '#15121c' })));
  const bulbs = new THREE.BufferGeometry();
  bulbs.setAttribute('position', new THREE.Float32BufferAttribute(bulbPos, 3));
  bulbs.setAttribute('color', new THREE.Float32BufferAttribute(bulbCol, 3));
  const bulbMat = new THREE.PointsMaterial({ map: glow(), size: 5.5, sizeAttenuation: true, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  root.add(new THREE.Points(bulbs, bulbMat));
  // work lamp: head glow, a faint beam, and a big pool over the hairpin
  const lampFace = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), new THREE.MeshBasicMaterial({ color: '#fff7e0', toneMapped: false }));
  lampFace.position.set(wl.x - 1.05, 14.6, wl.z);
  lampFace.rotation.y = -Math.PI / 2;
  root.add(lampFace);
  root.add(lightPool(hz.cx + 6, hz.cz, 30, '#fff1cf', 0.42));
  root.add(lightPool(s0.x, s0.z, 16, '#ffd9a0', 0.3));
  root.add(lightPool(pl.ax - 8, pl.az - 4, 18, '#ffc7dd', 0.22));
  // house window far behind the fence line
  const win = new THREE.Mesh(new THREE.PlaneGeometry(26, 18), new THREE.MeshBasicMaterial({ color: '#ffcf85', toneMapped: false, fog: false }));
  win.position.set(-10, 34, -100);
  root.add(win);
  const house = new THREE.Mesh(new THREE.PlaneGeometry(260, 120), new THREE.MeshBasicMaterial({ color: '#191a2e', fog: false }));
  house.position.set(0, 55, -101);
  root.add(house);

  // the sky: a dome, so the stars and the moon stay put when the camera swings
  const skyTex = canvasTex(1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#080a22');
    g.addColorStop(0.3, '#141a45');
    g.addColorStop(0.42, '#3a2f6b');
    g.addColorStop(0.485, '#a45f78');
    g.addColorStop(0.5, '#e09a72');
    g.addColorStop(0.51, '#1a1c30');
    g.addColorStop(1, '#101122');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 520; i++) {
      const y = Math.pow(r(), 1.5) * 225;
      const a = 0.35 + r() * 0.65;
      ctx.fillStyle = `rgba(${230 + Math.floor(r() * 25)},${230 + Math.floor(r() * 25)},255,${a})`;
      const sz = r() < 0.08 ? 2.2 : 1.1;
      ctx.fillRect(r() * 1024, y, sz, sz);
    }
    // the moon, low over the fence to the north
    const mx = 760;
    const my = 120;
    const halo = ctx.createRadialGradient(mx, my, 6, mx, my, 90);
    halo.addColorStop(0, 'rgba(255,246,214,0.55)');
    halo.addColorStop(1, 'rgba(255,246,214,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    ctx.fillStyle = '#fff6d6';
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(214,204,170,0.7)';
    for (const [dx, dy, rr] of [[-6, -4, 4], [7, 5, 3], [3, -9, 2.4]] as const) {
      ctx.beginPath();
      ctx.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
      ctx.fill();
    }
  }, false);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(370, 32, 20), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  sky.renderOrder = -10;
  sky.position.y = -6;
  root.add(sky);

  // ── things a grown-up left out here ──
  // a boombox on the lawn beyond the start straight, speakers thumping
  const box = new THREE.Group();
  box.position.set(14, 0, 57);
  box.rotation.y = Math.PI + 0.35; // facing the track
  const shellM = mat.glossy('#2a2c3a', { roughness: 0.45 });
  box.add(new THREE.Mesh(new RoundedBoxGeometry(15, 8, 4, 3, 0.5).translate(0, 4.3, 0), shellM));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.28, 6, 16, Math.PI).translate(0, 8.2, 0), mat.metal('#c7cedb'));
  box.add(handle);
  const cones: THREE.Mesh[] = [];
  for (const x of [-4.6, 4.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.22, 6, 20).translate(x, 4.1, 2.02), mat.metal('#c7cedb'));
    const cone = new THREE.Mesh(new THREE.CircleGeometry(2.3, 20), new THREE.MeshBasicMaterial({ color: '#ff3d8b', toneMapped: false, fog: false }));
    cone.position.set(x, 4.1, 2.04);
    box.add(ring, cone);
    cones.push(cone);
  }
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), new THREE.MeshBasicMaterial({ color: '#ffd15c', toneMapped: false, fog: false }));
  deck.position.set(0, 5.4, 2.03);
  box.add(deck);
  box.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9, 5).rotateZ(-0.5).translate(8.6, 11, -1), mat.metal('#c7cedb')));
  root.add(box);
  root.add(lightPool(11, 50, 14, '#ff5aa5', 0.3));

  // a neon sign on the back fence
  const signTex = canvasTex(1024, 256, (ctx) => {
    ctx.clearRect(0, 0, 1024, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 800 170px "Barlow Condensed", "Arial Narrow", Impact, sans-serif';
    for (const [blur, alpha] of [[46, 0.9], [18, 1], [0, 1]] as const) {
      ctx.shadowColor = '#ff2f7e';
      ctx.shadowBlur = blur;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = blur ? '#ff5aa5' : '#fff0f6';
      ctx.fillText('OPEN LATE', 512, 132);
    }
    ctx.globalAlpha = 1;
  }, false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(46, 11.5), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  sign.position.set(-18, 15, -57.4);
  root.add(sign);
  root.add(lightPool(-18, -50, 22, '#ff5aa5', 0.22));

  // fireflies
  const flyN = 46;
  const flyBase = new Float32Array(flyN * 3);
  for (let i = 0; i < flyN; i++) {
    flyBase[i * 3] = -70 + r() * 150;
    flyBase[i * 3 + 1] = 1.5 + r() * 7;
    flyBase[i * 3 + 2] = -34 + r() * 78;
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyBase.slice(), 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: glow(), color: '#d8ff7a', size: 1.1, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  root.add(flies);

  // ── plank state ──
  const CLOSED = 0.075; // radians: the near end sits about 2.5 units up on the peg
  const drop = new Spring(CLOSED, 90, 7);
  let open = false;
  let propT = -1;
  plankPivot.rotation.z = CLOSED;

  return {
    root,
    openPlank(instant = false): void {
      if (open) return;
      open = true;
      drop.target = 0;
      if (instant) {
        drop.value = 0;
        drop.velocity = 0;
        prop.visible = false;
        propGlow.visible = false;
      } else propT = 0;
    },
    resetPlank(): void {
      open = false;
      drop.target = CLOSED;
      drop.value = CLOSED;
      drop.velocity = 0;
      propT = -1;
      prop.visible = true;
      propGlow.visible = true;
      prop.position.set(pl.prop.x, 0, pl.prop.z);
      prop.rotation.set(0, 0, 0);
    },
    update(dt: number, time: number): void {
      plankPivot.rotation.z = Math.max(0, drop.update(dt));
      if (propT >= 0) {
        // the peg spins away across the patio
        propT += dt;
        prop.position.set(pl.prop.x + propT * 9, Math.max(0, 5 * propT - 9 * propT * propT) + 0.1, pl.prop.z + propT * 7);
        prop.rotation.z = propT * 9;
        prop.rotation.x = propT * 5;
        propGlow.visible = false;
        if (propT > 1.4) {
          prop.visible = false;
          propT = -1;
        }
      } else if (!open) {
        arrow.position.y = 3.6 + Math.sin(time * 4) * 0.3;
        (propGlow.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.sin(time * 4);
      }
      const a = flyGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < flyN; i++) {
        a.setXYZ(i, flyBase[i * 3]! + Math.sin(time * 0.5 + i) * 1.6, flyBase[i * 3 + 1]! + Math.sin(time * 0.8 + i * 2.1) * 0.8, flyBase[i * 3 + 2]! + Math.cos(time * 0.4 + i * 1.3) * 1.6);
      }
      a.needsUpdate = true;
      bulbMat.size = 5.5 + Math.sin(time * 2.1) * 0.25;
      // speakers kick at the race tempo; the sign has a tube that will not stay lit
      const beat = (time * 126) / 60;
      const kick = Math.max(0, 1 - (beat - Math.floor(beat)) * 3.2);
      for (const c of cones) c.scale.setScalar(1 + 0.12 * kick);
      (sign.material as THREE.MeshBasicMaterial).opacity = Math.sin(time * 37) > 0.985 || Math.sin(time * 2.3) > 0.995 ? 0.45 : 1;
    },
  };
}

/** Sky for the night scene: indigo above, a warm glow at the horizon, a few stars. */
export function buildNightSky(): THREE.Texture {
  return canvasTex(8, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0d1030');
    g.addColorStop(0.45, '#232a5c');
    g.addColorStop(0.72, '#5a3d78');
    g.addColorStop(0.9, '#b06a6a');
    g.addColorStop(1, '#e0a070');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
  }, false);
}

// ───────────────────────────── karts ─────────────────────────────

export interface KartModel {
  readonly root: THREE.Group;
  /** parent for the driver's rig; origin on the kart floor */
  readonly seat: THREE.Object3D;
  /** lean / pitch / hop of the body, separate from where the kart is */
  readonly body: THREE.Group;
  setSteer(steer: number): void;
  setBoost(amount01: number): void;
  setGhost(on: boolean): void;
  /** world positions of the rear wheels, for sparks */
  rearWheel(side: -1 | 1, out: THREE.Vector3): THREE.Vector3;
  /** bolt on (or take off) the guns, the ram and the side plates */
  setArmed(on: boolean): void;
  /** one round leaves one of the barrels: a muzzle flash */
  fire(): void;
  /** world position between the two muzzles, for tracers */
  muzzle(out: THREE.Vector3): THREE.Vector3;
  /** world position of the bonnet, for smoke */
  bonnet(out: THREE.Vector3): THREE.Vector3;
  /** a wreck sits burning with its lamps out until it is put back */
  setWrecked(on: boolean): void;
  update(dt: number, speed: number): void;
  /** free this kart's own geometry and one-off materials (shared kit materials are left alone) */
  dispose(): void;
}

/** A tin-toy kart: enamel tub, bottle-cap wheels, twin drinking-straw exhausts. */
export function buildKart(color: string, accent: string): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = mat.glossy(color, { roughness: 0.3 });
  const trim = mat.glossy(accent, { roughness: 0.35 });
  const metal = mat.metal('#c7cedb');
  const rubber = mat.clay('#22202a', { roughness: 0.9 });

  const tub = new RoundedBoxGeometry(1.72, 0.34, 0.98, 3, 0.12).translate(0, 0.36, 0);
  const nose = new RoundedBoxGeometry(0.62, 0.24, 0.8, 3, 0.1).translate(0.72, 0.33, 0);
  const tail = new RoundedBoxGeometry(0.5, 0.42, 0.9, 3, 0.1).translate(-0.72, 0.5, 0);
  const paintGeo = mergeGeometries([tub, nose, tail].map((g) => g.toNonIndexed()), false)!;
  body.add(new THREE.Mesh(paintGeo, paint));
  const stripe = new RoundedBoxGeometry(1.5, 0.05, 0.26, 2, 0.02).translate(0.1, 0.55, 0);
  const seatBack = new RoundedBoxGeometry(0.14, 0.3, 0.7, 2, 0.06).translate(-0.46, 0.6, 0);
  const pennant = new THREE.ConeGeometry(0.16, 0.36, 3).rotateZ(-Math.PI / 2).translate(-0.72, 1.56, 0.4);
  body.add(new THREE.Mesh(mergeGeometries([stripe, seatBack, pennant].map((g) => g.toNonIndexed()), false)!, trim));
  const bumper = new THREE.CapsuleGeometry(0.07, 0.86, 4, 8).rotateX(Math.PI / 2).translate(1.04, 0.3, 0);
  const pole = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5).translate(-0.82, 1.1, 0.4);
  const column = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6).rotateZ(-0.9).translate(0.54, 0.66, 0);
  const wheelRing = new THREE.TorusGeometry(0.19, 0.04, 6, 14).rotateY(Math.PI / 2).rotateZ(0.6).translate(0.36, 0.84, 0);
  const pipes = [-0.24, 0.24].map((z) => new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8).rotateZ(Math.PI / 2 - 0.3).translate(-1.02, 0.6, z));
  body.add(new THREE.Mesh(mergeGeometries([bumper, pole, column, wheelRing, ...pipes].map((g) => g.toNonIndexed()), false)!, metal));
  // lamps: unlit emissive faces + a pool on the road ahead
  const lampGeo = mergeGeometries([-0.26, 0.26].map((z) => new THREE.SphereGeometry(0.1, 10, 8).translate(1.0, 0.42, z)), false)!;
  body.add(new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: '#fff3c9', toneMapped: false })));
  const tailGeo = mergeGeometries([-0.3, 0.3].map((z) => new THREE.SphereGeometry(0.08, 8, 6).translate(-0.98, 0.52, z)), false)!;
  body.add(new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ color: '#ff3b4e', toneMapped: false })));
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ map: glow(), color: '#fff0c0', transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(4.6, 0.06, 0);
  beam.renderOrder = 3;
  root.add(beam);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshBasicMaterial({ map: glow(), color: '#000000', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  shadow.renderOrder = 2;
  root.add(shadow);

  // wheels: bottle caps
  const wheelGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.23, 0.23, 0.2, 14).rotateX(Math.PI / 2).toNonIndexed(),
  ], false)!;
  const capGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.22, 10).rotateX(Math.PI / 2);
  const wheels: THREE.Group[] = [];
  const fronts: THREE.Group[] = [];
  for (const [x, z] of [[0.6, 0.56], [0.6, -0.56], [-0.6, 0.58], [-0.6, -0.58]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.23, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(wheelGeo, rubber), new THREE.Mesh(capGeo, trim));
    pivot.add(spin);
    root.add(pivot);
    wheels.push(spin);
    if (x > 0) fronts.push(pivot);
  }
  // boost flames at the pipes
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const flames: THREE.Mesh[] = [];
  for (const z of [-0.24, 0.24]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 8).rotateZ(Math.PI / 2).translate(-0.55, 0, 0), flameMat);
    f.position.set(-1.2, 0.68, z);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }
  const seat = new THREE.Object3D();
  seat.position.set(-0.14, 0.24, 0);
  body.add(seat);

  // ── the combat kit: bolted on for an armed race, left off for a plain one ──
  const armed = new THREE.Group();
  armed.visible = false;
  body.add(armed);
  const gunmetal = mat.metal('#3b404d');
  const plate = mat.clay('#262830', { roughness: 0.75 });
  const GUN_Y = 0.6;
  const GUN_Z = 0.22;
  const MUZZLE_X = 1.3;
  const guns: THREE.BufferGeometry[] = [];
  for (const z of [-GUN_Z, GUN_Z]) {
    guns.push(
      new RoundedBoxGeometry(0.42, 0.15, 0.17, 2, 0.04).translate(0.62, GUN_Y, z), // breech
      new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8).rotateZ(Math.PI / 2).translate(0.98, GUN_Y, z), // barrel
      new THREE.CylinderGeometry(0.065, 0.065, 0.12, 8).rotateZ(Math.PI / 2).translate(1.24, GUN_Y, z), // flash hider
    );
  }
  armed.add(new THREE.Mesh(mergeGeometries(guns.map((g) => g.toNonIndexed()), false)!, gunmetal));
  const armour: THREE.BufferGeometry[] = [
    // a ram across the nose, with teeth
    new RoundedBoxGeometry(0.14, 0.3, 1.24, 2, 0.04).translate(1.16, 0.3, 0),
    ...[-0.42, 0, 0.42].map((z) => new THREE.ConeGeometry(0.1, 0.26, 4).rotateZ(-Math.PI / 2).translate(1.33, 0.3, z)),
    // plates down each side and over the tail
    ...[-0.52, 0.52].map((z) => new RoundedBoxGeometry(1.25, 0.3, 0.06, 2, 0.02).translate(0, 0.4, z)),
    new RoundedBoxGeometry(0.08, 0.36, 0.86, 2, 0.02).translate(-1.0, 0.5, 0),
  ];
  armed.add(new THREE.Mesh(mergeGeometries(armour.map((g) => g.toNonIndexed()), false)!, plate));
  // rivets and a hazard band, so the plates read as bolted-on at speed
  const band = mergeGeometries([-0.555, 0.555].map((z) => new THREE.BoxGeometry(0.5, 0.07, 0.012).translate(0.1, 0.4, z)), false)!;
  armed.add(new THREE.Mesh(band, new THREE.MeshBasicMaterial({ color: '#ffb52e', toneMapped: false })));
  const flashMat = new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const flashes: THREE.Mesh[] = [];
  for (const z of [-GUN_Z, GUN_Z]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.95, 6).rotateZ(-Math.PI / 2).translate(0.47, 0, 0), flashMat);
    f.position.set(MUZZLE_X, GUN_Y, z);
    f.visible = false;
    armed.add(f);
    flashes.push(f);
  }
  // a wreck burns: flames over the bonnet
  const fireMat = new THREE.MeshBasicMaterial({ color: '#ff7a2e', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const fires: THREE.Mesh[] = [];
  for (const [x, z] of [[0.55, 0.12], [0.2, -0.2], [-0.6, 0.1]] as const) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.9, 7).translate(0, 0.45, 0), fireMat);
    f.position.set(x, 0.5, z);
    f.visible = false;
    body.add(f);
    fires.push(f);
  }

  let boost = 0;
  let flick = 0;
  let flashT = 0;
  let flashFresh = false;
  let barrel = 0;
  let wrecked = false;
  return {
    root, seat, body,
    setArmed(on: boolean): void {
      armed.visible = on;
    },
    fire(): void {
      barrel = 1 - barrel;
      flashT = 0.05;
      flashFresh = true; // drawn at least once, however slow the frame rate
      flashes[barrel]!.visible = true;
      flashes[1 - barrel]!.visible = false;
      flashes[barrel]!.rotation.x = flick;
    },
    muzzle(out: THREE.Vector3): THREE.Vector3 {
      return root.localToWorld(out.set(MUZZLE_X, GUN_Y, 0));
    },
    bonnet(out: THREE.Vector3): THREE.Vector3 {
      return root.localToWorld(out.set(0.5, 0.7, 0));
    },
    setWrecked(on: boolean): void {
      wrecked = on;
      beam.visible = !on;
      for (const f of fires) f.visible = on;
    },
    setSteer(steer: number): void {
      for (const f of fronts) f.rotation.y = -steer * 0.5;
    },
    setBoost(amount: number): void {
      boost = amount;
    },
    setGhost(on: boolean): void {
      root.visible = !on || Math.floor(performance.now() / 70) % 2 === 0;
    },
    rearWheel(side: -1 | 1, out: THREE.Vector3): THREE.Vector3 {
      return root.localToWorld(out.set(-0.6, 0.08, 0.58 * side));
    },
    update(dt: number, speed: number): void {
      for (const w of wheels) w.rotation.z -= (speed / 0.23) * dt;
      flick += dt * 40;
      for (const f of flames) {
        f.visible = boost > 0.02;
        const s = boost * (0.8 + 0.25 * Math.sin(flick + f.position.z * 9));
        f.scale.set(s, 0.7 + 0.3 * boost, 0.7 + 0.3 * boost);
      }
      beam.material.opacity = 0.3 + 0.06 * Math.sin(flick * 0.2);
      if (flashT > 0) {
        if (flashFresh) flashFresh = false;
        else flashT -= dt;
        if (flashT <= 0) for (const f of flashes) f.visible = false;
      }
      if (wrecked) {
        fires.forEach((f, n) => {
          const k = 0.75 + 0.3 * Math.sin(flick * 0.55 + n * 2.1);
          f.scale.set(k, 0.7 + 0.5 * Math.abs(Math.sin(flick * 0.4 + n)), k);
        });
      }
    },
    dispose(): void {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        // only the unlit one-offs made here; mat.* materials are cached and shared
        if ((m.material as THREE.Material).type === 'MeshBasicMaterial') (m.material as THREE.Material).dispose();
      });
    },
  };
}

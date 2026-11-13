/**
 * The Grease Pit — the world kit for the figure-of-eight on the garage floor.
 *
 * A workshop at night seen from two centimetres up: a lane swept clean through the sawdust, a
 * yellow box where the track crosses itself, paint tins and concrete blocks for furniture, a
 * strip light that came off its chains, an oil spill with a board across it, and a car up on
 * stands somewhere overhead. Presentation only; the simulation owns every position.
 * No external assets.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PitDressing, Track } from '../../attractions/dash/track';
import { Spring, mat } from '../../kit/materials';
import { canvasTex, glow, lightPool, rng, speckle } from '../shared';
import type { RaceWorld } from '../index';

export function buildPitWorld(track: Track): RaceWorld {
  const root = new THREE.Group();
  root.name = 'pit';
  const r = rng(4242);
  const d = track.dressing as PitDressing;
  const S = track.samples;
  const N = S.length;
  const bed = track.bed;
  const pl = track.plank;

  // ── the floor: concrete under a scatter of sawdust ──
  const floorTex = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#6b5d4c';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 3200, ['#8a765a', '#57493a', '#a08a66', '#75654f', '#4a3f33'], r, 3);
    // wood shavings
    ctx.strokeStyle = 'rgba(214,186,138,0.55)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 120; i++) {
      const x = r() * 256;
      const y = r() * 256;
      ctx.beginPath();
      ctx.arc(x, y, 2 + r() * 4, r() * 6, r() * 6 + 1.5 + r() * 2);
      ctx.stroke();
    }
  });
  floorTex.repeat.set(44, 34);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(340, 260), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -4);
  root.add(floor);

  // ── the lane: swept concrete. Its texture is laid out by where it is on the floor, not by
  //    how far round the lap, so the two roads that share the crossing are the same slab there ──
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const edgeIdx: number[] = [];
  const edgeL: number[] = [];
  const edgeR: number[] = [];
  const box = d.crossing;
  const inBox = (x: number, z: number): boolean => Math.abs(x - box.x) < box.half + 0.4 && Math.abs(z - box.z) < box.half + 0.4;
  for (let i = 0; i <= N; i++) {
    const p = S[i % N]!;
    const nx = -p.tz;
    const nz = p.tx;
    const lx = p.x - nx * p.hw;
    const lz = p.z - nz * p.hw;
    const rx = p.x + nx * p.hw;
    const rz = p.z + nz * p.hw;
    pos.push(lx, 0.02, lz, rx, 0.02, rz);
    uv.push(lx / 7, lz / 7, rx / 7, rz / 7);
    for (const [arr, side] of [[edgeL, -1], [edgeR, 1]] as const) {
      const a = p.hw - 0.34;
      const b = p.hw - 0.06;
      arr.push(p.x + nx * a * side, 0.04, p.z + nz * a * side, p.x + nx * b * side, 0.04, p.z + nz * b * side);
    }
    if (i < N) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      // no tape across the junction: the box is painted there instead
      const q = S[(i + 1) % N]!;
      if (!inBox(p.x, p.z) && !inBox(q.x, q.z)) edgeIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const slabTex = canvasTex(256, 256, (ctx) => {
    ctx.fillStyle = '#585b66';
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 2400, ['#4b4e58', '#676a75', '#52555f', '#70737d'], r, 2);
    // rubber laid down by whoever raced here before
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(22,22,28,${0.08 + r() * 0.14})`;
      ctx.lineWidth = 2 + r() * 4;
      ctx.beginPath();
      const x = r() * 256;
      const y = r() * 256;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 40, y + (r() - 0.5) * 30, x + 90, y + (r() - 0.5) * 30, x + 130, y + (r() - 0.5) * 40);
      ctx.stroke();
    }
    // the joints between slabs
    ctx.strokeStyle = '#33353d';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 256);
  });
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx);
  roadGeo.computeVertexNormals();
  root.add(new THREE.Mesh(roadGeo, new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.78, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  // glow tape along both edges: warm on your left, cold on your right, all the way round
  for (const [arr, color] of [[edgeL, '#ff8a2a'], [edgeR, '#8fe9ff']] as const) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setIndex(edgeIdx);
    root.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide })));
  }
  // the box junction where the track crosses itself
  const boxTex = canvasTex(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 9;
    ctx.strokeRect(6, 6, 244, 244);
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let k = -256; k <= 256; k += 42) {
      ctx.moveTo(k, 0);
      ctx.lineTo(k + 256, 256);
      ctx.moveTo(k + 256, 0);
      ctx.lineTo(k, 256);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(10, 10, 236, 236);
    ctx.clip();
    ctx.beginPath();
    for (let k = -256; k <= 256; k += 42) {
      ctx.moveTo(k, 0);
      ctx.lineTo(k + 256, 256);
      ctx.moveTo(k + 256, 0);
      ctx.lineTo(k, 256);
    }
    ctx.stroke();
    ctx.restore();
  }, false);
  const junction = new THREE.Mesh(
    new THREE.PlaneGeometry(box.half * 2, box.half * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: boxTex, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
  );
  junction.position.set(box.x, 0.05, box.z);
  junction.renderOrder = 1;
  root.add(junction);
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

  // ── the oil spill: black, wet, with a film of colour on it ──
  const oilTex = canvasTex(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, '#07070c');
    g.addColorStop(0.5, '#0c0b14');
    g.addColorStop(0.68, '#2a1846');
    g.addColorStop(0.78, '#13405a');
    g.addColorStop(0.86, '#3a4a1c');
    g.addColorStop(0.93, '#4a2416');
    g.addColorStop(1, '#0a0a0e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }, false);
  const stain = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: '#2c2620', transparent: true, opacity: 0.55, depthWrite: false }));
  stain.rotation.x = -Math.PI / 2;
  stain.scale.set(bed.rx * 1.07, bed.rz * 1.1, 1);
  stain.position.set(bed.x, 0.008, bed.z);
  root.add(stain);
  const oil = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ map: oilTex, roughness: 0.08, metalness: 0.75 }));
  oil.rotation.x = -Math.PI / 2;
  oil.scale.set(bed.rx, bed.rz, 1);
  oil.position.set(bed.x, 0.014, bed.z);
  root.add(oil);

  // ── everything that stands on the floor, merged by material ──
  const statics: Record<string, THREE.BufferGeometry[]> = { steel: [], rubber: [], enamel: [], concrete: [], hazard: [], dust: [], drum: [], can: [], brick: [], dark: [], label: [] };
  const put = (key: string, g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rz = 0, rx = 0): void => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    statics[key]!.push(g.index ? g.toNonIndexed() : g);
  };

  // heavy chain round the outside of each hairpin: a link lying flat, a link on edge, and so on
  for (const c of d.chains) {
    const links = Math.round((Math.abs(c.a1 - c.a0) * c.r) / 1.25);
    for (let i = 0; i <= links; i++) {
      const a = c.a0 + ((c.a1 - c.a0) * i) / links;
      const flat = i % 2 === 0;
      const link = new THREE.TorusGeometry(0.62, 0.2, 5, 10).scale(1.25, 1, 1);
      if (flat) link.rotateX(Math.PI / 2);
      put('steel', link, c.cx + Math.cos(a) * c.r, flat ? 0.24 : 0.66, c.cz + Math.sin(a) * c.r, -a + Math.PI / 2);
    }
  }
  // paint tins stood in the firing line: a lid, a label and a wire handle each
  const tinColors = ['#c9372c', '#e2a72e', '#2f86c9'];
  d.tins.forEach((t, i) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, 3.9, 22), mat.glossy(tinColors[i % tinColors.length]!, { roughness: 0.4 }));
    body.position.set(t.x, 1.95, t.z);
    root.add(body);
    put('label', new THREE.CylinderGeometry(t.r + 0.03, t.r + 0.03, 1.5, 22, 1, true), t.x, 2.0, t.z);
    put('steel', new THREE.TorusGeometry(t.r, 0.1, 5, 22).rotateX(Math.PI / 2), t.x, 3.9, t.z);
    put('steel', new THREE.CylinderGeometry(t.r - 0.12, t.r - 0.12, 0.08, 22), t.x, 3.86, t.z);
    put('steel', new THREE.TorusGeometry(t.r + 0.1, 0.05, 4, 16, Math.PI).rotateX(-0.5), t.x, 3.2, t.z, i * 1.1);
    root.add(lightPool(t.x, t.z, 4.6, tinColors[i % tinColors.length]!, 0.28));
  });
  // two tyres stacked inside the east hairpin
  const ty = d.tyres;
  const tyreR = ty.r - 1.95;
  put('rubber', new THREE.TorusGeometry(tyreR, 1.95, 12, 36).rotateX(Math.PI / 2), ty.x, 1.95, ty.z);
  put('rubber', new THREE.TorusGeometry(tyreR, 1.95, 12, 36).rotateX(Math.PI / 2), ty.x + 0.3, 5.75, ty.z - 0.25);
  // a jerry can beside them
  const can = d.can;
  put('can', new RoundedBoxGeometry(4.2, 5.2, 2.9, 3, 0.45), can.x, 2.6, can.z, 0.5);
  put('can', new THREE.CylinderGeometry(0.42, 0.42, 0.7, 10), can.x + 1.0, 5.5, can.z - 0.55, 0.5);
  put('dark', new THREE.TorusGeometry(0.9, 0.16, 5, 12, Math.PI), can.x - 0.5, 5.2, can.z + 0.28, 0.5);
  // an oil drum inside the west hairpin, open at the top (armed, it is alight)
  const dr = d.drum;
  put('drum', new THREE.CylinderGeometry(dr.r, dr.r, 9, 30, 1, true), dr.x, 4.5, dr.z);
  for (const y of [0.25, 3.1, 5.9, 8.9]) put('drum', new THREE.TorusGeometry(dr.r, 0.2, 5, 30).rotateX(Math.PI / 2), dr.x, y, dr.z);
  put('dark', new THREE.CircleGeometry(dr.r - 0.05, 30).rotateX(-Math.PI / 2), dr.x, 8.3, dr.z);
  // the gate: two concrete blocks, striped on top so nobody can say they were not warned
  for (const b of d.blocks) {
    const len = Math.hypot(b.x2 - b.x1, b.z2 - b.z1) + b.r * 2;
    const cx = (b.x1 + b.x2) / 2;
    const cz = (b.z1 + b.z2) / 2;
    put('concrete', new RoundedBoxGeometry(len, 3.6, b.r * 2, 2, 0.18), cx, 1.8, cz);
    put('hazard', new THREE.BoxGeometry(len + 0.06, 0.5, b.r * 2 + 0.06), cx, 3.2, cz);
    for (const off of [-len / 4, len / 4]) put('dark', new THREE.BoxGeometry(len / 4, 0.06, b.r * 0.9), cx + off, 3.63, cz);
  }
  // the strip light that fences the infield: an enamel batten, two tubes still burning
  const tb = d.tube;
  const tubeLen = tb.x2 - tb.x1;
  const tubeMid = (tb.x1 + tb.x2) / 2;
  put('enamel', new RoundedBoxGeometry(tubeLen + tb.r * 2, 1.0, tb.r * 2, 2, 0.2), tubeMid, 0.5, tb.z1);
  put('steel', new THREE.BoxGeometry(0.5, 1.5, tb.r * 2 + 0.1), tb.x1 - tb.r + 0.3, 0.75, tb.z1);
  put('steel', new THREE.BoxGeometry(0.5, 1.5, tb.r * 2 + 0.1), tb.x2 + tb.r - 0.3, 0.75, tb.z1);
  const tubeMat = new THREE.MeshBasicMaterial({ color: '#f1f8ff', toneMapped: false, fog: false });
  const tubes: THREE.Mesh[] = [];
  for (const dz of [-0.48, 0.48]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, tubeLen - 0.4, 8).rotateZ(Math.PI / 2), tubeMat.clone());
    lamp.position.set(tubeMid, 1.22, tb.z1 + dz);
    root.add(lamp);
    tubes.push(lamp);
  }
  const tubePools: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const pool = lightPool(tb.x1 + (tubeLen * (i + 0.5)) / 5, tb.z1, 15, '#cfe6ff', 0.34);
    root.add(pool);
    tubePools.push(pool);
  }
  // sawdust: drifts along the edges of the lane, and heaped round the spill it was thrown at
  for (let i = 0; i < N; i += 2) {
    const p = S[i]!;
    for (const side of [-1, 1]) {
      if (r() < 0.5) continue;
      const off = p.hw + 0.8 + r() * 2.6;
      const x = p.x - p.tz * off * side;
      const z = p.z + p.tx * off * side;
      if (inBox(x, z)) continue;
      const bx = (x - bed.x) / bed.rx;
      const bz = (z - bed.z) / bed.rz;
      if (bx * bx + bz * bz < 1.05) continue;
      // (never on the other road, where the lane doubles back close by)
      let clear = true;
      for (let j = 0; j < N; j += 3) {
        const q = S[j]!;
        if ((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) < (q.hw + 0.5) * (q.hw + 0.5)) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const w = 0.5 + r() * 0.9;
      put('dust', new THREE.SphereGeometry(w, 6, 4).scale(1.5, 0.3, 1), x, 0.05, z, r() * 6);
    }
  }
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + r() * 0.2;
    const x = bed.x + Math.cos(a) * (bed.rx + 1.2 + r() * 1.2);
    const z = bed.z + Math.sin(a) * (bed.rz + 1.0 + r() * 1.0);
    if (Math.abs(z - pl.az) < 2.6) continue; // keep the board clear
    let onRoad = false;
    for (let j = 0; j < N; j += 2) {
      const q = S[j]!;
      if ((q.x - x) * (q.x - x) + (q.z - z) * (q.z - z) < (q.hw + 0.3) * (q.hw + 0.3)) {
        onRoad = true;
        break;
      }
    }
    if (!onRoad) put('dust', new THREE.SphereGeometry(1.3 + r() * 0.8, 7, 4).scale(1.4, 0.26, 1), x, 0.05, z, r() * 6);
  }
  // the board's far-end rest: a brick
  put('brick', new RoundedBoxGeometry(2.2, 0.7, 4.2, 2, 0.1), pl.bx - 0.6, 0.3, pl.bz);

  // ── the room: a pegboard wall, a door with light under it, and a car up on stands ──
  const wheel = new THREE.Group();
  wheel.position.set(94, 15.5, 10);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(11.2, 4.4, 12, 34).rotateY(Math.PI / 2), mat.clay('#17171b')));
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 3.2, 26).rotateZ(Math.PI / 2), mat.metal('#8d939f')));
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6.4, 1.5), mat.metal('#5c616b'));
    spoke.position.set(-0.4, Math.cos((i / 5) * Math.PI * 2) * 3.6, Math.sin((i / 5) * Math.PI * 2) * 3.6);
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    wheel.add(spoke);
  }
  root.add(wheel);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 170), new THREE.MeshStandardMaterial({ color: '#3a1216', roughness: 0.45, metalness: 0.3 }));
  sill.position.set(104, 38, -30);
  root.add(sill);
  // an axle stand under the sill
  put('steel', new THREE.CylinderGeometry(1.6, 6.5, 22, 4), 96, 11, -62, 0.6);
  put('steel', new THREE.CylinderGeometry(0.9, 0.9, 12, 8), 96, 27, -62);

  const boardTex = canvasTex(512, 256, (ctx) => {
    ctx.fillStyle = '#2a211c';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#17110e';
    for (let y = 8; y < 256; y += 16) for (let x = 8; x < 512; x += 16) ctx.fillRect(x, y, 3, 3);
    // tool outlines, the way a tidy person paints them on
    ctx.strokeStyle = '#4d3d33';
    ctx.fillStyle = '#4d3d33';
    ctx.lineCap = 'round';
    const spanner = (x: number, y: number, len: number): void => {
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - 6, 11, 0.4, Math.PI * 2 - 0.4 + Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + len + 6, 9, 0, Math.PI * 2);
      ctx.fill();
    };
    spanner(60, 60, 110);
    spanner(100, 70, 90);
    spanner(136, 78, 74);
    // a hammer
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(220, 70);
    ctx.lineTo(220, 200);
    ctx.stroke();
    ctx.fillRect(190, 48, 64, 26);
    // a saw
    ctx.beginPath();
    ctx.moveTo(300, 60);
    ctx.lineTo(450, 80);
    ctx.lineTo(450, 118);
    ctx.lineTo(300, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(280, 52, 34, 62);
    // screwdrivers
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(330 + i * 34, 150);
      ctx.lineTo(330 + i * 34, 225);
      ctx.stroke();
      ctx.fillRect(322 + i * 34, 135, 16, 34);
    }
  }, true);
  boardTex.repeat.set(3, 1);
  const wallN = new THREE.Mesh(new THREE.PlaneGeometry(330, 84), new THREE.MeshBasicMaterial({ map: boardTex, fog: false }));
  wallN.position.set(0, 40, -98);
  root.add(wallN);
  // the side walls: high windows with the night in them, and a shelf of jars underneath
  const sideTex = canvasTex(512, 256, (ctx) => {
    ctx.fillStyle = '#14151b';
    ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 3; i++) {
      const x = 46 + i * 170;
      const g = ctx.createLinearGradient(0, 36, 0, 132);
      g.addColorStop(0, '#2c3a5e');
      g.addColorStop(1, '#3d4f7a');
      ctx.fillStyle = g;
      ctx.fillRect(x, 36, 96, 96);
      ctx.fillStyle = '#14151b';
      ctx.fillRect(x + 45, 36, 6, 96);
      ctx.fillRect(x, 81, 96, 6);
    }
    ctx.fillStyle = '#23252f';
    ctx.fillRect(0, 176, 512, 7);
    for (let i = 0; i < 22; i++) {
      const w = 10 + r() * 12;
      const h = 14 + r() * 22;
      ctx.fillStyle = ['#2d3040', '#3a2f2a', '#26323a'][i % 3]!;
      ctx.fillRect(8 + i * 23, 176 - h, w, h);
    }
  }, true);
  sideTex.repeat.set(2, 1);
  const sideMat = new THREE.MeshBasicMaterial({ map: sideTex, fog: false });
  for (const x of [-140, 140]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(240, 84), sideMat);
    w.position.set(x, 40, -10);
    w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(w);
  }
  // the roller door to the south, a line of streetlight under it
  const doorTex = canvasTex(64, 256, (ctx) => {
    ctx.fillStyle = '#1b1d25';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = '#12131a';
    for (let y = 0; y < 256; y += 20) ctx.fillRect(0, y, 64, 4);
  });
  doorTex.repeat.set(1, 1);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(330, 84), new THREE.MeshBasicMaterial({ map: doorTex, fog: false }));
  door.position.set(0, 40, 88);
  door.rotation.y = Math.PI;
  root.add(door);
  const gap = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.1), new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false, fog: false }));
  gap.position.set(0, 0.6, 87.6);
  gap.rotation.y = Math.PI;
  root.add(gap);
  root.add(lightPool(0, 76, 60, '#ffcf8a', 0.14));

  // the roof: dark, with the strip lights that did not fall down, a long way up and out of focus
  const skyTex = canvasTex(1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#0a0b10');
    g.addColorStop(0.4, '#12141c');
    g.addColorStop(0.5, '#1c1e28');
    g.addColorStop(0.52, '#0e0f14');
    g.addColorStop(1, '#0a0a0e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 7; i++) {
      const x = 70 + i * 146;
      const y = 60 + (i % 2) * 46;
      const halo = ctx.createRadialGradient(x, y, 2, x, y, 70);
      halo.addColorStop(0, 'rgba(214,232,255,0.5)');
      halo.addColorStop(1, 'rgba(214,232,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - 70, y - 70, 140, 140);
      ctx.fillStyle = 'rgba(232,242,255,0.8)';
      ctx.fillRect(x - 34, y - 2, 68, 4);
    }
  }, false);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(370, 32, 20), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  sky.renderOrder = -10;
  sky.position.y = -6;
  root.add(sky);

  // a sign on the pegboard, one letter of it on its way out
  const signTex = canvasTex(1024, 256, (ctx) => {
    ctx.clearRect(0, 0, 1024, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 800 170px "Barlow Condensed", "Arial Narrow", Impact, sans-serif';
    for (const [blur, alpha] of [[46, 0.9], [18, 1], [0, 1]] as const) {
      ctx.shadowColor = '#ff3b1f';
      ctx.shadowBlur = blur;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = blur ? '#ff6a3a' : '#fff1e8';
      ctx.fillText('NO BRAKES', 512, 132);
    }
    ctx.globalAlpha = 1;
  }, false);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(56, 14), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  sign.position.set(-22, 22, -97.4);
  root.add(sign);
  root.add(lightPool(-22, -66, 26, '#ff5a3a', 0.2));

  // light lying on the floor: the line, the junction, the gate, the hairpin, the sheen on the oil
  root.add(lightPool(s0.x, s0.z, 16, '#ffe2b0', 0.3));
  root.add(lightPool(box.x, box.z, 13, '#ffd21f', 0.26));
  const gateMid = d.blocks[0]!;
  root.add(lightPool((gateMid.x1 + gateMid.x2) / 2, (d.blocks[0]!.z1 + d.blocks[1]!.z1) / 2, 11, '#ff5a3a', 0.3));
  root.add(lightPool(d.chains[0]!.cx + 6, d.chains[0]!.cz, 26, '#d8e8ff', 0.3));
  root.add(lightPool(bed.x, bed.z - 6, 20, '#9a7cff', 0.16));

  const staticMat: Record<string, THREE.Material> = {
    steel: mat.metal('#8b919e'), rubber: mat.clay('#1b1b20'), enamel: mat.glossy('#dfe3ea', { roughness: 0.4 }), concrete: mat.clay('#8d8c88'),
    hazard: mat.glossy('#f2c21a', { roughness: 0.55 }), dust: mat.fabric('#b79a6c'), drum: mat.metal('#3d5a78'), can: mat.glossy('#7a8a3a', { roughness: 0.5 }),
    brick: mat.clay('#a4553f'), dark: mat.clay('#141418'), label: mat.glossy('#f2efe6', { roughness: 0.6 }),
  };
  (staticMat.drum as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  (staticMat.label as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  for (const key of Object.keys(statics)) {
    const list = statics[key]!;
    if (!list.length) continue;
    const merged = mergeGeometries(list.map((g) => { g.deleteAttribute('uv'); return g; }), false);
    if (merged) root.add(new THREE.Mesh(merged, staticMat[key]!));
    for (const g of list) g.dispose();
  }

  // ── the board across the spill, and the chock that holds its near end up ──
  const woodTex = canvasTex(256, 64, (ctx) => {
    ctx.fillStyle = '#b98f5c';
    ctx.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(90,58,30,${0.15 + r() * 0.3})`;
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
  const prop = new THREE.Group();
  const chock = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.2, 3).rotateX(Math.PI / 2), mat.glossy('#f2c21a', { roughness: 0.5 }));
  chock.position.y = 0.5;
  chock.rotation.z = Math.PI / 6;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.24), mat.clay('#141418'));
  stripe.position.y = 0.42;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), new THREE.MeshBasicMaterial({ color: '#ffd15c', toneMapped: false }));
  arrow.rotation.x = Math.PI;
  arrow.position.y = 3.2;
  prop.add(chock, stripe, arrow);
  prop.position.set(pl.prop.x, 0, pl.prop.z);
  root.add(prop);
  const propGlow = lightPool(pl.prop.x, pl.prop.z, 2.4, '#ffd15c', 0.5);
  root.add(propGlow);

  // dust hanging in the light
  const moteN = 60;
  const moteBase = new Float32Array(moteN * 3);
  for (let i = 0; i < moteN; i++) {
    moteBase[i * 3] = -70 + r() * 140;
    moteBase[i * 3 + 1] = 1 + r() * 9;
    moteBase[i * 3 + 2] = -50 + r() * 92;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteBase.slice(), 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glow(), color: '#e6eeff', size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  root.add(motes);

  // ── board state ──
  const CLOSED = 0.075;
  const drop = new Spring(CLOSED, 90, 7);
  let open = false;
  let propT = -1;
  plankPivot.rotation.z = CLOSED;

  return {
    root,
    mood: {
      fog: ['#1c1d26', '#24161a'], density: [0.0092, 0.0104],
      sky: ['#aab6d8', '#b9a8b4'], skyIntensity: [1.0, 0.92],
      neon: ['#ff7a3a', '#ff2a1e'], neonIntensity: [0.5, 0.9],
      lamp: '#e4eeff', moon: '#9db4ff',
    },
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
        // the chock skitters off across the concrete
        propT += dt;
        prop.position.set(pl.prop.x + propT * 9, Math.max(0, 4 * propT - 9 * propT * propT) + 0.1, pl.prop.z + propT * 7);
        prop.rotation.y = propT * 11;
        propGlow.visible = false;
        if (propT > 1.4) {
          prop.visible = false;
          propT = -1;
        }
      } else if (!open) {
        arrow.position.y = 3.2 + Math.sin(time * 4) * 0.3;
        (propGlow.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.2 * Math.sin(time * 4);
      }
      const a = moteGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < moteN; i++) {
        a.setXYZ(i, moteBase[i * 3]! + Math.sin(time * 0.3 + i) * 1.4, moteBase[i * 3 + 1]! + Math.sin(time * 0.5 + i * 2.1) * 0.6, moteBase[i * 3 + 2]! + Math.cos(time * 0.25 + i * 1.3) * 1.4);
      }
      a.needsUpdate = true;
      // one tube has a bad starter: it dips now and then; the sign has a letter that will not stay lit
      const dip = Math.sin(time * 31) > 0.97 || Math.sin(time * 1.7) > 0.992;
      (tubes[1]!.material as THREE.MeshBasicMaterial).color.set(dip ? '#8f9bb0' : '#f1f8ff');
      for (const pool of tubePools) (pool.material as THREE.MeshBasicMaterial).opacity = dip ? 0.24 : 0.34;
      (sign.material as THREE.MeshBasicMaterial).opacity = Math.sin(time * 37) > 0.985 || Math.sin(time * 2.3) > 0.995 ? 0.45 : 1;
    },
  };
}

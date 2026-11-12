/**
 * Character kit dev page.
 *
 *   /dev/characters.html                       contact sheet of the preset cast
 *   ?action=<CharacterAction>&expr=<Expression>
 *   &t=<seconds>      pre-advance the animation this long, then freeze (deterministic shots)
 *   &carry=1          MotionContext.carrying (+ a stand-in basket on the carry anchor)
 *   &tension=<0..1>   MotionContext.tension01        &speed=<0..1>  MotionContext.speed01
 *   &vx=&vy=          MotionContext velocity         &tilt=<rad>    rig.setTilt
 *   &face=-1          rig.setFacing(-1)
 *   &only=<id,id>     subset of the cast             &random=<n>    n random specs per species instead
 *   &cam=sheet|close|gameplay                        &yaw=<deg>     spin the rigs for inspection
 *   &stats=1          triangles + draw calls per character (also in window.__stats)
 *   &props=0          hide the stand-in basket / umbrella
 *
 * window.__ready turns true after the first rendered frame; window.__probe() reports anchors.
 */
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import * as THREE from 'three';
import { PRESET_CHARACTERS, buildCharacter, describeSpec, randomSpec } from '../src/characters';
import type { CharacterAction, CharacterRig, CharacterSpec, Expression, MotionContext, Species } from '../src/kit/contracts';
import { RIG } from '../src/kit/contracts';
import { PALETTE, mat } from '../src/kit/materials';
import { createStage } from '../src/render/stage';

declare global {
  interface Window {
    __ready?: boolean;
    __stats?: unknown;
    __probe?: () => unknown;
    __rigs?: CharacterRig[];
  }
}

const q = new URLSearchParams(location.search);
const num = (key: string, fallback: number): number => {
  const v = q.get(key);
  if (v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const ACTIONS: CharacterAction[] = ['idle', 'run', 'anticipate', 'fly', 'float', 'tumble', 'splat', 'caught', 'dive', 'slide', 'celebrate', 'sad', 'wave'];
const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'nervous', 'thrilled', 'determined', 'dizzy', 'oops', 'cheer'];

const action = (ACTIONS as string[]).includes(q.get('action') ?? '') ? (q.get('action') as CharacterAction) : 'idle';
const expr = (EXPRESSIONS as string[]).includes(q.get('expr') ?? '') ? (q.get('expr') as Expression) : 'neutral';
const preT = q.has('t') ? Math.max(0, num('t', 0)) : null;
const carrying = q.get('carry') === '1';
const cam = (q.get('cam') ?? 'sheet') as 'sheet' | 'close' | 'gameplay';
const facing: 1 | -1 = q.get('face') === '-1' ? -1 : 1;
const showProps = q.get('props') !== '0';
const wantStats = q.get('stats') === '1';
const ctx: MotionContext = {
  vx: num('vx', 0),
  vy: num('vy', 0),
  speed01: num('speed', 1),
  tension01: num('tension', 0),
  carrying,
};
const tilt = num('tilt', 0);
const yawDeg = num('yaw', 0);

// ── cast ──
let cast: CharacterSpec[] = PRESET_CHARACTERS;
const randomN = Math.floor(num('random', 0));
if (randomN > 0) {
  cast = [];
  const seed = Math.floor(num('seed', 1));
  for (const sp of ['human', 'dog', 'cat'] as Species[]) {
    for (let i = 0; i < randomN; i++) cast.push(randomSpec(sp, seed * 100 + i));
  }
}
const only = (q.get('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (only.length) cast = cast.filter((c) => only.includes(c.id));

// ── stage ──
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const stage = createStage(canvas, { maxPixelRatio: 2 });
stage.resize(window.innerWidth, window.innerHeight);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), mat.fabric(PALETTE.cloth));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
stage.scene.add(ground);

// ── layout ──
interface Slot {
  rig: CharacterRig;
  x: number;
  z: number;
  props: THREE.Object3D[];
}
const slots: Slot[] = [];
const people = cast.filter((c) => c.species === 'human');
const pets = cast.filter((c) => c.species !== 'human');
const twoRows = cam === 'sheet' && people.length > 0 && pets.length > 0 && cast.length > 8;
const place = (list: CharacterSpec[], spacing: number, z: number): number => {
  const w = (list.length - 1) * spacing;
  list.forEach((spec, i) => {
    const rig = buildCharacter(spec);
    rig.root.position.set(-w / 2 + i * spacing, 0, z);
    rig.root.rotation.y = yawDeg * Math.PI / 180;
    stage.scene.add(rig.root);
    slots.push({ rig, x: rig.root.position.x, z, props: [] });
  });
  return w;
};
let rowWidth: number;
if (twoRows) {
  rowWidth = Math.max(place(people, 1.42, -1.25), place(pets, 1.72, 0.95));
} else {
  const spacing = cam === 'gameplay' ? 2.6 : cam === 'close' ? 1.75 : 1.55;
  rowWidth = place(cast, spacing, 0);
}

// ── camera ──
const hfovHalf = (): number => Math.atan(Math.tan((stage.camera.fov * Math.PI) / 360) * stage.camera.aspect);
function frame(): void {
  if (cam === 'gameplay') {
    // ~34 world units across at the gameplay plane, same tilt as the game camera
    const d = 17 / Math.tan(hfovHalf());
    stage.camera.position.set(0, 6, d);
    stage.camera.lookAt(0, 4, 0);
    stage.focusShadows(0, 2, 18);
    return;
  }
  const tall = action === 'caught' || carrying || action === 'float' ? 0.5 : 0;
  const w = rowWidth + (cam === 'close' ? 2.2 : 2.0);
  const minW = cam === 'close' ? 3.4 + tall : 5;
  const d = Math.max(w, minW) / 2 / Math.tan(hfovHalf());
  const lift = twoRows ? 0.3 : cam === 'close' ? 0.1 : 0.16;
  const cy = (twoRows ? 0.5 : 0.62) + tall * 0.5;
  stage.camera.position.set(0, cy + d * lift, d);
  stage.camera.lookAt(0, cy, twoRows ? -0.2 : 0);
  stage.focusShadows(0, 0.5, Math.max(8, w / 2 + 2));
}

// ── stand-in props (dev only; the real ones live in the world kit) ──
const basketMat = new THREE.MeshStandardMaterial({ color: '#d7a45f', roughness: 0.85, side: THREE.DoubleSide });
function makeBasket(): THREE.Mesh {
  const pts = [[0.001, 0], [0.34, 0], [0.5, 0.9], [0.46, 0.9], [0.31, 0.045], [0.001, 0.045]].map(([r, y]) => new THREE.Vector2(r, y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), basketMat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function makeUmbrella(): THREE.Group {
  const grp = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8), mat.clay(PALETTE.sponge));
  stick.position.y = 0.5;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.36, 24, 1, true), new THREE.MeshStandardMaterial({ color: PALETTE.coral, roughness: 0.9, side: THREE.DoubleSide }));
  canopy.position.y = 0.95;
  grp.add(stick, canopy);
  grp.traverse((o) => { o.castShadow = true; });
  return grp;
}

// ── drive ──
for (const s of slots) {
  s.rig.setFacing(facing);
  s.rig.setAction(action);
  s.rig.setExpression(expr);
  s.rig.setTilt(tilt);
}

// stats must be measured before the dev props are attached
interface StatRow { id: string; name: string; species: string; triangles: number; drawCalls: number; drawCallsNoShadow: number; bones: number; meshes: number }
function measure(): StatRow[] {
  const rows: StatRow[] = [];
  ground.visible = false;
  for (const s of slots) s.rig.root.visible = false;
  for (const s of slots) {
    let tris = 0;
    let bones = 0;
    let meshes = 0;
    s.rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        meshes++;
        const g = m.geometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        const sk = (m as THREE.SkinnedMesh).skeleton;
        if (sk) bones += sk.bones.length;
      }
    });
    s.rig.root.visible = true;
    stage.key.castShadow = true;
    stage.render();
    const drawCalls = stage.renderer.info.render.calls;
    stage.key.castShadow = false;
    stage.render();
    const drawCallsNoShadow = stage.renderer.info.render.calls;
    stage.key.castShadow = true;
    s.rig.root.visible = false;
    rows.push({ id: s.rig.spec.id, name: s.rig.spec.name, species: s.rig.spec.species, triangles: Math.round(tris), drawCalls, drawCallsNoShadow, bones, meshes });
  }
  for (const s of slots) s.rig.root.visible = true;
  ground.visible = true;
  return rows;
}

function attachProps(): void {
  if (!showProps) return;
  for (const s of slots) {
    if (carrying) {
      const b = makeBasket();
      s.rig.carryAnchor.add(b);
      s.props.push(b);
    }
    if (action === 'caught') {
      const b = makeBasket();
      s.rig.root.add(b);
      s.props.push(b);
    }
    if (action === 'float') {
      const u = makeUmbrella();
      s.rig.umbrellaAnchor.add(u);
      s.props.push(u);
    }
  }
}

// ── labels ──
const labelHost = document.getElementById('labels') as HTMLDivElement;
const labels = slots.map((s) => {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = s.rig.spec.name;
  if (cam === 'close' && slots.length <= 4) {
    const small = document.createElement('small');
    small.textContent = describeSpec(s.rig.spec);
    el.appendChild(small);
  }
  labelHost.appendChild(el);
  return el;
});
const tmp = new THREE.Vector3();
function layoutLabels(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  slots.forEach((s, i) => {
    tmp.set(s.x, -0.04, s.z + 0.25).project(stage.camera);
    labels[i].style.left = `${((tmp.x + 1) / 2) * w}px`;
    labels[i].style.top = `${((1 - tmp.y) / 2) * h + 4}px`;
    labels[i].style.fontSize = cam === 'gameplay' ? '10px' : '';
  });
}

const hud = document.getElementById('hud') as HTMLDivElement;
hud.textContent = `${action} · ${expr}${carrying ? ' · carrying' : ''}${preT !== null ? ` · t=${preT}` : ''}`;

window.__rigs = slots.map((s) => s.rig);
window.__probe = () => slots.map((s) => {
  s.rig.root.updateWorldMatrix(true, true);
  const local = (o: THREE.Object3D): number[] => {
    const v = o.getWorldPosition(new THREE.Vector3());
    s.rig.root.worldToLocal(v);
    return [v.x, v.y, v.z].map((n) => Math.round(n * 1e4) / 1e4);
  };
  return { id: s.rig.spec.id, carryAnchor: local(s.rig.carryAnchor), umbrellaAnchor: local(s.rig.umbrellaAnchor), expectedCarryY: RIG.CARRY_Y };
});

function step(dt: number): void {
  for (const s of slots) s.rig.update(dt, ctx);
}

frame();
if (preT !== null) {
  const n = Math.round(preT * 60);
  for (let i = 0; i < n; i++) step(1 / 60);
  if (n === 0) step(0);
}

if (wantStats) {
  const rows = measure();
  window.__stats = rows;
  const pre = document.getElementById('stats') as HTMLPreElement;
  pre.style.display = 'block';
  pre.textContent = 'character        tris   calls (no shadow)  bones\n' + rows.map((r) =>
    `${r.name.padEnd(14)} ${String(r.triangles).padStart(6)}   ${String(r.drawCalls).padStart(3)}   ${String(r.drawCallsNoShadow).padStart(3)}           ${String(r.bones).padStart(3)}`).join('\n');
}
attachProps();

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (preT === null) step(dt);
  stage.render();
  layoutLabels();
  if (!window.__ready) window.__ready = true;
  requestAnimationFrame(loop);
}
window.addEventListener('resize', () => {
  stage.resize(window.innerWidth, window.innerHeight);
  frame();
});
requestAnimationFrame(loop);

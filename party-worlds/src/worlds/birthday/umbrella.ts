/**
 * Paper cocktail parasol on a toothpick.
 * Origin at the bottom of the handle (the grip). Handle runs +y 0.95; canopy radius 0.95 open.
 *
 * The canopy is folded like the real thing: ribs are fixed-length sticks hinged at the apex and
 * the paper between two ribs has a fixed width, so as the ribs swing down the slack paper tucks
 * inward into pleats. Closing it therefore looks like closing a parasol, not like scaling a cone.
 */
import * as THREE from 'three';
import type { CocktailUmbrella } from '../../kit/contracts';
import { PALETTE, Spring, mat } from '../../kit/materials';
import { umbrellaPrintTexture } from './textures';
import { Batch, clamp, clamp01, lathe, lerp, mixHex, own, seeded, TAU, vcMat } from './util';

/** Gameplay-facing numbers (mirrored by the dev page's debug overlay). */
export const UMBRELLA = {
  handle: 0.95,
  radius: 0.95,
} as const;

const RIBS = 16;
const SPOKES = RIBS * 2;
const ROWS = [0.05, 0.3, 0.55, 0.78, 1.0];
const A_OPEN = (70 * Math.PI) / 180;
const A_TAUT = (76 * Math.PI) / 180;
const A_CLOSED = (10 * Math.PI) / 180;
const RIB_LEN = UMBRELLA.radius / Math.sin(A_OPEN);
const STICK_R = 0.03;

export function buildCocktailUmbrella(color: string = PALETTE.teal): CocktailUmbrella {
  const root = new THREE.Group();
  root.name = 'cocktail-umbrella';

  // ── stick, collars, glossy tip ──
  const wood = '#ecd2a0';
  const stick = new Batch();
  stick.add(lathe([[0.004, 0], [0.02, 0.05], [STICK_R, 0.14], [STICK_R, 0.98], [0.018, 1.04], [0.004, 1.07]], 8), wood);
  stick.add(new THREE.CylinderGeometry(0.062, 0.07, 0.1, 10), PALETTE.paper, { p: [0, UMBRELLA.handle - 0.07, 0] });
  const slider = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10);
  const stickMesh = stick.mesh(vcMat('clay'));
  root.add(stickMesh);
  const sliderMesh = new THREE.Mesh(slider, mat.clay(PALETTE.paper));
  sliderMesh.castShadow = true;
  root.add(sliderMesh);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), mat.glossy(mixHex(color, PALETTE.ink, 0.25)));
  tip.position.y = UMBRELLA.handle + 0.105;
  tip.scale.y = 1.25;
  tip.castShadow = true;
  root.add(tip);

  // ── canopy (shared geometry, printed top + plain underside) ──
  const cols = SPOKES + 1;
  const rows = ROWS.length;
  const pos = new Float32Array((cols * rows + 1) * 3);
  const uv = new Float32Array((cols * rows + 1) * 2);
  const idx: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      uv[k * 2] = i / SPOKES;
      uv[k * 2 + 1] = 1 - ROWS[j]!;
    }
  }
  const apexIndex = cols * rows;
  uv[apexIndex * 2] = 0.5;
  uv[apexIndex * 2 + 1] = 1;
  for (let i = 0; i < SPOKES; i++) {
    // crown fan
    idx.push(apexIndex, i + 1, i);
    for (let j = 0; j < rows - 1; j++) {
      const a = j * cols + i;
      const b = j * cols + i + 1;
      const c = (j + 1) * cols + i;
      const d = (j + 1) * cols + i + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);

  const paperTop = own(mat.clay('#ffffff', { roughness: 0.62, flat: true }));
  paperTop.map = umbrellaPrintTexture(color, RIBS);
  paperTop.side = THREE.FrontSide;
  const underColor = new THREE.Color(mixHex(PALETTE.paper, color, 0.22));
  const paperUnder = own(mat.clay('#ffffff', { roughness: 0.8, flat: true }));
  paperUnder.color.copy(underColor);
  paperUnder.side = THREE.BackSide;
  const top = new THREE.Mesh(geo, paperTop);
  const under = new THREE.Mesh(geo, paperUnder);
  top.castShadow = true;
  top.frustumCulled = false;
  under.frustumCulled = false;
  root.add(top, under);

  // ── rib sticks under the paper ──
  const ribPos = new Float32Array(RIBS * 2 * 3);
  const ribGeo = new THREE.BufferGeometry();
  const ribAttr = new THREE.BufferAttribute(ribPos, 3);
  ribGeo.setAttribute('position', ribAttr);
  const ribs = new THREE.LineSegments(ribGeo, new THREE.LineBasicMaterial({ color: '#b9935c' }));
  ribs.frustumCulled = false;
  root.add(ribs);

  // ── state ──
  const rnd = seeded(0x5eed + color.charCodeAt(1) * 7 + color.charCodeAt(3));
  const ribNoise: number[] = [];
  for (let i = 0; i < RIBS; i++) ribNoise.push(rnd() * 2 - 1);
  const openSpring = new Spring(0, 300, 19);
  let wear = 0;
  let wearShown = -1;
  let lastAlpha = -1;
  let time = 0;
  const white = new THREE.Color('#ffffff');
  const faded = new THREE.Color('#d9d2c8');
  const wash = new THREE.Color('#fff1dc');

  function rebuild(alpha: number, flutter: number): void {
    const sinTaut2 = Math.sin(A_TAUT) ** 2;
    const half = Math.PI / RIBS;
    const ribAngle = (r: number, s: number): number => {
      const n = ribNoise[((r % RIBS) + RIBS) % RIBS]!;
      // worn paper lets the ribs sag, most at the tips, unevenly
      const droop = wear * (0.1 + 0.34 * s * s) * (1 + 0.55 * n);
      const flap = flutter * s * s * Math.sin(time * 23 + r * 1.7) * 0.05;
      return Math.max(0.12, alpha - droop + flap);
    };
    const ribLen = (r: number): number => RIB_LEN * (1 - wear * 0.05 * (0.5 + 0.5 * ribNoise[((r % RIBS) + RIBS) % RIBS]!));
    for (let j = 0; j < rows; j++) {
      const s = ROWS[j]!;
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 3;
        const az = (i / SPOKES) * TAU;
        let rad: number;
        let y: number;
        if (i % 2 === 0) {
          const r = i / 2;
          const a = ribAngle(r, s);
          const len = ribLen(r) * s;
          rad = len * Math.sin(a);
          y = -len * Math.cos(a);
        } else {
          const r0 = (i - 1) / 2;
          const a0 = ribAngle(r0, s);
          const a1 = ribAngle(r0 + 1, s);
          const l0 = ribLen(r0) * s;
          const l1 = ribLen(r0 + 1) * s;
          const a = (a0 + a1) / 2;
          const len = (l0 + l1) / 2;
          const sa = Math.sin(a);
          // slack paper between the ribs folds inward
          const slack = len * Math.sin(half) * Math.sqrt(Math.max(0, sinTaut2 - sa * sa)) + wear * 0.035 * s;
          rad = len * sa * Math.cos(half) - slack * Math.cos(a);
          y = -len * Math.cos(a) - slack * sa;
          const minR = STICK_R + 0.012 + 0.02 * s;
          if (rad < minR) rad = minR;
        }
        pos[k] = rad * Math.cos(az);
        pos[k + 1] = UMBRELLA.handle + y;
        pos[k + 2] = rad * Math.sin(az);
      }
    }
    pos[apexIndex * 3] = 0;
    pos[apexIndex * 3 + 1] = UMBRELLA.handle + 0.012;
    pos[apexIndex * 3 + 2] = 0;
    posAttr.needsUpdate = true;
    geo.computeBoundingSphere();

    for (let r = 0; r < RIBS; r++) {
      const az = (r / RIBS) * TAU;
      const a = ribAngle(r, 1);
      const len = ribLen(r) * 0.985;
      // tucked a hair under the paper
      const rad = len * Math.sin(a) - 0.012 * Math.cos(a);
      const y = -len * Math.cos(a) - 0.012 * Math.sin(a);
      const o = r * 6;
      ribPos[o] = 0;
      ribPos[o + 1] = UMBRELLA.handle - 0.03;
      ribPos[o + 2] = 0;
      ribPos[o + 3] = rad * Math.cos(az);
      ribPos[o + 4] = UMBRELLA.handle + y;
      ribPos[o + 5] = rad * Math.sin(az);
    }
    ribAttr.needsUpdate = true;
  }

  function applyWear(): void {
    paperTop.color.copy(white).lerp(faded, wear * 0.75);
    paperTop.emissive.copy(wash);
    paperTop.emissiveIntensity = wear * 0.22;
    paperUnder.color.copy(underColor).lerp(faded, wear * 0.6);
    wearShown = wear;
  }

  function refresh(force: boolean): void {
    const o = openSpring.value;
    // a worn parasol no longer opens all the way
    const full = A_OPEN - wear * 0.1;
    const alpha = clamp(lerp(A_CLOSED, full, o), A_CLOSED * 0.9, A_TAUT + 0.07);
    const moving = Math.abs(openSpring.velocity) > 0.02;
    const flutter = clamp01(o) * (0.25 + 0.75 * wear);
    if (force || moving || flutter > 0.01 || Math.abs(alpha - lastAlpha) > 1e-4) {
      rebuild(alpha, flutter);
      lastAlpha = alpha;
    }
    // the runner slides up the stick as the canopy opens
    sliderMesh.position.y = lerp(0.3, 0.62, clamp01(o));
    if (wearShown !== wear) applyWear();
  }
  refresh(true);

  return {
    root,
    setOpen(open01: number): void {
      openSpring.target = clamp01(open01);
    },
    setWear(wear01: number): void {
      wear = clamp01(wear01);
    },
    update(dt: number): void {
      time += dt;
      openSpring.update(dt);
      refresh(false);
    },
  };
}

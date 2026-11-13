/**
 * Party balloon on a string, weighted by a wrapped sweet.
 * Origin at the balloon centre. The simulation treats it as a circle of `radius`; the visual is
 * slightly taller than wide (top at 1.08 r, knot at -1.3 r) and exactly 2 r across.
 *
 * The string's lower end — the top of the sweet — is at local y = -(radius + stringLength).
 * The sweet is BALLOON_WEIGHT_HEIGHT tall, so to rest it on the table (y = 0) use
 *   stringLength = balloonY - radius - BALLOON_WEIGHT_HEIGHT.
 */
import * as THREE from 'three';
import type { Balloon } from '../../kit/contracts';
import { PALETTE, Spring, mat } from '../../kit/materials';
import { Batch, PolyTube, clamp01, lathe, lerp, mixHex, paintBy, seeded, smoothProfile, smoothstep, vcMat } from './util';

export const BALLOON_WEIGHT_HEIGHT = 0.44;

const STRING_POINTS = 14;

export function buildBalloon(radius: number, color: string, stringLength: number): Balloon & { pop(instant?: boolean): void } {
  const root = new THREE.Group();
  root.name = 'balloon';
  const r = radius;
  const rnd = seeded(Math.round(r * 977) + color.charCodeAt(2) * 31 + Math.round(stringLength * 13));
  const phase = rnd() * 10;

  // ── body ──
  const body = new THREE.Group();
  root.add(body);
  const profile = smoothProfile([
    [0, 1.08], [0.3, 1.035], [0.58, 0.9], [0.82, 0.66], [0.96, 0.36], [1.0, 0.04], [0.95, -0.28],
    [0.8, -0.6], [0.58, -0.88], [0.36, -1.07], [0.17, -1.19], [0.075, -1.25],
  ], 20).map(([x, y]) => [x * r, y * r] as [number, number]);
  const rubber = mat.glossy(color, { roughness: 0.16 });
  const skin = new THREE.Mesh(lathe(profile.reverse(), 32), rubber);
  skin.castShadow = true;
  body.add(skin);
  const dark = mixHex(color, PALETTE.ink, 0.18);
  const knotBatch = new Batch();
  // rolled lip + pinched knot
  knotBatch.add(new THREE.TorusGeometry(0.085 * r, 0.035 * r, 6, 14), dark, { r: [Math.PI / 2, 0, 0], p: [0, -1.255 * r, 0] });
  knotBatch.add(lathe([[0.001, -1.34 * r], [0.07 * r, -1.33 * r], [0.05 * r, -1.28 * r], [0.03 * r, -1.25 * r]], 10), dark);
  const knot = knotBatch.mesh(vcMat('glossy'));
  body.add(knot);
  const knotY = -1.33 * r;

  // ── weight: a wrapped sweet lying on the cloth ──
  const weightTopY = -(r + stringLength);
  const weight = new THREE.Group();
  weight.position.set(0, weightTopY - BALLOON_WEIGHT_HEIGHT * 0.5, 0);
  const candyColor = mixHex(color, '#ffffff', 0.1);
  const candy = new THREE.SphereGeometry(0.22, 18, 12);
  candy.scale(1.45, 1, 1);
  paintBy(candy, (x, _y, _z, out) => {
    // spiral candy stripes
    out.set(Math.sin(x * 26 + _y * 14) > 0.15 ? PALETTE.frostingWhite : candyColor);
  });
  const wb = new Batch();
  wb.add(candy, null);
  for (const side of [-1, 1]) {
    // twisted cellophane ends
    const fan = lathe([[0.03, 0], [0.06, 0.06], [0.17, 0.2], [0.2, 0.24]], 10);
    wb.add(fan, PALETTE.frostingWhite, { r: [0, 0, side * -Math.PI / 2], p: [side * 0.29, 0, 0] });
  }
  const weightMesh = wb.mesh(vcMat('glossy', THREE.DoubleSide));
  weight.rotation.y = 0.5 + rnd() * 0.8;
  weight.add(weightMesh);
  root.add(weight);
  const groundY = weightTopY - BALLOON_WEIGHT_HEIGHT;

  // ── string ──
  const string = new PolyTube(STRING_POINTS, 0.022, 4);
  const stringMesh = new THREE.Mesh(string.geo, mat.fabric(PALETTE.paper));
  stringMesh.frustumCulled = false;
  stringMesh.castShadow = true;
  root.add(stringMesh);

  // ── what is left after a pop ──
  const scrap = new THREE.Group();
  const scrapGeo = new THREE.SphereGeometry(0.2 * r, 9, 7);
  {
    const p = scrapGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const k = 0.62 + rnd() * 0.5;
      p.setXYZ(i, p.getX(i) * k * 1.3, p.getY(i) * k * 0.55 - 0.05 * r, p.getZ(i) * k);
    }
    scrapGeo.computeVertexNormals();
  }
  const scrapMesh = new THREE.Mesh(scrapGeo, rubber);
  scrapMesh.castShadow = true;
  scrap.add(scrapMesh);
  scrap.visible = false;
  root.add(scrap);

  // burst shards: one small buffer of triangles
  const SHARDS = 9;
  const shardPos = new Float32Array(SHARDS * 9);
  const shardGeo = new THREE.BufferGeometry();
  const shardAttr = new THREE.BufferAttribute(shardPos, 3);
  shardGeo.setAttribute('position', shardAttr);
  const shardMat = rubber.clone();
  shardMat.side = THREE.DoubleSide;
  shardMat.transparent = true;
  const shards = new THREE.Mesh(shardGeo, shardMat);
  shards.frustumCulled = false;
  shards.visible = false;
  root.add(shards);
  const shardDir: Array<{ a: number; z: number; sp: number; spin: number; size: number }> = [];
  for (let i = 0; i < SHARDS; i++) {
    shardDir.push({ a: (i / SHARDS) * Math.PI * 2 + rnd() * 0.5, z: (rnd() - 0.5) * 0.8, sp: 6 + rnd() * 6, spin: 8 + rnd() * 14, size: (0.22 + rnd() * 0.2) * r });
  }
  // pop flash: a quick expanding ring of the balloon's own colour
  const flashMat = new THREE.MeshBasicMaterial({ color: mixHex(color, '#ffffff', 0.6), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const flash = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 28), flashMat);
  flash.visible = false;
  root.add(flash);

  // ── state ──
  const offX = new Spring(0, 62, 6.2);
  const offY = new Spring(0, 78, 6.6);
  const squash = new Spring(0, 300, 11);
  let time = 0;
  let popped = false;
  let popT = 0;
  const fallDir = rnd() < 0.5 ? -1 : 1;
  const top = new THREE.Vector3();
  const bottom = new THREE.Vector3(0, weightTopY + 0.03, 0);

  function hangingPoint(u: number, out: THREE.Vector3): void {
    // u: 0 at the sweet, 1 at the knot. Leaves the sweet vertically, curves to meet the knot.
    const k = u * u * (3 - 2 * u);
    out.set(lerp(bottom.x, top.x, k * k * 0.6 + k * 0.4), lerp(bottom.y, top.y, u), lerp(bottom.z, top.z, k));
  }
  function fallenPoint(u: number, out: THREE.Vector3): void {
    // a loose squiggle of string lying on the cloth beside the sweet
    const reach = Math.min(stringLength * 0.42, 2.4);
    const down = smoothstep(0, 0.22, u);
    out.set(
      fallDir * (0.32 + reach * u + 0.16 * Math.sin(u * 11)),
      lerp(bottom.y, groundY + 0.03, down),
      0.38 * Math.sin(u * 7.5 + 0.6) * u + 0.1,
    );
  }

  const hp = new THREE.Vector3();
  const fp = new THREE.Vector3();
  function updateString(): void {
    for (let i = 0; i < STRING_POINTS; i++) {
      const u = i / (STRING_POINTS - 1);
      const p = string.points[i]!;
      hangingPoint(u, hp);
      if (!popped) {
        p.copy(hp);
        continue;
      }
      fallenPoint(u, fp);
      // every bit of string free-falls from where it hung, upper parts take longer
      const drop = Math.max(0.0001, hp.y - fp.y);
      const tFall = Math.sqrt((2 * drop) / 34);
      const k = clamp01(popT / (tFall + 0.05));
      const e = k * k;
      p.set(lerp(hp.x, fp.x, smoothstep(0, 1, k)), hp.y - drop * e, lerp(hp.z, fp.z, smoothstep(0, 1, k)));
    }
    string.update();
    if (popped) {
      const end = string.points[STRING_POINTS - 1]!;
      scrap.position.copy(end);
      scrap.position.y += 0.05 * r;
    }
  }

  function updateShards(): void {
    const life = 0.55;
    const k = popT / life;
    if (k >= 1) {
      shards.visible = false;
      flash.visible = false;
      return;
    }
    for (let i = 0; i < SHARDS; i++) {
      const d = shardDir[i]!;
      const dist = r * 0.6 + d.sp * popT * (1 - 0.45 * k);
      const cx = Math.cos(d.a) * dist;
      const cy = Math.sin(d.a) * dist - 9 * popT * popT;
      const cz = d.z * dist;
      const sz = d.size * (1 - k * 0.7);
      const rot = d.spin * popT + i;
      for (let v = 0; v < 3; v++) {
        const ang = rot + (v / 3) * Math.PI * 2;
        const o = (i * 3 + v) * 3;
        shardPos[o] = cx + Math.cos(ang) * sz;
        shardPos[o + 1] = cy + Math.sin(ang) * sz * 0.7;
        shardPos[o + 2] = cz + Math.sin(ang + 1) * sz * 0.5;
      }
    }
    shardAttr.needsUpdate = true;
    shardGeo.computeVertexNormals();
    shardMat.opacity = 1 - k * k;
    const fk = clamp01(popT / 0.22);
    flash.scale.setScalar(r * (0.9 + 1.5 * fk));
    flashMat.opacity = 0.85 * (1 - fk);
    flash.visible = fk < 1;
  }

  const api = {
    root,
    get popped(): boolean {
      return popped;
    },
    bump(dx: number, dy: number): void {
      if (popped) return;
      const len = Math.hypot(dx, dy) || 1;
      offX.kick((dx / len) * 4.6);
      offY.kick((dy / len) * 4.2);
      squash.kick(7.5);
    },
    pop(instant = false): void {
      if (popped) return;
      popped = true;
      popT = instant ? 5 : 0;
      body.visible = false;
      scrap.visible = true;
      scrap.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      shards.visible = !instant;
      flash.visible = !instant;
      top.set(offX.value, knotY + offY.value, 0);
    },
    update(dt: number): void {
      time += dt;
      if (!popped) {
        const ox = offX.update(dt) + Math.sin(time * 0.9 + phase) * 0.07 * r;
        const oy = offY.update(dt) + Math.sin(time * 1.37 + phase * 1.7) * 0.05 * r;
        const sq = squash.update(dt);
        body.position.set(ox, oy, 0);
        // leans away from a shove, pivoting on its string
        body.rotation.z = -ox * 0.32 / r + Math.sin(time * 0.7 + phase) * 0.035;
        body.scale.set(1 + sq * 0.06, 1 - sq * 0.07, 1 + sq * 0.06);
        const c = Math.cos(body.rotation.z);
        const s = Math.sin(body.rotation.z);
        top.set(ox - knotY * s, oy + knotY * c, 0);
      } else {
        popT += dt;
        updateShards();
      }
      updateString();
    },
  };
  api.update(0);
  return api;
}

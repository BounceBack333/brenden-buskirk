/**
 * Backyard Dash — what a combat race adds to the picture: tracers, blast flashes, mines on the
 * road, mine crates and the repair strip. Presentation only: it reads race state and never
 * writes it.
 */
import * as THREE from 'three';
import { COMBAT } from './combat';
import type { ItemName } from './combat';
import type { RaceState } from './sim';
import type { Track } from './track';

const TRACERS = 40;
const FLASHES = 5;
const SCORCHES = 14;
const ROCKETS = 8;
const RINGS = 3;

/** One colour per thing, the same on the crate, the button and the minimap. */
const ITEM_HEX: Readonly<Record<ItemName, string>> = { mine: '#ff3b3b', rocket: '#ff8a2e', shock: '#b06bff', shield: '#3db8ff', overdrive: '#ffd23d' };

/** The face of a crate: a dark panel with a glyph that says what is inside. */
function emblem(item: ItemName): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const g = c.getContext('2d')!;
  const col = ITEM_HEX[item];
  g.fillStyle = '#15161d';
  g.fillRect(0, 0, 96, 96);
  g.strokeStyle = col;
  g.lineWidth = 8;
  g.strokeRect(5, 5, 86, 86);
  g.fillStyle = col;
  g.strokeStyle = col;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 9;
  g.beginPath();
  if (item === 'mine') {
    g.arc(48, 50, 17, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.moveTo(48 + Math.cos(a) * 17, 50 + Math.sin(a) * 17);
      g.lineTo(48 + Math.cos(a) * 29, 50 + Math.sin(a) * 29);
    }
    g.stroke();
  } else if (item === 'rocket') {
    g.moveTo(48, 16);
    g.lineTo(64, 42);
    g.lineTo(64, 70);
    g.lineTo(32, 70);
    g.lineTo(32, 42);
    g.closePath();
    g.fill();
    g.moveTo(34, 78);
    g.lineTo(26, 86);
    g.moveTo(62, 78);
    g.lineTo(70, 86);
    g.stroke();
  } else if (item === 'shock') {
    g.moveTo(56, 14);
    g.lineTo(30, 52);
    g.lineTo(48, 52);
    g.lineTo(40, 82);
    g.lineTo(68, 42);
    g.lineTo(50, 42);
    g.closePath();
    g.fill();
  } else if (item === 'shield') {
    g.moveTo(48, 16);
    g.lineTo(74, 26);
    g.lineTo(72, 54);
    g.quadraticCurveTo(64, 74, 48, 82);
    g.quadraticCurveTo(32, 74, 24, 54);
    g.lineTo(22, 26);
    g.closePath();
    g.stroke();
  } else {
    // overdrive: go, and then some
    for (const x of [24, 46]) {
      g.moveTo(x, 22);
      g.lineTo(x + 24, 48);
      g.lineTo(x, 74);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const X_AXIS = new THREE.Vector3(1, 0, 0);

function stripes(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffb52e';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#17181f';
  for (let i = -64; i < 128; i += 22) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 11, 0);
    g.lineTo(i + 11 - 64, 64);
    g.lineTo(i - 64, 64);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function chevrons(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 9;
  g.lineJoin = 'miter';
  // a plus sign: the universal "this mends you"
  g.beginPath();
  g.moveTo(32, 14);
  g.lineTo(32, 50);
  g.moveTo(14, 32);
  g.lineTo(50, 32);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Red and white chevrons pointing left: the outside of a corner, the way racing circuits mark it. */
function arrows(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#16161c';
  g.fillRect(0, 0, 256, 96);
  for (let i = 0; i < 4; i++) {
    const x = 34 + i * 62;
    g.fillStyle = i % 2 ? '#f4f1e8' : '#ff3030';
    g.beginPath();
    g.moveTo(x + 26, 8);
    g.lineTo(x - 6, 48);
    g.lineTo(x + 26, 88);
    g.lineTo(x + 2, 88);
    g.lineTo(x - 30, 48);
    g.lineTo(x + 2, 8);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function disc(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

interface MineModel {
  root: THREE.Group;
  lamp: THREE.Mesh;
  pool: THREE.Mesh;
}

export class CombatFx {
  readonly root = new THREE.Group();
  private tracers: THREE.InstancedMesh;
  private tLife = new Float32Array(TRACERS);
  /** not yet drawn: however slow the frame rate, every round is seen once */
  private tFresh = new Uint8Array(TRACERS);
  private tNext = 0;
  private tDummy = new THREE.Object3D();
  private flashes: { mesh: THREE.Mesh; t: number; size: number; fresh: boolean }[] = [];
  private fNext = 0;
  private mines: MineModel[] = [];
  private scorches: THREE.Mesh[] = [];
  private sNext = 0;
  private rockets: { root: THREE.Group; flame: THREE.Mesh }[] = [];
  private bubbles: THREE.Mesh[] = [];
  private rings: { mesh: THREE.Mesh; t: number; fresh: boolean; reach: number }[] = [];
  private rNext = 0;
  private emblems = new Map<ItemName, THREE.CanvasTexture>();
  private crates: THREE.Group[] = [];
  private pickups = new THREE.Group();
  /** what makes the yard an arena when the karts are armed: fires, chevrons */
  private arena = new THREE.Group();
  private fires: { flames: THREE.Mesh[]; pool: THREE.Mesh; seed: number }[] = [];
  private strip: THREE.Mesh | null = null;
  private readonly dir = new THREE.Vector3();
  private readonly glow = disc();
  private readonly hazard = stripes();
  private readonly plus = chevrons();
  private readonly chev = arrows();

  constructor(track: Track) {
    const tracerMat = new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0), tracerMat, TRACERS);
    this.tracers.frustumCulled = false;
    this.tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tDummy.scale.set(0, 0, 0);
    this.tDummy.updateMatrix();
    for (let i = 0; i < TRACERS; i++) this.tracers.setMatrixAt(i, this.tDummy.matrix);
    this.root.add(this.tracers);

    for (let i = 0; i < FLASHES; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 2),
        new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
      );
      mesh.visible = false;
      this.root.add(mesh);
      this.flashes.push({ mesh, t: 0, size: 1, fresh: false });
    }

    const shell = new THREE.MeshStandardMaterial({ color: '#23252d', roughness: 0.55, metalness: 0.5 });
    // big enough to read from a kart doing sixteen units a second
    const shellGeo = new THREE.CylinderGeometry(0.46, 0.6, 0.22, 12).translate(0, 0.11, 0);
    const lampGeo = new THREE.SphereGeometry(0.2, 10, 8).translate(0, 0.3, 0);
    const poolGeo = new THREE.PlaneGeometry(4.2, 4.2).rotateX(-Math.PI / 2).translate(0, 0.04, 0);
    for (let i = 0; i < COMBAT.maxMines; i++) {
      const root = new THREE.Group();
      const lamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: '#ff3b3b', toneMapped: false }));
      const pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: this.glow, color: '#ff2a2a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
      pool.renderOrder = 3;
      root.add(new THREE.Mesh(shellGeo, shell), lamp, pool);
      root.visible = false;
      this.root.add(root);
      this.mines.push({ root, lamp, pool });
    }

    // what a blast leaves on the road: the yard remembers where it happened until the next race
    const burn = new THREE.MeshBasicMaterial({ map: this.glow, color: '#000000', transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false });
    const burnGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < SCORCHES; i++) {
      const m = new THREE.Mesh(burnGeo, burn);
      m.visible = false;
      m.renderOrder = 1;
      this.root.add(m);
      this.scorches.push(m);
    }

    // rockets: a stubby body with a flame, pooled
    const bodyGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8).rotateZ(-Math.PI / 2);
    const noseGeo = new THREE.ConeGeometry(0.16, 0.34, 8).rotateZ(-Math.PI / 2).translate(0.62, 0, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#d9dde6', roughness: 0.4, metalness: 0.6 });
    const noseMat = new THREE.MeshBasicMaterial({ color: ITEM_HEX.rocket, toneMapped: false });
    const jetGeo = new THREE.ConeGeometry(0.22, 1.5, 7).rotateZ(Math.PI / 2).translate(-1.15, 0, 0);
    const jetMat = new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    for (let i = 0; i < ROCKETS; i++) {
      const root = new THREE.Group();
      const flame = new THREE.Mesh(jetGeo, jetMat);
      root.add(new THREE.Mesh(bodyGeo, bodyMat), new THREE.Mesh(noseGeo, noseMat), flame);
      root.visible = false;
      this.root.add(root);
      this.rockets.push({ root, flame });
    }
    // the shield: a bubble round a kart (one each; the view says where)
    const bubbleGeo = new THREE.IcosahedronGeometry(1.45, 2);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(bubbleGeo, new THREE.MeshBasicMaterial({ color: ITEM_HEX.shield, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.FrontSide }));
      m.visible = false;
      m.renderOrder = 4;
      this.root.add(m);
      this.bubbles.push(m);
    }
    // the shockwave: a ring that runs out along the ground
    const ringGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: ITEM_HEX.shock, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.root.add(mesh);
      this.rings.push({ mesh, t: 0, fresh: false, reach: 1 });
    }

    this.root.add(this.pickups, this.arena);
    this.setTrack(track);
  }

  /** Crates and the repair strip belong to a circuit: build this one's. */
  setTrack(track: Track): void {
    for (const o of [...this.pickups.children]) {
      this.pickups.remove(o);
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    for (const o of [...this.arena.children]) {
      this.arena.remove(o);
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    this.crates = [];
    this.fires = [];
    this.strip = null;
    this.dress(track);
    const kit = track.combat;
    if (!kit) return;

    for (const c of kit.crates) {
      const g = new THREE.Group();
      // every face says what is inside, in that thing's colour
      let face = this.emblems.get(c.item);
      if (!face) {
        face = emblem(c.item);
        this.emblems.set(c.item, face);
      }
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), new THREE.MeshBasicMaterial({ map: face, toneMapped: false }));
      box.position.y = 1.05;
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: this.glow, color: ITEM_HEX[c.item], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
      );
      pool.position.y = 0.05;
      pool.renderOrder = 3;
      g.add(box, pool);
      g.position.set(c.x, 0, c.z);
      this.pickups.add(g);
      this.crates.push(g);
    }

    // the repair strip: a band of green light laid along the road wherever it runs through the zone
    const r = kit.repair;
    const S = track.samples;
    const inside = (i: number): boolean => {
      const p = S[(i + S.length) % S.length]!;
      return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
    };
    const pos: number[] = [];
    const uv: number[] = [];
    let run = 0;
    for (let i = 0; i < S.length; i++) {
      if (!inside(i) || !inside(i + 1)) continue;
      const a = S[i]!;
      const b = S[(i + 1) % S.length]!;
      const wa = a.hw * 0.92;
      const wb = b.hw * 0.92;
      const quad = [
        [a.x + a.tz * wa, a.z - a.tx * wa, 0, run], [a.x - a.tz * wa, a.z + a.tx * wa, 1, run],
        [b.x + b.tz * wb, b.z - b.tx * wb, 0, run + 0.25], [b.x - b.tz * wb, b.z + b.tx * wb, 1, run + 0.25],
      ] as const;
      for (const n of [0, 1, 2, 2, 1, 3]) {
        pos.push(quad[n]![0], 0.07, quad[n]![1]);
        uv.push(quad[n]![2] * 2, quad[n]![3]);
      }
      run += 0.25;
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      this.strip = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.plus, color: '#3dff9a', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      this.strip.renderOrder = 2;
      // a solid wash underneath, so the strip reads from a distance as well as up close
      const wash = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#1fbf6c', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
      wash.renderOrder = 2;
      this.pickups.add(wash, this.strip);
    }
  }

  /**
   * Arena dressing, all of it where no kart can go (the track says where), so nothing here
   * needs to be solid: fires burning in old tin cans, and chevron boards round the outside of
   * the hairpins.
   */
  private dress(track: Track): void {
    const kit = track.combat;
    if (!kit) return;
    const tin = new THREE.MeshStandardMaterial({ color: '#4a3528', roughness: 0.85, metalness: 0.45 });
    const band = new THREE.MeshStandardMaterial({ map: this.hazard, roughness: 0.7, metalness: 0.2 });
    const ember = new THREE.MeshBasicMaterial({ color: '#ffb14a', toneMapped: false });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a2e', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: '#ffe39a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    const canGeo = new THREE.CylinderGeometry(0.95, 0.85, 1.9, 14, 1, true).translate(0, 0.95, 0);
    const bandGeo = new THREE.CylinderGeometry(0.97, 0.97, 0.45, 14, 1, true).translate(0, 1.15, 0);
    const emberGeo = new THREE.CircleGeometry(0.86, 14).rotateX(-Math.PI / 2).translate(0, 1.7, 0);
    const flameGeo = new THREE.ConeGeometry(0.62, 2.2, 7).translate(0, 1.1, 0);
    const coreGeo = new THREE.ConeGeometry(0.36, 1.5, 6).translate(0, 0.75, 0);
    const fire = (x: number, z: number, y = 0, size = 1): void => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.scale.setScalar(size);
      if (y === 0) {
        const can = new THREE.Mesh(canGeo, tin);
        can.material.side = THREE.DoubleSide;
        g.add(can, new THREE.Mesh(bandGeo, band));
      }
      // (a raised fire burns in something the world kit has already drawn: only the embers and flames)
      g.add(new THREE.Mesh(emberGeo, ember));
      const flames: THREE.Mesh[] = [];
      for (const [fx, fz, mat, geo] of [[0, 0, flameMat, flameGeo], [0.28, 0.15, flameMat, flameGeo], [-0.2, -0.22, coreMat, coreGeo]] as const) {
        const f = new THREE.Mesh(geo, mat);
        f.position.set(fx, 1.75, fz);
        g.add(f);
        flames.push(f);
      }
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: this.glow, color: '#ff7a2e', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
      );
      pool.position.y = (0.06 - y) / size; // on the floor, however high the fire is
      pool.renderOrder = 2;
      g.add(pool);
      this.arena.add(g);
      this.fires.push({ flames, pool, seed: x * 0.37 + z * 0.61 });
    };
    for (const f of kit.fires ?? []) fire(f.x, f.z, f.y ?? 0, f.size ?? 1);
    const boardGeo = new THREE.PlaneGeometry(6.4, 2.4);
    const boardMat = new THREE.MeshBasicMaterial({ map: this.chev, toneMapped: false });
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6).translate(0, 1.2, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: '#2a2c36', roughness: 0.6, metalness: 0.6 });
    for (const b of kit.boards ?? []) {
      const board = new THREE.Group();
      board.position.set(b.x, 0, b.z);
      board.lookAt(b.fx, 0, b.fz);
      const face = new THREE.Mesh(boardGeo, boardMat);
      face.position.y = 2.9;
      const p1 = new THREE.Mesh(postGeo, postMat);
      p1.position.set(-2.6, 0, -0.08);
      const p2 = new THREE.Mesh(postGeo, postMat);
      p2.position.set(2.6, 0, -0.08);
      board.add(face, p1, p2);
      this.arena.add(board);
    }
  }

  /** Crates, the strip and the arena dressing are part of the yard only when weapons are on. */
  setArmed(on: boolean): void {
    this.pickups.visible = on;
    this.arena.visible = on;
    if (!on) for (const m of this.mines) m.root.visible = false;
  }

  tracer(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const i = this.tNext;
    this.tNext = (this.tNext + 1) % TRACERS;
    const d = this.tDummy;
    this.dir.set(x1 - x0, y1 - y0, z1 - z0);
    const len = this.dir.length() || 1;
    d.position.set(x0, y0, z0);
    d.quaternion.setFromUnitVectors(X_AXIS, this.dir.multiplyScalar(1 / len));
    d.scale.set(len, 0.11, 0.11);
    d.updateMatrix();
    this.tracers.setMatrixAt(i, d.matrix);
    this.tracers.instanceMatrix.needsUpdate = true;
    this.tLife[i] = 0.07;
    this.tFresh[i] = 1;
  }

  /** Leave a burn on the ground here. The oldest goes when there are too many. */
  scorch(x: number, z: number, size: number): void {
    const m = this.scorches[this.sNext]!;
    this.sNext = (this.sNext + 1) % SCORCHES;
    m.position.set(x, 0.045 + this.sNext * 0.0004, z);
    m.scale.set(size, 1, size);
    m.rotation.y = x * 1.7 + z;
    m.visible = true;
  }

  /** A new race starts on a clean road. */
  clearScorches(): void {
    for (const m of this.scorches) m.visible = false;
    for (const b of this.bubbles) b.visible = false;
  }

  /** A shockwave leaves here and runs out to `reach`. */
  ring(x: number, z: number, reach: number): void {
    const r = this.rings[this.rNext]!;
    this.rNext = (this.rNext + 1) % RINGS;
    r.mesh.position.set(x, 0.12, z);
    r.mesh.visible = true;
    r.t = 0.45;
    r.fresh = true;
    r.reach = reach;
  }

  /** Put (or take away) the shield bubble round kart `seat`. */
  bubble(seat: number, on: boolean, x: number, y: number, z: number, time: number, fading: boolean): void {
    const m = this.bubbles[seat];
    if (!m) return;
    m.visible = on && (!fading || Math.sin(time * 26) > -0.3); // it flickers before it goes
    if (!on) return;
    m.position.set(x, y + 0.75, z);
    m.rotation.y = time * 0.9;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.05 * Math.sin(time * 7 + seat);
  }

  flash(x: number, y: number, z: number, size: number): void {
    const f = this.flashes[this.fNext]!;
    this.fNext = (this.fNext + 1) % FLASHES;
    f.mesh.position.set(x, y, z);
    f.mesh.visible = true;
    f.t = 0.3;
    f.size = size;
    f.fresh = true;
  }

  /** Follow the race: mines on the road, which crates are there, and the passing of time. */
  update(s: RaceState | null, dt: number, time: number): void {
    // tracers: gone almost as soon as seen
    let dirty = false;
    for (let i = 0; i < TRACERS; i++) {
      if (this.tLife[i]! <= 0) continue;
      if (this.tFresh[i]) {
        this.tFresh[i] = 0;
        continue;
      }
      this.tLife[i] = this.tLife[i]! - dt;
      if (this.tLife[i]! <= 0) {
        this.tDummy.scale.set(0, 0, 0);
        this.tDummy.updateMatrix();
        this.tracers.setMatrixAt(i, this.tDummy.matrix);
        dirty = true;
      }
    }
    if (dirty) this.tracers.instanceMatrix.needsUpdate = true;

    for (const f of this.flashes) {
      if (f.t <= 0) continue;
      if (f.fresh) f.fresh = false;
      else f.t -= dt;
      if (f.t <= 0) {
        f.mesh.visible = false;
        continue;
      }
      const k = 1 - f.t / 0.3;
      f.mesh.scale.setScalar(f.size * (0.35 + 0.9 * k));
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k) * (1 - k);
    }

    for (let i = 0; i < this.crates.length; i++) {
      const g = this.crates[i]!;
      const ready = !s || !s.combat || s.tick >= (s.crateReady[i] ?? 0);
      g.visible = ready;
      const box = g.children[0]!;
      box.rotation.y = time * 1.4 + i;
      box.position.y = 1.05 + Math.sin(time * 2.6 + i * 2) * 0.12;
    }
    if (this.strip) (this.strip.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.2 * Math.sin(time * 3.2);
    if (this.strip) this.plus.offset.y = -time * 0.6;

    for (const r of this.rings) {
      if (r.t <= 0) continue;
      if (r.fresh) r.fresh = false;
      else r.t -= dt;
      if (r.t <= 0) {
        r.mesh.visible = false;
        continue;
      }
      const k = 1 - r.t / 0.45;
      r.mesh.scale.setScalar(1 + (r.reach - 1) * k);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }

    for (let i = 0; i < this.rockets.length; i++) {
      const model = this.rockets[i]!;
      const rk = s && s.combat ? s.rockets[i] : undefined;
      if (!rk) {
        model.root.visible = false;
        continue;
      }
      model.root.visible = true;
      model.root.position.set(rk.x, 0.75, rk.z);
      model.root.rotation.y = -Math.atan2(rk.dz, rk.dx);
      model.flame.scale.set(0.8 + 0.4 * Math.sin(time * 60 + i), 1, 1);
    }

    // fires: flames lick, the light on the ground breathes
    for (const f of this.fires) {
      const t = time * 9 + f.seed * 7;
      f.flames.forEach((m, n) => {
        const k = 0.8 + 0.28 * Math.sin(t * (1 + n * 0.23) + n * 2.1);
        m.scale.set(0.85 + 0.2 * Math.sin(t * 1.7 + n), k + 0.25 * Math.abs(Math.sin(t * 0.63 + n * 1.3)), 0.85 + 0.2 * Math.cos(t * 1.3 + n));
        m.rotation.y = t * 0.2 + n;
      });
      (f.pool.material as THREE.MeshBasicMaterial).opacity = 0.34 + 0.1 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 2.7);
    }

    for (let i = 0; i < this.mines.length; i++) {
      const model = this.mines[i]!;
      const mine = s && s.combat ? s.mines[i] : undefined;
      if (!mine) {
        model.root.visible = false;
        continue;
      }
      model.root.visible = true;
      model.root.position.set(mine.x, 0, mine.z);
      // a slow pulse while it arms, an urgent blink once live
      const armed = s!.tick >= mine.armTick;
      const on = armed ? Math.sin(time * 22 + mine.id) > -0.2 : Math.sin(time * 6) > 0;
      model.lamp.visible = on;
      (model.pool.material as THREE.MeshBasicMaterial).opacity = armed ? (on ? 0.8 : 0.4) : 0.2;
    }
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.glow.dispose();
    this.hazard.dispose();
    this.plus.dispose();
    this.chev.dispose();
    for (const t of this.emblems.values()) t.dispose();
  }
}

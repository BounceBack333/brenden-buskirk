/**
 * Backyard Dash — what a combat race adds to the picture: tracers, blast flashes, mines on the
 * road, mine crates and the repair strip. Presentation only: it reads race state and never
 * writes it.
 */
import * as THREE from 'three';
import { COMBAT } from './combat';
import type { RaceState } from './sim';
import type { Track } from './track';

const TRACERS = 40;
const FLASHES = 5;
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
  private crates: THREE.Group[] = [];
  private pickups = new THREE.Group();
  private strip: THREE.Mesh | null = null;
  private readonly dir = new THREE.Vector3();
  private readonly glow = disc();
  private readonly hazard = stripes();
  private readonly plus = chevrons();

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

    this.root.add(this.pickups);
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
    this.crates = [];
    this.strip = null;
    const kit = track.combat;
    if (!kit) return;

    const boxMat = new THREE.MeshStandardMaterial({ map: this.hazard, roughness: 0.6, metalness: 0.1, emissive: '#ffb52e', emissiveMap: this.hazard, emissiveIntensity: 0.35 });
    for (const c of kit.crates) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), boxMat);
      box.position.y = 0.95;
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 4.4).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: this.glow, color: '#ffb52e', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
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

  /** Crates and the strip are part of the yard only when weapons are on. */
  setArmed(on: boolean): void {
    this.pickups.visible = on;
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
      box.rotation.x = 0.35;
      box.position.y = 0.95 + Math.sin(time * 2.6 + i * 2) * 0.12;
    }
    if (this.strip) (this.strip.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.2 * Math.sin(time * 3.2);
    if (this.strip) this.plus.offset.y = -time * 0.6;

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
  }
}

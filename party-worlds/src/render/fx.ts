/**
 * Pooled particles. Two instanced meshes (paper rectangles and round dots), fixed capacity,
 * zero allocation per frame. Purely cosmetic: nothing reads particle state back.
 */
import * as THREE from 'three';

interface Particle {
  alive: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  spin: number;
  flip: number;
  flipSpeed: number;
  grow: number;
}

class Pool {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private cursor = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(geo: THREE.BufferGeometry, private capacity: number, private flips: boolean) {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.count = capacity;
    for (let i = 0; i < capacity; i++) {
      this.parts.push({
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0,
        life: 0, maxLife: 1, size: 1, rot: 0, spin: 0, flip: 0, flipSpeed: 0, grow: 0,
      });
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set('#ffffff'));
    }
  }

  spawn(init: Partial<Particle> & { color: string }): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const pt = this.parts[i]!;
    pt.alive = true;
    pt.x = init.x ?? 0; pt.y = init.y ?? 0; pt.z = init.z ?? 0;
    pt.vx = init.vx ?? 0; pt.vy = init.vy ?? 0; pt.vz = init.vz ?? 0;
    pt.gravity = init.gravity ?? 0;
    pt.drag = init.drag ?? 0;
    pt.maxLife = init.maxLife ?? 1;
    pt.life = pt.maxLife;
    pt.size = init.size ?? 0.2;
    pt.rot = init.rot ?? 0;
    pt.spin = init.spin ?? 0;
    pt.flip = init.flip ?? 0;
    pt.flipSpeed = init.flipSpeed ?? 0;
    pt.grow = init.grow ?? 0;
    this.mesh.setColorAt(i, this.c.set(init.color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      const pt = this.parts[i]!;
      if (!pt.alive) continue;
      any = true;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.alive = false;
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      const damp = Math.exp(-pt.drag * dt);
      pt.vx *= damp; pt.vy *= damp; pt.vz *= damp;
      pt.vy -= pt.gravity * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
      if (pt.y < 0.03 && pt.gravity > 0) { pt.y = 0.03; pt.vy = 0; pt.vx *= 0.6; pt.spin = 0; pt.flipSpeed = 0; }
      pt.rot += pt.spin * dt;
      pt.flip += pt.flipSpeed * dt;
      const t = pt.life / pt.maxLife;
      const fade = t < 0.25 ? t / 0.25 : 1;
      const size = (pt.size + pt.grow * (1 - t)) * fade;
      this.e.set(0, 0, pt.rot);
      this.q.setFromEuler(this.e);
      this.s.set(size, this.flips ? size * (0.25 + 0.75 * Math.abs(Math.cos(pt.flip))) : size, size);
      this.p.set(pt.x, pt.y, pt.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const PARTY = ['#ff6b5e', '#ffb52e', '#1fb5a8', '#7a5cff', '#e2457b', '#6ec3ff', '#fff4dc'];

export class Fx {
  readonly root = new THREE.Group();
  private paper: Pool;
  private dots: Pool;
  private seed = 1234567;

  constructor() {
    this.paper = new Pool(new THREE.PlaneGeometry(1, 0.55), 260, true);
    this.dots = new Pool(new THREE.CircleGeometry(0.5, 14), 260, false);
    this.root.add(this.paper.mesh, this.dots.mesh);
  }

  // cosmetic randomness only; never feeds the simulation
  private r(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private rr(a: number, b: number): number {
    return a + (b - a) * this.r();
  }

  confetti(x: number, y: number, count: number, power = 1): void {
    for (let i = 0; i < count; i++) {
      const a = this.rr(0.15, 2.99);
      const sp = this.rr(4, 11) * power;
      this.paper.spawn({
        x, y, z: this.rr(-0.4, 0.8),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, vz: this.rr(-1, 2),
        gravity: 9, drag: 1.6, maxLife: this.rr(1.4, 2.6), size: this.rr(0.16, 0.3),
        rot: this.rr(0, 6.28), spin: this.rr(-6, 6), flip: this.rr(0, 6.28), flipSpeed: this.rr(6, 14),
        color: PARTY[Math.floor(this.r() * PARTY.length)]!,
      });
    }
  }

  /** Soft round puffs: dust, breath, rim taps. */
  puff(x: number, y: number, count: number, color: string, speed = 2, size = 0.28): void {
    for (let i = 0; i < count; i++) {
      const a = this.rr(0, Math.PI);
      const sp = this.rr(0.4, 1) * speed;
      this.dots.spawn({
        x: x + this.rr(-0.15, 0.15), y: y + this.rr(0, 0.1), z: this.rr(-0.2, 0.5),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + 0.4, drag: 3.2,
        maxLife: this.rr(0.3, 0.6), size: size * this.rr(0.6, 1.1), grow: size * 0.9, color,
      });
    }
  }

  /** Frosting blobs thrown up by a splat. */
  splash(x: number, y: number, color: string, count = 14): void {
    for (let i = 0; i < count; i++) {
      const a = this.rr(0.3, 2.84);
      const sp = this.rr(2, 7);
      this.dots.spawn({
        x, y: y + 0.1, z: this.rr(-0.3, 0.6),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 18, drag: 0.6,
        maxLife: this.rr(0.5, 1.0), size: this.rr(0.1, 0.24), color,
      });
    }
  }

  sparkle(x: number, y: number, count: number, color = '#fff4dc', spread = 1): void {
    for (let i = 0; i < count; i++) {
      const a = this.rr(0, 6.28);
      const sp = this.rr(1.5, 6) * spread;
      this.dots.spawn({
        x, y, z: 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 4,
        maxLife: this.rr(0.25, 0.55), size: this.rr(0.08, 0.2), color,
      });
    }
  }

  /** One fading dot behind a fast flyer. */
  trail(x: number, y: number, color: string, size = 0.2): void {
    this.dots.spawn({ x, y, z: -0.2, maxLife: 0.32, size, color });
  }

  /** Light horizontal streaks to show a gust. */
  gust(x: number, y: number, dir: number): void {
    this.dots.spawn({
      x, y, z: this.rr(-1.5, -0.5), vx: dir * this.rr(6, 10), vy: this.rr(-0.3, 0.3),
      maxLife: this.rr(0.5, 0.9), size: this.rr(0.06, 0.12), color: '#ffffff',
    });
  }

  update(dt: number): void {
    this.paper.update(dt);
    this.dots.update(dt);
  }
}

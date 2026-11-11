/**
 * Backyard Dash — presentation: the night yard, karts and drivers, chase cameras (one per
 * local player, split-screen for two), particles and sound. Reads race state and events only;
 * nothing here feeds back into the simulation.
 */
import * as THREE from 'three';
import { buildCharacter } from '../../characters';
import type { AudioKit, CharacterRig, CharacterSpec, MotionContext } from '../../kit/contracts';
import type { Settings } from '../../core/profile';
import { buildBackyardWorld, buildKart, buildNightSky } from '../../worlds/backyard';
import type { BackyardWorld, KartModel } from '../../worlds/backyard';
import { KART, RACE, backyard } from './track';
import { SURFACE, forwardSpeed } from './sim';
import type { RaceEvent, RaceState } from './sim';

export interface Rect { x: number; y: number; w: number; h: number }

interface Cam {
  camera: THREE.PerspectiveCamera;
  seat: number;
  yaw: number;
  fov: number;
  shake: number;
  finishT: number;
}

/** A small fixed pool of glowing dots in world space: drift sparks, dust, landing puffs, confetti. */
class Sparks {
  readonly mesh: THREE.InstancedMesh;
  private readonly n = 260;
  private next = 0;
  private readonly d = new Float32Array(260 * 10);
  private readonly m = new THREE.Matrix4();
  private readonly c = new THREE.Color();

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }), this.n);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < this.n; i++) {
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.c.set('#ffffff'));
    }
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: string, gravity: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const o = i * 10;
    const d = this.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
    d[o + 6] = life; d[o + 7] = life; d[o + 8] = size; d[o + 9] = gravity;
    this.mesh.setColorAt(i, this.c.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    const d = this.d;
    for (let i = 0; i < this.n; i++) {
      const o = i * 10;
      if (d[o + 6]! <= 0) continue;
      d[o + 6] = d[o + 6]! - dt;
      if (d[o + 6]! <= 0) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      d[o + 4] = d[o + 4]! - d[o + 9]! * dt;
      d[o] = d[o]! + d[o + 3]! * dt;
      d[o + 1] = Math.max(0.05, d[o + 1]! + d[o + 4]! * dt);
      d[o + 2] = d[o + 2]! + d[o + 5]! * dt;
      const k = d[o + 6]! / d[o + 7]!;
      const s = d[o + 8]! * (k < 0.4 ? k / 0.4 : 1);
      this.m.makeScale(s, s, s);
      this.m.setPosition(d[o]!, d[o + 1]!, d[o + 2]!);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const TWO_PI = Math.PI * 2;
function wrap(a: number): number {
  let x = a % TWO_PI;
  if (x > Math.PI) x -= TWO_PI;
  if (x < -Math.PI) x += TWO_PI;
  return x;
}

/** Drivers sit big in small karts: the person is the thing you recognise, not the car. */
const DRIVER_SCALE = 1.28;

export class RaceView {
  readonly scene = new THREE.Scene();
  private sparks = new Sparks();
  /** told about things worth a banner: (local view index or -1 for all, headline, detail) */
  onBanner: ((view: number, l1: string, l2: string) => void) | null = null;
  onBuzz: ((ms: number | number[]) => void) | null = null;

  private world: BackyardWorld;
  private karts: KartModel[] = [];
  private rigs: CharacterRig[] = [];
  private specs: CharacterSpec[];
  private cams: Cam[] = [];
  private lobbyCam = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 400);
  private lobby = true;
  private demo: { seat: number; kind: string; t: number } | null = null;
  private prev: { x: number; z: number; h: number; y: number }[] = [];
  private pose: { x: number; z: number; h: number; y: number }[] = [];
  private ctx: MotionContext = { vx: 0, vy: 0, steer: 0, lookYaw: 0 };
  private time = 0;
  private sparkClock = 0;
  private humans: number[] = [0];
  private names: string[] = [];
  private readonly v = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private rects: Rect[] = [{ x: 0, y: 0, w: 1, h: 1 }];

  constructor(
    private renderer: THREE.WebGLRenderer,
    env: THREE.Texture | null,
    private audio: AudioKit,
    cast: CharacterSpec[],
    private settings: Settings,
  ) {
    const scene = this.scene;
    scene.background = buildNightSky();
    scene.fog = new THREE.FogExp2('#232a55', 0.0085);
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    // dusk rather than pitch dark: everything you race on must read on a phone outdoors
    scene.add(new THREE.HemisphereLight('#8fa2ff', '#3a4a36', 1.35));
    const lamp = new THREE.DirectionalLight('#fff0d8', 1.9); // the work lamp, low from the east
    lamp.position.set(70, 34, 20);
    scene.add(lamp);
    const moon = new THREE.DirectionalLight('#9db8ff', 0.8);
    moon.position.set(-40, 60, -50);
    scene.add(moon);

    this.world = buildBackyardWorld(backyard());
    scene.add(this.world.root, this.sparks.mesh);
    this.specs = cast.slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const spec = this.specs[i]!;
      const kart = buildKart(spec.accent, spec.species === 'human' ? spec.bottom ?? '#22304f' : spec.secondary);
      const rig = buildCharacter(spec);
      rig.setAction('drive');
      rig.root.scale.setScalar(DRIVER_SCALE);
      rig.root.scale.setScalar(DRIVER_SCALE);
    kart.seat.add(rig.root);
      scene.add(kart.root);
      this.karts.push(kart);
      this.rigs.push(rig);
      this.prev.push({ x: 0, z: 0, h: 0, y: 0 });
      this.pose.push({ x: 0, z: 0, h: 0, y: 0 });
    }
    this.enterLobby();
  }

  // ───────────────────────────── cast / lobby ─────────────────────────────

  setCast(seat: number, spec: CharacterSpec): void {
    this.specs[seat] = spec;
    const old = this.rigs[seat]!;
    old.dispose();
    const kart = buildKart(spec.accent, spec.species === 'human' ? spec.bottom ?? '#22304f' : spec.secondary);
    this.scene.remove(this.karts[seat]!.root);
    this.karts[seat]!.dispose();
    this.karts[seat] = kart;
    this.scene.add(kart.root);
    const rig = buildCharacter(spec);
    rig.setAction('drive');
    rig.root.scale.setScalar(DRIVER_SCALE);
    kart.seat.add(rig.root);
    this.rigs[seat] = rig;
    if (this.lobby) {
      this.placeLobby();
      rig.setExpression('cheer');
      this.demo = { seat, kind: 'wave', t: 1.2 };
    }
  }

  castSpec(seat: number): CharacterSpec {
    return this.specs[seat]!;
  }

  private placeLobby(): void {
    // the two chosen characters parked nose-out by the finish line; rivals wait further back
    const spots = [[-7.4, 28.4, 0.5], [-9.2, 31.9, 0.25], [-16, 27.6, 0], [-18.5, 31.6, 0]] as const;
    for (let i = 0; i < 4; i++) {
      const [x, z, h] = spots[i]!;
      this.pose[i] = { x, z, h, y: 0 };
      this.prev[i] = { x, z, h, y: 0 };
    }
  }

  enterLobby(): void {
    this.lobby = true;
    this.world.resetPlank();
    this.placeLobby();
    for (const rig of this.rigs) {
      rig.setAction('drive');
      rig.setExpression('happy');
    }
    for (const kart of this.karts) kart.root.visible = true; // a kart caught mid-blink must not stay hidden
    this.audio.setEngine(null);
    this.audio.setSkid(null);
  }

  lobbyDemo(seat: number, kind: 'wave' | 'cheer' | 'run' | 'fly' | 'spin'): void {
    if (!this.lobby) return;
    this.demo = { seat, kind, t: kind === 'spin' ? 1.8 : 2.2 };
    const rig = this.rigs[seat]!;
    rig.setAction(kind === 'wave' ? 'wave' : 'drive');
    rig.setExpression(kind === 'cheer' ? 'cheer' : kind === 'run' || kind === 'fly' ? 'thrilled' : 'happy');
  }

  // ───────────────────────────── race hooks ─────────────────────────────

  beginRace(s: RaceState, humans: number[], names: string[]): void {
    this.lobby = false;
    this.demo = null;
    this.humans = humans.slice(0, 2);
    this.names = names;
    this.world.resetPlank();
    this.cams = this.humans.map((seat) => ({
      camera: new THREE.PerspectiveCamera(64, 1, 0.2, 500), seat, yaw: s.karts[seat]!.heading, fov: 64, shake: 0, finishT: 0,
    }));
    for (let i = 0; i < s.karts.length; i++) {
      const k = s.karts[i]!;
      this.pose[i] = { x: k.x, z: k.z, h: k.heading, y: 0 };
      this.prev[i] = { x: k.x, z: k.z, h: k.heading, y: 0 };
      this.rigs[i]!.setAction('drive');
      this.rigs[i]!.setExpression('determined');
      this.karts[i]!.root.visible = true;
    }
    this.audio.music('race');
  }

  beforeTick(s: RaceState): void {
    for (let i = 0; i < s.karts.length; i++) {
      const k = s.karts[i]!;
      const p = this.prev[i]!;
      p.x = k.x; p.z = k.z; p.h = k.heading; p.y = k.y;
    }
  }

  afterTick(s: RaceState): void {
    for (const e of s.events) this.onEvent(s, e);
  }

  private viewOf(seat: number): number {
    return this.humans.indexOf(seat);
  }

  private onEvent(s: RaceState, e: RaceEvent): void {
    const a = this.audio;
    const local = (seat: number): boolean => this.viewOf(seat) >= 0;
    switch (e.type) {
      case 'go':
        a.play('go');
        break;
      case 'start_boost':
        if (local(e.seat)) {
          a.play('boost');
          this.onBanner?.(this.viewOf(e.seat), 'Perfect start!', '');
        }
        break;
      case 'stall':
        if (local(e.seat)) this.onBanner?.(this.viewOf(e.seat), 'Too early!', 'Press DRIFT just before GO');
        break;
      case 'drift_start':
        if (local(e.seat)) a.play('dive', { intensity: 0.5 });
        break;
      case 'charge':
        if (local(e.seat)) {
          a.play('charge', { pitch: e.level === 2 ? 1.5 : 1 });
          this.onBuzz?.(8);
        }
        break;
      case 'boost':
        if (local(e.seat)) {
          a.play(e.level === 2 ? 'boost_big' : 'boost');
          this.cam(e.seat).shake = 0.25;
          this.onBuzz?.(e.level === 2 ? [15, 20, 25] : 18);
        }
        break;
      case 'bump': {
        const k = s.karts[e.seat]!;
        this.burst(k.x, 0.3, k.z, 5, '#d8d2c8', 2 + e.strength * 3, 0.3);
        if (local(e.seat)) {
          a.play('bump', { intensity: e.strength });
          this.cam(e.seat).shake = Math.max(this.cam(e.seat).shake, 0.2 + e.strength * 0.5);
          this.onBuzz?.(20);
        }
        break;
      }
      case 'kart_bump':
        if (local(e.a) || local(e.b)) {
          a.play('kart_bump', { intensity: e.strength });
          for (const seat of [e.a, e.b]) if (local(seat)) this.cam(seat).shake = Math.max(this.cam(seat).shake, 0.15 + e.strength * 0.3);
        }
        break;
      case 'plank_open': {
        this.world.openPlank();
        a.play('plank');
        const pl = backyard().plank;
        this.burst(pl.ax - 2, 0.3, pl.az, 18, '#e8d2aa', 5, 0.45);
        this.onBanner?.(-1, 'Shortcut open!', `${this.names[e.seat] ?? 'Someone'} knocked the peg out — the plank is down for everyone`);
        break;
      }
      case 'jump':
        if (local(e.seat)) a.play('dive', { intensity: 0.8, pitch: 1.3 });
        break;
      case 'land': {
        const k = s.karts[e.seat]!;
        this.burst(k.x, 0.2, k.z, 9, '#d8d2c8', 3.5, 0.32);
        if (local(e.seat)) {
          a.play('land');
          this.cam(e.seat).shake = 0.3;
        }
        break;
      }
      case 'lap':
        if (local(e.seat)) {
          const last = e.lap + 1 === s.laps;
          a.play(last ? 'final_lap' : 'lap');
          this.onBanner?.(this.viewOf(e.seat), last ? 'Final lap!' : `Lap ${e.lap + 1}`, `${(e.ticks / 60).toFixed(2)} s`);
        }
        break;
      case 'finish': {
        const k = s.karts[e.seat]!;
        this.confetti(k.x, 1.5, k.z, e.place === 1 ? 44 : 16);
        this.rigs[e.seat]!.setExpression(e.place === 1 ? 'cheer' : e.place === 2 ? 'happy' : 'oops');
        if (e.place === 1) this.rigs[e.seat]!.setAction('wave');
        if (local(e.seat)) a.play(e.place === 1 ? 'fanfare' : 'catch');
        break;
      }
      case 'reset':
        if (local(e.seat)) this.onBanner?.(this.viewOf(e.seat), 'Back on track', '');
        break;
      case 'over':
        a.setEngine(null);
        a.setSkid(null);
        break;
    }
  }

  private cam(seat: number): Cam {
    return this.cams[Math.max(0, this.viewOf(seat))]!;
  }

  /** A puff of dots thrown outward along the ground. */
  private burst(x: number, y: number, z: number, n: number, color: string, speed: number, size: number): void {
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + this.time * 7;
      const sp = speed * (0.4 + ((i * 37) % 10) / 16);
      this.sparks.spawn(x, y, z, Math.cos(a) * sp, 1 + ((i * 13) % 7) * 0.35, Math.sin(a) * sp, 0.45 + (i % 4) * 0.08, size, color, 6);
    }
  }

  private confetti(x: number, y: number, z: number, n: number): void {
    const colors = ['#ff6b5e', '#ffb52e', '#1fb5a8', '#7a5cff', '#e2457b', '#6ec3ff'];
    for (let i = 0; i < n; i++) {
      const a = i * 2.399;
      const sp = 2 + ((i * 29) % 10) * 0.45;
      this.sparks.spawn(x, y, z, Math.cos(a) * sp, 5 + ((i * 17) % 9) * 0.5, Math.sin(a) * sp, 1.3 + (i % 5) * 0.2, 0.2, colors[i % colors.length]!, 9);
    }
  }

  // ───────────────────────────── frame ─────────────────────────────

  /** The screen areas of each local player's view, in stage pixels. */
  layout(width: number, height: number): Rect[] {
    if (this.lobby || this.humans.length < 2) this.rects = [{ x: 0, y: 0, w: width, h: height }];
    else this.rects = [{ x: 0, y: 0, w: width / 2, h: height }, { x: width / 2, y: 0, w: width / 2, h: height }];
    return this.rects;
  }

  render(s: RaceState | null, alpha: number, dt: number, width: number, height: number): void {
    this.time += dt;
    this.layout(width, height);
    if (this.lobby || !s) this.frameLobby(dt);
    else this.frameRace(s, alpha, dt);
    this.world.update(dt, this.time);
    this.sparks.update(dt);

    const r = this.renderer;
    r.setScissorTest(true);
    if (this.lobby || !s) {
      const cam = this.lobbyCam;
      cam.aspect = width / Math.max(1, height);
      // shift the picture right so the menu on the left never covers the drivers
      cam.setViewOffset(width, height, -width * 0.2, 0, width, height);
      cam.updateProjectionMatrix();
      r.setViewport(0, 0, width, height);
      r.setScissor(0, 0, width, height);
      r.render(this.scene, cam);
    } else {
      for (let i = 0; i < this.cams.length; i++) {
        const rect = this.rects[i]!;
        const c = this.cams[i]!;
        c.camera.aspect = rect.w / Math.max(1, rect.h);
        c.camera.updateProjectionMatrix();
        // three.js viewports count from the bottom-left
        r.setViewport(rect.x, height - rect.y - rect.h, rect.w, rect.h);
        r.setScissor(rect.x, height - rect.y - rect.h, rect.w, rect.h);
        r.render(this.scene, c.camera);
      }
    }
    r.setScissorTest(false);
  }

  private placeKart(i: number, x: number, y: number, z: number, heading: number): void {
    const kart = this.karts[i]!;
    kart.root.position.set(x, y, z);
    kart.root.rotation.y = -heading;
  }

  private frameLobby(dt: number): void {
    const d = this.demo;
    for (let i = 0; i < 4; i++) {
      const p = this.pose[i]!;
      let h = p.h;
      const ctx = this.ctx;
      ctx.vx = 0; ctx.vy = 0; ctx.steer = Math.sin(this.time * 0.7 + i) * 0.25; ctx.lookYaw = i < 2 ? (i === 0 ? 0.5 : 0.35) : 0;
      let boost = 0;
      if (d && d.seat === i) {
        if (d.kind === 'spin') h += (1 - d.t / 1.8) * TWO_PI;
        if (d.kind === 'run' || d.kind === 'fly') {
          ctx.vx = 15;
          ctx.steer = Math.sin(this.time * 5) * 0.9;
          boost = d.kind === 'fly' ? 1 : 0.3;
        }
      }
      this.placeKart(i, p.x, 0, p.z, h);
      const kart = this.karts[i]!;
      kart.setSteer(ctx.steer ?? 0);
      kart.setBoost(boost);
      kart.body.rotation.x = 0;
      kart.update(dt, ctx.vx);
      this.rigs[i]!.update(dt, ctx);
    }
    if (d) {
      d.t -= dt;
      if (d.t <= 0) {
        this.rigs[d.seat]!.setAction('drive');
        this.rigs[d.seat]!.setExpression('happy');
        this.demo = null;
      }
    }
    const cam = this.lobbyCam;
    cam.position.set(-0.9 + Math.sin(this.time * 0.25) * 0.4, 2.15, 36.3);
    cam.lookAt(-8.3, 0.95, 30.2);
  }

  private frameRace(s: RaceState, alpha: number, dt: number): void {
    const n = s.karts.length;
    this.sparkClock -= dt;
    const emit = this.sparkClock <= 0;
    if (emit) this.sparkClock = 0.03;
    for (let i = 0; i < n; i++) {
      const k = s.karts[i]!;
      const p = this.prev[i]!;
      const q = this.pose[i]!;
      q.x = p.x + (k.x - p.x) * alpha;
      q.z = p.z + (k.z - p.z) * alpha;
      q.y = p.y + (k.y - p.y) * alpha;
      q.h = p.h + wrap(k.heading - p.h) * alpha;
      this.placeKart(i, q.x, q.y, q.z, q.h);
      const kart = this.karts[i]!;
      const vf = forwardSpeed(k);
      const boost = k.boostTicks > 0 ? Math.min(1, k.boostTicks / 20) : 0;
      kart.setSteer(k.steer);
      kart.setBoost(boost);
      kart.setGhost(k.blinkTicks > 0);
      // the tub leans out of a corner and squats under a boost
      const lean = k.drifting ? k.driftDir * 0.16 : k.steer * 0.07 * Math.min(1, vf / 10);
      kart.body.rotation.x += (lean - kart.body.rotation.x) * Math.min(1, dt * 10);
      kart.body.rotation.z += ((boost * 0.07 - (k.y > 0.3 ? 0.12 : 0)) - kart.body.rotation.z) * Math.min(1, dt * 8);
      kart.update(dt, vf);

      // driver
      const rig = this.rigs[i]!;
      const ctx = this.ctx;
      ctx.vx = vf;
      ctx.vy = k.vy;
      ctx.steer = k.drifting ? k.driftDir * 0.8 + k.steer * 0.2 : k.steer;
      ctx.lookYaw = 0;
      // a glance at whoever is alongside
      const fx = Math.cos(q.h);
      const fz = Math.sin(q.h);
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const o = this.pose[j]!;
        const dx = o.x - q.x;
        const dz = o.z - q.z;
        const along = dx * fx + dz * fz;
        const side = -dx * fz + dz * fx;
        if (Math.abs(along) < 1.6 && Math.abs(side) < 3) ctx.lookYaw = side > 0 ? 0.7 : -0.7;
      }
      if (!k.finished) {
        rig.setExpression(k.stunTicks > 0 ? 'dizzy' : boost > 0 ? 'thrilled' : k.drifting ? 'determined' : k.surface === SURFACE.soil ? 'oops' : 'happy');
      }
      rig.update(dt, ctx);

      // sparks, dust
      if (emit && vf > 4) {
        if (k.drifting && k.y < 0.2) {
          const color = k.charge >= 2 ? '#58e6ff' : k.charge >= 1 ? '#ff4f8b' : '#ffe9a8';
          for (const side of [-1, 1] as const) {
            kart.rearWheel(side, this.v);
            this.spark(this.v.x, this.v.y, this.v.z, color, k.charge >= 1 ? 0.2 : 0.12);
          }
        } else if ((k.surface === SURFACE.grass || k.surface === SURFACE.soil) && k.y === 0) {
          kart.rearWheel(i % 2 ? 1 : -1, this.v);
          this.spark(this.v.x, this.v.y + 0.1, this.v.z, k.surface === SURFACE.soil ? '#6b4a34' : '#3b8048', 0.22);
        }
      }
    }

    // sound for the first local driver
    const me = s.karts[this.humans[0] ?? 0]!;
    if (dt === 0) {
      // paused: a frozen race makes no noise
      this.audio.setEngine(null);
      this.audio.setSkid(null);
    } else if (s.phase !== 'over') {
      const v = forwardSpeed(me);
      this.audio.setEngine(Math.min(1, Math.abs(v) / KART.vBoost) * (s.phase === 'countdown' ? 0.15 : 1) + (s.phase === 'countdown' ? 0.12 : 0), me.boostTicks > 0 ? 1 : 0.3);
      this.audio.setSkid(me.drifting ? 0.5 + Math.min(0.5, me.charge * 0.25) : me.stunTicks > 0 ? 0.8 : null);
    }

    // cameras
    for (const c of this.cams) this.chase(s, c, dt);
  }

  private spark(x: number, y: number, z: number, color: string, size: number): void {
    this.sparks.spawn(x, y, z, 0, 0.8, 0, 0.32, size, color, 0);
  }

  private chase(s: RaceState, c: Cam, dt: number): void {
    const k = s.karts[c.seat]!;
    const q = this.pose[c.seat]!;
    const speed = Math.hypot(k.vx, k.vz);
    // follow where the kart is going, not where it points: a drift shows its flank
    // (angles are blended as differences: averaging raw angles breaks where they wrap)
    let slip = speed > 2.5 ? wrap(Math.atan2(k.vz, k.vx) - q.h) : 0;
    if (Math.abs(slip) > 2) slip = 0; // rolling backwards: stay behind the nose
    c.yaw += wrap(q.h + slip * 0.6 - c.yaw) * Math.min(1, dt * 6);
    const boost = k.boostTicks > 0 ? 1 : 0;
    const split = this.cams.length > 1;
    const baseFov = split ? 74 : 64;
    c.fov += (baseFov + boost * 9 + Math.min(6, speed * 0.25) - c.fov) * Math.min(1, dt * 5);
    c.camera.fov = c.fov;
    let orbit = 0;
    let dist = 4.0 + boost * 0.7;
    let height = 2.0;
    let lookUp = 1.05;
    let ahead = 2.4;
    if (s.phase === 'countdown') {
      // meet the driver face to face, then swing in behind for GO
      const t = Math.min(1, s.phaseTick / (RACE.countdownTicks * 0.82));
      const e = t < 0.2 ? 0 : (t - 0.2) / 0.8;
      const ease = e * e * (3 - 2 * e);
      orbit = Math.PI * (1 - ease) * (c.seat % 2 ? -1 : 1);
      dist = 3.4 + ease * 0.6;
      height = 1.5 + ease * 0.5;
      ahead = ease * 2.4;
      c.yaw = q.h;
    } else if (k.finished) {
      c.finishT += dt;
      const e = Math.min(1, c.finishT / 1.4);
      const ease = e * e * (3 - 2 * e);
      orbit = Math.PI * 0.86 * ease;
      dist = 4.0 - ease * 0.9;
      height = 2.0 - ease * 0.55;
      ahead = 2.4 * (1 - ease);
    }
    c.shake *= Math.exp(-dt * 7);
    const sh = this.settings.reducedMotion ? 0 : c.shake;
    const yaw = c.yaw + orbit;
    const cx = q.x - Math.cos(yaw) * dist + Math.sin(this.time * 61) * sh * 0.3;
    const cz = q.z - Math.sin(yaw) * dist + Math.cos(this.time * 47) * sh * 0.3;
    c.camera.position.set(cx, q.y * 0.5 + height + Math.sin(this.time * 53) * sh * 0.2, cz);
    c.camera.lookAt(q.x + Math.cos(q.h) * ahead, q.y * 0.6 + lookUp, q.z + Math.sin(q.h) * ahead);
    if (!this.settings.reducedMotion && !k.finished && s.phase === 'racing') {
      c.camera.rotation.z += (k.drifting ? k.driftDir : k.steer * 0.5) * -0.035;
    }
  }

  /** World point → pixel in a local player's view; visible=false when behind the camera. */
  project(view: number, x: number, y: number, z: number, out: { x: number; y: number; visible: boolean; dist: number }): void {
    const c = this.cams[view];
    const rect = this.rects[view];
    if (!c || !rect) {
      out.visible = false;
      return;
    }
    this.v.set(x, y, z);
    out.dist = this.v.distanceTo(c.camera.position);
    this.v.project(c.camera);
    out.visible = this.v.z < 1 && this.v.z > -1 && Math.abs(this.v.x) < 1.05 && Math.abs(this.v.y) < 1.05;
    out.x = rect.x + (this.v.x * 0.5 + 0.5) * rect.w;
    out.y = rect.y + (-this.v.y * 0.5 + 0.5) * rect.h;
  }

  kartPosition(seat: number, out: { x: number; y: number; z: number }): void {
    const q = this.pose[seat]!;
    out.x = q.x; out.y = q.y; out.z = q.z;
  }

  dispose(): void {
    for (const rig of this.rigs) rig.dispose();
    for (const kart of this.karts) kart.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();
    });
    void this.v2;
  }
}

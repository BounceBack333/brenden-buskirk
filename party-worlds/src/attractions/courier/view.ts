/**
 * Catapult Courier — presentation.
 *
 * Reads simulation state and events and turns them into characters, props, camera, particles
 * and sound. Nothing here feeds back into the simulation: you could delete this file and every
 * outcome would be identical.
 */
import * as THREE from 'three';
import { buildCharacter } from '../../characters';
import {
  buildBalloon, buildCatchBasket, buildCocktailUmbrella, buildCupcake, buildJellyDome, buildRingGate,
  buildRunway, buildSplat, buildSpoonCatapult, buildTableFan, buildTableScene, buildWindStreamers,
} from '../../worlds/birthday';
import { RIG } from '../../kit/contracts';
import type {
  Animated, AudioKit, Balloon, CatchBasket, CharacterRig, CharacterSpec, CocktailUmbrella, JellyDome,
  MotionContext, RingGate, SpoonCatapult, TableFan, TableScene, WindStreamers,
} from '../../kit/contracts';
import { PALETTE, disposeGeometry } from '../../kit/materials';
import { CameraRig } from '../../render/camera';
import type { Frame } from '../../render/camera';
import { Fx } from '../../render/fx';
import type { Stage } from '../../render/stage';
import type { Settings } from '../../core/profile';
import { ARENAS, DEFAULT_ARENA, DT, POINTS, TIMING, TUNE } from './rules';
import type { Arena } from './rules';
import { aimRadians, arenaOf, forecastLaunch, setupOf } from './sim';
import type { CourierEvent, CourierState, FlightSample, LaunchResult } from './sim';
import { AimArc, buildCakeCliff, buildDropShadow, buildLandingMarker } from './setpieces';

export interface Popup {
  text: string;
  wx: number;
  wy: number;
  tone: 'good' | 'great' | 'miss' | 'info';
}

const BALLOON_COLORS = [PALETTE.teal, PALETTE.grape, PALETTE.sunflower, PALETTE.berry];
const MAX_RINGS = 2;

/** Body tilt for a ballistic flyer, radians about z. The 'fly' pose is head-first along +x at tilt 0. */
function flightTilt(vx: number, vy: number): number {
  return Math.atan2(vy, Math.max(Math.abs(vx), 0.001)) * (vx >= 0 ? 1 : -1);
}

export class CourierView {
  readonly cam: CameraRig;
  readonly fx = new Fx();
  onPopup: ((p: Popup) => void) | null = null;
  onBuzz: ((ms: number | number[]) => void) | null = null;

  private readonly world = new THREE.Group();
  private readonly arena: Arena;
  private table: TableScene;
  private spoon: SpoonCatapult;
  private basket: CatchBasket;
  private umbrella: CocktailUmbrella;
  private jellies: JellyDome[] = [];
  private cupcakes: Animated[] = [];
  private balloons: Balloon[] = [];
  private rings: RingGate[] = [];
  private fan: TableFan;
  private streamers: WindStreamers;
  private runway: Animated;
  private splats: Animated[] = [];
  private arc = new AimArc();
  private dropShadow = buildDropShadow();
  private landing = buildLandingMarker();

  private rigs: [CharacterRig, CharacterRig];
  private holders: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private yaw: [number, number] = [0, 0];

  // interpolation snapshots (previous tick)
  private pf = { x: 0, y: 0 };
  private pc = { x: 0, bx: 0, by: 0 };
  private snap = true;

  // presentation state
  private pullVis = 0;
  private aimVis = 0.9;
  private launchOffset = new THREE.Vector3();
  private tumble = 0;
  private spin = 0;
  private tiltVis = 0;
  private outcomeT = 0;
  private hop = 0;
  private lastResult: LaunchResult | null = null;
  private windVis = 0;
  private fanYaw = 0;
  private gustClock = 0;
  private trailClock = 0;
  private time = 0;
  private lobbyMode = true;
  private lobbyWave = 2;
  private demo: { seat: 0 | 1; kind: 'wave' | 'cheer' | 'run' | 'fly' | 'spin'; t: number; total: number } | null = null;
  private samples: FlightSample[] = [];
  private arcPoints: number[] = [];
  private forecastLand = NaN;
  private forecastApex = 0;
  private lastAimKey = -1;
  private ctxL: MotionContext = { vx: 0, vy: 0, speed01: 0, tension01: 0, carrying: false };
  private ctxC: MotionContext = { vx: 0, vy: 0, speed01: 0, tension01: 0, carrying: true };
  private readonly v3 = new THREE.Vector3();

  constructor(
    private stage: Stage,
    private audio: AudioKit,
    cast: [CharacterSpec, CharacterSpec],
    private settings: Settings,
    arenaId: string = DEFAULT_ARENA,
  ) {
    this.arena = ARENAS[arenaId] ?? ARENAS[DEFAULT_ARENA]!;
    const a = this.arena;
    this.cam = new CameraRig(stage.camera);
    stage.scene.add(this.world);

    this.table = buildTableScene({ xMin: a.xMin, xMax: a.xMax });
    this.world.add(this.table.root);
    this.world.add(buildCakeCliff(a.xMax));

    this.runway = buildRunway(a.laneMax - a.laneMin + 2);
    this.runway.root.position.set(a.laneMin - 1, 0, 0);
    this.world.add(this.runway.root);

    this.spoon = buildSpoonCatapult();
    this.spoon.root.position.set(TUNE.launchX, 0, 0);
    this.world.add(this.spoon.root);

    for (const j of a.jellies) {
      const jelly = buildJellyDome(j.halfW);
      jelly.root.position.set(j.x, 0, 0);
      jelly.root.scale.set(1, j.h / j.halfW, 1);
      this.jellies.push(jelly);
      this.world.add(jelly.root);
    }
    for (const c of a.cupcakes) {
      const cup = buildCupcake(c.r, c.h);
      cup.root.position.set(c.x, 0, 0);
      this.cupcakes.push(cup);
      this.world.add(cup.root);
    }
    a.balloons.forEach((b, i) => {
      const balloon = buildBalloon(b.r, BALLOON_COLORS[i % BALLOON_COLORS.length]!, b.y - 0.3);
      balloon.root.position.set(b.x, b.y, 0);
      this.balloons.push(balloon);
      this.world.add(balloon.root);
    });
    for (let i = 0; i < MAX_RINGS; i++) {
      const ring = buildRingGate(1.6);
      ring.root.visible = false;
      ring.root.rotation.y = 0.5; // show the hole to a side-on camera
      this.rings.push(ring);
      this.world.add(ring.root);
    }

    this.fan = buildTableFan();
    this.fan.root.position.set((a.windZone.x0 + a.windZone.x1) / 2 - 1, 0, -4.4);
    this.world.add(this.fan.root);
    const zw = a.windZone.x1 - a.windZone.x0 - 2;
    this.streamers = buildWindStreamers(zw, 10);
    this.streamers.root.position.set((a.windZone.x0 + a.windZone.x1) / 2, 8.2, -1.4);
    this.world.add(this.streamers.root);

    this.basket = buildCatchBasket();
    this.world.add(this.basket.root);
    this.umbrella = buildCocktailUmbrella(PALETTE.berry);
    this.umbrella.root.visible = false;

    this.world.add(this.arc.mesh, this.dropShadow, this.landing, this.fx.root);
    this.world.add(this.holders[0], this.holders[1]);

    this.rigs = [buildCharacter(cast[0]), buildCharacter(cast[1])];
    this.holders[0].add(this.rigs[0].root);
    this.holders[1].add(this.rigs[1].root);
    this.enterLobby();
  }

  // ───────────────────────────── cast / modes ─────────────────────────────

  setCast(seat: 0 | 1, spec: CharacterSpec): void {
    const old = this.rigs[seat];
    this.holders[seat].remove(old.root);
    this.umbrella.root.removeFromParent();
    old.dispose();
    const rig = buildCharacter(spec);
    this.rigs[seat] = rig;
    this.holders[seat].add(rig.root);
    if (this.lobbyMode) {
      rig.setAction('celebrate');
      rig.setExpression('cheer');
      this.lobbyWave = 0.9;
    }
  }

  castSpec(seat: 0 | 1): CharacterSpec {
    return this.rigs[seat].spec;
  }

  /** Character screen: show a seat's character actually moving the way it will in play. */
  lobbyDemo(seat: 0 | 1, kind: 'wave' | 'cheer' | 'run' | 'fly' | 'spin'): void {
    if (!this.lobbyMode) return;
    const total = kind === 'spin' ? 1.7 : 2.3;
    this.demo = { seat, kind, t: total, total };
    const rig = this.rigs[seat];
    if (kind === 'wave') { rig.setAction('wave'); rig.setExpression('happy'); }
    else if (kind === 'cheer') { rig.setAction('celebrate'); rig.setExpression('cheer'); }
    else if (kind === 'run') { rig.setAction('run'); rig.setExpression('determined'); }
    else if (kind === 'fly') { rig.setAction('fly'); rig.setExpression('thrilled'); }
    else { rig.setAction('idle'); rig.setExpression('happy'); }
  }

  /** Menu backdrop: both characters stand together by the spoon. */
  enterLobby(): void {
    this.lobbyMode = true;
    this.arc.hide();
    this.dropShadow.visible = false;
    this.landing.visible = false;
    this.umbrella.root.removeFromParent();
    this.umbrella.root.visible = false;
    for (const ring of this.rings) ring.root.visible = false;
    this.spoon.setPull(0, 0.9);
    this.basket.root.position.set(8.4, 0, 1.2);
    this.basket.root.rotation.set(0, 0, 0);
    for (const seat of [0, 1] as const) {
      const h = this.holders[seat];
      this.world.add(h);
      h.position.set(seat === 0 ? 3.4 : 5.6, 0, 1.6);
      h.rotation.set(0, 0, 0);
      const rig = this.rigs[seat];
      rig.setTilt(0);
      rig.setFacing(seat === 0 ? 1 : -1);
      rig.setAction('idle');
      rig.setExpression('happy');
    }
    this.yaw = [-0.75, 0.75];
    this.windVis = 0;
    this.streamers.setWind(0, 0);
    this.fan.setStrength(0);
    this.audio.setTension(null);
    this.audio.setWind(null);
    this.audio.setFlutter(null);
    this.cam.rate = 3;
    this.cam.setFrame(this.lobbyFrame(), false);
  }

  private lobbyFrame(): Frame {
    // characters sit right of centre so the menu on the left never covers them
    return { x0: -2.6, x1: 8.2, y0: -0.7, y1: 4.4 };
  }

  /** Call when a round starts (or restarts). */
  beginRound(s: CourierState): void {
    this.lobbyMode = false;
    for (const sp of this.splats) {
      this.world.remove(sp.root);
      disposeGeometry(sp.root);
    }
    this.splats = [];
    // balloons popped in a previous round come back for a new one
    if (this.balloons.some((b) => b.popped)) {
      this.balloons.forEach((b) => {
        this.world.remove(b.root);
        disposeGeometry(b.root);
      });
      this.balloons = [];
      this.arena.balloons.forEach((b, i) => {
        const balloon = buildBalloon(b.r, BALLOON_COLORS[i % BALLOON_COLORS.length]!, b.y - 0.3);
        balloon.root.position.set(b.x, b.y, 0);
        this.balloons.push(balloon);
        this.world.add(balloon.root);
      });
    }
    this.lastResult = null;
    this.outcomeT = 0;
    this.hop = 0;
    this.snap = true;
    this.setupLaunch(s);
    this.cam.rate = 3.2;
    this.cam.setFrame(this.wideFrame(), true);
    this.audio.music('play');
  }

  private wideFrame(): Frame {
    return { x0: this.arena.xMin + 1.5, x1: this.arena.xMax + 1.5, y0: -1.4, y1: 14 };
  }

  private setupLaunch(s: CourierState): void {
    const setup = setupOf(s);
    this.rings.forEach((ring, i) => {
      const def = setup.rings[i];
      ring.root.visible = !!def;
      if (def) {
        ring.root.position.set(def.x, def.y, 0);
        const k = def.r / 1.6;
        ring.root.scale.setScalar(k);
        ring.setCollected(false);
      }
    });
    const L = s.launcherSeat;
    const C = L === 0 ? 1 : 0;
    // launcher into the spoon
    const hl = this.holders[L];
    this.spoon.seat.add(hl);
    hl.position.set(0, 0, 0);
    hl.rotation.set(0, 0, 0);
    this.rigs[L].setTilt(0);
    this.rigs[L].setFacing(1);
    this.rigs[L].setAction('anticipate');
    this.rigs[L].setExpression('happy');
    // catcher onto the lane
    const hc = this.holders[C];
    this.world.add(hc);
    hc.rotation.set(0, 0, 0);
    this.rigs[C].setTilt(0);
    this.rigs[C].setAction('idle');
    this.rigs[C].setExpression('determined');
    this.umbrella.root.removeFromParent();
    this.umbrella.root.visible = false;
    this.umbrella.setOpen(0);
    this.umbrella.setWear(0);
    this.basket.root.rotation.set(0, 0, 0);
    this.pullVis = 0;
    this.tumble = 0;
    this.tiltVis = 0;
    this.outcomeT = 0;
    this.hop = 0;
    this.lastAimKey = -1;
    this.forecastLand = NaN;
    this.snap = true;
  }

  // ───────────────────────────── tick hooks ─────────────────────────────

  /** Call immediately before stepping the sim. */
  beforeTick(s: CourierState): void {
    this.pf.x = s.flyer.x;
    this.pf.y = s.flyer.y;
    this.pc.x = s.catcher.x;
    this.pc.bx = s.catcher.bx;
    this.pc.by = s.catcher.by;
  }

  /** Call immediately after stepping the sim: reacts to this tick's events. */
  afterTick(s: CourierState): void {
    for (const e of s.events) this.onEvent(s, e);
  }

  /** Present an explicit list of events (online play: the server's, or my own predicted actions). */
  applyEvents(s: CourierState, events: readonly CourierEvent[]): void {
    for (const e of events) this.onEvent(s, e);
  }

  private pan(x: number): number {
    const half = this.cam.visibleHalfHeight * (this.stage.camera.aspect || 1.7);
    return Math.max(-1, Math.min(1, (x - this.cam.centerX) / Math.max(1, half)));
  }

  private popup(text: string, wx: number, wy: number, tone: Popup['tone']): void {
    this.onPopup?.({ text, wx, wy, tone });
  }

  private onEvent(s: CourierState, e: CourierEvent): void {
    const f = s.flyer;
    const audio = this.audio;
    switch (e.type) {
      case 'phase':
        if (e.phase === 'intro') {
          this.setupLaunch(s);
          if (s.launchIndex > 0) audio.play('swap');
        } else if (e.phase === 'done') {
          audio.setWind(null);
          audio.setFlutter(null);
        }
        break;
      case 'launch': {
        // keep the character where the spoon had it for a few frames, then melt onto the sim path
        const L = s.launcherSeat;
        const h = this.holders[L];
        h.getWorldPosition(this.v3);
        this.launchOffset.set(this.v3.x - f.x, this.v3.y + RIG.CENTER_Y - f.y, 0);
        this.world.add(h);
        this.spoon.fire(e.power01);
        this.rigs[L].setAction('fly');
        this.rigs[L].setExpression('thrilled');
        audio.setTension(null);
        audio.play('launch', { intensity: 0.4 + e.power01 * 0.6, pan: this.pan(f.x) });
        this.fx.puff(TUNE.launchX, TUNE.launchY - 0.3, 8, '#ffffff', 3 + e.power01 * 3);
        this.cam.shake(0.12 + e.power01 * 0.18);
        this.onBuzz?.(18);
        this.arc.hide();
        this.landing.visible = false;
        this.snap = true;
        break;
      }
      case 'aim_cancel':
        audio.setTension(null);
        audio.play('ui_back');
        break;
      case 'umbrella':
        audio.play(e.open ? 'umbrella_open' : 'umbrella_close', { pan: this.pan(f.x) });
        if (e.open) {
          this.fx.puff(f.x, f.y + 0.8, 4, '#ffffff', 1.6, 0.2);
          this.onBuzz?.(8);
        }
        break;
      case 'umbrella_spent':
        audio.play('umbrella_spent', { pan: this.pan(f.x) });
        this.popup('Umbrella spent!', f.x, f.y + 1.6, 'info');
        break;
      case 'jelly': {
        this.jellies[e.index]?.boing(e.strength, e.dirX);
        audio.play('boing', { intensity: e.strength, pan: this.pan(f.x) });
        this.fx.splash(f.x, f.y - 0.3, PALETTE.berry, 8);
        this.popup(`Jelly bounce`, f.x, f.y + 1.4, 'good');
        this.tumble = 0.35;
        this.spin = 9;
        this.onBuzz?.(12);
        break;
      }
      case 'cupcake':
        audio.play('rim', { intensity: e.strength, pitch: 0.7, pan: this.pan(f.x) });
        this.fx.splash(f.x, f.y, PALETTE.frosting, 6);
        this.tumble = 0.5;
        this.spin = -8;
        break;
      case 'balloon_bump':
        this.balloons[e.index]?.bump(e.dx, e.dy);
        audio.play('balloon_bump', { pan: this.pan(f.x) });
        this.tumble = 0.4;
        this.spin = 7;
        break;
      case 'balloon_pop': {
        const b = this.arena.balloons[e.index]!;
        this.balloons[e.index]?.pop();
        audio.play('balloon_pop', { pan: this.pan(b.x) });
        this.fx.confetti(b.x, b.y, 16, 0.8);
        this.popup('POP!', b.x, b.y + 1.2, 'info');
        this.cam.shake(0.25);
        this.onBuzz?.([10, 30, 10]);
        break;
      }
      case 'cake':
        audio.play('miss_splat', { intensity: 0.7, pan: this.pan(f.x) });
        this.fx.splash(this.arena.xMax - 0.2, e.y, PALETTE.frosting, 12);
        this.cam.shake(0.2);
        this.tumble = 0.6;
        this.spin = -10;
        break;
      case 'ring': {
        const def = setupOf(s).rings[e.index]!;
        this.rings[e.index]?.celebrate();
        this.rings[e.index]?.setCollected(true);
        audio.play('ring', { pan: this.pan(def.x) });
        this.fx.sparkle(def.x, def.y, 16, PALETTE.butter, 1.4);
        this.popup(`Donut! +${POINTS.ring} if caught`, def.x, def.y + def.r + 0.8, 'good');
        this.onBuzz?.(10);
        break;
      }
      case 'rim':
        this.basket.rattle(e.side);
        audio.play('rim', { intensity: e.strength, pan: this.pan(f.x) });
        this.fx.puff(f.x, f.y - 0.2, 3, '#fff4dc', 2, 0.16);
        this.tumble = 0.45;
        this.spin = e.side * -11;
        this.cam.shake(0.08);
        this.onBuzz?.(8);
        break;
      case 'caught':
        this.onCaught(s, e.result);
        break;
      case 'miss':
        this.onMiss(s, e.result);
        break;
      case 'dive':
        audio.play('dive', { pan: this.pan(s.catcher.x) });
        this.fx.puff(s.catcher.x, 0.15, 5, '#fff4dc', 2.4);
        break;
      case 'skid':
        audio.play('skid', { intensity: 0.6, pan: this.pan(s.catcher.x) });
        this.fx.puff(s.catcher.x, 0.1, 2, '#fff4dc', 1.4, 0.2);
        break;
      case 'step':
        audio.play('footstep', { intensity: 0.5, pan: this.pan(s.catcher.x) });
        break;
    }
  }

  private onCaught(s: CourierState, r: LaunchResult): void {
    const L = s.launcherSeat;
    const C = L === 0 ? 1 : 0;
    const c = s.catcher;
    this.lastResult = r;
    this.outcomeT = 0;
    this.hop = 1;
    const h = this.holders[L];
    this.basket.root.add(h);
    h.position.set(0, 0, 0);
    h.rotation.set(0, 0, 0);
    this.rigs[L].setTilt(0);
    this.rigs[L].setAction('caught');
    this.rigs[L].setExpression('dizzy');
    this.rigs[C].setExpression('cheer');
    this.umbrella.root.visible = false;
    this.basket.thump(r.perfect ? 1 : 0.7);
    this.audio.setWind(null);
    this.audio.setFlutter(null);
    this.audio.play(r.perfect ? 'catch_perfect' : 'catch', { pan: this.pan(c.bx) });
    this.fx.confetti(c.bx, c.by + 1.2, r.perfect ? 46 : 26, r.perfect ? 1.2 : 0.9);
    if (r.perfect) this.fx.sparkle(c.bx, c.by + 1.4, 22, PALETTE.butter, 1.6);
    this.cam.punchIn(r.perfect ? 1 : 0.6);
    this.cam.shake(0.18);
    this.onBuzz?.(r.perfect ? [20, 40, 30] : 24);
    const y = c.by + 2.6;
    this.popup(r.perfect ? `PERFECT CATCH  +${POINTS.caught + POINTS.perfect}` : `CAUGHT  +${POINTS.caught}`, c.bx, y, r.perfect ? 'great' : 'good');
    let line = 1;
    if (r.diveCatch) this.popup(`Diving catch  +${POINTS.dive}`, c.bx, y + 0.9 * line++, 'great');
    if (r.rings > 0) this.popup(`Donut${r.rings > 1 ? ` ×${r.rings}` : ''}  +${POINTS.ring * r.rings}`, c.bx, y + 0.9 * line++, 'good');
    if (r.jelly) this.popup(`Jelly bounce  +${POINTS.jelly}`, c.bx, y + 0.9 * line++, 'good');
  }

  private onMiss(s: CourierState, r: LaunchResult): void {
    const L = s.launcherSeat;
    const C = L === 0 ? 1 : 0;
    const f = s.flyer;
    this.lastResult = r;
    this.outcomeT = 0;
    const rig = this.rigs[L];
    const h = this.holders[L];
    this.world.add(h);
    this.umbrella.root.visible = false;
    this.audio.setWind(null);
    this.audio.setFlutter(null);
    rig.setTilt(0);
    if (r.missKind === 'table') {
      h.position.set(f.x, 0, 0);
      rig.setAction('splat');
      rig.setExpression('oops');
      this.audio.play('miss_splat', { pan: this.pan(f.x) });
      this.fx.splash(f.x, 0.1, rig.spec.accent, 16);
      this.fx.puff(f.x, 0.2, 6, '#fff4dc', 2.6);
      this.cam.shake(0.22);
      const splat = buildSplat(rig.spec.accent, s.splats.length * 7919 + 13);
      splat.root.position.set(f.x, 0, 0.35);
      this.splats.push(splat);
      this.world.add(splat.root);
      const near = r.missBy < 2.2;
      this.popup(near ? `So close!  ${r.missBy.toFixed(1)} away` : 'Splat!', f.x, 2.4, 'miss');
    } else if (r.missKind === 'stranded') {
      h.position.set(f.x, f.y - RIG.CENTER_Y, 0);
      rig.setAction('sad');
      rig.setExpression('oops');
      this.audio.play('whoops', { pan: this.pan(f.x) });
      this.popup('Stuck on the cupcake!', f.x, f.y + 1.8, 'miss');
    } else {
      h.position.set(f.x, -40, 0);
      this.audio.play('whoops');
      this.popup(r.missKind === 'off_edge' ? 'Off the table!' : 'Lost in the party…', Math.max(f.x, this.arena.xMin + 2), 3, 'miss');
    }
    this.rigs[C].setExpression('oops');
    window.setTimeout(() => this.audio.play('whoops', { intensity: 0.7 }), 380);
    this.onBuzz?.(40);
  }

  // ───────────────────────────── per-frame ─────────────────────────────

  /**
   * Draw one frame. `alpha` blends the previous and current tick. In lobby mode `s` may be null.
   */
  render(s: CourierState | null, alpha: number, dt: number): void {
    this.time += dt;
    this.cam.reducedMotion = this.settings.reducedMotion;
    if (this.lobbyMode || !s) {
      this.renderLobby(dt);
    } else {
      this.renderRound(s, alpha, dt);
    }
    this.table.update(dt);
    this.runway.update(dt);
    this.spoon.update(dt);
    this.basket.update(dt);
    this.umbrella.update(dt);
    for (const j of this.jellies) j.update(dt);
    for (const c of this.cupcakes) c.update(dt);
    for (const b of this.balloons) b.update(dt);
    for (const r of this.rings) if (r.root.visible) r.update(dt);
    this.fan.update(dt);
    this.streamers.update(dt);
    this.fx.update(dt);
    this.cam.update(dt);
    this.stage.focusShadows(this.cam.centerX, 2, Math.min(34, this.cam.visibleHalfHeight * (this.stage.camera.aspect || 1.7) + 4));
    this.stage.render();
  }

  private renderLobby(dt: number): void {
    this.cam.rate = 3;
    this.cam.setFrame(this.lobbyFrame());
    this.lobbyWave -= dt;
    const demo = this.demo;
    for (const seat of [0, 1] as const) {
      const rig = this.rigs[seat];
      const h = this.holders[seat];
      const ctx = this.ctxL;
      ctx.vx = 0;
      ctx.vy = 0;
      ctx.speed01 = 0;
      ctx.tension01 = 0;
      ctx.carrying = false;
      let yaw = this.yaw[seat];
      let lift = 0;
      let tilt = 0;
      if (demo && demo.seat === seat) {
        const k = 1 - demo.t / demo.total;
        if (demo.kind === 'spin') yaw += k * Math.PI * 2;
        else if (demo.kind === 'run') { ctx.vx = 7; ctx.speed01 = 1; yaw = -0.35; }
        else if (demo.kind === 'fly') {
          const ease = Math.sin(Math.min(1, k * 1.15) * Math.PI);
          lift = ease * 1.5;
          tilt = 0.25 - k * 0.5;
          ctx.vx = 16;
          ctx.vy = 6 - k * 12;
          yaw = -0.3;
        }
      } else if (this.lobbyWave <= 0) {
        rig.setAction(seat === (Math.floor(this.time / 5) % 2) ? 'wave' : 'idle');
        rig.setExpression('happy');
      }
      const quick = demo && demo.seat === seat && demo.kind === 'spin';
      h.rotation.y = quick ? yaw : h.rotation.y + (yaw - h.rotation.y) * Math.min(1, dt * 8);
      h.position.y += (lift - h.position.y) * Math.min(1, dt * 10);
      rig.setFacing(demo && demo.seat === seat && demo.kind !== 'spin' ? 1 : seat === 0 ? 1 : -1);
      rig.setTilt(tilt);
      rig.update(dt, ctx);
    }
    if (demo) {
      demo.t -= dt;
      if (demo.t <= 0) {
        const rig = this.rigs[demo.seat];
        rig.setAction('idle');
        rig.setExpression('happy');
        rig.setTilt(0);
        this.demo = null;
        this.lobbyWave = 1.5;
      }
    }
    if (this.lobbyWave <= 0) this.lobbyWave = 2.5;
  }

  private renderRound(s: CourierState, alpha: number, dt: number): void {
    const f = s.flyer;
    const c = s.catcher;
    const L = s.launcherSeat;
    const C = L === 0 ? 1 : 0;
    const rigL = this.rigs[L];
    const rigC = this.rigs[C];
    const hl = this.holders[L];
    const hc = this.holders[C];
    const a = this.snap ? 1 : alpha;
    const fx = this.pf.x + (f.x - this.pf.x) * a;
    const fy = this.pf.y + (f.y - this.pf.y) * a;
    const cx = this.pc.x + (c.x - this.pc.x) * a;
    const bx = this.pc.bx + (c.bx - this.pc.bx) * a;
    const by = this.pc.by + (c.by - this.pc.by) * a;
    this.snap = false;
    const setup = setupOf(s);

    // ── wind dressing ──
    this.windVis += (setup.wind - this.windVis) * Math.min(1, dt * 3);
    this.streamers.setWind(this.windVis, 0);
    this.fan.setStrength(Math.min(1, Math.abs(this.windVis) / 7));
    const wantYaw = this.windVis < -0.2 ? Math.PI : 0;
    this.fanYaw += (wantYaw - this.fanYaw) * Math.min(1, dt * 4);
    this.fan.root.rotation.y = this.fanYaw;
    if (Math.abs(this.windVis) > 0.5) {
      this.gustClock -= dt * Math.abs(this.windVis);
      if (this.gustClock <= 0) {
        this.gustClock = 0.5;
        const z = this.arena.windZone;
        const gx = this.cam.centerX + (Math.sin(this.time * 12.9898) * 0.5) * 30;
        const gy = 3.5 + Math.abs(Math.sin(this.time * 78.233)) * 9;
        if (gx > z.x0 && gx < z.x1) this.fx.gust(gx, gy, this.windVis > 0 ? 1 : -1);
      }
    }

    // ── launcher ──
    if (f.mode === 'seated') {
      const targetPull = s.aim.pulling ? s.aim.powerQ / 255 : 0;
      this.pullVis += (targetPull - this.pullVis) * Math.min(1, dt * 26);
      const aimRad = aimRadians(s.aim.aimQ);
      this.aimVis += (aimRad - this.aimVis) * Math.min(1, dt * 20);
      this.spoon.setPull(this.pullVis, this.aimVis);
      rigL.setAction('anticipate');
      rigL.setExpression(this.pullVis > 0.6 ? 'nervous' : this.pullVis > 0.08 ? 'determined' : 'happy');
      this.ctxL.vx = 0;
      this.ctxL.vy = 0;
      this.ctxL.tension01 = this.pullVis;
      this.ctxL.carrying = false;
      this.yawTo(hl, -0.45, dt);
      this.audio.setTension(s.aim.pulling && this.pullVis > 0.03 ? this.pullVis : null);
      this.updateArc(s);
      this.dropShadow.visible = false;
    } else if (f.mode === 'air') {
      this.launchOffset.multiplyScalar(Math.exp(-dt * 34));
      hl.position.set(fx + this.launchOffset.x, fy - RIG.CENTER_Y + this.launchOffset.y, 0);
      const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
      this.ctxL.vx = f.vx;
      this.ctxL.vy = f.vy;
      this.ctxL.tension01 = 0;
      if (this.tumble > 0) {
        this.tumble -= dt;
        this.tiltVis += this.spin * dt;
        rigL.setAction('tumble');
        rigL.setExpression('dizzy');
      } else if (f.open > 0.5) {
        this.tiltVis += (-f.vx * 0.012 - this.tiltVis) * Math.min(1, dt * 9);
        rigL.setAction('float');
        rigL.setExpression(f.vy < -3 ? 'determined' : 'happy');
      } else {
        const want = flightTilt(f.vx, f.vy);
        // shortest way round after a tumble
        let d = want - this.tiltVis;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.tiltVis += d * Math.min(1, dt * 12);
        rigL.setAction('fly');
        rigL.setExpression(f.vy > 0 ? 'thrilled' : 'nervous');
      }
      rigL.setTilt(this.tiltVis);
      rigL.setFacing(f.vx >= -0.5 ? 1 : -1);
      this.yawTo(hl, -0.3, dt);

      // umbrella
      const showUmbrella = f.open > 0.02 || (f.spent && f.airTicks > 0);
      if (showUmbrella && this.umbrella.root.parent !== rigL.umbrellaAnchor) rigL.umbrellaAnchor.add(this.umbrella.root);
      this.umbrella.root.visible = showUmbrella && this.tumble <= 0;
      this.umbrella.setOpen(f.open);
      this.umbrella.setWear(1 - f.budget / TUNE.umbrellaTicks);

      // air sounds + trail
      this.audio.setWind(Math.min(1, speed / 24) * (1 - f.open * 0.6));
      this.audio.setFlutter(f.open > 0.05 ? f.open : null);
      this.trailClock -= dt;
      if (speed > 9 && f.open < 0.5 && this.trailClock <= 0) {
        this.trailClock = 0.035;
        this.fx.trail(fx, fy, '#ffffff', 0.16 + Math.min(0.2, speed * 0.008));
      }

      // landing shadow: straight down, tighter and darker as the flyer comes in
      const h = Math.max(0, fy);
      const k = 1 / (1 + h * 0.12);
      this.dropShadow.visible = true;
      this.dropShadow.position.set(fx, 0.06, 0);
      this.dropShadow.scale.set(1.5 + h * 0.16, 1.1 + h * 0.1, 1);
      (this.dropShadow.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * k;
      this.arc.hide();
      this.landing.visible = false;
    } else {
      // caught or down: the holder was parked by onCaught / onMiss
      this.outcomeT += dt;
      this.dropShadow.visible = false;
      this.ctxL.vx = 0;
      this.ctxL.vy = 0;
      this.ctxL.tension01 = 0;
      if (f.mode === 'caught') {
        if (this.outcomeT > 0.55) rigL.setExpression('cheer');
      } else if (this.outcomeT > 1.0) {
        rigL.setExpression('dizzy');
      }
      this.yawTo(hl, f.mode === 'caught' ? -0.7 : -0.4, dt);
    }
    rigL.update(dt, this.ctxL);

    // ── catcher + basket ──
    this.hop *= Math.exp(-dt * 2.2);
    const hopY = f.mode === 'caught' ? Math.abs(Math.sin(this.outcomeT * 9)) * 0.42 * this.hop : 0;
    hc.position.set(cx, hopY, 0);
    rigC.setFacing(c.facing);
    this.yawTo(hc, -0.4 * c.facing, dt);
    const sp = Math.abs(c.vx);
    if (c.mode === 'dive') rigC.setAction('dive');
    else if (c.mode === 'slide' || c.mode === 'recover') rigC.setAction('slide');
    else rigC.setAction(sp > 0.7 ? 'run' : 'idle');
    this.ctxC.vx = c.vx;
    this.ctxC.vy = 0;
    this.ctxC.speed01 = Math.min(1, sp / TUNE.catcher.maxSpeed);
    this.ctxC.carrying = true;
    if (s.phase === 'flight') {
      const dist = Math.abs(f.x - c.bx);
      rigC.setExpression(dist < 5 && f.vy < 0 ? 'nervous' : 'determined');
    } else if (s.phase === 'aim' || s.phase === 'intro') {
      rigC.setExpression('determined');
    }
    rigC.update(dt, this.ctxC);
    this.basket.root.position.set(bx, by + hopY, 0);

    // ── camera ──
    this.frameCamera(s, fx, fy, cx, bx);
  }

  private yawTo(h: THREE.Group, target: number, dt: number): void {
    h.rotation.y += (target - h.rotation.y) * Math.min(1, dt * 7);
  }

  /** Recompute the dotted arc only when the aim actually changed. */
  private updateArc(s: CourierState): void {
    if (!s.aim.pulling || s.aim.powerQ < TIMING.minPowerQ) {
      this.arc.hide();
      this.landing.visible = false;
      this.forecastLand = NaN;
      this.lastAimKey = -1;
      return;
    }
    const key = s.aim.aimQ * 256 + s.aim.powerQ + (this.settings.aimAssist ? 1 << 20 : 0);
    if (key === this.lastAimKey) return;
    this.lastAimKey = key;
    this.samples.length = 0;
    const fc = forecastLaunch(s, s.aim.aimQ, s.aim.powerQ, 420, this.samples, 3);
    this.forecastLand = fc.landX;
    let apex = 0;
    for (const p of this.samples) if (p.y > apex) apex = p.y;
    this.forecastApex = apex;
    // Default: only the first part of the flight is shown; reading the rest is the skill.
    const shown = this.settings.aimAssist ? this.samples.length : Math.min(this.samples.length, 13);
    this.arcPoints.length = 0;
    for (let i = 0; i < shown; i++) {
      this.arcPoints.push(this.samples[i]!.x, this.samples[i]!.y);
    }
    this.arc.set(this.arcPoints, shown);
    if (this.settings.aimAssist && !Number.isNaN(fc.landX) && !fc.dead) {
      this.landing.visible = true;
      this.landing.position.set(fc.landX, 0.07, 0);
    } else {
      this.landing.visible = false;
    }
  }

  private frameCamera(s: CourierState, fx: number, fy: number, cx: number, bx: number): void {
    const A = this.arena;
    let frame: Frame;
    const rm = this.settings.reducedMotion;
    switch (s.phase) {
      case 'intro':
        this.cam.rate = 3.2;
        frame = this.wideFrame();
        break;
      case 'aim': {
        if (rm) {
          frame = this.wideFrame();
          break;
        }
        this.cam.rate = 3.4;
        if (this.pullVis < 0.06) {
          // lean in on the passenger while they think
          frame = { x0: -7.5, x1: 15.5, y0: -1.2, y1: 9 };
        } else {
          // the harder you pull, the more of the table you see
          const land = Number.isNaN(this.forecastLand) ? cx : this.forecastLand;
          let x1 = Math.max(18, land + 5, cx + 4);
          for (const r of setupOf(s).rings) x1 = Math.max(x1, r.x + 4);
          x1 = Math.min(x1, A.xMax + 1.5);
          frame = { x0: -6.5, x1, y0: -1.3, y1: Math.max(10, this.forecastApex + 3) };
        }
        break;
      }
      case 'flight': {
        this.cam.rate = 5.5;
        const lo = Math.min(fx, bx);
        const hi = Math.max(fx, bx);
        let x0 = lo - 5.5;
        let x1 = hi + 5.5;
        if (x1 - x0 < 19) {
          const mid = (x0 + x1) / 2;
          x0 = mid - 9.5;
          x1 = mid + 9.5;
        }
        x1 = Math.min(x1, A.xMax + 2);
        frame = { x0, x1, y0: -1.3, y1: Math.max(fy + 3.6, 8.5) };
        if (rm) frame = this.wideFrame();
        break;
      }
      case 'outcome':
      case 'done':
      default: {
        this.cam.rate = 4.2;
        const r = this.lastResult;
        if (rm) {
          frame = this.wideFrame();
        } else if (r && r.caught) {
          frame = { x0: bx - 6.5, x1: bx + 6.5, y0: -1, y1: 6.6 };
        } else if (r && r.missKind === 'table' && Math.abs(r.downX - bx) < 9) {
          const lo = Math.min(r.downX, bx);
          const hi = Math.max(r.downX, bx);
          frame = { x0: lo - 4.5, x1: hi + 4.5, y0: -1, y1: 6.5 };
        } else if (r && (r.missKind === 'table' || r.missKind === 'stranded')) {
          frame = { x0: r.downX - 7, x1: r.downX + 7, y0: -1, y1: Math.max(7, fy + 3) };
        } else {
          frame = this.wideFrame();
        }
        break;
      }
    }
    this.cam.setFrame(frame);
  }

  /** World → stage pixels, for HUD elements that follow things in the world. */
  project(wx: number, wy: number, stageW: number, stageH: number): { x: number; y: number } {
    return this.cam.project(wx, wy, 0, stageW, stageH);
  }

  /** Where a seat's character currently is (for name tags). */
  headPosition(seat: 0 | 1, out: { x: number; y: number }): void {
    this.holders[seat].getWorldPosition(this.v3);
    out.x = this.v3.x;
    out.y = this.v3.y + 1.55;
  }

  dispose(): void {
    this.umbrella.root.removeFromParent();
    this.rigs[0].dispose();
    this.rigs[1].dispose();
    this.stage.scene.remove(this.world);
    disposeGeometry(this.world);
  }
}

export { DT };
export type { CourierEvent, FlightSample };
export { arenaOf };

/**
 * Backyard Dash on this device: touch/keyboard → DriveInput, the race HUD, and the session that
 * steps the simulation with local players and labelled rival bots.
 *
 * Controls: the kart accelerates by itself. Drag left/right anywhere in your view to steer.
 * Hold DRIFT while turning to slide; let go to boost. A second finger also drifts. With
 * "auto drift" (the default when two people share a screen) steering hard starts the slide.
 */
import type { Pointers, Ptr } from '../../core/pointers';
import type { Settings } from '../../core/profile';
import type { StageSize } from '../../core/viewport';
import { esc } from '../../ui/hud';
import { ICON } from '../../ui/icons';
import { Rival } from './bot';
import { KART, RACE, backyard } from './track';
import { createRace, forwardSpeed, noDrive, stepRace } from './sim';
import type { DriveInput, RaceState } from './sim';
import type { RaceView, Rect } from './view';

// ───────────────────────────── controls ─────────────────────────────

interface Pad {
  stick: Ptr | null;
  ox: number;
  x: number;
  driftPtr: Ptr | null;
  driftBtn: boolean;
  brakeBtn: boolean;
  hard: number;
  auto: boolean;
}

export class RaceControls {
  /** seats driven from this device, in view order */
  humans: number[] = [0];
  rects: Rect[] = [{ x: 0, y: 0, w: 1, h: 1 }];
  readonly pads: Pad[] = [0, 1].map(() => ({ stick: null, ox: 0, x: 0, driftPtr: null, driftBtn: false, brakeBtn: false, hard: 0, auto: false }));
  enabled = false;
  private out: DriveInput[] = [noDrive(), noDrive()];

  constructor(private pointers: Pointers, private settings: Settings) {}

  attach(): void {
    this.pointers.onDown = (p) => this.down(p);
    this.pointers.onMove = (p) => {
      for (const pad of this.pads) {
        if (pad.stick === p) pad.x = p.x;
        else if (pad.driftPtr === p && pad.stick && pad.stick.moved < 10 && Math.abs(p.x - p.startX) > 22) {
          // The first finger down has not moved and this one is plainly steering: they were the
          // wrong way round (a palm or a gripping finger landed first). This one takes the wheel;
          // the still one is let go, so it cannot sit there as a held drift either.
          pad.stick = p;
          pad.ox = p.startX;
          pad.x = p.x;
          pad.driftPtr = null;
        }
      }
    };
    this.pointers.onUp = (p) => {
      for (const pad of this.pads) {
        if (pad.stick === p) pad.stick = null;
        if (pad.driftPtr === p) pad.driftPtr = null;
      }
    };
    this.pointers.onKey = null;
  }

  reset(): void {
    for (const pad of this.pads) {
      pad.stick = null; pad.driftPtr = null; pad.driftBtn = false; pad.brakeBtn = false; pad.hard = 0; pad.auto = false;
    }
  }

  private padAt(x: number, y: number): number {
    for (let i = 0; i < this.humans.length; i++) {
      const r = this.rects[i];
      if (r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }

  private down(p: Ptr): void {
    if (!this.enabled) return;
    const i = this.padAt(p.x, p.y);
    if (i < 0) return;
    const pad = this.pads[i]!;
    if (!pad.stick) {
      pad.stick = p;
      pad.ox = p.x;
      pad.x = p.x;
    } else if (!pad.driftPtr) {
      pad.driftPtr = p; // a second finger is the drift button
    }
  }

  stickRadius(view: number): number {
    return Math.max(34, (this.rects[view]?.h ?? 400) * 0.13);
  }

  /** This tick's input for local player `view`. */
  sample(view: number, s: RaceState): DriveInput {
    const o = this.out[view]!;
    const pad = this.pads[view]!;
    const keys = this.pointers.keys;
    const split = this.humans.length > 1;
    let steer = 0;
    if (pad.stick) {
      const r = this.stickRadius(view);
      const dx = pad.x - pad.ox;
      // floating stick: the origin trails the thumb, so there is always travel left
      if (dx > r) pad.ox = pad.x - r;
      else if (dx < -r) pad.ox = pad.x + r;
      const d = Math.max(-r, Math.min(r, pad.x - pad.ox));
      const dead = r * 0.08;
      if (Math.abs(d) > dead) steer = ((Math.abs(d) - dead) / (r - dead)) * (d > 0 ? 1 : -1);
    }
    const left = split ? (view === 0 ? keys.has('KeyA') : keys.has('ArrowLeft')) : keys.has('KeyA') || keys.has('ArrowLeft');
    const right = split ? (view === 0 ? keys.has('KeyD') : keys.has('ArrowRight')) : keys.has('KeyD') || keys.has('ArrowRight');
    if (left) steer = -1;
    if (right) steer = 1;
    const keyDrift = split
      ? (view === 0 ? keys.has('ShiftLeft') || keys.has('Space') || keys.has('KeyW') : keys.has('ShiftRight') || keys.has('Enter') || keys.has('ArrowUp'))
      : keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyJ');
    const keyBrake = split ? (view === 0 ? keys.has('KeyS') : keys.has('ArrowDown')) : keys.has('KeyS') || keys.has('ArrowDown');

    // auto drift: steering hard at speed starts the slide; easing off fires the boost
    let auto = false;
    if (this.settings.autoDrift || (split && pad.stick !== null)) {
      const k = s.karts[this.humans[view]!];
      pad.hard = Math.abs(steer) > 0.82 ? pad.hard + 1 : 0;
      if (!pad.auto && pad.hard > 9 && k && forwardSpeed(k) > KART.driftMinSpeed) pad.auto = true;
      if (pad.auto && Math.abs(steer) < 0.3) pad.auto = false;
      auto = pad.auto && s.phase === 'racing';
    }
    o.steer = Math.round(steer * 127);
    o.drift = pad.driftBtn || pad.driftPtr !== null || keyDrift || auto;
    o.brake = pad.brakeBtn || keyBrake;
    return o;
  }
}

// ───────────────────────────── HUD ─────────────────────────────

const ORD = ['1st', '2nd', '3rd', '4th'];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

interface Pane {
  root: HTMLElement;
  place: HTMLElement;
  lap: HTMLElement;
  meter: HTMLElement;
  fill: HTMLElement;
  banner: HTMLElement;
  count: HTMLElement;
  wrong: HTMLElement;
  face: HTMLElement;
  drift: HTMLButtonElement;
  brake: HTMLButtonElement;
  hint: HTMLElement;
  tags: HTMLElement[];
  bannerUntil: number;
  lastPlace: number;
}

export class RaceHud {
  onPause: (() => void) | null = null;
  private panes: Pane[] = [];
  private clock: HTMLElement;
  private map: HTMLCanvasElement;
  private mapBase: HTMLCanvasElement;
  private names: string[] = [];
  private colors: string[] = [];
  private bots: boolean[] = [];
  private faces: string[] = [];
  private readonly proj = { x: 0, y: 0, visible: false, dist: 0 };
  private readonly pos = { x: 0, y: 0, z: 0 };
  private drove = false;
  /** which local players have steered by touch this session */
  private touched = [false, false];
  /** a phone or tablet: assume thumbs until proven otherwise */
  private coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  private order = [0, 1, 2, 3];
  private done = [0, 0, 0, 0];
  private tagD = [0, 0, 0, 0];
  private tagX = [0, 0, 0, 0];
  private tagY = [0, 0, 0, 0];
  private tagW = [0, 0, 0, 0];

  constructor(private root: HTMLElement, private controls: RaceControls, private learned: Record<string, boolean>) {
    root.innerHTML = '';
    this.clock = el('div', 'race-clock', '0.0');
    this.map = el('canvas', 'race-map');
    this.map.width = 168;
    this.map.height = 112;
    this.mapBase = document.createElement('canvas');
    this.mapBase.width = 168;
    this.mapBase.height = 112;
    const pause = el('button', 'icon-btn pause-btn', ICON.pause);
    pause.setAttribute('aria-label', 'Pause');
    pause.addEventListener('click', () => this.onPause?.());
    root.append(this.clock, this.map, pause);
    for (let i = 0; i < 2; i++) this.panes.push(this.makePane(i));
    this.drawMapBase();
  }

  private makePane(i: number): Pane {
    const p = el('div', 'race-pane');
    const place = el('div', 'race-place', '1st');
    const face = el('div', 'race-face');
    const lap = el('div', 'race-lap', 'Lap 1/3');
    const meter = el('div', 'race-meter', '<i></i><b></b><b></b>');
    const banner = el('div', 'race-banner', '<div class="l1"></div><div class="l2"></div>');
    const count = el('div', 'race-count');
    const wrong = el('div', 'race-wrong', 'Wrong way');
    const drift = el('button', 'race-btn drift touchable', 'DRIFT');
    const brake = el('button', 'race-btn brake touchable', 'BRAKE');
    const hint = el('div', 'hint race-hint');
    const tags = [0, 1, 2, 3].map(() => el('div', 'race-tag'));
    const hold = (btn: HTMLElement, set: (v: boolean) => void): void => {
      const on = (v: boolean) => (e: Event) => {
        e.preventDefault();
        set(v);
        btn.classList.toggle('down', v);
      };
      btn.addEventListener('pointerdown', on(true));
      btn.addEventListener('pointerup', on(false));
      btn.addEventListener('pointercancel', on(false));
      btn.addEventListener('pointerleave', on(false));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold(drift, (v) => (this.controls.pads[i]!.driftBtn = v));
    hold(brake, (v) => (this.controls.pads[i]!.brakeBtn = v));
    p.append(face, place, lap, meter, banner, count, wrong, hint, ...tags, brake, drift);
    this.root.append(p);
    return { root: p, place, face, lap, meter, fill: meter.querySelector('i') as HTMLElement, banner, count, wrong, drift, brake, hint, tags, bannerUntil: 0, lastPlace: 0 };
  }

  private mapXY(x: number, z: number): [number, number] {
    return [(x + 66) * 1.2 + 6, (z + 30) * 1.2 + 14];
  }

  private drawMapBase(): void {
    const ctx = this.mapBase.getContext('2d')!;
    const t = backyard();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const path = (): void => {
      ctx.beginPath();
      t.samples.forEach((p, i) => {
        const [x, y] = this.mapXY(p.x, p.z);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    };
    path();
    ctx.strokeStyle = 'rgba(20,22,40,0.75)';
    ctx.lineWidth = 12;
    ctx.stroke();
    path();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 7;
    ctx.stroke();
    const [fx, fy] = this.mapXY(t.samples[0]!.x, t.samples[0]!.z);
    ctx.fillStyle = '#22304f';
    ctx.fillRect(fx - 1.5, fy - 6, 3, 12);
  }

  setup(names: string[], colors: string[], bots: boolean[], faces: string[], humans: number[]): void {
    this.names = names;
    this.colors = colors;
    this.bots = bots;
    this.faces = faces;
    this.drove = false;
    this.panes.forEach((p, i) => {
      p.bannerUntil = 0;
      p.lastPlace = 0;
      p.banner.classList.remove('show');
      for (const tag of p.tags) tag.dataset.k = '';
      const seat = humans[i];
      if (seat !== undefined) p.face.style.background = `${colors[seat] ?? '#fff'} url('${faces[seat] ?? ''}') center/cover`;
    });
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  banner(view: number, l1: string, l2: string, ms = 1900): void {
    const now = performance.now();
    this.panes.forEach((p, i) => {
      if (view >= 0 && view !== i) return;
      (p.banner.querySelector('.l1') as HTMLElement).textContent = l1;
      const b2 = p.banner.querySelector('.l2') as HTMLElement;
      b2.textContent = l2;
      b2.style.display = l2 ? '' : 'none';
      p.banner.classList.add('show');
      p.bannerUntil = now + ms;
    });
  }

  update(s: RaceState, view: RaceView, size: StageSize, rects: Rect[], humans: number[], settings: Settings): void {
    const now = performance.now();
    const split = humans.length > 1;
    // clock
    const t = s.phase === 'countdown' ? 0 : (s.phase === 'over' && s.firstFinishTick ? s.tick : s.tick) - RACE.countdownTicks;
    this.clock.textContent = (Math.max(0, t) / 60).toFixed(1);
    // minimap
    const ctx = this.map.getContext('2d')!;
    ctx.clearRect(0, 0, 168, 112);
    ctx.drawImage(this.mapBase, 0, 0);
    const tr = backyard();
    if (s.plankOpen) {
      const [ax, ay] = this.mapXY(tr.plank.ax, tr.plank.az);
      const [bx, by] = this.mapXY(tr.plank.bx, tr.plank.bz);
      ctx.strokeStyle = '#ffd15c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    for (let i = s.karts.length - 1; i >= 0; i--) {
      const k = s.karts[i]!;
      const [x, y] = this.mapXY(k.x, k.z);
      const mine = humans.includes(i);
      ctx.beginPath();
      ctx.arc(x, y, mine ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = this.colors[i] ?? '#fff';
      ctx.fill();
      ctx.lineWidth = mine ? 2.5 : 1.5;
      ctx.strokeStyle = mine ? '#fff' : '#22304f';
      ctx.stroke();
    }

    this.panes.forEach((p, i) => {
      const seat = humans[i];
      const rect = rects[i];
      const on = seat !== undefined && !!rect;
      p.root.style.display = on ? 'block' : 'none';
      if (!on) return;
      const k = s.karts[seat]!;
      p.root.style.left = `${rect.x}px`;
      p.root.style.top = `${rect.y}px`;
      p.root.style.width = `${rect.w}px`;
      p.root.style.height = `${rect.h}px`;
      p.root.classList.toggle('split', split);
      if (k.place !== p.lastPlace) {
        p.lastPlace = k.place;
        p.place.textContent = ORD[k.place - 1] ?? '';
        p.place.classList.remove('bump');
        void p.place.offsetWidth;
        p.place.classList.add('bump');
      }
      p.lap.textContent = k.finished ? 'Finished' : `Lap ${Math.max(1, Math.min(s.laps, k.lap))}/${s.laps}`;
      // drift charge: fills, then flips colour at each boost level
      const c = k.drifting ? Math.min(1, k.charge / 2) : 0;
      p.fill.style.width = `${c * 100}%`;
      p.meter.className = `race-meter${k.drifting ? ' on' : ''}${k.charge >= 2 ? ' l2' : k.charge >= 1 ? ' l1' : ''}`;
      // countdown
      if (s.phase === 'countdown') {
        const left = Math.ceil((RACE.countdownTicks - s.phaseTick) / 60);
        p.count.textContent = String(left);
        p.count.style.display = 'block';
      } else if (s.phase === 'racing' && s.phaseTick < 50) {
        p.count.textContent = 'GO!';
        p.count.style.display = 'block';
      } else p.count.style.display = 'none';
      p.wrong.style.display = k.wrongTicks > 50 ? 'block' : 'none';
      if (p.bannerUntil && now > p.bannerUntil) {
        p.bannerUntil = 0;
        p.banner.classList.remove('show');
      }
      const lefty = settings.leftHanded;
      // both buttons live on one side so the other thumb has its whole side of the screen to steer in
      p.root.classList.toggle('lefty', lefty);
      // first-race hints, retired once done; worded for whatever this player is steering with
      const pad = this.controls.pads[i]!;
      if (pad.stick) this.touched[i] = true;
      const touch = this.touched[i] || this.coarse;
      const driftKey = split ? (i === 0 ? 'W' : '↑') : 'Space';
      const auto = settings.autoDrift || (touch && split);
      let hint = '';
      if (s.phase === 'countdown' && !this.learned.raceStart) hint = `It drives itself. Press ${touch ? 'DRIFT' : driftKey} just before GO for a boost.`;
      else if (s.phase === 'racing' && !this.learned.steer) hint = touch ? `${ICON.hand}Drag left or right to steer` : `Steer with ${split ? (i === 0 ? 'A / D' : '← / →') : 'A / D or ← / →'}`;
      else if (s.phase === 'racing' && !this.learned.drift && s.phaseTick > 240) hint = auto ? 'Steer hard into a corner to slide, ease off to boost' : `Hold ${touch ? 'DRIFT' : driftKey} in a corner, let go to boost`;
      else if (s.phase === 'racing' && !s.plankOpen && !this.learned.plank && k.lap >= 2) hint = 'Bump the glowing peg to drop the plank';
      if (p.hint.dataset.t !== hint) {
        p.hint.dataset.t = hint;
        if (hint) p.hint.innerHTML = hint;
        p.hint.classList.toggle('show', !!hint);
      }
      // rivals' name tags: nearest first, and a tag that would cover another steps up out of the way
      const unit = Math.min(size.width, size.height) / 100;
      const tagH = unit * 4.6;
      let placed = 0;
      for (let j = 0; j < 4; j++) this.order[j] = j;
      for (let j = 0; j < 4; j++) {
        const tag = p.tags[j]!;
        this.tagD[j] = 1e9;
        if (j === seat || j >= s.karts.length) {
          tag.style.display = 'none';
          continue;
        }
        view.kartPosition(j, this.pos);
        view.project(i, this.pos.x, this.pos.y + 2.1, this.pos.z, this.proj);
        if (!this.proj.visible || this.proj.dist > 46 || this.proj.dist < 2) {
          tag.style.display = 'none';
          continue;
        }
        this.tagD[j] = this.proj.dist;
        this.tagX[j] = this.proj.x - rect.x;
        this.tagY[j] = this.proj.y - rect.y;
        const key = `${j}:${s.karts[j]!.place}`;
        if (tag.dataset.k !== key) {
          tag.dataset.k = key;
          tag.innerHTML = `<i style="background:${esc(this.colors[j] ?? '#fff')} url('${this.faces[j] ?? ''}') center/cover"></i>${esc(this.names[j] ?? '')}${this.bots[j] ? ' <span class="tag bot">bot</span>' : ''} <b>${ORD[s.karts[j]!.place - 1]}</b>`;
          this.tagW[j] = 0;
        }
        tag.style.display = 'block';
        if (!this.tagW[j]) this.tagW[j] = tag.offsetWidth || unit * 26;
      }
      this.order.sort((a, b) => this.tagD[a]! - this.tagD[b]!);
      for (const j of this.order) {
        if (this.tagD[j]! >= 1e9) continue;
        const x = Math.max(this.tagW[j]! * 0.5 + unit, Math.min(rect.w - this.tagW[j]! * 0.5 - unit, this.tagX[j]!));
        let y = Math.max(tagH * 1.2, this.tagY[j]!);
        for (let pass = 0; pass < 3; pass++) {
          for (let n = 0; n < placed; n++) {
            const o = this.done[n]!;
            if (Math.abs(this.tagX[o]! - x) < (this.tagW[o]! + this.tagW[j]!) * 0.5 + unit && Math.abs(this.tagY[o]! - y) < tagH) y = this.tagY[o]! - tagH;
          }
        }
        this.tagX[j] = x;
        this.tagY[j] = y;
        this.done[placed++] = j;
        const tag = p.tags[j]!;
        tag.style.left = `${this.tagX[j]}px`;
        tag.style.top = `${y}px`;
        tag.style.opacity = String(Math.max(0.35, 1 - this.tagD[j]! / 50));
      }
      // learning
      if (s.phase === 'racing' && Math.abs(k.steer) > 0.5) this.drove = true;
      if (this.drove && s.phaseTick > 200) this.learned.steer = true;
      if (k.boostTicks > 0 && s.phaseTick > 60) this.learned.drift = true;
      if (s.phase === 'racing') this.learned.raceStart = true;
      if (s.plankOpen) this.learned.plank = true;
    });
  }
}

// ───────────────────────────── session ─────────────────────────────

export interface RaceSetup {
  /** seats driven on this device, in view order */
  humans: number[];
  names: string[];
  colors: string[];
  laps: number;
  seed: number;
  /** rendered portraits of the drivers (data URLs) */
  faces: string[];
  /** skill of the rival in each non-human seat */
  skills: number[];
  /** throttle of the rival in each non-human seat (people always have 1) */
  pace: number[];
}

export class RaceSession {
  state: RaceState;
  paused = false;
  onDone: ((s: RaceState) => void) | null = null;
  readonly bots: boolean[];
  private rivals: (Rival | null)[];
  private inputs: DriveInput[];
  private doneFired = false;

  constructor(private view: RaceView, private controls: RaceControls, private hud: RaceHud, readonly setup: RaceSetup) {
    let b = 0;
    let q = 0;
    this.state = createRace({
      karts: 4, laps: setup.laps, required: setup.humans,
      pace: [0, 1, 2, 3].map((seat) => (setup.humans.includes(seat) ? 1 : setup.pace[q++] ?? 1)),
    });
    this.rivals = [0, 1, 2, 3].map((seat) => (setup.humans.includes(seat) ? null : new Rival({ seed: setup.seed * 13 + seat * 7 + 1, skill: setup.skills[b++] ?? 0.6 })));
    this.bots = this.rivals.map((r) => r !== null);
    this.inputs = [noDrive(), noDrive(), noDrive(), noDrive()];
    controls.humans = setup.humans;
    controls.reset();
    controls.enabled = true;
    view.onBanner = (v, l1, l2) => hud.banner(v, l1, l2, l1.startsWith('Shortcut') ? 3200 : 1900);
    view.beginRace(this.state, setup.humans, setup.names);
    hud.setup(setup.names, setup.colors, this.bots, setup.faces, setup.humans);
  }

  tick(): void {
    const s = this.state;
    if (this.paused || s.phase === 'over') return;
    for (let seat = 0; seat < 4; seat++) {
      const view = this.setup.humans.indexOf(seat);
      const rival = this.rivals[seat];
      this.inputs[seat] = view >= 0 ? this.controls.sample(view, s) : rival ? rival.think(s, seat) : this.inputs[seat]!;
    }
    this.view.beforeTick(s);
    stepRace(s, this.inputs);
    this.view.afterTick(s);
    if ((s.phase as string) === 'over' && !this.doneFired) {
      this.doneFired = true;
      this.controls.enabled = false;
      this.controls.reset();
      this.onDone?.(s);
    }
  }

  dispose(): void {
    this.controls.enabled = false;
    this.controls.reset();
    this.view.onBanner = null;
  }
}

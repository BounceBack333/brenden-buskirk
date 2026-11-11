/**
 * In-round HUD: score, launch pips, who-does-what, touch affordances, contextual hints.
 * Plain DOM over the canvas. It only ever reads game state.
 */
import type { CourierControls } from '../attractions/courier/controls';
import { TICK_HZ, TIMING, TUNE } from '../attractions/courier/rules';
import { catcherSeat, setupOf } from '../attractions/courier/sim';
import type { CourierState } from '../attractions/courier/sim';
import type { CourierView, Popup } from '../attractions/courier/view';
import type { Profile } from '../core/profile';
import type { StageSize } from '../core/viewport';
import { ICON } from './icons';

export interface SeatInfo {
  name: string;
  color: string;
  /** human = playing on this device · remote = a person on another device · bot = labelled computer partner */
  kind: 'human' | 'bot' | 'remote';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Text that came from a player (names) must never be treated as markup. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export class Hud {
  onPause: (() => void) | null = null;

  private badges: [HTMLElement, HTMLElement];
  private roles: [HTMLElement, HTMLElement];
  private scoreNum: HTMLElement;
  private pips: HTMLElement;
  private windChip: HTMLElement;
  private banner: HTMLElement;
  private bannerTimer = 0;
  private hints: [HTMLElement, HTMLElement];
  private dive: [HTMLButtonElement, HTMLButtonElement];
  private stick: HTMLElement;
  private knob: HTMLElement;
  private pullLine: HTMLElement;
  private pullKnob: HTMLElement;
  private meter: HTMLElement;
  private tags: [HTMLElement, HTMLElement];
  private clock: HTMLElement;
  private divider: HTMLElement;
  private shownScore = -1;
  private lastPipKey = '';
  private lastRoleKey = '';
  private lastHint: [string, string] = ['', ''];
  private lastWind = 999;
  private seats: [SeatInfo, SeatInfo] = [
    { name: 'P1', color: '#ff6b5e', kind: 'human' },
    { name: 'P2', color: '#1fb5a8', kind: 'human' },
  ];
  private readonly pos = { x: 0, y: 0 };

  constructor(
    private root: HTMLElement,
    private popLayer: HTMLElement,
    private controls: CourierControls,
    private profile: Profile,
  ) {
    root.innerHTML = '';
    const top = el('div', 'hud-top');
    const mk = (right: boolean): [HTMLElement, HTMLElement] => {
      const b = el('div', `badge${right ? ' right' : ''}`);
      b.innerHTML = `<span class="dot"></span><span><span class="nm"></span><span class="role"></span></span>`;
      return [b, b.querySelector('.role') as HTMLElement];
    };
    const [b0, r0] = mk(false);
    const [b1, r1] = mk(true);
    this.badges = [b0, b1];
    this.roles = [r0, r1];
    const score = el('div', 'score');
    this.scoreNum = el('div', 'num', '0');
    this.pips = el('div', 'pips');
    this.windChip = el('div', 'wind-chip calm', `${ICON.wind}<span></span>`);
    score.append(this.scoreNum, this.pips, this.windChip);
    top.append(b0, score, b1);

    const pause = el('button', 'icon-btn pause-btn', ICON.pause);
    pause.setAttribute('aria-label', 'Pause');
    pause.addEventListener('click', () => this.onPause?.());

    this.banner = el('div', 'banner', '<div class="l1"></div><div class="l2"></div>');
    this.hints = [el('div', 'hint'), el('div', 'hint')];
    this.dive = [el('button', 'dive-btn touchable', 'DIVE'), el('button', 'dive-btn touchable', 'DIVE')];
    this.dive.forEach((btn, seat) => {
      btn.setAttribute('aria-label', 'Dive');
      const set = (down: boolean) => (e: Event) => {
        e.preventDefault();
        this.controls.diveButton[seat as 0 | 1] = down;
        btn.classList.toggle('down', down);
      };
      btn.addEventListener('pointerdown', set(true));
      btn.addEventListener('pointerup', set(false));
      btn.addEventListener('pointercancel', set(false));
      btn.addEventListener('pointerleave', set(false));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    this.stick = el('div', 'stick');
    this.knob = el('div', 'knob');
    this.stick.append(this.knob);
    this.pullLine = el('div', 'pull-line');
    this.pullKnob = el('div', 'pull-knob');
    this.meter = el('div', 'meter');
    this.tags = [el('div', 'nametag'), el('div', 'nametag')];
    this.clock = el('div', 'aim-clock');
    this.divider = el('div', 'divider');
    root.append(
      this.divider, top, pause, this.banner, this.clock, this.tags[0], this.tags[1], this.meter,
      this.stick, this.pullLine, this.pullKnob, this.hints[0], this.hints[1], this.dive[0], this.dive[1],
    );
  }

  setSeats(seats: [SeatInfo, SeatInfo]): void {
    this.seats = seats;
    seats.forEach((s, i) => {
      const b = this.badges[i]!;
      (b.querySelector('.dot') as HTMLElement).style.background = s.color;
      (b.querySelector('.nm') as HTMLElement).innerHTML =
        esc(s.name) + (s.kind === 'bot' ? ' <span class="tag bot">bot</span>' : s.kind === 'remote' ? ' <span class="tag soft">online</span>' : '');
    });
    this.lastRoleKey = '';
    this.lastPipKey = '';
    this.shownScore = -1;
  }

  show(on: boolean): void {
    this.root.hidden = !on;
    if (!on) this.popLayer.innerHTML = '';
  }

  showBanner(l1: string, l2: string, ms = 1700): void {
    (this.banner.querySelector('.l1') as HTMLElement).textContent = l1;
    const b2 = this.banner.querySelector('.l2') as HTMLElement;
    b2.textContent = l2;
    b2.style.display = l2 ? '' : 'none';
    this.banner.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), ms);
  }

  popup(p: Popup, view: CourierView, size: StageSize): void {
    const at = view.project(p.wx, p.wy, size.width, size.height);
    const d = el('div', `pop ${p.tone}`);
    d.textContent = p.text;
    const x = Math.max(size.width * 0.12, Math.min(size.width * 0.88, at.x));
    const y = Math.max(size.height * 0.2, Math.min(size.height * 0.85, at.y));
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    this.popLayer.append(d);
    window.setTimeout(() => d.remove(), 1600);
    while (this.popLayer.childElementCount > 10) this.popLayer.firstElementChild?.remove();
  }

  /** Mark a contextual hint as understood so it never shows again. */
  learn(key: string): boolean {
    if (this.profile.learned[key]) return false;
    this.profile.learned[key] = true;
    return true;
  }

  update(s: CourierState, view: CourierView, size: StageSize): void {
    const L = s.launcherSeat;
    const C = catcherSeat(s);
    const shared = this.seats[0].kind === 'human' && this.seats[1].kind === 'human';

    // score
    if (s.total !== this.shownScore) {
      this.shownScore = s.total;
      this.scoreNum.textContent = String(s.total);
      this.scoreNum.classList.remove('bump');
      void this.scoreNum.offsetWidth;
      this.scoreNum.classList.add('bump');
    }

    // launch pips
    const pipKey = `${s.results.length}:${s.launchIndex}:${s.phase === 'done'}`;
    if (pipKey !== this.lastPipKey) {
      this.lastPipKey = pipKey;
      let html = '';
      for (let i = 0; i < s.launches; i++) {
        const r = s.results[i];
        const cls = r ? (r.caught ? (r.perfect ? 'hit perfect' : 'hit') : 'miss') : i === s.launchIndex && s.phase !== 'done' ? 'now' : '';
        const label = r ? (r.caught ? (r.perfect ? 'perfect catch' : 'caught') : 'missed') : 'to come';
        html += `<span class="pip ${cls}" title="Launch ${i + 1}: ${label}">${r ? (r.caught ? '✓' : '×') : ''}</span>`;
      }
      this.pips.innerHTML = html;
    }

    // roles
    const roleKey = `${L}`;
    if (roleKey !== this.lastRoleKey) {
      this.lastRoleKey = roleKey;
      for (const seat of [0, 1] as const) {
        const isL = seat === L;
        this.roles[seat].className = `role ${isL ? '' : 'catch'}`;
        this.roles[seat].innerHTML = isL ? 'Launching' : 'Catching';
        this.badges[seat].classList.add('pulse');
        window.setTimeout(() => this.badges[seat].classList.remove('pulse'), 420);
      }
    }

    // wind
    const wind = setupOf(s).wind;
    if (wind !== this.lastWind) {
      this.lastWind = wind;
      const span = this.windChip.querySelector('span') as HTMLElement;
      const svg = this.windChip.querySelector('svg') as SVGElement;
      this.windChip.classList.toggle('calm', wind === 0);
      span.textContent = wind === 0 ? 'Calm' : wind < 0 ? `Headwind ${Math.abs(wind)}` : `Tailwind ${wind}`;
      svg.style.transform = wind < 0 ? 'scaleX(-1)' : 'none';
    }

    this.divider.style.display = shared ? 'block' : 'none';

    // dive buttons
    for (const seat of [0, 1] as const) {
      const btn = this.dive[seat];
      const show = this.seats[seat].kind === 'human' && seat === C && (s.phase === 'aim' || s.phase === 'flight' || s.phase === 'intro');
      btn.classList.toggle('show', show);
      if (show) {
        const left = shared ? seat === 0 : this.profile.settings.leftHanded;
        btn.style.left = left ? 'calc(var(--pad-x) + var(--u) * 2)' : '';
        btn.style.right = left ? '' : 'calc(var(--pad-x) + var(--u) * 2)';
        btn.classList.toggle('cool', s.catcher.mode !== 'run');
      } else if (this.controls.diveButton[seat]) {
        this.controls.diveButton[seat] = false;
        btn.classList.remove('down');
      }
    }

    // stick
    const st = this.controls.stick;
    if (st.active) {
      this.stick.style.display = 'block';
      this.stick.style.left = `${st.ox}px`;
      this.stick.style.top = `${st.oy}px`;
      const r = Math.max(28, size.height * 0.1);
      const dx = Math.max(-r, Math.min(r, st.x - st.ox));
      this.knob.style.transform = `translate(${dx}px, 0)`;
    } else {
      this.stick.style.display = 'none';
    }

    // pull gesture
    const pl = this.controls.pull;
    if (pl.active && s.flyer.mode === 'seated') {
      const dx = pl.x - pl.sx;
      const dy = pl.y - pl.sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      this.pullLine.style.display = 'block';
      this.pullLine.style.left = `${pl.sx}px`;
      this.pullLine.style.top = `${pl.sy}px`;
      this.pullLine.style.width = `${len}px`;
      this.pullLine.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      this.pullKnob.style.display = 'block';
      this.pullKnob.style.left = `${pl.x}px`;
      this.pullKnob.style.top = `${pl.y}px`;
      const weak = pl.power01 * 255 < TIMING.minPowerQ;
      this.pullKnob.style.opacity = weak ? '0.5' : '1';
    } else {
      this.pullLine.style.display = 'none';
      this.pullKnob.style.display = 'none';
    }

    // umbrella paper left, shown beside the flyer
    const f = s.flyer;
    if (f.mode === 'air' && (f.open > 0.02 || f.budget < TUNE.umbrellaTicks)) {
      const at = view.project(f.x, f.y + 1.9, size.width, size.height);
      this.meter.style.display = 'block';
      this.meter.style.left = `${at.x}px`;
      this.meter.style.top = `${at.y}px`;
      this.meter.style.setProperty('--p', String(Math.max(0, f.budget / TUNE.umbrellaTicks)));
    } else {
      this.meter.style.display = 'none';
    }

    // name tags while everyone gets their bearings
    const tagsOn = (s.phase === 'intro' || (s.phase === 'aim' && !s.aim.pulling && s.phaseTick < 150)) && s.launchIndex < 2;
    for (const seat of [0, 1] as const) {
      const tag = this.tags[seat];
      if (tagsOn) {
        view.headPosition(seat, this.pos);
        const at = view.project(this.pos.x, this.pos.y + (seat === C ? 1.1 : 0.15), size.width, size.height);
        tag.style.left = `${at.x}px`;
        tag.style.top = `${at.y}px`;
        const want = `${esc(this.seats[seat].name)}<small class="${seat === L ? '' : 'catch'}">${seat === L ? 'launch' : 'catch'}</small>`;
        if (tag.dataset.k !== `${seat}${L}`) {
          tag.dataset.k = `${seat}${L}`;
          tag.innerHTML = want;
        }
      }
      tag.classList.toggle('show', tagsOn);
    }

    // aim clock for the last five seconds
    const left = TIMING.aimLimit - s.phaseTick;
    if (s.phase === 'aim' && left <= TIMING.aimWarn && left > 0) {
      this.clock.style.display = 'block';
      this.clock.textContent = String(Math.ceil(left / TICK_HZ));
    } else {
      this.clock.style.display = 'none';
    }

    this.updateHints(s, size, shared);
  }

  private updateHints(s: CourierState, size: StageSize, shared: boolean): void {
    const L = s.launcherSeat;
    const learned = this.profile.learned;
    for (const seat of [0, 1] as const) {
      let text = '';
      if (this.seats[seat].kind === 'human') {
        if (seat === L) {
          if (s.phase === 'aim' && !learned.pull && !s.aim.pulling) text = `${ICON.hand}Pull back anywhere, then let go`;
          else if (s.phase === 'aim' && !learned.pull && s.aim.pulling) text = 'Let go to fly!';
          else if (s.phase === 'flight' && !learned.umbrella && s.flyer.airTicks > 22 && !s.flyer.spent) {
            text = this.profile.settings.umbrellaToggle ? 'Tap to open your umbrella' : 'Hold to open your umbrella';
          }
        } else {
          if ((s.phase === 'aim' || s.phase === 'intro') && !learned.run) text = 'Drag left or right to run';
          else if (s.phase === 'flight' && !learned.dive && learned.run) text = 'Too far? Tap DIVE';
        }
      }
      const h = this.hints[seat];
      if (text !== this.lastHint[seat]) {
        this.lastHint[seat] = text;
        if (text) h.innerHTML = text;
        h.classList.toggle('show', !!text);
      }
      if (text) {
        const cx = shared ? (seat === 0 ? size.width * 0.25 : size.width * 0.75) : size.width * 0.5;
        h.style.left = `${cx}px`;
      }
    }
  }
}

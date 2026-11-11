/**
 * Menus and sheets: Home (Play Together / My Characters / My Worlds), the character picker and
 * builder, settings, pause, results. Plain DOM; the live 3D table is always visible behind.
 */
import { PRESET_CHARACTERS, SPEC_OPTIONS, describeSpec, randomSpec, sanitizeSpec } from '../characters';
import type { FieldOption } from '../characters/spec';
import { POINTS, starsFor } from '../attractions/courier/rules';
import type { CourierState, LaunchResult } from '../attractions/courier/sim';
import type { Profile, Settings } from '../core/profile';
import type { AudioKit, CharacterAction, CharacterSpec, Species } from '../kit/contracts';
import { esc } from './hud';
import { ICON } from './icons';

export type PlayMode = 'shared' | 'buddy' | 'online';

export interface AppApi {
  profile: Profile;
  audio: AudioKit;
  save(): void;
  cast(seat: 0 | 1): CharacterSpec;
  setSeatCharacter(seat: 0 | 1, spec: CharacterSpec): void;
  portrait(spec: CharacterSpec): string;
  startRound(mode: PlayMode): void;
  resume(): void;
  restart(): void;
  quitToHome(): void;
  demo(seat: 0 | 1, kind: 'wave' | 'cheer' | 'run' | 'fly' | 'spin'): void;
  applySettings(): void;
  buildLabel: string;
  online: OnlineApi;
}

export interface OnlineApi {
  /** false when no room server is configured for this build */
  available: boolean;
  create(): void;
  join(code: string): void;
  ready(ready: boolean): void;
  leave(): void;
  inviteLink(code: string): string;
}

/** The slice of a room the lobby screen needs (kept structural so the UI does not import net code). */
export interface RoomView {
  code: string;
  phase: 'lobby' | 'playing' | 'results';
  you: 0 | 1;
  seats: [({ name: string; ready: boolean; connected: boolean } | null), ({ name: string; ready: boolean; connected: boolean } | null)];
}

export interface ResultsInfo {
  mode: PlayMode;
  names: [string, string];
  best: number;
  newBest: boolean;
  ringsAvailable: number;
  assisted: boolean;
  /** online only: a bot took over a seat during the round */
  botFinished?: boolean;
}

const SPECIES_LABEL: Record<Species, string> = { human: 'Person', dog: 'Dog', cat: 'Cat' };

export class Screens {
  private editSeat: 0 | 1 = 0;
  private editTab: 'cast' | 'make' = 'cast';
  private randomSeed = 1;

  constructor(private root: HTMLElement, private api: AppApi) {}

  clear(): void {
    this.root.innerHTML = '';
  }

  private tap(): void {
    this.api.audio.play('ui_tap');
  }

  private on(sel: string, fn: (el: HTMLElement, ev: Event) => void, scope: ParentNode = this.root): void {
    scope.querySelectorAll<HTMLElement>(sel).forEach((el) =>
      el.addEventListener('click', (ev) => {
        fn(el, ev);
      }),
    );
  }

  // ───────────────────────────── home ─────────────────────────────

  home(): void {
    const a = this.api;
    const chip = (seat: 0 | 1): string => {
      const c = a.cast(seat);
      return `<button class="cast-chip" data-seat="${seat}" aria-label="Change player ${seat + 1} character">
        <span class="dot" style="background:${esc(c.accent)} url('${a.portrait(c)}') center/cover"></span>
        <span>${esc(c.name)}<small>Player ${seat + 1}</small></span></button>`;
    };
    this.root.innerHTML = `
      <div class="home">
        <div class="wordmark">
          <div class="small">BounceBack</div>
          <div class="big">Party Worlds</div>
          <div class="promise">Our people and pets, inside impossible little worlds.</div>
        </div>
        <div class="home-menu">
          <button class="btn primary big" data-act="play">${ICON.play}Play Together</button>
          <button class="btn" data-act="chars">${ICON.people}My Characters</button>
          <button class="btn" data-act="worlds">${ICON.globe}My Worlds</button>
        </div>
        <div class="home-foot">
          <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
          <span class="build">${esc(a.buildLabel)}</span>
        </div>
        <div class="cast-strip">${chip(0)}${chip(1)}</div>
      </div>`;
    this.on('[data-act="play"]', () => { this.tap(); this.playSheet(); });
    this.on('[data-act="chars"]', () => { this.tap(); this.characters(0); });
    this.on('[data-act="worlds"]', () => { this.tap(); this.worlds(); });
    this.on('[data-act="settings"]', () => { this.tap(); this.settings(() => this.home()); });
    this.on('.cast-chip', (el) => { this.tap(); this.characters(Number(el.dataset.seat) as 0 | 1); });
  }

  private playSheet(): void {
    const a = this.api;
    const p0 = esc(a.cast(0).name);
    const p1 = esc(a.cast(1).name);
    const sheet = document.createElement('div');
    sheet.className = 'scrim';
    sheet.innerHTML = `
      <div class="sheet card" role="dialog" aria-label="Play together">
        <div class="sheet-head">
          <div><h2>Catapult Courier</h2>
          <p>One of you is flung off a spoon. The other sprints to catch them. Swap every launch. Six launches, one score.</p></div>
          <button class="icon-btn" data-act="close" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="choices">
          <button class="choice primary" data-mode="shared">${ICON.couch}
            <span class="t">Same screen</span>
            <span class="d">Two players, one device. ${p0} takes the left side, ${p1} the right.</span></button>
          <button class="choice" data-mode="buddy">${ICON.robot}
            <span class="t">With Buddy <span class="tag bot">bot</span></span>
            <span class="d">Just you. ${p1} is played by Buddy, a computer partner who is good but not perfect.</span></button>
          <button class="choice" data-act="online" ${a.online.available ? '' : 'disabled'}>${ICON.wifi}
            <span class="t">Online room</span>
            <span class="d">${a.online.available
              ? 'Two devices, one private room. Share a four-letter code.'
              : 'Private rooms need the room server, which is not hosted for this build yet.'}</span></button>
        </div>
      </div>`;
    this.root.append(sheet);
    this.on('[data-act="close"]', () => { a.audio.play('ui_back'); sheet.remove(); }, sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
    this.on('[data-mode]', (el) => {
      a.audio.play('ui_confirm');
      a.startRound(el.dataset.mode as PlayMode);
    }, sheet);
    this.on('[data-act="online"]', () => { this.tap(); this.onlineEntry(); }, sheet);
  }

  // ───────────────────────────── online rooms ─────────────────────────────

  /** Create or join. `notice` carries a human-readable problem (expired code, full room…). */
  onlineEntry(notice = '', code = ''): void {
    const a = this.api;
    this.root.innerHTML = `
      <div class="scrim">
        <div class="sheet card" role="dialog" aria-label="Online room" style="width:min(100%, calc(var(--u) * 118))">
          <div class="sheet-head"><div><h2>Online room</h2>
            <p>A private room for two. Whoever makes it shares the code; the other types it in.</p></div>
            <button class="icon-btn" data-act="close" aria-label="Close">${ICON.close}</button></div>
          ${notice ? `<p class="notice" role="alert">${esc(notice)}</p>` : ''}
          <div class="online-row">
            <button class="btn primary big" data-act="create">${ICON.play}Make a room</button>
            <span class="muted">or</span>
            <input class="text-in code-in" id="room-code" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="4" placeholder="CODE" aria-label="Room code" value="${esc(code)}">
            <button class="btn go" data-act="join">Join</button>
          </div>
        </div>
      </div>`;
    const input = this.root.querySelector('#room-code') as HTMLInputElement;
    const join = (): void => {
      const v = input.value.trim().toUpperCase();
      if (v.length !== 4) { input.focus(); return; }
      a.audio.play('ui_confirm');
      this.onlineBusy('Finding the room…');
      a.online.join(v);
    };
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
    this.on('[data-act="join"]', join);
    this.on('[data-act="create"]', () => { a.audio.play('ui_confirm'); this.onlineBusy('Making a room…'); a.online.create(); });
    this.on('[data-act="close"]', () => { a.audio.play('ui_back'); a.online.leave(); });
  }

  onlineBusy(text: string): void {
    this.root.innerHTML = `<div class="scrim"><div class="sheet card" style="width:auto"><h2>${esc(text)}</h2></div></div>`;
  }

  /** The room's waiting area, before a round and between rounds. Re-rendered on every room update. */
  onlineRoom(room: RoomView, note = ''): void {
    const a = this.api;
    const me = room.seats[room.you];
    const other = room.seats[room.you === 0 ? 1 : 0];
    const seat = (s: RoomView['seats'][0], mine: boolean): string => s
      ? `<div class="room-seat ${s.ready ? 'ready' : ''}"><b>${esc(s.name)}</b>${mine ? ' <span class="tag soft">you</span>' : ''}
          <small>${!s.connected ? 'reconnecting…' : s.ready ? 'ready ✓' : 'not ready yet'}</small></div>`
      : `<div class="room-seat empty"><b>Waiting for a friend</b><small>share the code</small></div>`;
    const link = a.online.inviteLink(room.code);
    this.root.innerHTML = `
      <div class="scrim">
        <div class="sheet card" role="dialog" aria-label="Room ${esc(room.code)}" style="width:min(100%, calc(var(--u) * 118))">
          <div class="sheet-head"><div><h2>Room <span class="room-code">${esc(room.code)}</span></h2>
            <p>${other ? 'You are both here. Start when you are both ready.' : 'Tell your friend this code, or send them the link.'}${note ? ` ${esc(note)}` : ''}</p></div>
            <button class="icon-btn" data-act="leave" aria-label="Leave room">${ICON.close}</button></div>
          <div class="room-seats">${seat(room.seats[0], room.you === 0)}${seat(room.seats[1], room.you === 1)}</div>
          <div class="sheet-actions">
            <button class="btn" data-act="copy">Copy invite link</button>
            <button class="btn ${me?.ready ? '' : 'primary'} big" data-act="ready" ${other ? '' : 'disabled'}>${me?.ready ? `Waiting for ${esc(other?.name ?? 'friend')}…` : `${ICON.check}Ready`}</button>
          </div>
        </div>
      </div>`;
    this.on('[data-act="leave"]', () => { a.audio.play('ui_back'); a.online.leave(); });
    this.on('[data-act="ready"]', () => { a.audio.play('ui_confirm'); a.online.ready(!me?.ready); });
    this.on('[data-act="copy"]', (el) => {
      this.tap();
      const done = (ok: boolean): void => { el.textContent = ok ? 'Link copied' : link; };
      try {
        const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
        if (nav.share) nav.share({ title: 'Come play this with me', url: link }).catch(() => undefined);
        else if (nav.clipboard) nav.clipboard.writeText(link).then(() => done(true), () => done(false));
        else done(false);
      } catch { done(false); }
    });
  }

  // ───────────────────────────── characters ─────────────────────────────

  private allCharacters(): CharacterSpec[] {
    return [...this.api.profile.customCharacters, ...PRESET_CHARACTERS];
  }

  characters(seat: 0 | 1 = this.editSeat): void {
    this.editSeat = seat;
    const a = this.api;
    const cur = a.cast(seat);
    const isCustom = a.profile.customCharacters.some((c) => c.id === cur.id);
    this.root.innerHTML = `
      <div class="chars">
        <div class="chars-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>
          <h2>My Characters</h2>
        </div>
        <div class="panel card">
          <div class="seg" role="group" aria-label="Which player">
            <button data-seat="0" aria-pressed="${seat === 0}">Player 1 · ${esc(a.cast(0).name)}</button>
            <button data-seat="1" aria-pressed="${seat === 1}">Player 2 · ${esc(a.cast(1).name)}</button>
          </div>
          <div class="seg" role="group" aria-label="Pick or make">
            <button data-tab="cast" aria-pressed="${this.editTab === 'cast'}">Pick</button>
            <button data-tab="make" aria-pressed="${this.editTab === 'make'}">Make your own</button>
          </div>
          <div class="scroll" id="chars-body"></div>
          <div class="note">${esc(describeSpec(cur))}${isCustom ? ' · yours' : ''}. Looks never change how anyone plays.</div>
        </div>
      </div>
      <div class="try-row">
        <button class="btn small" data-demo="spin">Spin</button>
        <button class="btn small" data-demo="wave">Wave</button>
        <button class="btn small" data-demo="run">Run</button>
        <button class="btn small" data-demo="fly">Fly</button>
        <button class="btn small" data-demo="cheer">Cheer</button>
        <button class="btn go" data-act="done">${ICON.check}Done</button>
      </div>`;
    const body = this.root.querySelector('#chars-body') as HTMLElement;
    if (this.editTab === 'cast') this.renderCast(body, seat);
    else this.renderBuilder(body, seat);

    this.on('[data-act="back"], [data-act="done"]', () => { a.audio.play('ui_confirm'); a.save(); this.home(); });
    this.on('[data-seat]', (el) => { this.tap(); this.characters(Number(el.dataset.seat) as 0 | 1); });
    this.on('[data-tab]', (el) => { this.tap(); this.editTab = el.dataset.tab as 'cast' | 'make'; this.characters(seat); });
    this.on('[data-demo]', (el) => { this.tap(); a.demo(seat, el.dataset.demo as 'wave'); });
  }

  private renderCast(body: HTMLElement, seat: 0 | 1): void {
    const a = this.api;
    const cur = a.cast(seat);
    const list = this.allCharacters();
    body.innerHTML = `<div class="grid">${list.map((c, i) => `
      <button class="pick" data-i="${i}" aria-pressed="${c.id === cur.id}" title="${esc(describeSpec(c))}">
        <span class="swatch" style="background:${esc(c.accent)}"><img alt="" data-p="${i}" style="width:100%;height:100%;display:block"></span>
        <span>${esc(c.name)}</span><small>${SPECIES_LABEL[c.species]}</small>
      </button>`).join('')}</div>`;
    // portraits are real renders; fill them a few per frame so the list appears instantly
    const imgs = [...body.querySelectorAll<HTMLImageElement>('img[data-p]')];
    let n = 0;
    const fill = (): void => {
      if (!body.isConnected) return;
      for (let k = 0; k < 2 && n < imgs.length; k++, n++) {
        const img = imgs[n]!;
        img.src = a.portrait(list[Number(img.dataset.p)]!);
      }
      if (n < imgs.length) requestAnimationFrame(fill);
    };
    requestAnimationFrame(fill);
    this.on('.pick', (el) => {
      const c = list[Number(el.dataset.i)]!;
      a.audio.play('ui_confirm');
      a.setSeatCharacter(seat, c);
      this.characters(seat);
    }, body);
  }

  /** Copy-on-write: editing a preset makes a personal copy; editing your own changes it in place. */
  private editable(seat: 0 | 1): CharacterSpec {
    const a = this.api;
    const cur = a.cast(seat);
    if (a.profile.customCharacters.some((c) => c.id === cur.id)) return cur;
    return { ...cur, id: `mine-${Date.now().toString(36)}-${seat}` };
  }

  private commit(seat: 0 | 1, next: CharacterSpec): void {
    const a = this.api;
    const clean = sanitizeSpec(next);
    const list = a.profile.customCharacters;
    const at = list.findIndex((c) => c.id === clean.id);
    if (at >= 0) list[at] = clean;
    else list.unshift(clean);
    if (list.length > 24) list.length = 24;
    a.setSeatCharacter(seat, clean);
    a.save();
  }

  private renderBuilder(body: HTMLElement, seat: 0 | 1): void {
    const a = this.api;
    const cur = a.cast(seat);
    const fields = SPEC_OPTIONS.fields[cur.species] as readonly FieldOption[];
    const species = (['human', 'dog', 'cat'] as const)
      .map((sp) => `<button class="chip" data-species="${sp}" aria-pressed="${cur.species === sp}">${SPECIES_LABEL[sp]}</button>`)
      .join('');
    const fieldHtml = fields.map((f) => {
      const val = (cur as unknown as Record<string, unknown>)[f.key];
      if (f.kind === 'text') {
        return `<div class="field"><label for="f-${f.key}">${esc(f.label)}</label>
          <input class="text-in" id="f-${f.key}" data-text="${f.key}" maxlength="${SPEC_OPTIONS.limits.nameMaxLength}" value="${esc(String(val ?? ''))}" autocomplete="off" autocapitalize="words" enterkeyhint="done"></div>`;
      }
      if (f.kind === 'color') {
        return `<div class="field"><span class="flabel">${esc(f.label)}</span><div class="swatches">${(f.swatches ?? [])
          .map((s) => `<button class="sw" data-color="${f.key}" data-hex="${esc(s.hex)}" style="background:${esc(s.hex)}" aria-label="${esc(s.name)}" aria-pressed="${String(val).toLowerCase() === s.hex.toLowerCase()}"></button>`)
          .join('')}</div></div>`;
      }
      if (f.kind === 'enum') {
        return `<div class="field"><span class="flabel">${esc(f.label)}</span><div class="chips">${(f.values ?? [])
          .map((v) => `<button class="chip" data-enum="${f.key}" data-val="${esc(v)}" aria-pressed="${val === v}">${esc(v)}</button>`)
          .join('')}</div></div>`;
      }
      return `<div class="field"><label for="f-${f.key}">${esc(f.label)} <span class="muted">(${esc(f.lowLabel ?? 'less')} → ${esc(f.highLabel ?? 'more')})</span></label>
        <input type="range" id="f-${f.key}" data-range="${f.key}" min="0" max="1" step="0.05" value="${Number(val ?? 0.5)}"></div>`;
    }).join('');
    body.innerHTML = `
      <div class="field"><span class="flabel">Who is it?</span><div class="chips">${species}
        <button class="chip" data-act="surprise">${ICON.wand} Surprise me</button></div></div>
      ${fieldHtml}
      <p class="note">Photo-to-character is not connected in this build. Nothing you make here leaves this device.</p>`;

    const edit = (patch: Partial<CharacterSpec>, rerender = true): void => {
      this.commit(seat, { ...this.editable(seat), ...patch });
      if (rerender) {
        const top = body.scrollTop;
        this.characters(seat);
        const nb = this.root.querySelector('#chars-body') as HTMLElement | null;
        if (nb) nb.scrollTop = top;
      }
    };
    this.on('[data-species]', (el) => {
      this.tap();
      const sp = el.dataset.species as Species;
      if (sp === cur.species) return;
      const base = this.editable(seat);
      const fresh = randomSpec(sp, this.randomSeed++ * 7919 + 11);
      this.commit(seat, { ...fresh, id: base.id, name: cur.name });
      this.characters(seat);
    }, body);
    this.on('[data-act="surprise"]', () => {
      a.audio.play('ui_confirm');
      const base = this.editable(seat);
      const fresh = randomSpec(cur.species, (Date.now() & 0xffff) + this.randomSeed++ * 104729);
      this.commit(seat, { ...fresh, id: base.id, name: cur.name });
      this.characters(seat);
    }, body);
    this.on('[data-color]', (el) => { this.tap(); edit({ [el.dataset.color!]: el.dataset.hex } as Partial<CharacterSpec>); }, body);
    this.on('[data-enum]', (el) => { this.tap(); edit({ [el.dataset.enum!]: el.dataset.val } as Partial<CharacterSpec>); }, body);
    body.querySelectorAll<HTMLInputElement>('[data-range]').forEach((inp) =>
      inp.addEventListener('change', () => edit({ [inp.dataset.range!]: Number(inp.value) } as Partial<CharacterSpec>, false)));
    body.querySelectorAll<HTMLInputElement>('[data-text]').forEach((inp) =>
      inp.addEventListener('change', () => edit({ name: inp.value } as Partial<CharacterSpec>)));
  }

  // ───────────────────────────── worlds ─────────────────────────────

  private worlds(): void {
    const sheet = document.createElement('div');
    sheet.className = 'scrim';
    sheet.innerHTML = `
      <div class="sheet card" role="dialog" aria-label="My worlds">
        <div class="sheet-head"><div><h2>My Worlds</h2>
          <p>Each world is a real place at tiny scale, and it remembers what you do to it.</p></div>
          <button class="icon-btn" data-act="close" aria-label="Close">${ICON.close}</button></div>
        <div class="row"><span class="lbl"><b>The Birthday Continental</b> <span class="tag">playable</span>
          <small>A birthday table: jelly trampolines, donut rings, a spoon catapult, a cake cliff. Attraction: Catapult Courier.</small></span></div>
        <div class="row"><span class="lbl"><b>The Place Between the Cushions</b> <span class="tag soft">drawing board</span>
          <small>A lost-object city inside a sofa. Not built yet.</small></span></div>
        <div class="row"><span class="lbl"><b>The Lunchbox Frontier</b> <span class="tag soft">drawing board</span>
          <small>Sandwich cliffs and a thermos waterfall. Not built yet.</small></span></div>
        <div class="row"><span class="lbl"><b>The Claw Cabinet</b> <span class="tag soft">drawing board</span>
          <small>One of you becomes the giant outside the glass. Not built yet.</small></span></div>
      </div>`;
    this.root.append(sheet);
    this.on('[data-act="close"]', () => { this.api.audio.play('ui_back'); sheet.remove(); }, sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
  }

  // ───────────────────────────── settings / pause ─────────────────────────────

  settings(onClose: () => void): void {
    const a = this.api;
    const s = a.profile.settings;
    const sw = (key: keyof Settings, label: string, sub: string): string => `
      <div class="row"><span class="lbl">${label}<small>${sub}</small></span>
        <button class="switch" role="switch" data-sw="${key}" aria-checked="${!!s[key]}" aria-label="${label}"></button></div>`;
    const range = (key: 'master' | 'music' | 'sfx', label: string): string => `
      <div class="row"><span class="lbl">${label}</span>
        <input type="range" min="0" max="1" step="0.05" value="${s[key]}" data-vol="${key}" aria-label="${label}"></div>`;
    const sheet = document.createElement('div');
    sheet.className = 'scrim';
    sheet.innerHTML = `
      <div class="sheet card" role="dialog" aria-label="Settings">
        <div class="sheet-head"><h2>Settings</h2>
          <button class="icon-btn" data-act="close" aria-label="Close">${ICON.close}</button></div>
        ${range('master', 'Volume')}${range('music', 'Music')}${range('sfx', 'Sound effects')}
        ${sw('reducedMotion', 'Reduced motion', 'Steady wide camera, no shake or zoom punches.')}
        ${sw('aimAssist', 'Aim assist', 'Shows the whole flight path and the landing spot. Marked on the results.')}
        ${sw('umbrellaToggle', 'Tap umbrella', 'Tap to open and tap to close, instead of holding.')}
        ${sw('leftHanded', 'Left-handed', 'Puts the DIVE button on the left.')}
        ${sw('haptics', 'Vibration', 'Light taps on supported devices.')}
      </div>`;
    this.root.append(sheet);
    const close = (): void => { a.audio.play('ui_back'); a.save(); sheet.remove(); onClose(); };
    this.on('[data-act="close"]', close, sheet);
    this.on('[data-sw]', (el) => {
      const key = el.dataset.sw as keyof Settings;
      (s as unknown as Record<string, boolean>)[key] = !s[key];
      el.setAttribute('aria-checked', String(!!s[key]));
      a.audio.play('ui_toggle');
      a.applySettings();
    }, sheet);
    sheet.querySelectorAll<HTMLInputElement>('[data-vol]').forEach((inp) =>
      inp.addEventListener('input', () => {
        s[inp.dataset.vol as 'master'] = Number(inp.value);
        a.applySettings();
      }));
  }

  pause(): void {
    const a = this.api;
    this.root.innerHTML = `
      <div class="scrim">
        <div class="sheet card" role="dialog" aria-label="Paused" style="width:min(100%, calc(var(--u) * 96))">
          <h2>Paused</h2><p>Nothing is lost. Jump back in whenever you like.</p>
          <div class="sheet-actions" style="justify-content:flex-start">
            <button class="btn primary big" data-act="resume">${ICON.play}Resume</button>
            <button class="btn" data-act="restart">${ICON.retry}Restart</button>
            <button class="btn" data-act="settings">${ICON.gear}Settings</button>
            <button class="btn" data-act="quit">${ICON.home}Leave</button>
          </div>
        </div>
      </div>`;
    this.on('[data-act="resume"]', () => { a.audio.play('ui_confirm'); this.clear(); a.resume(); });
    this.on('[data-act="restart"]', () => { a.audio.play('ui_confirm'); this.clear(); a.restart(); });
    this.on('[data-act="settings"]', () => { this.tap(); this.settings(() => undefined); });
    this.on('[data-act="quit"]', () => { a.audio.play('ui_back'); a.quitToHome(); });
  }

  // ───────────────────────────── results ─────────────────────────────

  results(state: CourierState, info: ResultsInfo): void {
    const a = this.api;
    const stars = starsFor(state.total, state.launches, info.ringsAvailable);
    const caught = state.results.filter((r) => r.caught).length;
    const headline = stars === 3 ? 'Special delivery!' : stars === 2 ? 'Nicely caught!' : stars === 1 ? 'Getting the hang of it' : 'The table won this one';
    const describe = (r: LaunchResult): { what: string; sub: string } => {
      const who = esc(info.names[r.launcherSeat]);
      const catcher = esc(info.names[r.launcherSeat === 0 ? 1 : 0]);
      if (r.caught) {
        const bits: string[] = [`catch ${POINTS.caught}`];
        if (r.perfect) bits.push(`perfect ${POINTS.perfect}`);
        if (r.diveCatch) bits.push(`dive ${POINTS.dive}`);
        if (r.rings) bits.push(`donut ${POINTS.ring * r.rings}`);
        if (r.jelly) bits.push(`jelly ${POINTS.jelly}`);
        return { what: `${who} flew, ${catcher} caught`, sub: bits.join(' + ') };
      }
      const why = r.missKind === 'table'
        ? `landed ${r.missBy.toFixed(1)} from the basket`
        : r.missKind === 'stranded' ? 'stuck on a cupcake' : r.missKind === 'off_edge' ? 'flew off the table' : 'never came down';
      const lost = r.rings || r.jelly ? ' · bonuses only count when caught' : '';
      return { what: `${who} flew, ${why}`, sub: `no catch${lost}` };
    };
    const rows = state.results.map((r, i) => {
      const d = describe(r);
      return `<div class="launch-row ${r.caught ? '' : 'miss'}"><span class="n">${i + 1}</span>
        <span class="what">${d.what}<small>${d.sub}</small></span><span class="pts">${r.points}</span></div>`;
    }).join('');
    const star = (i: number): string =>
      ICON.star.replace('<svg', `<svg class="${i < stars ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.22}s"`);
    this.root.innerHTML = `
      <div class="scrim">
        <div class="results card" role="dialog" aria-label="Results">
          <div class="results-top">
            <div><h2>${headline}</h2>
              <div class="muted" style="font-size:calc(var(--u)*3.1)">${caught} of ${state.launches} caught · ${esc(info.names[0])} &amp; ${esc(info.names[1])}${info.mode === 'buddy' ? ' <span class="tag bot">bot partner</span>' : ''}${info.botFinished ? ' <span class="tag bot">finished with a bot</span>' : ''}${info.assisted ? ' <span class="tag soft">aim assist on</span>' : ''}</div>
              <div class="stars" aria-label="${stars} of 3 stars">${star(0)}${star(1)}${star(2)}</div></div>
            <div style="text-align:right"><div class="total">${state.total}<small>${info.newBest ? 'new best!' : `best ${info.best}`}</small></div></div>
          </div>
          <div class="launch-list">${rows}</div>
          <div class="sheet-actions">
            <button class="btn" data-act="home">${ICON.home}Home</button>
            <button class="btn" data-act="chars">${ICON.people}Characters</button>
            <button class="btn primary big" data-act="again">${ICON.retry}Again</button>
          </div>
        </div>
      </div>`;
    if (info.mode === 'online') {
      // same room, same people: "Again" readies you up and the round starts when both have
      (this.root.querySelector('[data-act="chars"]') as HTMLElement).remove();
      (this.root.querySelector('[data-act="home"]') as HTMLElement).innerHTML = `${ICON.home}Leave room`;
      this.on('[data-act="again"]', (el) => {
        a.audio.play('ui_confirm');
        el.setAttribute('disabled', '');
        el.textContent = 'Waiting for your friend…';
        a.online.ready(true);
      });
      this.on('[data-act="home"]', () => { a.audio.play('ui_back'); a.online.leave(); });
    } else {
      this.on('[data-act="again"]', () => { a.audio.play('ui_confirm'); this.clear(); a.restart(); });
      this.on('[data-act="home"]', () => { a.audio.play('ui_back'); a.quitToHome(); });
      this.on('[data-act="chars"]', () => { this.tap(); a.quitToHome(); this.characters(0); });
    }
    // stars chime in as they pop
    for (let i = 0; i < stars; i++) {
      window.setTimeout(() => a.audio.play('star', { pitch: 1 + i * 0.18 }), 250 + i * 220);
    }
  }
}

export type { CharacterAction };

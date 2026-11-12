/**
 * Menus and sheets: Home (Play Together / My Characters / My Worlds), the character picker and
 * builder, settings, pause, results. Plain DOM; the live 3D table is always visible behind.
 */
import { PRESET_CHARACTERS, SPEC_OPTIONS, describeSpec, randomSpec, sanitizeSpec } from '../characters';
import type { FieldOption } from '../characters/spec';
import { POINTS, starsFor } from '../attractions/courier/rules';
import type { CourierState, LaunchResult } from '../attractions/courier/sim';
import { MAX_CUSTOM } from '../core/profile';
import type { Profile, Settings } from '../core/profile';
import type { AudioKit, CharacterAction, CharacterSpec, Species } from '../kit/contracts';
import { esc } from './hud';
import { ICON } from './icons';
import { RIVAL_LEVELS, rivalLevel } from '../attractions/dash/rivals';

export type PlayMode = 'shared' | 'buddy' | 'online';
export type RaceMode = 'solo' | 'split';

export interface RaceRow {
  place: number;
  name: string;
  color: string;
  /** a rendered head-and-shoulders of the driver (data URL) */
  face: string;
  bot: boolean;
  /** '' for a rival, otherwise how to mark a person on this device: "you", "P1", "P2" */
  you: string;
  time: string;
  best: string;
  /** armed races: how many rivals this driver wrecked ('' in a plain race) */
  wrecks: string;
  /** armed races: how many times this driver was wrecked */
  wrecked: number;
}

export interface RaceResultsInfo {
  rows: RaceRow[];
  headline: string;
  note: string;
  best: string;
  newBest: boolean;
  /** which rivals this was against, e.g. "Gentle rivals" */
  rivals: string;
  /** an armed race: the rows carry wreck counts */
  combat: boolean;
  /** name of the next rival level when the player has earned the suggestion, else '' */
  stepUp: string;
  /** the thing being played for: a head-to-head score, or a medal */
  stakes: RaceStakes | null;
  /** label of the main button */
  again: string;
}

export type RaceStakes =
  | { kind: 'series'; names: [string, string]; faces: [string, string]; colors: [string, string]; wins: [number, number]; target: number; line: string; over: boolean }
  | { kind: 'medal'; medal: 'gold' | 'silver' | 'bronze' | ''; title: string; line: string };

export interface AppApi {
  profile: Profile;
  audio: AudioKit;
  save(): void;
  cast(seat: 0 | 1): CharacterSpec;
  setSeatCharacter(seat: 0 | 1, spec: CharacterSpec): void;
  portrait(spec: CharacterSpec): string;
  startRound(mode: PlayMode): void;
  startRace(mode: RaceMode): void;
  resume(): void;
  restart(): void;
  /** rematch against the next rival level up */
  stepUp(): void;
  quitToHome(): void;
  demo(seat: 0 | 1, kind: 'wave' | 'cheer' | 'run' | 'fly' | 'spin'): void;
  applySettings(): void;
  /** the karts in the menu are shown armed or not, to match the weapons setting */
  showWeapons(): void;
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
/** What a driver is, in a word, for the picker. */
function kindOf(c: CharacterSpec): string {
  if (c.species !== 'human') return SPECIES_LABEL[c.species];
  if (c.creature && c.creature !== 'none') return c.creature === 'luchador' ? 'Wrestler' : c.creature.charAt(0).toUpperCase() + c.creature.slice(1);
  return c.age === 'kid' ? 'Kid' : 'Grown-up';
}

/** True where the browser lets a page go full screen (not iPhone Safari, not every embedded viewer). */
function canFullscreen(): boolean {
  try {
    return !!document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';
  } catch {
    return false;
  }
}

function toggleFullscreen(): void {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
  } catch {
    /* not allowed here: the button simply does nothing */
  }
}

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
          <div class="promise">Tiny karts. Loaded guns. One more race.</div>
        </div>
        <div class="home-menu">
          <button class="btn primary big" data-act="play">${ICON.play}Race</button>
          <button class="btn" data-act="chars">${ICON.people}Drivers</button>
          <button class="btn" data-act="worlds">${ICON.globe}Tracks</button>
        </div>
        <div class="home-foot">
          <button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button>
          ${canFullscreen() ? `<button class="icon-btn" data-act="fullscreen" aria-label="Full screen">${ICON.expand}</button>` : ''}
          <span class="build">${esc(a.buildLabel)}</span>
        </div>
        <div class="cast-strip">${chip(0)}${chip(1)}</div>
      </div>`;
    this.on('[data-act="play"]', () => { this.tap(); this.playSheet(); });
    this.on('[data-act="chars"]', () => { this.tap(); this.characters(0); });
    this.on('[data-act="worlds"]', () => { this.tap(); this.worlds(); });
    this.on('[data-act="settings"]', () => { this.tap(); this.settings(() => this.home()); });
    this.on('[data-act="fullscreen"]', () => { this.tap(); toggleFullscreen(); });
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
          <div><h2>Backyard Dash</h2>
          <p class="pitch">${Screens.pitch(a.profile.settings.weapons)}</p></div>
          <button class="icon-btn" data-act="close" aria-label="Close">${ICON.close}</button>
        </div>
        <div class="choices two">
          <button class="choice primary" data-race="solo">${ICON.play}
            <span class="t">Race</span>
            <span class="d">You as ${p0}, against ${p1} and two more. Rivals are bots and say so.</span></button>
          <button class="choice" data-race="split">${ICON.couch}
            <span class="t">Split screen</span>
            <span class="d">Two players, one screen: ${p0} left, ${p1} right, plus two bot rivals. Thumbs, one keyboard (A/D + W · ←/→ + ↑) or two controllers.</span></button>
        </div>
        <div class="rivals-row">
          <span class="lbl">Rivals</span>
          <div class="seg" role="group" aria-label="Rival difficulty">${RIVAL_LEVELS.map((l, i) => `<button data-rivals="${i}" aria-pressed="${i === a.profile.settings.rivals}">${l.name}</button>`).join('')}</div>
          <span class="muted blurb">${esc(rivalLevel(a.profile.settings.rivals).blurb)}</span>
        </div>
        <div class="rivals-row">
          <span class="lbl">Weapons</span>
          <div class="seg" role="group" aria-label="Weapons"><button data-weapons="1" aria-pressed="${a.profile.settings.weapons}">Armed</button><button data-weapons="0" aria-pressed="${!a.profile.settings.weapons}">Clean</button></div>
          <span class="muted blurb arms">${Screens.arms(a.profile.settings.weapons)}</span>
        </div>
        <div class="parked">
          <span class="muted">Parked experiment · Catapult Courier:</span>
          <button class="btn small" data-mode="buddy">Bot partner</button>
          <button class="btn small" data-mode="shared">Same screen</button>
          <button class="btn small" data-act="online" ${a.online.available ? '' : 'disabled'}>Online</button>
        </div>
      </div>`;
    this.root.append(sheet);
    this.on('[data-act="close"]', () => { a.audio.play('ui_back'); sheet.remove(); }, sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.remove(); });
    this.on('[data-rivals]', (el) => {
      this.tap();
      a.profile.settings.rivals = Number(el.dataset.rivals);
      a.save();
      sheet.querySelectorAll('[data-rivals]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      (sheet.querySelector('.blurb') as HTMLElement).textContent = rivalLevel(a.profile.settings.rivals).blurb;
    }, sheet);
    this.on('[data-weapons]', (el) => {
      this.tap();
      const on = el.dataset.weapons === '1';
      a.profile.settings.weapons = on;
      a.save();
      a.showWeapons();
      sheet.querySelectorAll('[data-weapons]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      (sheet.querySelector('.arms') as HTMLElement).textContent = Screens.arms(on);
      (sheet.querySelector('.pitch') as HTMLElement).textContent = Screens.pitch(on);
    }, sheet);
    this.on('[data-race]', (el) => {
      a.audio.play('ui_confirm');
      a.startRace(el.dataset.race as RaceMode);
    }, sheet);
    this.on('[data-mode]', (el) => {
      a.audio.play('ui_confirm');
      a.startRound(el.dataset.mode as PlayMode);
    }, sheet);
    this.on('[data-act="online"]', () => { this.tap(); this.onlineEntry(); }, sheet);
  }

  /** Race results: finishing order, times, and what happened to the shortcut. */
  private static pitch(armed: boolean): string {
    return armed
      ? 'Three laps of the patio after dark, armed. Shoot what is in front of you, mine what is behind you, and get round before your armour runs out.'
      : "Three laps of the patio after dark. Drift for boosts, sit in a rival's wake, and decide who pays to open the shortcut.";
  }

  private static arms(armed: boolean): string {
    return armed ? 'Guns, mines and armour for everyone, rivals included. A wreck costs a few seconds.' : 'No weapons: a straight race.';
  }

  raceResults(info: RaceResultsInfo): void {
    const a = this.api;
    const rows = info.rows.map((r) => `
      <div class="race-row ${r.you ? 'you' : ''}">
        <span class="pl">${r.place}</span>
        <span class="dot" style="background:${esc(r.color)} url('${r.face}') center/cover"></span>
        <span class="nm">${esc(r.name)}${r.bot ? ' <span class="tag bot">bot</span>' : ''}${r.you ? ` <span class="tag soft">${esc(r.you)}</span>` : ''}</span>
        <span class="tm">${esc(r.time)}</span>
        <span class="bl">${esc(r.best)}</span>
        ${info.combat ? `<span class="wk">${esc(r.wrecks)}<small>${r.wrecked ? `−${r.wrecked}` : ''}</small></span>` : ''}
      </div>`).join('');
    const st = info.stakes;
    const pipsOf = (n: number, target: number): string => Array.from({ length: target }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    const stakes = !st ? '' : st.kind === 'series'
      ? `<div class="stakes series${st.over ? ' over' : ''}">
          <div class="side"><span class="dot" style="background:${esc(st.colors[0])} url('${st.faces[0]}') center/cover"></span><b>${esc(st.names[0])}</b><span class="pips">${pipsOf(st.wins[0], st.target)}</span></div>
          <div class="tally">${st.wins[0]}<small>–</small>${st.wins[1]}</div>
          <div class="side right"><span class="pips">${pipsOf(st.wins[1], st.target)}</span><b>${esc(st.names[1])}</b><span class="dot" style="background:${esc(st.colors[1])} url('${st.faces[1]}') center/cover"></span></div>
          <div class="line">${esc(st.line)}</div>
        </div>`
      : `<div class="stakes medal ${st.medal || 'none'}">
          <span class="disc">${st.medal ? ICON.star : ''}</span>
          <div><b>${esc(st.title)}</b><div class="line">${esc(st.line)}</div></div>
        </div>`;
    this.root.innerHTML = `
      <div class="scrim clear">
        <div class="results card" role="dialog" aria-label="Race results">
          <div class="results-top">
            <div><h2>${esc(info.headline)}</h2>
              <div class="muted" style="font-size:calc(var(--u)*3.1)">${esc(info.rivals)} · ${esc(info.note)}</div></div>
            ${st && st.kind === 'series' ? '' : `<div style="text-align:right"><div class="total" style="font-size:calc(var(--u)*7)">${esc(info.best)}<small>${info.newBest ? 'new best race!' : 'your best race'}</small></div></div>`}
          </div>
          ${stakes}
          <div class="race-rows${info.combat ? ' combat' : ''}"><div class="race-row head"><span class="pl"></span><span class="dot"></span><span class="nm">Driver</span><span class="tm">Race</span><span class="bl">Best lap</span>${info.combat ? '<span class="wk">Wrecks</span>' : ''}</div>${rows}</div>
          <div class="sheet-actions">
            <button class="btn" data-act="home">${ICON.home}Home</button>
            ${info.stepUp ? `<button class="btn" data-act="stepup">Try ${esc(info.stepUp)} rivals</button>` : `<button class="btn" data-act="chars">${ICON.people}Characters</button>`}
            <button class="btn primary big" data-act="again">${ICON.retry}${esc(info.again)}</button>
          </div>
        </div>
      </div>`;
    this.on('[data-act="again"]', () => { a.audio.play('ui_confirm'); this.clear(); a.restart(); });
    this.on('[data-act="stepup"]', () => { a.audio.play('ui_confirm'); this.clear(); a.stepUp(); });
    this.on('[data-act="home"]', () => { a.audio.play('ui_back'); a.quitToHome(); });
    this.on('[data-act="chars"]', () => { this.tap(); a.quitToHome(); this.characters(0); });
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
          <h2>Drivers</h2>
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
        <button class="btn small" data-demo="run">Rev</button>
        <button class="btn small" data-demo="fly">Boost</button>
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
        <span>${esc(c.name)}</span><small>${kindOf(c)}</small>
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
    if (list.length > MAX_CUSTOM) list.length = MAX_CUSTOM;
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
        <div class="sheet-head"><div><h2>Tracks</h2>
          <p>Each world is a real place at tiny scale, and it remembers what you do to it.</p></div>
          <button class="icon-btn" data-act="close" aria-label="Close">${ICON.close}</button></div>
        <div class="row"><span class="lbl"><b>Backyard After Dark</b> <span class="tag">playable</span>
          <small>A patio at night: a garden-hose hairpin, a brick chicane, a plank across the flowerbed. Race: Backyard Dash.</small></span></div>
        <div class="row"><span class="lbl"><b>The Birthday Continental</b> <span class="tag soft">parked</span>
          <small>A birthday table with a spoon catapult. Catapult Courier still plays, but racing is the focus now.</small></span></div>
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
        ${sw('autoDrift', 'Auto drift', 'Steering hard starts the slide by itself, for one-thumb play. Always on when two share a touch screen.')}
        ${sw('autoFire', 'Auto fire', 'In an armed race the guns shoot by themselves when a rival is in your sights. Always on when two share a touch screen.')}
        ${sw('leftHanded', 'Left-handed', 'Puts DRIFT and BRAKE on the left.')}
        ${sw('reducedMotion', 'Reduced motion', 'No camera shake, roll, orbit or speed zoom.')}
        ${sw('haptics', 'Vibration', 'Light taps on supported devices.')}
        <div class="field" style="margin:calc(var(--u)*2.4) 0 0"><span class="flabel">Parked experiment · Catapult Courier</span></div>
        ${sw('aimAssist', 'Aim assist', 'Shows the whole flight path and the landing spot. Marked on the results.')}
        ${sw('umbrellaToggle', 'Tap umbrella', 'Tap to open and tap to close, instead of holding.')}
        <p class="build">Build ${esc(__BUILD__)}</p>
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
        : r.missKind === 'stranded' ? 'got stuck' : r.missKind === 'off_edge' ? 'flew off the table' : 'never came down';
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

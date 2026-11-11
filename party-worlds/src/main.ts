/**
 * BounceBack Party Worlds — app shell.
 *
 * The game is a kart racer first: the menu lives in the night backyard with your two characters
 * parked in their karts. Catapult Courier (the birthday-table attraction) is kept as a parked
 * experiment and loaded only when chosen.
 */
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/styles.css';

import { createAudioKit } from './audio';
import { createSilentAudio } from './kit/silent-audio';
import type { AudioKit, CharacterSpec } from './kit/contracts';
import { PRESET_CHARACTERS, sanitizeSpec } from './characters';
import { CourierControls } from './attractions/courier/controls';
import { NetCourierSession } from './attractions/courier/netsession';
import { ARENAS, DEFAULT_ARENA, ringsInScript } from './attractions/courier/rules';
import { CourierSession } from './attractions/courier/session';
import type { SeatKind } from './attractions/courier/session';
import type { CourierState } from './attractions/courier/sim';
import { CourierView } from './attractions/courier/view';
import { RaceControls, RaceHud, RaceSession } from './attractions/dash/play';
import { RIVAL_LEVELS, rivalLevel } from './attractions/dash/rivals';
import type { RaceState } from './attractions/dash/sim';
import { RACE, backyard } from './attractions/dash/track';
import { RaceView } from './attractions/dash/view';
import { FixedLoop } from './core/loop';
import { Pointers } from './core/pointers';
import { buzz, loadProfile, saveProfile } from './core/profile';
import { Viewport } from './core/viewport';
import { RoomClient, roomServerUrl } from './net/client';
import type { StartMsg } from './net/client';
import type { RoomInfo } from './net/protocol';
import { PortraitStudio } from './render/portrait';
import { createStage } from './render/stage';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';
import type { AppApi, PlayMode, RaceMode, RaceRow } from './ui/screens';

const BUILD_LABEL = 'Racing prototype · web build';

interface CourierRound {
  state: CourierState;
  paused: boolean;
  tick(): void;
  dispose(): void;
  onDone: ((s: CourierState) => void) | null;
}

function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

function layer(parent: HTMLElement): HTMLElement {
  const d = document.createElement('div');
  d.className = 'hud-layer';
  d.hidden = true;
  parent.append(d);
  return d;
}

const seconds = (ticks: number): string => `${(ticks / 60).toFixed(2)} s`;

function boot(): void {
  const stageEl = $('stage');
  const canvas = $('gl') as HTMLCanvasElement;
  const viewport = new Viewport(stageEl);
  const profile = loadProfile();
  // sound is optional: if Web Audio cannot start, the game plays silently
  let audio: AudioKit;
  try {
    audio = createAudioKit();
  } catch {
    audio = createSilentAudio();
  }
  const stage = createStage(canvas, { maxPixelRatio: 2 });
  const pointers = new Pointers(canvas, viewport);
  const params = new URLSearchParams(window.location.search);

  // ── cast: seats 0 and 1 are yours; two more of the cast fill the grid ──
  const everyone = (): CharacterSpec[] => [...profile.customCharacters.map(sanitizeSpec), ...PRESET_CHARACTERS];
  const find = (id: string): CharacterSpec | undefined => everyone().find((c: CharacterSpec) => c.id === id);
  const firstOf = (species: string): CharacterSpec =>
    PRESET_CHARACTERS.find((c: CharacterSpec) => c.species === species) ?? PRESET_CHARACTERS[0]!;
  const cast: [CharacterSpec, CharacterSpec] = [
    find(profile.seats[0]) ?? firstOf('human'),
    find(profile.seats[1]) ?? firstOf('dog'),
  ];
  const rivals = (): [CharacterSpec, CharacterSpec] => {
    const free = PRESET_CHARACTERS.filter((c: CharacterSpec) => c.id !== cast[0].id && c.id !== cast[1].id);
    const cat = free.find((c: CharacterSpec) => c.species === 'cat') ?? free[0]!;
    const person = free.find((c: CharacterSpec) => c.species === 'human' && c.id !== cat.id) ?? free[1] ?? free[0]!;
    return [cat, person];
  };
  const grid = (): CharacterSpec[] => [cast[0], cast[1], ...rivals()];

  // ── views ──
  const raceView = new RaceView(stage.renderer, stage.scene.environment, audio, grid(), profile.settings);
  let courierView: CourierView | null = null;
  const studio = new PortraitStudio(stage);
  const hudRoot = $('hud');
  hudRoot.hidden = false;
  const courierControls = new CourierControls(pointers, profile.settings);
  const raceControls = new RaceControls(pointers, profile.settings);
  const courierHud = new Hud(layer(hudRoot), $('popups'), courierControls, profile);
  const raceHud = new RaceHud(layer(hudRoot), raceControls, profile.learned);

  let active: 'race' | 'courier' = 'race';
  let race: RaceSession | null = null;
  let raceMode: RaceMode = 'solo';
  let raceLevel = 0;
  let round: CourierRound | null = null;
  let mode: PlayMode = 'buddy';
  let last: 'race' | 'courier' = 'race';
  let seed = (Date.now() & 0xffff) + 1;
  let roundNames: [string, string] = [cast[0].name, cast[1].name];
  const lapsParam = Number(params.get('laps'));
  const raceLaps = Number.isFinite(lapsParam) && lapsParam >= 1 ? Math.min(5, Math.floor(lapsParam)) : RACE.laps;
  const launchesParam = Number(params.get('launches'));
  const roundLaunches = Number.isFinite(launchesParam) && launchesParam >= 1 ? Math.min(6, Math.floor(launchesParam)) : 6;

  const applySettings = (): void => {
    const s = profile.settings;
    audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
  };
  applySettings();
  raceView.onBuzz = (ms) => buzz(profile.settings, ms);

  function ensureCourier(): CourierView {
    if (!courierView) {
      courierView = new CourierView(stage, audio, cast, profile.settings, DEFAULT_ARENA);
      const v = courierView;
      v.onPopup = (p) => courierHud.popup(p, v, viewport.size);
      v.onBuzz = (ms) => buzz(profile.settings, ms);
    }
    return courierView;
  }

  function toLobby(): void {
    race?.dispose();
    race = null;
    round?.dispose();
    round = null;
    courierHud.show(false);
    raceHud.show(false);
    active = 'race';
    raceControls.reset();
    raceView.enterLobby();
    audio.music('menu');
  }

  // ───────────────────────────── racing ─────────────────────────────
  function startRace(m: RaceMode): void {
    raceMode = m;
    last = 'race';
    round?.dispose();
    round = null;
    race?.dispose();
    courierHud.show(false);
    active = 'race';
    const specs = grid();
    const level = rivalLevel(profile.settings.rivals);
    raceLevel = profile.settings.rivals;
    const humans = m === 'split' ? [0, 1] : [0];
    screens.clear();
    raceControls.attach();
    raceHud.show(true);
    race = new RaceSession(raceView, raceControls, raceHud, {
      humans,
      names: specs.map((c) => c.name),
      colors: specs.map((c) => c.accent),
      faces: specs.map((c) => studio.face(c)),
      laps: raceLaps,
      seed: seed++,
      // your second character is the sharpest rival when it is not being driven by a person;
      // with two people the two bots are the level's quickest and slowest, so the pack spreads
      skills: m === 'split' ? [level.skills[0], level.skills[2]] : [...level.skills],
      pace: m === 'split' ? [level.pace[0], level.pace[2]] : [...level.pace],
    });
    race.onDone = (s) => window.setTimeout(() => finishRace(s), 2600);
  }

  function finishRace(s: RaceState): void {
    if (!race || race.state !== s) return;
    const setup = race.setup;
    const order = s.karts.map((k, seat) => ({ k, seat })).sort((a, b) => a.k.place - b.k.place);
    const winner = order[0]!;
    const rows: RaceRow[] = order.map(({ k, seat }) => ({
      place: k.place,
      name: setup.names[seat]!,
      color: setup.colors[seat]!,
      face: setup.faces[seat] ?? '',
      bot: race!.bots[seat]!,
      you: !setup.humans.includes(seat) ? '' : setup.humans.length > 1 ? `P${setup.humans.indexOf(seat) + 1}` : 'you',
      time: k.finished
        ? seat === winner.seat ? seconds(k.finishTick - RACE.countdownTicks) : `+${seconds(k.finishTick - winner.k.finishTick)}`
        : `lap ${Math.min(s.laps, Math.max(1, k.lap))} of ${s.laps}`,
      best: k.bestLapTicks ? seconds(k.bestLapTicks) : '—',
    }));
    // personal best: your fastest finished race in this mode (lower is better)
    const key = `backyard:${raceMode}:${rivalLevel(raceLevel).id}:time`;
    const mine = setup.humans.map((seat) => s.karts[seat]!).filter((k) => k.finished).map((k) => k.finishTick - RACE.countdownTicks);
    const prev = profile.best[key] ?? 0;
    const now = mine.length ? Math.min(...mine) : 0;
    const newBest = now > 0 && (prev === 0 || now < prev) && s.laps === RACE.laps;
    if (newBest) profile.best[key] = now;
    profile.roundsPlayed++;
    saveProfile(profile);
    const best = newBest ? now : prev;
    const youWon = setup.humans.includes(winner.seat);
    const opener = s.plankOpener >= 0 ? setup.names[s.plankOpener]! : '';
    raceHud.show(false);
    audio.music('win');
    screens.raceResults({
      rows,
      headline: youWon ? `${setup.names[winner.seat]} wins!` : `${setup.names[winner.seat]} takes it`,
      note: opener ? `${opener} knocked the peg out and opened the plank for everyone.` : 'Nobody opened the plank shortcut this time.',
      best: best ? seconds(best) : '—',
      newBest,
      rivals: `${rivalLevel(raceLevel).name} rivals`,
      stepUp: youWon && raceMode === 'solo' && raceLevel < RIVAL_LEVELS.length - 1 ? rivalLevel(raceLevel + 1).name : '',
    });
  }

  // ───────────────────────────── Catapult Courier (parked) ─────────────────────────────
  const serverUrl = roomServerUrl();
  let client: RoomClient | null = null;
  let room: RoomInfo | null = null;
  let botFinished = false;

  function beginCourier(): CourierView {
    race?.dispose();
    race = null;
    raceHud.show(false);
    last = 'courier';
    active = 'courier';
    courierControls.attach();
    return ensureCourier();
  }

  function startLocalRound(): void {
    const view = beginCourier();
    round?.dispose();
    if (view.castSpec(0) !== cast[0]) view.setCast(0, cast[0]);
    if (view.castSpec(1) !== cast[1]) view.setCast(1, cast[1]);
    const seats: [SeatKind, SeatKind] = mode === 'shared' ? ['human', 'human'] : ['human', 'bot'];
    roundNames = [cast[0].name, cast[1].name];
    screens.clear();
    courierHud.setSeats([
      { name: roundNames[0], color: cast[0].accent, kind: seats[0] },
      { name: roundNames[1], color: cast[1].accent, kind: seats[1] },
    ]);
    courierHud.show(true);
    const local = new CourierSession(view, courierControls, courierHud, {
      seats, names: roundNames, arenaId: DEFAULT_ARENA, launches: roundLaunches, botSkill: 0.62, seed: seed++, firstLauncher: 0,
    });
    local.onDone = (s) => window.setTimeout(() => finishRound(s), 500);
    round = local;
  }

  function leaveOnline(notice = ''): void {
    client?.close();
    client = null;
    room = null;
    toLobby();
    if (notice) screens.onlineEntry(notice);
    else screens.home();
  }

  function connectOnline(then: (c: RoomClient) => void): void {
    if (!serverUrl) return;
    if (client?.connected) {
      then(client);
      return;
    }
    const c = new RoomClient(serverUrl);
    client = c;
    c.onRoom = (r) => {
      room = r;
      if (r.seats.some((s) => s?.bot)) botFinished = true;
      if (r.phase !== 'playing' && !(round && r.phase === 'results')) screens.onlineRoom(r);
    };
    c.onStart = (msg) => startOnlineRound(msg);
    c.onError = (code, text) => {
      if (code === 'rate') return;
      if (round) courierHud.showBanner('Hmm.', text, 2400);
      else screens.onlineEntry(text);
    };
    c.onReconnecting = (attempt) => courierHud.showBanner('Reconnecting…', `Attempt ${attempt}`, 1200);
    c.onClosed = (byUser) => {
      if (!byUser) leaveOnline('The connection to the room was lost.');
    };
    c.connect(cast[0].name, cast[0]).then(
      () => then(c),
      (err: Error) => {
        client = null;
        screens.onlineEntry(err.message || 'Could not reach the room server.');
      },
    );
  }

  function startOnlineRound(msg: StartMsg): void {
    if (!client || !room) return;
    const view = beginCourier();
    const you = room.you;
    const them = you === 0 ? 1 : 0;
    const theirSeat = room.seats[them];
    const theirSpec = sanitizeSpec(theirSeat?.spec ?? null);
    mode = 'online';
    botFinished = false;
    round?.dispose();
    view.setCast(you, cast[0]);
    view.setCast(them, { ...theirSpec, name: theirSeat?.name ?? theirSpec.name });
    roundNames = you === 0 ? [cast[0].name, theirSeat?.name ?? 'Friend'] : [theirSeat?.name ?? 'Friend', cast[0].name];
    screens.clear();
    courierHud.setSeats([
      { name: roundNames[0], color: view.castSpec(0).accent, kind: you === 0 ? 'human' : 'remote' },
      { name: roundNames[1], color: view.castSpec(1).accent, kind: you === 1 ? 'human' : 'remote' },
    ]);
    courierHud.show(true);
    const net = new NetCourierSession(view, courierControls, courierHud, client, you, roundNames, msg);
    net.onDone = (s) => window.setTimeout(() => finishRound(s), 500);
    round = net;
  }

  function finishRound(s: CourierState): void {
    if (!round) return;
    const arena = ARENAS[s.arenaId] ?? ARENAS[DEFAULT_ARENA]!;
    const key = `${arena.id}:${mode}`;
    const prev = profile.best[key] ?? 0;
    const countable = !(mode === 'online' && botFinished);
    const newBest = countable && s.total > prev;
    if (newBest) profile.best[key] = s.total;
    profile.roundsPlayed++;
    saveProfile(profile);
    courierHud.show(false);
    audio.music('win');
    audio.play('fanfare');
    screens.results(s, {
      mode,
      names: roundNames,
      best: Math.max(prev, countable ? s.total : 0),
      newBest: newBest && s.total > 0,
      ringsAvailable: ringsInScript(arena, s.launches),
      assisted: profile.settings.aimAssist,
      botFinished: mode === 'online' && botFinished,
    });
  }

  // ───────────────────────────── app API for the screens ─────────────────────────────
  const api: AppApi = {
    profile,
    audio,
    buildLabel: BUILD_LABEL,
    save: () => saveProfile(profile),
    cast: (seat) => cast[seat],
    portrait: (spec) => studio.render(spec),
    applySettings,
    setSeatCharacter: (seat, spec) => {
      cast[seat] = spec;
      profile.seats[seat] = spec.id;
      raceView.setCast(seat, spec);
      // the two extra drivers must never duplicate a chosen character
      const [c, d] = rivals();
      if (raceView.castSpec(2).id !== c.id) raceView.setCast(2, c);
      if (raceView.castSpec(3).id !== d.id) raceView.setCast(3, d);
      saveProfile(profile);
    },
    demo: (seat, kind) => raceView.lobbyDemo(seat, kind),
    startRace,
    startRound: (m) => {
      mode = m;
      startLocalRound();
    },
    resume: () => {
      if (race) race.paused = false;
      if (round) round.paused = false;
      audio.resume();
    },
    restart: () => (last === 'race' ? startRace(raceMode) : startLocalRound()),
    stepUp: () => {
      profile.settings.rivals = Math.min(RIVAL_LEVELS.length - 1, raceLevel + 1);
      saveProfile(profile);
      startRace(raceMode);
    },
    quitToHome: () => {
      if (mode === 'online' && client) {
        leaveOnline();
        return;
      }
      toLobby();
      screens.home();
    },
    online: {
      available: !!serverUrl,
      create: () => connectOnline((c) => c.send({ t: 'create' })),
      join: (code) => connectOnline((c) => c.send({ t: 'join', code })),
      ready: (ready) => client?.send({ t: 'ready', ready }),
      leave: () => leaveOnline(),
      inviteLink: (code) => {
        const u = new URL(window.location.href);
        u.search = '';
        u.searchParams.set('room', code);
        const q = params.get('server');
        if (q) u.searchParams.set('server', q);
        return u.toString();
      },
    },
  };
  const screens = new Screens($('ui'), api);

  const pause = (): void => {
    if (race && race.state.phase !== 'over' && !race.paused) {
      race.paused = true;
      raceControls.reset();
      audio.play('ui_tap');
      screens.pause();
    } else if (round && round.state.phase !== 'done' && !round.paused) {
      if (mode === 'online') {
        courierHud.showBanner('Online rounds keep going', 'Finish the round, or leave from the results', 2200);
        return;
      }
      round.paused = true;
      courierControls.reset();
      audio.play('ui_tap');
      screens.pause();
    }
  };
  courierHud.onPause = pause;
  raceHud.onPause = pause;

  // ───────────────────────────── loop ─────────────────────────────
  const loop = new FixedLoop({
    tick: () => {
      race?.tick();
      round?.tick();
    },
    frame: (alpha, dt) => {
      const size = viewport.size;
      if (active === 'courier' && courierView) {
        const r = round;
        const frozen = !!r && r.paused && mode !== 'online';
        stage.renderer.setViewport(0, 0, size.width, size.height);
        courierView.render(r ? r.state : null, frozen ? 1 : alpha, frozen ? 0 : dt);
        if (r) courierHud.update(r.state, courierView, size);
      } else {
        const frozen = !!race && race.paused;
        raceView.render(race ? race.state : null, frozen ? 1 : alpha, frozen ? 0 : dt, size.width, size.height);
        if (race) {
          const rects = raceView.layout(size.width, size.height);
          raceControls.rects = rects;
          raceHud.update(race.state, raceView, size, rects, race.setup.humans, profile.settings);
        }
      }
    },
  });

  viewport.onChange((size) => {
    stage.resize(size.width, size.height);
    courierControls.setStageSize(size);
  });

  // Frame-rate guard: if the device cannot hold ~50 fps, step the picture quality down (lower
  // pixel ratio first, shadows last). It never steps back up, so it cannot oscillate.
  // (?hq on the URL keeps full quality regardless, for screenshots on slow machines.)
  const lockQuality = params.has('hq');
  let slowSince = 0;
  window.setInterval(() => {
    if (lockQuality || document.hidden || stage.quality >= 3) return;
    if (loop.frameMs > 21) {
      slowSince++;
      if (slowSince >= 2) {
        stage.setQuality(stage.quality + 1);
        slowSince = 0;
      }
    } else {
      slowSince = 0;
    }
  }, 1500);

  // iOS only starts audio from a gesture
  const unlock = (): void => {
    void audio.unlock().then(() => {
      applySettings();
      if (!race && !round) audio.music('menu');
    });
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      pause();
    } else {
      audio.resume();
    }
  });

  // An invitation link (?room=CODE) goes straight to that Courier room.
  const invited = params.get('room');
  if (invited && serverUrl) {
    screens.onlineBusy('Joining your friend…');
    api.online.join(invited.toUpperCase());
  } else {
    screens.home();
  }
  loop.start();

  // handle for automated play-testing; it only exposes what is already on screen
  (window as unknown as Record<string, unknown>).__pw = {
    get round() { return round; },
    get race() { return race; },
    get room() { return room; },
    raceView, raceControls, loop, profile, viewport, stage, api, track: backyard(),
  };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $('boot').classList.add('gone');
    (window as unknown as Record<string, unknown>).__ready = true;
  }));
}

try {
  boot();
} catch (err) {
  const status = document.getElementById('boot-status');
  if (status) {
    status.className = 'boot-error';
    status.textContent = `Something went wrong while starting.\n${String(err instanceof Error ? err.message : err)}`;
  }
  throw err;
}

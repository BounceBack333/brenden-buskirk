/**
 * BounceBack Party Worlds — app shell.
 * Boots the stage, the kits and the profile, then moves between the live lobby (menus) and a
 * round of the current attraction. First playable: Catapult Courier.
 */
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/styles.css';

import { createAudioKit } from './audio';
import { createSilentAudio } from './kit/silent-audio';
import type { AudioKit } from './kit/contracts';
import { PRESET_CHARACTERS, sanitizeSpec } from './characters';
import { CourierControls } from './attractions/courier/controls';
import { NetCourierSession } from './attractions/courier/netsession';
import { ARENAS, DEFAULT_ARENA, ringsInScript } from './attractions/courier/rules';
import { CourierSession } from './attractions/courier/session';
import type { SeatKind } from './attractions/courier/session';
import type { CourierState } from './attractions/courier/sim';
import { CourierView } from './attractions/courier/view';
import { FixedLoop } from './core/loop';
import { Pointers } from './core/pointers';
import { buzz, loadProfile, saveProfile } from './core/profile';
import { Viewport } from './core/viewport';
import type { CharacterSpec } from './kit/contracts';
import { RoomClient, roomServerUrl } from './net/client';
import type { StartMsg } from './net/client';
import type { RoomInfo } from './net/protocol';
import { PortraitStudio } from './render/portrait';
import { createStage } from './render/stage';
import { Hud } from './ui/hud';
import { Screens } from './ui/screens';
import type { AppApi, PlayMode } from './ui/screens';

const BUILD_LABEL = 'First playable · web build';

/** What the loop needs from a round, whether it is simulated here or on the room server. */
interface Round {
  state: CourierState;
  paused: boolean;
  tick(): void;
  dispose(): void;
  onDone: ((s: CourierState) => void) | null;
}

function $(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

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
  const controls = new CourierControls(pointers, profile.settings);
  controls.attach();

  // ── cast: seats remember their characters; the default is a person and their dog ──
  const everyone = (): CharacterSpec[] => [...profile.customCharacters.map(sanitizeSpec), ...PRESET_CHARACTERS];
  const find = (id: string): CharacterSpec | undefined => everyone().find((c: CharacterSpec) => c.id === id);
  const firstOf = (species: string): CharacterSpec =>
    PRESET_CHARACTERS.find((c: CharacterSpec) => c.species === species) ?? PRESET_CHARACTERS[0]!;
  const cast: [CharacterSpec, CharacterSpec] = [
    find(profile.seats[0]) ?? firstOf('human'),
    find(profile.seats[1]) ?? firstOf('dog'),
  ];

  const view = new CourierView(stage, audio, cast, profile.settings, DEFAULT_ARENA);
  const studio = new PortraitStudio(stage);
  const hud = new Hud($('hud'), $('popups'), controls, profile);
  let round: Round | null = null;
  let mode: PlayMode = 'buddy';
  let roundSeed = (Date.now() & 0xffff) + 1;
  let roundNames: [string, string] = [cast[0].name, cast[1].name];
  // ?launches=N shortens a round (1–6) for quick checks and automated play-throughs
  const launchesParam = Number(new URLSearchParams(window.location.search).get('launches'));
  const roundLaunches = Number.isFinite(launchesParam) && launchesParam >= 1 ? Math.min(6, Math.floor(launchesParam)) : 6;

  const applySettings = (): void => {
    const s = profile.settings;
    audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
  };
  applySettings();

  view.onPopup = (p) => hud.popup(p, view, viewport.size);
  view.onBuzz = (ms) => buzz(profile.settings, ms);

  // ───────────────────────────── online rooms ─────────────────────────────
  const serverUrl = roomServerUrl();
  let client: RoomClient | null = null;
  let room: RoomInfo | null = null;
  let botFinished = false;

  function restoreLocalCast(): void {
    if (view.castSpec(0) !== cast[0]) view.setCast(0, cast[0]);
    if (view.castSpec(1) !== cast[1]) view.setCast(1, cast[1]);
  }

  function leaveOnline(notice = ''): void {
    client?.close();
    client = null;
    room = null;
    round?.dispose();
    round = null;
    hud.show(false);
    restoreLocalCast();
    view.enterLobby();
    audio.music('menu');
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
      // while a round is running the HUD is in charge; otherwise show the waiting area
      if (r.phase !== 'playing' && !(round && r.phase === 'results')) screens.onlineRoom(r);
    };
    c.onStart = (msg) => startOnlineRound(msg);
    c.onError = (code, text) => {
      if (code === 'rate') return;
      if (round) hud.showBanner('Hmm.', text, 2400);
      else screens.onlineEntry(text);
    };
    c.onReconnecting = (attempt) => hud.showBanner('Reconnecting…', `Attempt ${attempt}`, 1200);
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
    const you = room.you;
    const them = you === 0 ? 1 : 0;
    const theirSeat = room.seats[them];
    const theirSpec = sanitizeSpec(theirSeat?.spec ?? null);
    mode = 'online';
    botFinished = false;
    round?.dispose();
    // my character sits in my seat, whichever one the room gave me
    view.setCast(you, cast[0]);
    view.setCast(them, { ...theirSpec, name: theirSeat?.name ?? theirSpec.name });
    roundNames = you === 0 ? [cast[0].name, theirSeat?.name ?? 'Friend'] : [theirSeat?.name ?? 'Friend', cast[0].name];
    screens.clear();
    hud.setSeats([
      { name: roundNames[0], color: view.castSpec(0).accent, kind: you === 0 ? 'human' : 'remote' },
      { name: roundNames[1], color: view.castSpec(1).accent, kind: you === 1 ? 'human' : 'remote' },
    ]);
    hud.show(true);
    const net = new NetCourierSession(view, controls, hud, client, you, roundNames, msg);
    net.onDone = (s) => window.setTimeout(() => finishRound(s), 500);
    round = net;
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
      view.setCast(seat, spec);
      saveProfile(profile);
    },
    demo: (seat, kind) => view.lobbyDemo(seat, kind),
    startRound: (m) => {
      mode = m;
      startLocalRound();
    },
    resume: () => {
      if (round) round.paused = false;
      audio.resume();
    },
    restart: () => startLocalRound(),
    quitToHome: () => {
      if (mode === 'online') {
        leaveOnline();
        return;
      }
      round?.dispose();
      round = null;
      hud.show(false);
      view.enterLobby();
      audio.music('menu');
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
        const q = new URLSearchParams(window.location.search).get('server');
        if (q) u.searchParams.set('server', q);
        return u.toString();
      },
    },
  };
  const screens = new Screens($('ui'), api);

  function startLocalRound(): void {
    round?.dispose();
    const seats: [SeatKind, SeatKind] = mode === 'shared' ? ['human', 'human'] : ['human', 'bot'];
    roundNames = [cast[0].name, cast[1].name];
    screens.clear();
    hud.setSeats([
      { name: roundNames[0], color: cast[0].accent, kind: seats[0] },
      { name: roundNames[1], color: cast[1].accent, kind: seats[1] },
    ]);
    hud.show(true);
    const local = new CourierSession(view, controls, hud, {
      seats, names: roundNames, arenaId: DEFAULT_ARENA, launches: roundLaunches, botSkill: 0.62, seed: roundSeed++, firstLauncher: 0,
    });
    local.onDone = (s) => window.setTimeout(() => finishRound(s), 500);
    round = local;
  }

  function finishRound(s: CourierState): void {
    if (!round) return;
    const arena = ARENAS[s.arenaId] ?? ARENAS[DEFAULT_ARENA]!;
    // personal bests are kept per way of playing; online-with-a-bot-substitute never counts
    const key = `${arena.id}:${mode}`;
    const prev = profile.best[key] ?? 0;
    const countable = !(mode === 'online' && botFinished);
    const newBest = countable && s.total > prev;
    if (newBest) profile.best[key] = s.total;
    profile.roundsPlayed++;
    saveProfile(profile);
    hud.show(false);
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

  hud.onPause = () => {
    if (!round || round.state.phase === 'done' || round.paused) return;
    if (mode === 'online') {
      // an online round belongs to two people; one of them cannot freeze it
      hud.showBanner('Online rounds keep going', 'Finish the round, or leave from the results', 2200);
      return;
    }
    round.paused = true;
    controls.reset();
    audio.play('ui_tap');
    screens.pause();
  };

  // ───────────────────────────── loop ─────────────────────────────
  const hudHidden = (): boolean => !!$('hud').hidden;
  const loop = new FixedLoop({
    tick: () => round?.tick(),
    frame: (alpha, dt) => {
      const r = round;
      const frozen = !!r && r.paused && mode !== 'online';
      view.render(r ? r.state : null, frozen ? 1 : alpha, frozen ? 0 : dt);
      if (r && !hudHidden()) hud.update(r.state, view, viewport.size);
    },
  });

  viewport.onChange((size) => {
    stage.resize(size.width, size.height);
    controls.setStageSize(size);
  });

  // Frame-rate guard: if the device cannot hold ~50 fps, step the picture quality down (lower
  // pixel ratio first, shadows last). It never steps back up, so it cannot oscillate.
  // (?hq on the URL keeps full quality regardless, for screenshots on slow machines.)
  const lockQuality = new URLSearchParams(window.location.search).has('hq');
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
      if (!round) audio.music('menu');
    });
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      if (round && !round.paused && round.state.phase !== 'done' && mode !== 'online') hud.onPause?.();
    } else {
      audio.resume();
    }
  });

  // An invitation link (?room=CODE) goes straight to that room.
  const invited = new URLSearchParams(window.location.search).get('room');
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
    get room() { return room; },
    view, controls, loop, profile, viewport, stage, api,
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

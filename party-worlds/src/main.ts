/**
 * BounceBack Party Worlds — app shell.
 *
 * The game is a kart racer first: the menu lives in the night backyard with your two characters
 * parked in their karts. Catapult Courier (the birthday-table attraction) is kept as a parked
 * experiment and loaded only when chosen.
 */
import './ui/fonts.css';
import './ui/styles.css';

import { createAudioKit } from './audio';
import { createSilentAudio } from './kit/silent-audio';
import type { AudioKit, CharacterSpec } from './kit/contracts';
import { PRESET_CHARACTERS, kartColorOf, sanitizeSpec } from './characters';
import { CourierControls } from './attractions/courier/controls';
import { NetCourierSession } from './attractions/courier/netsession';
import { ARENAS, DEFAULT_ARENA, ringsInScript } from './attractions/courier/rules';
import { CourierSession } from './attractions/courier/session';
import type { SeatKind } from './attractions/courier/session';
import type { CourierState } from './attractions/courier/sim';
import { CourierView } from './attractions/courier/view';
import { RaceControls, RaceHud, RaceSession } from './attractions/dash/play';
import { RIVAL_LEVELS, rivalLevel } from './attractions/dash/rivals';
import { medalFor, medalsOf, newSeries, nextMedal, scoreSeries, seriesLine, seriesWinner } from './attractions/dash/stakes';
import type { RaceState } from './attractions/dash/sim';
import { DEFAULT_TRACK, RACE, trackById } from './attractions/dash/track';
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
import type { AppApi, PlayMode, RaceMode, RaceRow, RaceStakes } from './ui/screens';

const BUILD_LABEL = 'Prototype · web build';

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
    find(profile.seats[0]) ?? find('rex') ?? firstOf('human'),
    find(profile.seats[1]) ?? find('zadie') ?? firstOf('human'),
  ];
  const rivals = (): [CharacterSpec, CharacterSpec] => {
    // not the same character, and not the same name either: an edited copy of a preset keeps
    // its name, and two "Pip"s on the results would be unreadable
    const taken = new Set([cast[0].id, cast[1].id, cast[0].name, cast[1].name]);
    const free = PRESET_CHARACTERS.filter((c: CharacterSpec) => !taken.has(c.id) && !taken.has(c.name));
    // the grid is filled out with one driver who is not a person and one pet, for variety
    const odd = free.find((c: CharacterSpec) => c.species === 'human' && !!c.creature && c.creature !== 'none') ?? free[0]!;
    const pet = free.find((c: CharacterSpec) => c.species !== 'human' && c.id !== odd.id) ?? free.find((c: CharacterSpec) => c.id !== odd.id) ?? free[0]!;
    return [odd, pet];
  };
  const grid = (): CharacterSpec[] => [cast[0], cast[1], ...rivals()];

  // ── views ──
  // the circuit: one today, chosen in one place (see track.ts for how another is added)
  const track = trackById(DEFAULT_TRACK);
  const raceView = new RaceView(stage.renderer, stage.scene.environment, audio, grid(), profile.settings, track);
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
  /** the running head-to-head between the two people on this device */
  let series = newSeries();
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
    series = newSeries();
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
    if (m !== 'split' || seriesWinner(series) >= 0) series = newSeries(); // a settled series starts again
    const level = rivalLevel(profile.settings.rivals);
    raceLevel = profile.settings.rivals;
    const humans = m === 'split' ? [0, 1] : [0];
    screens.clear();
    raceControls.attach();
    raceHud.show(true);
    race = new RaceSession(raceView, raceControls, raceHud, {
      track: track.id,
      humans,
      names: specs.map((c) => c.name),
      colors: specs.map((c) => kartColorOf(c)),
      faces: specs.map((c) => studio.face(c)),
      laps: raceLaps,
      seed: seed++,
      // your second character is the sharpest rival when it is not being driven by a person;
      // with two people the two bots are the level's quickest and slowest, so the pack spreads
      skills: m === 'split' ? [level.skills[0], level.skills[2]] : [...level.skills],
      pace: m === 'split' ? [level.pace[0], level.pace[2]] : [...level.pace],
    });
    // (the simulation has already run on for a moment after the last person finished)
    race.onDone = (s) => window.setTimeout(() => finishRace(s), 700);
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
    const key = `${track.id}:${raceMode}:${rivalLevel(raceLevel).id}:time`;
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

    // what this race was for
    let stakes: RaceStakes | null = null;
    let again = 'Rematch';
    let headline = youWon ? `${setup.names[winner.seat]} wins!` : `${setup.names[winner.seat]} takes it`;
    if (setup.humans.length === 2) {
      // two people: whoever finished ahead of the other takes the race, whatever the bots did
      const [a, b] = [setup.humans[0]!, setup.humans[1]!];
      const ahead: 0 | 1 = s.karts[a]!.place < s.karts[b]!.place ? 0 : 1;
      series = scoreSeries(series, ahead);
      const names: [string, string] = [setup.names[a]!, setup.names[b]!];
      const over = seriesWinner(series) >= 0;
      stakes = {
        kind: 'series', names, faces: [setup.faces[a] ?? '', setup.faces[b] ?? ''], colors: [setup.colors[a]!, setup.colors[b]!],
        wins: [series.wins[0], series.wins[1]], target: series.target, line: seriesLine(series, names), over,
      };
      headline = `${names[ahead]} beats ${names[ahead === 0 ? 1 : 0]}`;
      again = over ? 'New series' : series.wins[0] === series.wins[1] && series.wins[0] === series.target - 1 ? 'Decider' : 'Next race';
    } else if (s.laps === RACE.laps) {
      const medals = medalsOf(track);
      const medal = now > 0 ? medalFor(now, medals) : null;
      const up = nextMedal(now, medals);
      const bestMedal = profile.best[`${track.id}:medal`] ?? 0; // 3 gold, 2 silver, 1 bronze
      const rank = medal ? (medal.id === 'gold' ? 3 : medal.id === 'silver' ? 2 : 1) : 0;
      if (rank > bestMedal) {
        profile.best[`${track.id}:medal`] = rank;
        saveProfile(profile);
      }
      const bits: string[] = [];
      if (now > 0 && up && up.gap > 0) bits.push(`${seconds(up.gap)} off ${up.medal.name}`);
      else if (now <= 0 && up) bits.push(`${up.medal.name} is ${seconds(up.medal.ticks)}: finish the race to post a time`);
      if (now > 0 && prev > 0 && !newBest) bits.push(`${seconds(now - prev)} off your best`);
      else if (newBest && prev > 0) bits.push(`new best by ${seconds(prev - now)}`);
      if (medal?.id === 'gold' && raceLevel < RIVAL_LEVELS.length - 1) bits.push('gold in the bag: try tougher rivals');
      stakes = {
        kind: 'medal', medal: medal ? medal.id : '',
        title: medal ? `${medal.name} · ${seconds(now)}` : now > 0 ? `No medal · ${seconds(now)}` : 'No time',
        line: bits.join(' · ') || (medal ? 'Nothing left to prove here' : ''),
      };
      again = medal?.id === 'gold' ? 'Race again' : up && now > 0 ? `Go for ${up.medal.name}` : 'Rematch';
    }
    raceHud.show(false);
    audio.music('win');
    screens.raceResults({
      rows,
      headline,
      note: opener ? `${opener} knocked the peg out and opened the plank for everyone.` : 'Nobody opened the plank shortcut this time.',
      best: best ? seconds(best) : '—',
      newBest,
      rivals: `${rivalLevel(raceLevel).name} rivals`,
      stepUp: youWon && raceMode === 'solo' && raceLevel < RIVAL_LEVELS.length - 1 ? rivalLevel(raceLevel + 1).name : '',
      stakes,
      again,
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
    portrait: (spec) => studio.face(spec),
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
      audio.setEngine(null);
      audio.setSkid(null);
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
        // Paused: nothing moves. Finished and waiting for the results: the simulation has stopped,
        // so show its last tick exactly (no interpolation), while the celebration keeps animating.
        const paused = !!race && race.paused;
        const hold = paused || (!!race && race.state.phase === 'over');
        raceView.render(race ? race.state : null, hold ? 1 : alpha, paused ? 0 : dt, size.width, size.height);
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
    raceView, raceControls, loop, profile, viewport, stage, api, track,
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

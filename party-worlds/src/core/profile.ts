/**
 * Local profile + settings. Stored in localStorage when available; everything works without it
 * (private windows, embedded previews). Nothing here ever leaves the device.
 */
import type { CharacterSpec } from '../kit/contracts';
import { sanitizeSpec } from '../characters/spec';

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  reducedMotion: boolean;
  /** show the whole flight arc while aiming (an open, visible assist) */
  aimAssist: boolean;
  /** tap to toggle the umbrella instead of holding */
  umbrellaToggle: boolean;
  /** put the dive button on the left */
  leftHanded: boolean;
  haptics: boolean;
  /** racing: steering hard starts the drift by itself (one-thumb play) */
  autoDrift: boolean;
  /** racing: how hard the rival bots drive (index into RIVAL_LEVELS) */
  rivals: number;
}

export interface Profile {
  version: 1;
  /** which authored cast the saved seats refer to; an older one resets the seats to the current defaults */
  castVersion: number;
  settings: Settings;
  /** characters the player has made or edited */
  customCharacters: CharacterSpec[];
  /** ids of the characters in seats 0 and 1 */
  seats: [string, string];
  /** personal bests by key: race times in ticks, a medal rank per track, Courier scores per arena */
  best: Record<string, number>;
  /** which contextual hints have been understood (performed once) */
  learned: Record<string, boolean>;
  roundsPlayed: number;
}

const KEY = 'bounceback-party-worlds/profile/v1';
/** 2 = the grown-up cast */
export const CAST_VERSION = 2;

export function defaultSettings(): Settings {
  const prefersReduced =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    master: 0.9, sfx: 1, music: 0.6,
    reducedMotion: prefersReduced, aimAssist: false, umbrellaToggle: false, leftHanded: false, haptics: true, autoDrift: false, rivals: 0,
  };
}

export function defaultProfile(): Profile {
  return {
    version: 1,
    castVersion: CAST_VERSION,
    settings: defaultSettings(),
    customCharacters: [],
    seats: ['', ''],
    best: {},
    learned: {},
    roundsPlayed: 0,
  };
}

/** how many characters of their own a player can keep */
export const MAX_CUSTOM = 24;
const MAX_RECORDS = 200;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const level = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Settings from anything: each field is kept only if it is the right kind of value. */
export function sanitizeSettings(raw: unknown, base: Settings = defaultSettings()): Settings {
  const o = isRecord(raw) ? raw : {};
  return {
    master: level(o.master, base.master),
    sfx: level(o.sfx, base.sfx),
    music: level(o.music, base.music),
    reducedMotion: flag(o.reducedMotion, base.reducedMotion),
    aimAssist: flag(o.aimAssist, base.aimAssist),
    umbrellaToggle: flag(o.umbrellaToggle, base.umbrellaToggle),
    leftHanded: flag(o.leftHanded, base.leftHanded),
    haptics: flag(o.haptics, base.haptics),
    autoDrift: flag(o.autoDrift, base.autoDrift),
    rivals: count(o.rivals),
  };
}

/**
 * A profile from whatever was in storage. Saved data outlives the build that wrote it, and a
 * browser can hand back anything, so nothing is trusted: a field that is missing or the wrong
 * kind falls back to its default by itself and the rest of the save is kept.
 */
export function parseProfile(raw: string | null | undefined): Profile {
  const base = defaultProfile();
  if (!raw) return base;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!isRecord(data)) return base;

  const customCharacters: CharacterSpec[] = [];
  const ids = new Set<string>();
  for (const c of Array.isArray(data.customCharacters) ? data.customCharacters : []) {
    if (!isRecord(c) || customCharacters.length >= MAX_CUSTOM) continue;
    const spec = sanitizeSpec(c);
    if (ids.has(spec.id)) continue;
    ids.add(spec.id);
    customCharacters.push(spec);
  }

  const best: Record<string, number> = {};
  if (isRecord(data.best)) {
    for (const [k, v] of Object.entries(data.best).slice(0, MAX_RECORDS)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) best[k] = v;
    }
  }
  const learned: Record<string, boolean> = {};
  if (isRecord(data.learned)) {
    for (const [k, v] of Object.entries(data.learned).slice(0, MAX_RECORDS)) {
      if (v === true) learned[k] = true;
    }
  }

  // seats chosen from an earlier cast are dropped once, so nobody is left driving last year's default
  const seats = data.seats;
  const keepSeats = data.castVersion === CAST_VERSION && Array.isArray(seats) && seats.length === 2 && seats.every((x) => typeof x === 'string');
  return {
    version: 1,
    castVersion: CAST_VERSION,
    settings: sanitizeSettings(data.settings, base.settings),
    customCharacters,
    seats: keepSeats ? [seats[0] as string, seats[1] as string] : ['', ''],
    best,
    learned,
    roundsPlayed: count(data.roundsPlayed),
  };
}

export function loadProfile(): Profile {
  try {
    return parseProfile(window.localStorage.getItem(KEY));
  } catch {
    return defaultProfile(); // storage unavailable (private window, embedded preview)
  }
}

export function saveProfile(p: Profile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: the session still works, it just won't be remembered */
  }
}

/** Light haptic tick where the platform supports it (Android browsers; iOS Safari does not). */
export function buzz(settings: Settings, ms: number | number[]): void {
  if (!settings.haptics) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

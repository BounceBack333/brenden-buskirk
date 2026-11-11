/**
 * Local profile + settings. Stored in localStorage when available; everything works without it
 * (private windows, embedded previews). Nothing here ever leaves the device.
 */
import type { CharacterSpec } from '../kit/contracts';

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
  /** best duet score per arena */
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

export function loadProfile(): Profile {
  const base = defaultProfile();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<Profile>;
    if (!data || typeof data !== 'object') return base;
    return {
      version: 1,
      castVersion: CAST_VERSION,
      settings: { ...base.settings, ...(typeof data.settings === 'object' && data.settings ? data.settings : {}) },
      customCharacters: Array.isArray(data.customCharacters) ? data.customCharacters.slice(0, 24) : [],
      // seats chosen from an earlier cast are dropped once, so nobody is left driving last year's default
      seats: data.castVersion === CAST_VERSION && Array.isArray(data.seats) && data.seats.length === 2 ? [String(data.seats[0]), String(data.seats[1])] : ['', ''],
      best: data.best && typeof data.best === 'object' ? data.best : {},
      learned: data.learned && typeof data.learned === 'object' ? data.learned : {},
      roundsPlayed: Number.isFinite(data.roundsPlayed) ? Number(data.roundsPlayed) : 0,
    };
  } catch {
    return base;
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

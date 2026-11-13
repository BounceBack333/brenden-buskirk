/**
 * Which world kit draws which track. A world is presentation only: it is handed the track's data
 * and returns something to put in the scene, with the one moving part every track has (its gated
 * shortcut). Adding a track means adding its kit here; the race view never names a world.
 */
import type * as THREE from 'three';
import type { Track } from '../attractions/dash/track';
import { buildBackyardWorld } from './backyard';
import { buildPitWorld } from './pit';

/**
 * How a place is lit. Each pair is [a clean race, an armed one]: armed, every track is lit
 * harder and the haze closes in.
 */
export interface WorldMood {
  fog: [string, string];
  density: [number, number];
  sky: [string, string];
  skyIntensity: [number, number];
  /** the coloured light from one side: a neon sign, a fire */
  neon: [string, string];
  neonIntensity: [number, number];
  /** the key light and the fill */
  lamp: string;
  moon: string;
}

/** The backyard after dark, and any track that does not say otherwise. */
export const DEFAULT_MOOD: WorldMood = {
  fog: ['#232a55', '#261a3a'], density: [0.0085, 0.0098],
  sky: ['#8f9cff', '#7f8ae6'], skyIntensity: [1.05, 0.95],
  neon: ['#ff4f9a', '#ff3a2e'], neonIntensity: [0.55, 0.85],
  lamp: '#ffe9c8', moon: '#7fd0ff',
};

export interface RaceWorld {
  readonly root: THREE.Group;
  /** how this place is lit; the backyard's dusk when a kit does not say */
  readonly mood?: WorldMood;
  /** the shortcut's gate has been knocked out: show it opening (or already open, if instant) */
  openPlank(instant?: boolean): void;
  /** put the gate back (new race) */
  resetPlank(): void;
  update(dt: number, time: number): void;
}

const KITS: Record<string, (track: Track) => RaceWorld> = {
  backyard: buildBackyardWorld,
  pit: buildPitWorld,
};

/** The world for a track. A track without its own kit yet is drawn with the backyard's, so a new circuit can be driven before it is dressed. */
export function buildRaceWorld(track: Track): RaceWorld {
  return (KITS[track.id] ?? buildBackyardWorld)(track);
}

export { buildKart, buildNightSky } from './backyard';
export type { KartModel } from './backyard';

/**
 * Which world kit draws which track. A world is presentation only: it is handed the track's data
 * and returns something to put in the scene, with the one moving part every track has (its gated
 * shortcut). Adding a track means adding its kit here; the race view never names a world.
 */
import type * as THREE from 'three';
import type { Track } from '../attractions/dash/track';
import { buildBackyardWorld } from './backyard';

export interface RaceWorld {
  readonly root: THREE.Group;
  /** the shortcut's gate has been knocked out: show it opening (or already open, if instant) */
  openPlank(instant?: boolean): void;
  /** put the gate back (new race) */
  resetPlank(): void;
  update(dt: number, time: number): void;
}

const KITS: Record<string, (track: Track) => RaceWorld> = {
  backyard: buildBackyardWorld,
};

/** The world for a track. A track without its own kit yet is drawn with the backyard's, so a new circuit can be driven before it is dressed. */
export function buildRaceWorld(track: Track): RaceWorld {
  return (KITS[track.id] ?? buildBackyardWorld)(track);
}

export { buildKart, buildNightSky } from './backyard';
export type { KartModel } from './backyard';

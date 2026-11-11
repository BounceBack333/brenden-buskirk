/**
 * A do-nothing AudioKit. Used when Web Audio is unavailable or fails to start, so the game
 * never depends on sound to run.
 */
import type { AudioKit } from './contracts';

export function createSilentAudio(): AudioKit {
  return {
    unlock: () => Promise.resolve(),
    unlocked: false,
    setVolumes: () => undefined,
    play: () => undefined,
    setTension: () => undefined,
    setWind: () => undefined,
    setFlutter: () => undefined,
    music: () => undefined,
    suspend: () => undefined,
    resume: () => undefined,
  };
}

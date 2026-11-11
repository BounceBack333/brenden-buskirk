/**
 * How hard the rival bots race. Two honest dials, both stated to the player: how sharply a rival
 * drives (lines, drifts, mistakes) and how much of the kart's top speed it uses. Nothing here
 * changes during a race and nothing reacts to where the player is: there is no rubber band.
 * The numbers were set against stand-in drivers in dev/humanish.ts, not against people.
 */
export interface RivalLevel {
  id: 'gentle' | 'keen' | 'fierce';
  name: string;
  /** one line for the play sheet */
  blurb: string;
  /** sharpest first */
  skills: [number, number, number];
  /** throttle of each, 0.5…1 */
  pace: [number, number, number];
}

export const RIVAL_LEVELS: readonly RivalLevel[] = [
  {
    id: 'gentle', name: 'Gentle',
    blurb: 'Rivals hold back (85–93% throttle) and rarely drift. A good first race.',
    skills: [0.6, 0.45, 0.25], pace: [0.93, 0.9, 0.85],
  },
  {
    id: 'keen', name: 'Keen',
    blurb: 'Rivals push (90–96% throttle) and drift for boosts. You will need yours.',
    skills: [0.8, 0.6, 0.45], pace: [0.96, 0.93, 0.9],
  },
  {
    id: 'fierce', name: 'Fierce',
    blurb: 'Full throttle, clean lines, and the leader opens the shortcut for itself.',
    skills: [0.95, 0.85, 0.7], pace: [1, 0.99, 0.97],
  },
];

export function rivalLevel(index: number): RivalLevel {
  return RIVAL_LEVELS[Math.max(0, Math.min(RIVAL_LEVELS.length - 1, Math.floor(index) || 0))]!;
}

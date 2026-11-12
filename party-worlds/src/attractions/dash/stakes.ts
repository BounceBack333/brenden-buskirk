/**
 * What a race is for, beyond its finishing order: a medal to chase alone, and a running score
 * to settle between two people. Pure data and arithmetic, so it can be tested without a browser.
 *
 * Both exist to make "one more" an easy thing to want. Both also END: a medal is earned or not,
 * a series is first to three. Nothing here is a timer, a streak that punishes stopping, or a
 * reward that is held back at random.
 */
export type MedalId = 'gold' | 'silver' | 'bronze';

export interface Medal {
  id: MedalId;
  name: string;
  /** a three-lap race at or under this many ticks earns it */
  ticks: number;
}

interface MedalTimes { gold: number; silver: number; bronze: number }

/**
 * A track's medals, best first. The times live with the track (track.ts), in seconds; an armed
 * race has its own, slower set where the track gives one.
 */
export function medalsOf(track: { medals: MedalTimes; combatMedals?: MedalTimes }, combat = false): Medal[] {
  const m = combat && track.combatMedals ? track.combatMedals : track.medals;
  return [
    { id: 'gold', name: 'Gold', ticks: Math.round(m.gold * 60) },
    { id: 'silver', name: 'Silver', ticks: Math.round(m.silver * 60) },
    { id: 'bronze', name: 'Bronze', ticks: Math.round(m.bronze * 60) },
  ];
}

export function medalFor(ticks: number, medals: readonly Medal[]): Medal | null {
  if (!(ticks > 0)) return null;
  for (const m of medals) if (ticks <= m.ticks) return m;
  return null;
}

/** The next medal up from this time and how many ticks away it is; null when gold is already in hand. */
export function nextMedal(ticks: number, medals: readonly Medal[]): { medal: Medal; gap: number } | null {
  if (!(ticks > 0)) return { medal: medals[medals.length - 1]!, gap: 0 };
  let next: Medal | null = null;
  // best first, so the last one still out of reach is the nearest target
  for (let i = medals.length - 1; i >= 0; i--) {
    if (ticks > medals[i]!.ticks) { next = medals[i]!; break; }
  }
  return next ? { medal: next, gap: ticks - next.ticks } : null;
}

/** A head-to-head between the two people on this device: first to `target` wins it. */
export interface Series {
  target: number;
  wins: [number, number];
  /** who took the last race (-1 before the first) and how many they have taken in a row */
  last: -1 | 0 | 1;
  streak: number;
}

export function newSeries(target = 3): Series {
  return { target, wins: [0, 0], last: -1, streak: 0 };
}

export function scoreSeries(s: Series, winner: 0 | 1): Series {
  const wins: [number, number] = [s.wins[0], s.wins[1]];
  wins[winner]++;
  return { target: s.target, wins, last: winner, streak: s.last === winner ? s.streak + 1 : 1 };
}

export function seriesWinner(s: Series): -1 | 0 | 1 {
  return s.wins[0] >= s.target ? 0 : s.wins[1] >= s.target ? 1 : -1;
}

/** One line of needle for the scoreboard. */
export function seriesLine(s: Series, names: readonly [string, string]): string {
  const w = seriesWinner(s);
  if (w === 0 || w === 1) return `${names[w]} takes the series ${s.wins[w]}–${s.wins[w === 0 ? 1 : 0]}`;
  const [a, b] = s.wins;
  if (a + b === 0) return `First to ${s.target}`;
  if (a === b) return a === s.target - 1 ? 'Next race decides it' : `All square. First to ${s.target}`;
  const lead = a > b ? 0 : 1;
  if (s.wins[lead] === s.target - 1) return `${names[lead]} needs one more. ${names[1 - lead]} cannot lose this one`;
  if (s.last === lead && s.streak >= 2) return `${names[lead]} has won ${s.streak} in a row`;
  return `${names[lead]} leads. First to ${s.target}`;
}

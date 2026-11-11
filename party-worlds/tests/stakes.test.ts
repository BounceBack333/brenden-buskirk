import { describe, expect, it } from 'vitest';
import { MEDALS, medalFor, newSeries, nextMedal, scoreSeries, seriesLine, seriesWinner } from '../src/attractions/dash/stakes';

describe('medals', () => {
  it('are ordered best first and awarded at or under their time', () => {
    for (let i = 1; i < MEDALS.length; i++) expect(MEDALS[i]!.ticks).toBeGreaterThan(MEDALS[i - 1]!.ticks);
    expect(medalFor(MEDALS[0]!.ticks)?.id).toBe('gold');
    expect(medalFor(MEDALS[0]!.ticks + 1)?.id).toBe('silver');
    expect(medalFor(MEDALS[2]!.ticks)?.id).toBe('bronze');
    expect(medalFor(MEDALS[2]!.ticks + 1)).toBeNull();
    expect(medalFor(0)).toBeNull(); // did not finish
  });
  it('the next target is the nearest medal still out of reach', () => {
    expect(nextMedal(MEDALS[0]!.ticks)).toBeNull(); // gold in hand: nothing above it
    expect(nextMedal(MEDALS[0]!.ticks + 30)).toEqual({ medal: MEDALS[0], gap: 30 });
    expect(nextMedal(MEDALS[1]!.ticks + 12)).toEqual({ medal: MEDALS[1], gap: 12 });
    expect(nextMedal(MEDALS[2]!.ticks + 600)).toEqual({ medal: MEDALS[2], gap: 600 });
    expect(nextMedal(0)?.medal.id).toBe('bronze');
  });
});

describe('a series between two people', () => {
  const names: [string, string] = ['Rex', 'Zadie'];
  it('is first to three, and ends', () => {
    let s = newSeries();
    expect(seriesWinner(s)).toBe(-1);
    expect(seriesLine(s, names)).toBe('First to 3');
    s = scoreSeries(s, 0);
    s = scoreSeries(s, 0);
    expect(s.wins).toEqual([2, 0]);
    expect(s.streak).toBe(2);
    expect(seriesLine(s, names)).toContain('Rex needs one more');
    s = scoreSeries(s, 1);
    expect(s.streak).toBe(1);
    s = scoreSeries(s, 1);
    expect(s.wins).toEqual([2, 2]);
    expect(seriesLine(s, names)).toBe('Next race decides it');
    s = scoreSeries(s, 1);
    expect(seriesWinner(s)).toBe(1);
    expect(seriesLine(s, names)).toBe('Zadie takes the series 3–2');
  });
  it('scoring never mutates the series it was given', () => {
    const s = newSeries();
    const t = scoreSeries(s, 1);
    expect(s.wins).toEqual([0, 0]);
    expect(t.wins).toEqual([0, 1]);
    expect(t.last).toBe(1);
  });
  it('says who is ahead, and when it is level', () => {
    let s = scoreSeries(newSeries(), 1);
    expect(seriesLine(s, names)).toBe('Zadie leads. First to 3');
    s = scoreSeries(s, 0);
    expect(seriesLine(s, names)).toBe('All square. First to 3');
  });
});

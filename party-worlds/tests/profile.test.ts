import { describe, expect, it } from 'vitest';
import { CAST_VERSION, defaultProfile, parseProfile, sanitizeSettings } from '../src/core/profile';

/**
 * Saved data outlives the build that wrote it. Whatever storage hands back, the game has to
 * start, and whatever was good in the save has to survive.
 */
describe('saved profile', () => {
  const fresh = defaultProfile();

  it('starts from defaults when there is nothing, or nothing usable', () => {
    for (const raw of [null, undefined, '', 'not json', '{', 'null', '42', '"text"', '[]', '[1,2]', 'true']) {
      expect(parseProfile(raw)).toEqual(fresh);
    }
  });

  it('keeps a good save exactly, and reading is idempotent', () => {
    const p = defaultProfile();
    p.settings.music = 0.25;
    p.settings.autoDrift = true;
    p.settings.rivals = 2;
    p.settings.weapons = false;
    p.settings.autoFire = !p.settings.autoFire;
    p.seats = ['bruno', 'waffles'];
    p.best['backyard:solo:keen:time'] = 3301;
    p.best['backyard:medal'] = 2;
    p.learned.drift = true;
    p.roundsPlayed = 7;
    p.customCharacters = parseProfile(JSON.stringify({ customCharacters: [{ id: 'me', name: 'Me', species: 'human' }] })).customCharacters;
    const once = parseProfile(JSON.stringify(p));
    expect(once).toEqual(p);
    expect(parseProfile(JSON.stringify(once))).toEqual(once);
  });

  it('drops a field of the wrong kind and keeps the rest', () => {
    const p = parseProfile(JSON.stringify({
      castVersion: CAST_VERSION,
      settings: { master: 'loud', sfx: null, music: 0.4, reducedMotion: 'yes', autoDrift: true, rivals: '2', weapons: 0, autoFire: 'on', extra: 1 },
      seats: ['rex', 'zadie'],
      best: 'none',
      learned: [true],
      roundsPlayed: '9',
      customCharacters: 'nobody',
    }));
    expect(p.settings.master).toBe(fresh.settings.master);
    expect(p.settings.sfx).toBe(fresh.settings.sfx);
    expect(p.settings.music).toBe(0.4);
    expect(p.settings.reducedMotion).toBe(fresh.settings.reducedMotion);
    expect(p.settings.autoDrift).toBe(true);
    expect(p.settings.rivals).toBe(0);
    expect(p.settings.weapons).toBe(fresh.settings.weapons);
    expect(p.settings.autoFire).toBe(fresh.settings.autoFire);
    expect(p.settings).not.toHaveProperty('extra');
    expect(p.seats).toEqual(['rex', 'zadie']);
    expect(p.best).toEqual({});
    expect(p.learned).toEqual({});
    expect(p.roundsPlayed).toBe(0);
    expect(p.customCharacters).toEqual([]);
  });

  it('never lets a volume or a count be something sound or arithmetic would choke on', () => {
    const s = sanitizeSettings({ master: 7, sfx: -3, music: Number.NaN, rivals: -1 });
    expect(s.master).toBe(1);
    expect(s.sfx).toBe(0);
    expect(s.music).toBe(fresh.settings.music);
    expect(s.rivals).toBe(0);
    expect(sanitizeSettings({ rivals: 1.9 }).rivals).toBe(1);
    // JSON cannot carry Infinity or NaN: they arrive as null
    expect(parseProfile('{"settings":{"master":null},"roundsPlayed":null}').settings.master).toBe(fresh.settings.master);
    expect(parseProfile('{"roundsPlayed":-4}').roundsPlayed).toBe(0);
    expect(parseProfile('{"roundsPlayed":3.7}').roundsPlayed).toBe(3);
  });

  it('keeps only real records', () => {
    const p = parseProfile(JSON.stringify({
      best: { a: 12, b: '13', c: null, d: -5, e: 0, f: 4.5 },
      learned: { drift: true, plank: false, boost: 'yes', start: 1 },
    }));
    expect(p.best).toEqual({ a: 12, f: 4.5 });
    expect(p.learned).toEqual({ drift: true });
  });

  it('resets the seats once when the cast has changed, and when they are not two names', () => {
    expect(parseProfile(JSON.stringify({ castVersion: CAST_VERSION - 1, seats: ['pip', 'juno'] })).seats).toEqual(['', '']);
    expect(parseProfile(JSON.stringify({ seats: ['pip', 'juno'] })).seats).toEqual(['', '']);
    expect(parseProfile(JSON.stringify({ castVersion: CAST_VERSION, seats: ['pip'] })).seats).toEqual(['', '']);
    expect(parseProfile(JSON.stringify({ castVersion: CAST_VERSION, seats: ['pip', 5] })).seats).toEqual(['', '']);
    expect(parseProfile(JSON.stringify({ castVersion: CAST_VERSION, seats: ['pip', 'juno'] })).seats).toEqual(['pip', 'juno']);
    expect(parseProfile(JSON.stringify({ castVersion: CAST_VERSION - 1 })).castVersion).toBe(CAST_VERSION);
  });

  it('cleans saved characters: junk out, duplicates out, never more than the limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, species: 'dog' }));
    const p = parseProfile(JSON.stringify({
      customCharacters: [null, 5, 'x', [], { id: 'a', name: 'A', species: 'wombat', build: 99, primary: 'red' }, { id: 'a', name: 'Again' }, ...many],
    }));
    expect(p.customCharacters.length).toBe(24);
    expect(p.customCharacters[0]!.id).toBe('a');
    expect(p.customCharacters[0]!.species).toBe('human');
    expect(p.customCharacters[0]!.build).toBeLessThanOrEqual(1);
    expect(p.customCharacters[0]!.primary).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(p.customCharacters.map((c) => c.id)).size).toBe(24);
  });
});

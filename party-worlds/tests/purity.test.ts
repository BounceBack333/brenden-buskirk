/**
 * The rule that makes replays, bots, tests and a future server agree with the game: simulation
 * code is pure and deterministic. This test reads the simulation sources and fails if anything
 * that differs between machines, or that reaches outside the simulation, has crept in.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'src');
const attractions = join(root, 'attractions');
const SIM_FILES = ['sim.ts', 'combat.ts', 'rules.ts', 'track.ts', 'rivals.ts', 'stakes.ts'];

function simSources(): string[] {
  const out = [join(root, 'core', 'dmath.ts')];
  for (const dir of readdirSync(attractions)) {
    for (const f of SIM_FILES) {
      const p = join(attractions, dir, f);
      if (existsSync(p)) out.push(p);
    }
  }
  return out;
}

/** Source with comments and string literals blanked, so words in prose do not trip the checks. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""');
}

const ALLOWED_MATH = new Set(['sqrt', 'floor', 'round', 'abs', 'min', 'max', 'ceil', 'trunc', 'imul']);

describe('simulation purity', () => {
  const files = simSources();
  it('finds the simulation sources', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
    expect(files.some((f) => f.endsWith(join('dash', 'sim.ts')))).toBe(true);
    expect(files.some((f) => f.endsWith(join('courier', 'sim.ts')))).toBe(true);
  });

  for (const file of simSources()) {
    const name = file.slice(root.length + 1);
    const src = code(file);
    it(`${name} uses only arithmetic that is identical everywhere`, () => {
      const used = [...src.matchAll(/\bMath\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
      // dmath.ts is where the deterministic replacements live; it may define them but must
      // not lean on the platform's transcendental functions either
      const bad = used.filter((fn) => !ALLOWED_MATH.has(fn));
      expect(bad, `Math.${bad[0]} is not allowed in simulation code: use src/core/dmath.ts`).toEqual([]);
    });
    it(`${name} reaches for nothing outside the simulation`, () => {
      for (const word of ['Date', 'performance', 'window', 'document', 'navigator', 'localStorage', 'fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'crypto']) {
        expect(new RegExp(`\\b${word}\\b`).test(src), `${word} in ${name}`).toBe(false);
      }
      const imports = [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
      for (const from of imports) {
        expect(/^three|\/render\/|\/ui\/|\/audio|\/characters|\/worlds\/|\/kit\//.test(from), `${name} imports ${from}`).toBe(false);
      }
    });
  }
});

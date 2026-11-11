// Balance probe: Buddy bots play full rounds against the real sim.
import { createCourier, stepCourier, noInput } from '../src/attractions/courier/sim';
import type { PlayerInput } from '../src/attractions/courier/sim';
import { BuddyBot } from '../src/attractions/courier/bot';
import { starsFor, ringsInScript, ARENAS } from '../src/attractions/courier/rules';

function play(seed: number, skillA: number, skillB: number) {
  const s = createCourier({ launches: 6 });
  const bots = [new BuddyBot({ seed, skill: skillA }), new BuddyBot({ seed: seed * 7 + 3, skill: skillB })];
  const inputs: [PlayerInput, PlayerInput] = [noInput(), noInput()];
  let guard = 0;
  while (s.phase !== 'done' && guard++ < 60 * 60 * 5) {
    inputs[0] = { ...bots[0]!.think(s, 0) };
    inputs[1] = { ...bots[1]!.think(s, 1) };
    stepCourier(s, inputs);
  }
  return s;
}

const t0 = performance.now();
for (const [a, b] of [[0.3, 0.3], [0.65, 0.65], [0.9, 0.9], [1, 1]] as const) {
  let caught = 0, launches = 0, total = 0, rings = 0, perfect = 0, dive = 0, jelly = 0, ticks = 0, rim = 0;
  const kinds: Record<string, number> = {};
  const stars = [0, 0, 0, 0];
  const N = 60;
  for (let i = 1; i <= N; i++) {
    const s = play(i * 31, a, b);
    ticks += s.tick;
    total += s.total;
    stars[starsFor(s.total, 6, ringsInScript(ARENAS.jelly_junction!, 6))]!++;
    for (const r of s.results) {
      launches++;
      if (r.caught) { caught++; rings += r.rings; if (r.perfect) perfect++; if (r.diveCatch) dive++; if (r.jelly) jelly++; }
      else kinds[r.missKind ?? '?'] = (kinds[r.missKind ?? '?'] ?? 0) + 1;
    }
  }
  console.log(`skill ${a}/${b}: catch ${(100 * caught / launches).toFixed(0)}%  avg score ${(total / N).toFixed(0)}  rings/catch ${(rings / Math.max(1, caught)).toFixed(2)}  perfect ${(100 * perfect / Math.max(1, caught)).toFixed(0)}%  dive ${(100 * dive / Math.max(1, caught)).toFixed(0)}%  jelly ${(100 * jelly / Math.max(1, caught)).toFixed(0)}%  round ${(ticks / N / 60).toFixed(0)}s  stars ${stars.join('/')}  misses ${JSON.stringify(kinds)}`);
}
console.log(`sim+bot time ${(performance.now() - t0).toFixed(0)} ms`);

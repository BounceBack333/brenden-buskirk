/**
 * A fingerprint of the race simulation: npx tsx dev/fingerprint.ts
 * Rival bots race three seeds to the flag and the final state hashes are printed. Run it before
 * and after a refactor that is not supposed to change behaviour: the lines must be identical.
 */
import { createRace, hashRace, stepRace } from '../src/attractions/dash/sim';
import { Rival } from '../src/attractions/dash/bot';
import { RIVAL_LEVELS } from '../src/attractions/dash/rivals';

for (const level of RIVAL_LEVELS) {
  for (const seed of [11, 202, 3003]) {
    const s = createRace({ karts: 4, laps: 3, pace: [1, ...level.pace] });
    const bots = [0.9, ...level.skills].map((skill, i) => new Rival({ seed: seed + i * 7, skill }));
    let guard = 0;
    while (s.phase !== 'over' && guard++ < 60 * 300) stepRace(s, bots.map((b, i) => ({ ...b.think(s, i) })));
    console.log(`${level.id} seed ${seed}: tick ${s.tick} hash ${hashRace(s)} plank ${s.plankOpen ? s.plankOpener : '-'} order ${s.karts.map((k) => k.place).join('')}`);
  }
}

/**
 * A fingerprint of the race simulation, checked against the recorded one.
 *
 *   npm run fingerprint              compare with dev/fingerprint.txt (fails if a race plays differently)
 *   npm run fingerprint -- --update  record the present behaviour as the new baseline
 *
 * Rival bots race three seeds at each level to the flag, unarmed and then armed, and the final
 * state is hashed. The
 * simulation uses only arithmetic that every machine does identically, so the lines are the
 * same everywhere: a difference means play has changed. When that was the intention (tuning,
 * a rule, a track edit), update the file in the same commit and say why in docs/DECISIONS.md.
 * When it was not, something changed play by accident.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRace, hashRace, stepRace } from '../src/attractions/dash/sim';
import { Rival } from '../src/attractions/dash/bot';
import { RIVAL_LEVELS } from '../src/attractions/dash/rivals';
import { TRACK_IDS } from '../src/attractions/dash/track';

const file = resolve(dirname(fileURLToPath(import.meta.url)), 'fingerprint.txt');

const lines: string[] = [];
for (const track of TRACK_IDS) {
  // the plain race first, then the armed one: the plain lines must never move because of a
  // change to the weapons
  // (and then armed to the death, two lives each)
  for (const [combat, lives] of [[false, 0], [true, 0], [true, 2]] as const) {
    for (const level of RIVAL_LEVELS) {
      for (const seed of [11, 202, 3003]) {
        const s = createRace({ track, karts: 4, laps: 3, pace: [1, ...level.pace], combat, lives });
        const bots = [0.9, ...level.skills].map((skill, i) => new Rival({ seed: seed + i * 7, skill }));
        let guard = 0;
        while (s.phase !== 'over' && guard++ < 60 * 300) stepRace(s, bots.map((b, i) => ({ ...b.think(s, i) })));
        const fought = combat ? ` wrecks ${s.karts.map((k) => k.wrecks).join('')}${lives ? ` out ${s.karts.map((k) => (k.out ? 'x' : '-')).join('')}` : ''}` : '';
        lines.push(`${track}${combat ? (lives ? ' death' : ' armed') : ''} ${level.id} seed ${seed}: tick ${s.tick} hash ${hashRace(s)} plank ${s.plankOpen ? s.plankOpener : '-'} order ${s.karts.map((k) => k.place).join('')}${fought}`);
      }
    }
  }
}
const now = lines.join('\n') + '\n';

if (process.argv.includes('--update')) {
  writeFileSync(file, now);
  console.log(now + `recorded in ${file}`);
} else {
  let recorded = '';
  try {
    recorded = readFileSync(file, 'utf8');
  } catch {
    /* no baseline yet */
  }
  if (recorded === now) {
    console.log(`race fingerprint: ${lines.length} races match the recorded baseline`);
  } else {
    const was = recorded.split('\n');
    console.error('The race does not play as recorded in dev/fingerprint.txt:\n');
    lines.forEach((line, i) => {
      if (was[i] !== line) console.error(`  was  ${was[i] ?? '(nothing)'}\n  now  ${line}\n`);
    });
    console.error('Intended (tuning, a rule, a track edit)? Run "npm run fingerprint -- --update", commit the file with the change and note why in docs/DECISIONS.md.\nNot intended? Something changed play by accident.');
    process.exit(1);
  }
}

// Scripted drift through the hairpin to check charge and boost. npx tsx dev/driftdbg.ts
import { createRace, stepRace, noDrive, forwardSpeed } from '../src/attractions/dash/sim';
import type { DriveInput } from '../src/attractions/dash/sim';

const s = createRace({ karts: 1 });
const inp: DriveInput[] = [noDrive()];
const counts: Record<string, number> = {};
for (let t = 0; t < 60 * 30 && s.phase !== 'over'; t++) {
  const k = s.karts[0]!;
  // drive the lap by hand: steer left through the hairpin (x > 44), holding drift
  const inHairpin = k.x > 43 && k.z > -2;
  inp[0] = { steer: inHairpin ? -40 : 0, drift: inHairpin && k.x > 46, brake: false };
  if (!inHairpin && k.x < 43 && k.z < 5) inp[0].steer = 0;
  stepRace(s, inp);
  for (const e of s.events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type !== 'bump') console.log(t, JSON.stringify(e), 'x', k.x.toFixed(1), 'z', k.z.toFixed(1), 'vf', forwardSpeed(k).toFixed(1));
  }
  if (t % 30 === 0 && t > 180 && t < 700) console.log(t, 'x', k.x.toFixed(1), 'z', k.z.toFixed(1), 'vf', forwardSpeed(k).toFixed(1), 'head', k.heading.toFixed(2), 'drift', k.drifting, 'charge', k.charge.toFixed(2), 'surf', k.surface, 'boost', k.boostTicks);
}
console.log(counts);

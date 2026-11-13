// Tuning probe: sweep aim x power for each launch setup and print where flights come down.
import { createCourier, forecastLaunch, aimRadians, launchSpeed } from '../src/attractions/courier/sim';
import { ARENAS, TUNE } from '../src/attractions/courier/rules';

const arena = ARENAS.jelly_junction!;
for (let li = 0; li < arena.script.length; li++) {
  const s = createCourier({ launches: 6 });
  s.launchIndex = li;
  s.ringsCollected = arena.script[li]!.rings.map(() => false);
  console.log(`\n== launch ${li + 1}: wind ${arena.script[li]!.wind}, rings ${JSON.stringify(arena.script[li]!.rings)} ==`);
  const header = ['aim\\pow'];
  const powers = [30, 60, 90, 120, 150, 180, 210, 240];
  for (const p of powers) header.push(String(p).padStart(7));
  console.log(header.join(' '));
  let inLane = 0, total = 0, ringShots = 0, jellyShots = 0, ringLane = 0;
  for (let a = 0; a <= 1023; a += 93) {
    const row = [`${(aimRadians(a) * 180 / Math.PI).toFixed(0)}°`.padStart(7)];
    for (const p of powers) {
      const f = forecastLaunch(s, a, p, 600);
      const ok = !f.dead && f.landX >= arena.laneMin && f.landX <= arena.laneMax;
      row.push(`${Number.isNaN(f.landX) ? '  --' : f.landX.toFixed(0).padStart(3)}${f.rings ? 'R' : ' '}${f.jelly ? 'J' : ' '}${ok ? '*' : f.dead ? 'x' : ' '}`.padStart(7));
    }
    console.log(row.join(' '));
  }
  for (let a = 0; a <= 1023; a += 8) for (let p = 24; p <= 255; p += 4) {
    const f = forecastLaunch(s, a, p, 600);
    total++;
    const ok = !f.dead && f.landX >= arena.laneMin && f.landX <= arena.laneMax;
    if (ok) inLane++;
    if (f.rings) ringShots++;
    if (f.jelly) jellyShots++;
    if (ok && f.rings) ringLane++;
  }
  console.log(`in-lane ${(100 * inLane / total).toFixed(0)}%  ring ${(100 * ringShots / total).toFixed(1)}%  ring+lane ${(100 * ringLane / total).toFixed(1)}%  jelly ${(100 * jellyShots / total).toFixed(0)}%`);
}
// flight time examples
const s = createCourier();
for (const [a, p] of [[400, 200], [600, 220], [800, 255], [300, 150]] as const) {
  const f = forecastLaunch(s, a, p, 600);
  console.log(`aim ${(aimRadians(a) * 180 / Math.PI).toFixed(0)}° speed ${launchSpeed(p).toFixed(1)} -> land ${f.landX.toFixed(1)} in ${(f.landTicks / 60).toFixed(2)}s`, f.rings ? 'ring' : '', f.jelly ? 'jelly' : '');
}
console.log('rimY', TUNE.basket.carryY + TUNE.basket.depth);

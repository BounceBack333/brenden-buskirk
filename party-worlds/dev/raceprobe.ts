// Balance probe: rival bots race the real simulation. npx tsx dev/raceprobe.ts [races]
import { createRace, stepRace, noDrive, trackOf } from '../src/attractions/dash/sim';
import type { DriveInput } from '../src/attractions/dash/sim';
import { Rival } from '../src/attractions/dash/bot';

const races = Number(process.argv[2] ?? 12);
const skills = [0.95, 0.75, 0.55, 0.35];
const TRACK = process.env.TRACK ?? 'backyard';
const track = trackOf(createRace({ track: TRACK }));
console.log(`track ${track.name}: length ${track.length.toFixed(0)}, ${track.samples.length} samples, spacing ${track.ds.toFixed(3)}`);
const wins = [0, 0, 0, 0];
const tot = { time: 0, laps: 0, lapTicks: 0, best: 1e9, resets: 0, bumps: 0, kartBumps: 0, boosts: 0, plankOpen: 0, jumps: 0, startBoost: 0, over: 0 };
const per = skills.map(() => ({ time: 0, n: 0, grass: 0, soil: 0, boosts: 0, plank: 0, drift: 0 }));
const t0 = performance.now();
for (let r = 0; r < races; r++) {
  const s = createRace({ track: TRACK, karts: 4 });
  // rotate grid slots so no skill always starts on pole
  const order = [0, 1, 2, 3].map((i) => (i + r) % 4);
  const bots = order.map((slot, i) => new Rival({ seed: 100 + r * 17 + i, skill: skills[slot]! }));
  const inputs: DriveInput[] = [noDrive(), noDrive(), noDrive(), noDrive()];
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 60 * 300) {
    for (let i = 0; i < 4; i++) inputs[i] = { ...bots[i]!.think(s, i) };
    stepRace(s, inputs);
    for (let i = 0; i < 4; i++) { const k = s.karts[i]!; const q = per[order[i]!]!; if (!k.finished && s.phase === 'racing') { if (k.surface === 1) q.grass++; else if (k.surface === 2) q.soil++; else if (k.surface === 3) q.plank++; if (k.drifting) q.drift++; } }
    for (const e of s.events) {
      if (e.type === 'reset') tot.resets++;
      else if (e.type === 'bump') tot.bumps++;
      else if (e.type === 'kart_bump') tot.kartBumps++;
      else if (e.type === 'boost') { tot.boosts++; per[order[e.seat]!]!.boosts++; }
      else if (e.type === 'plank_open') tot.plankOpen++;
      else if (e.type === 'jump') tot.jumps++;
      else if (e.type === 'start_boost') tot.startBoost++;
      else if (e.type === 'lap') { tot.laps++; tot.lapTicks += e.ticks; if (e.ticks < tot.best) tot.best = e.ticks; }
    }
  }
  s.karts.forEach((k, i) => { if (k.finished) { per[order[i]!]!.time += (k.finishTick - 180) / 60; per[order[i]!]!.n++; } });
  const first = s.karts.findIndex((k) => k.place === 1);
  wins[order[first]!]!++;
  tot.time += (s.firstFinishTick - 180) / 60;
  if (s.phase === 'over') tot.over++;
  if (r < 3) console.log(`race ${r}: ` + s.karts.map((k, i) => `skill ${skills[order[i]!]} P${k.place} ${k.finished ? ((k.finishTick - 180) / 60).toFixed(1) + 's' : 'lap ' + k.lap}`).join(' | '));
}
console.log(`winner's race time avg ${(tot.time / races).toFixed(1)} s · lap avg ${(tot.lapTicks / Math.max(1, tot.laps) / 60).toFixed(1)} s · best lap ${(tot.best / 60).toFixed(1)} s`);
console.log(`wins by skill ${skills.map((sk, i) => `${sk}:${wins[i]}`).join('  ')}`);
console.log(`per race: boosts ${(tot.boosts / races).toFixed(1)}, wall bumps ${(tot.bumps / races).toFixed(1)}, kart bumps ${(tot.kartBumps / races).toFixed(1)}, jumps ${(tot.jumps / races).toFixed(1)}, start boosts ${(tot.startBoost / races).toFixed(1)}, resets ${(tot.resets / races).toFixed(2)}, plank opened in ${tot.plankOpen}/${races}, finished cleanly ${tot.over}/${races}`);
per.forEach((q, i) => console.log(`skill ${skills[i]}: avg finish ${(q.time / Math.max(1, q.n)).toFixed(1)} s (${q.n} finishes) · per race: grass ${(q.grass / races / 60).toFixed(1)} s, soil ${(q.soil / races / 60).toFixed(1)} s, plank ${(q.plank / races / 60).toFixed(1)} s, drifting ${(q.drift / races / 60).toFixed(1)} s, boosts ${(q.boosts / races).toFixed(1)}`));
console.log(`cpu ${(performance.now() - t0).toFixed(0)} ms`);

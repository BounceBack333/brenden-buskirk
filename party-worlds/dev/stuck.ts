import { createCourier, stepCourier, noInput } from '../src/attractions/courier/sim';
import type { PlayerInput } from '../src/attractions/courier/sim';
import { BuddyBot } from '../src/attractions/courier/bot';
let found = 0;
for (let seed = 1; seed <= 400 && found < 3; seed++) {
  for (const skill of [0.3, 0.9]) {
    const s = createCourier({ launches: 6 });
    const bots = [new BuddyBot({ seed: seed * 31, skill }), new BuddyBot({ seed: seed * 217 + 3, skill })];
    const inputs: [PlayerInput, PlayerInput] = [noInput(), noInput()];
    let guard = 0; let reported = false;
    while (s.phase !== 'done' && guard++ < 60 * 60 * 5) {
      inputs[0] = { ...bots[0]!.think(s, 0) }; inputs[1] = { ...bots[1]!.think(s, 1) };
      stepCourier(s, inputs);
      if (s.phase === 'flight' && s.flyer.airTicks > 420 && !reported && s.flyer.airTicks % 20 === 0) {
        console.log(`seed ${seed} skill ${skill} L${s.launchIndex} t${s.flyer.airTicks} f=(${s.flyer.x.toFixed(2)},${s.flyer.y.toFixed(2)}) v=(${s.flyer.vx.toFixed(2)},${s.flyer.vy.toFixed(2)}) c.bx=${s.catcher.bx.toFixed(2)} by=${s.catcher.by.toFixed(2)} cmode=${s.catcher.mode} rim=${s.flyer.rimHits} jelly=${s.flyer.jellyHits} ev=${JSON.stringify(s.events)}`);
        if (s.flyer.airTicks > 520) { reported = true; found++; }
      }
    }
  }
}
console.log('found', found);

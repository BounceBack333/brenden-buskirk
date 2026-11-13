import { createCourier, noInput, stepCourier } from '../src/attractions/courier/sim';
import { TIMING } from '../src/attractions/courier/rules';
const s = createCourier();
const idle = () => [noInput(), noInput()] as [any, any];
for (let i = 0; i < TIMING.intro; i++) stepCourier(s, idle());
for (let i = 0; i < 3; i++) { const p = idle(); p[0] = { ...noInput(), pull: true, aimQ: 500, powerQ: 200 }; stepCourier(s, p); }
stepCourier(s, idle());
console.log(s.phase, s.flyer, s.catcher);
s.flyer.x = s.catcher.bx; s.flyer.y = 6; s.flyer.vx = 0; s.flyer.vy = -6;
for (let i = 0; i < 60; i++) { stepCourier(s, idle()); if (i % 5 === 0 || s.events.length) console.log(i, s.phase, s.flyer.x.toFixed(2), s.flyer.y.toFixed(2), s.flyer.vy.toFixed(2), s.flyer.mode, JSON.stringify(s.events)); }

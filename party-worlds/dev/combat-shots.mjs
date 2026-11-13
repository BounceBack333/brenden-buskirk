#!/usr/bin/env node
// Freeze an armed race on the frame of a shot, a mine going off, a wreck and a respawn, and save
// each as a picture. The effects last a fraction of a second: this is the way to look at them.
//   node dev/combat-shots.mjs [url] [outDir]
// Run against a production preview (npm run build && npx vite preview --port 4173).
// The karts are placed by hand on the home straight; this checks the pictures, not the rules.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/?hq', out = 'dev/shots/combat'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await page.click('[data-act="play"]');
await page.click('[data-rules="armed"]'); // a wreck comes back, so the respawn can be photographed
await page.click('[data-race="solo"]');
await page.waitForFunction(() => window.__pw.race?.state.phase === 'racing', null, { timeout: 120000 });

await page.evaluate(() => {
  const pw = window.__pw;
  const s = pw.race.state;
  pw.loop.timeScale = 0.5;
  s.phaseTick = 400; // weapons live
  const put = (i, x, z) => {
    const k = s.karts[i];
    k.x = x; k.z = z; k.heading = 0; k.vx = 13; k.vz = 0; k.idx = Math.round(x + 5); k.lap = 1;
  };
  put(0, -2, 30); put(1, 7, 30.1); put(2, 15, 28.4); put(3, 11, 32.2);
  s.karts[1].armor = 13;
  s.karts[0].mines = 2;
  s.mines.push({ id: 99, owner: 0, x: 24, z: 28.4, armTick: 0, dieTick: s.tick + 99999 });
  // stop the loop on the frame in which a wanted event has just been drawn
  const view = pw.raceView;
  const after = view.afterTick.bind(view);
  view.afterTick = (state) => {
    after(state);
    for (const e of state.events) if (window.__want && window.__want(e)) window.__seen = e.type;
  };
  const watch = () => {
    if (window.__seen && pw.loop.isRunning) {
      pw.loop.stop();
      window.__frozen = window.__seen;
      window.__seen = null;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
});

async function freezeOn(name, want, keys = []) {
  await page.evaluate((src) => {
    window.__frozen = null;
    window.__want = new Function('e', `return ${src}`);
    if (!window.__pw.loop.isRunning) window.__pw.loop.start();
  }, want);
  for (const k of keys) await page.keyboard.down(k);
  const ok = await page.waitForFunction(() => !!window.__frozen, null, { timeout: 60000 }).then(() => true, () => false);
  for (const k of keys) await page.keyboard.up(k);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${ok ? 'ok   ' : 'MISS '} ${name}`);
  return ok;
}

let all = true;
all = (await freezeOn('1-shot-hits', "e.type === 'shot' && e.seat === 0 && e.hit >= 0", ['KeyF'])) && all;
all = (await freezeOn('2-wreck', "e.type === 'wreck'", ['KeyF'])) && all;
all = (await freezeOn('3-mine', "e.type === 'mine_hit'")) && all;
all = (await freezeOn('4-respawn', "e.type === 'respawn'")) && all;
// and a moment later, with the wreck back on the road and blinking under its shield
await page.evaluate(() => { window.__want = null; window.__pw.loop.start(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/5-after.png` });
await browser.close();
console.log(`errors ${errors.length}`, errors.slice(0, 2));
if (!all || errors.length) process.exit(1);

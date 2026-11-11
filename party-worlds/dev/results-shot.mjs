#!/usr/bin/env node
/**
 * Screenshot the race results without driving a whole race: starts a race, waits for GO, then
 * places the local karts just short of the line on their last lap (through the debug handle) and
 * lets the game finish the race by itself. For checking the results layout only.
 *   node dev/results-shot.mjs [url] [out.png] [solo|split] [width] [height]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [url = 'http://127.0.0.1:4173/?hq&laps=1', out = 'dev/shots/race/results.png', mode = 'solo', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(400);
await page.click('[data-act="play"]');
await page.waitForTimeout(300);
await page.click(`[data-race="${mode}"]`);
await page.waitForFunction(() => window.__pw.race?.state.phase === 'racing', null, { timeout: 120000 });
await page.screenshot({ path: out.replace('.png', '-hint.png') });
await page.evaluate(() => {
  const r = window.__pw.race;
  const t = window.__pw.track;
  const line = t.samples[0];
  const N = t.samples.length;
  r.setup.humans.forEach((seat, i) => {
    const k = r.state.karts[seat];
    k.lap = r.state.laps; k.cpMask = 3; k.heading = 0; k.vx = 16; k.vz = 0;
    k.x = line.x - 8 - i * 6; k.z = line.z + (i ? 2 : -2); k.idx = N - 8 - i * 6;
  });
  // one rival close behind, so the run-out has someone to time
  const rival = r.state.karts.findIndex((_, seat) => !r.setup.humans.includes(seat));
  const k = r.state.karts[rival];
  k.lap = r.state.laps; k.cpMask = 3; k.heading = 0; k.vx = 15; k.vz = 0; k.x = line.x - 30; k.z = line.z; k.idx = N - 30;
});
await page.waitForSelector('.race-rows', { timeout: 120000 });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
const text = await page.evaluate(() => document.querySelector('#ui')?.innerText ?? '');
await browser.close();
console.log(text.replace(/\n+/g, ' | '));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('saved', out);

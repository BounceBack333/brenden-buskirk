#!/usr/bin/env node
/**
 * Drives one launch with REAL touch events (not mouse) on an emulated phone, including a
 * second simultaneous finger, to prove the touch path end to end in a Chromium engine.
 *   node dev/touch-test.mjs [url] [outDir]
 * This does not prove behaviour in iOS Safari, which is a different engine.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://127.0.0.1:5173/?launches=1';
const out = process.argv[3] ?? 'dev/shots/touch';
mkdirSync(out, { recursive: true });
const W = 844;
const H = 390;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 8, radiusY: 8, force: 1 })) });
const state = () => page.evaluate(() => {
  const r = window.__pw?.round;
  if (!r) return null;
  const s = r.state;
  return { phase: s.phase, pulling: s.aim.pulling, powerQ: s.aim.powerQ, flyerMode: s.flyer.mode, open: s.flyer.open, y: s.flyer.y, vy: s.flyer.vy, results: s.results.length, budget: s.flyer.budget };
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.tap('[data-act="play"]');
await page.waitForTimeout(300);
await page.tap('[data-mode="buddy"]');

const log = [];
// wait for the aim phase
for (let i = 0; i < 200; i++) {
  const s = await state();
  if (s && s.phase === 'aim') break;
  await page.waitForTimeout(50);
}
// one finger: pull back and down
const sx = W * 0.5;
const sy = H * 0.4;
const len = H * 0.36 * 0.8;
const ang = (48 * Math.PI) / 180;
await touch('touchStart', [{ x: sx, y: sy, id: 1 }]);
for (let i = 1; i <= 10; i++) {
  await touch('touchMove', [{ x: sx - Math.cos(ang) * len * (i / 10), y: sy + Math.sin(ang) * len * (i / 10), id: 1 }]);
  await page.waitForTimeout(30);
}
await page.waitForTimeout(350);
const pulled = await state();
log.push({ step: 'pulled', ...pulled });
await page.screenshot({ path: out + '/1-pulled.png' });
await touch('touchEnd', []);
await page.waitForTimeout(200);
const launched = await state();
log.push({ step: 'released', ...launched });

// in flight: hold a finger to open the umbrella once the flyer is coming down
let opened = null;
for (let i = 0; i < 200; i++) {
  const s = await state();
  if (!s || s.phase !== 'flight') break;
  if (s.vy < 0 && !opened) {
    await touch('touchStart', [{ x: W * 0.6, y: H * 0.5, id: 2 }]);
    await page.waitForTimeout(350);
    opened = await state();
    await page.screenshot({ path: out + '/2-umbrella.png' });
    await touch('touchEnd', []);
    break;
  }
  await page.waitForTimeout(30);
}
log.push({ step: 'umbrella-held', ...opened });

// let the launch finish
for (let i = 0; i < 400; i++) {
  const s = await state();
  if (!s || s.results >= 1) break;
  await page.waitForTimeout(50);
}
await page.waitForTimeout(600);
await page.screenshot({ path: out + '/3-outcome.png' });
const end = await state();
log.push({ step: 'end', ...end });

const ok = !!pulled && pulled.pulling === true && pulled.powerQ > 120
  && !!launched && (launched.phase === 'flight' || launched.phase === 'outcome')
  && (!opened || opened.open > 0.5 || opened.budget < 96)
  && !!end && end.results >= 1;
console.log(JSON.stringify({ ok, log, errors }, null, 1));
await browser.close();
if (!ok || errors.length) process.exit(1);

#!/usr/bin/env node
/**
 * Automated play-through in a real browser with real pointer/keyboard input.
 *   node dev/playthrough.mjs [url] [mode=buddy|shared] [outDir] [--touch] [--portrait]
 * Drives one whole round of Catapult Courier, takes screenshots at each phase, and fails on any
 * page error. This is evidence that the round can be completed through the real UI; it is not
 * evidence that the game is fun.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const url = args[0] ?? 'http://127.0.0.1:5173/';
const mode = args[1] ?? 'buddy';
const out = args[2] ?? 'dev/shots/play';
mkdirSync(out, { recursive: true });

const portrait = flags.has('--portrait');
const viewport = portrait ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: flags.has('--touch') });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack || e)));

let shotN = 0;
const shot = async (name) => {
  const file = `${out}/${String(++shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  return file;
};
const state = () => page.evaluate(() => {
  const r = window.__pw?.round;
  if (!r) return null;
  const s = r.state;
  return {
    phase: s.phase, launchIndex: s.launchIndex, launcherSeat: s.launcherSeat, total: s.total,
    flyer: { x: s.flyer.x, y: s.flyer.y, vx: s.flyer.vx, vy: s.flyer.vy, mode: s.flyer.mode, budget: s.flyer.budget },
    catcher: { x: s.catcher.x, bx: s.catcher.bx, mode: s.catcher.mode },
    results: s.results.map((x) => ({ caught: x.caught, points: x.points, perfect: x.perfect, miss: x.missKind })),
    tick: s.tick,
  };
});

// stage → client coordinates (the stage is rotated in portrait)
const toClient = (x, y) => (portrait ? { x: viewport.width - y, y: x } : { x, y });
const stageW = portrait ? viewport.height : viewport.width;
const stageH = portrait ? viewport.width : viewport.height;

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(600);
await shot('home');

await page.click('[data-act="play"]');
await page.waitForTimeout(350);
await shot('play-sheet');
await page.click(`[data-mode="${mode}"]`);
await page.waitForTimeout(500);

const t0 = Date.now();
let lastPhase = '';
let lastLaunch = -1;
let pulling = false;
let shotsThisLaunch = new Set();
const snap = async (key, s) => {
  const k = `${s.launchIndex}:${key}`;
  if (shotsThisLaunch.has(k)) return;
  shotsThisLaunch.add(k);
  await shot(`L${s.launchIndex + 1}-${key}`);
};

while (Date.now() - t0 < 240000) {
  const s = await state();
  if (!s) break;
  if (s.phase === 'done') break;
  if (s.launchIndex !== lastLaunch) { lastLaunch = s.launchIndex; shotsThisLaunch = new Set(); }
  const humanSeats = mode === 'shared' ? [0, 1] : [0];
  const humanLaunches = humanSeats.includes(s.launcherSeat);
  const humanCatches = humanSeats.includes(1 - s.launcherSeat);
  // which half of the stage a seat owns
  const regionX = (seat) => (mode === 'shared' ? (seat === 0 ? stageW * 0.25 : stageW * 0.75) : stageW * 0.5);

  if (s.phase === 'intro') await snap('intro', s);

  if (s.phase === 'aim' && humanLaunches && !pulling) {
    await snap('aim', s);
    // pull back and down from the middle of the launcher's area, vary by launch
    const cx = regionX(s.launcherSeat);
    const cy = stageH * 0.45;
    const power = [0.74, 0.8, 0.86, 0.7, 0.78, 0.82][s.launchIndex % 6];
    const angle = [48, 52, 44, 50, 46, 49][s.launchIndex % 6] * Math.PI / 180;
    const len = stageH * 0.36 * power;
    const from = toClient(cx, cy);
    const to = toClient(cx - Math.cos(angle) * len, cy + Math.sin(angle) * len);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    pulling = true;
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(from.x + (to.x - from.x) * (i / 12), from.y + (to.y - from.y) * (i / 12));
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(250);
    await snap('pulled', (await state()) ?? s);
    await page.mouse.up();
    pulling = false;
    await page.waitForTimeout(120);
    await snap('launched', (await state()) ?? s);
    continue;
  }

  if (s.phase === 'aim' && !humanLaunches) await snap('bot-aim', s);

  if (s.phase === 'flight') {
    if (humanLaunches && mode !== 'shared') {
      // hold the umbrella on the way down when clearly overshooting the catcher
      const over = s.flyer.vy < -2 && s.flyer.x + s.flyer.vx * 0.5 > s.catcher.bx + 1;
      if (over && s.flyer.budget > 0) { await page.keyboard.down('Space'); await snap('umbrella', s); }
      else await page.keyboard.up('Space');
    }
    if (humanCatches && mode !== 'shared') {
      // crude outfielder: run toward where the flyer will be in a moment
      const lead = s.flyer.x + s.flyer.vx * Math.max(0.1, Math.min(1.2, (s.flyer.y - 2) / Math.max(4, -s.flyer.vy + 6)));
      const d = lead - s.catcher.x;
      if (d > 0.5) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
      else if (d < -0.5) { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
      else { await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD'); }
      if (s.flyer.y < 4.2 && s.flyer.vy < 0 && Math.abs(d) > 1.6 && Math.abs(d) < 5 && s.catcher.mode === 'run') {
        await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(40); await page.keyboard.up('ShiftLeft');
      }
    }
    if (s.flyer.y > 6) await snap('flight', s);
  } else {
    await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD'); await page.keyboard.up('Space');
  }

  if (s.phase === 'outcome' && lastPhase !== 'outcome') {
    await page.waitForTimeout(260);
    await snap('outcome', s);
  }
  lastPhase = s.phase;
  await page.waitForTimeout(30);
}

await page.waitForTimeout(1800);
await shot('results');
const final = await state();
const perf = await page.evaluate(() => ({ frameMs: window.__pw.loop.frameMs, calls: window.__pw.stage.renderer.info.render.calls, tris: window.__pw.stage.renderer.info.render.triangles }));
console.log(JSON.stringify({ mode, portrait, final: final && { total: final.total, results: final.results }, perf, errors }, null, 1));
await browser.close();
if (errors.length) process.exit(1);

#!/usr/bin/env node
/**
 * Where does a race frame go? Wraps the view's render and the HUD update with timers.
 *   node dev/raceprof.mjs [url] [width] [height]
 * Headless Chromium renders with SwiftShader (software), so absolute numbers say nothing about a
 * phone; the split between script time and draw time is what this is for.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://127.0.0.1:5173/?laps=1';
const width = +(process.argv[3] ?? 1280);
const height = +(process.argv[4] ?? 720);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.click('[data-act="play"]');
await page.waitForTimeout(300);
await page.click('[data-race="solo"]');
await page.waitForTimeout(4500);
const out = await page.evaluate(async () => {
  const pw = window.__pw;
  const t = { render: 0, gl: 0, frames: 0, tick: 0, ticks: 0, calls: 0, tris: 0 };
  const view = pw.raceView;
  const r = pw.stage.renderer;
  const origRender = view.render.bind(view);
  view.render = (...a) => { const t0 = performance.now(); origRender(...a); t.render += performance.now() - t0; t.frames++; t.calls += r.info.render.calls; t.tris += r.info.render.triangles; };
  const origGl = r.render.bind(r);
  r.render = (...a) => { const t0 = performance.now(); origGl(...a); t.gl += performance.now() - t0; };
  const race = pw.race;
  const origTick = race.tick.bind(race);
  race.tick = () => { const t0 = performance.now(); origTick(); t.tick += performance.now() - t0; t.ticks++; };
  const start = performance.now();
  await new Promise((res) => setTimeout(res, 5000));
  const wall = performance.now() - start;
  return {
    fps: +(t.frames / (wall / 1000)).toFixed(1),
    renderMsPerFrame: +(t.render / t.frames).toFixed(2),
    glMsPerFrame: +(t.gl / t.frames).toFixed(2),
    tickMs: +(t.tick / Math.max(1, t.ticks)).toFixed(3),
    ticksPerSecond: +(t.ticks / (wall / 1000)).toFixed(1),
    drawCalls: Math.round(t.calls / t.frames),
    triangles: Math.round(t.tris / t.frames),
    pixelRatio: r.getPixelRatio(),
    quality: pw.stage.quality,
  };
});
console.log(JSON.stringify({ width, height, ...out }));
await browser.close();

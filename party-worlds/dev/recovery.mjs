#!/usr/bin/env node
// Break the game mid-race in two ways and check it says so instead of freezing:
// the graphics context is taken away, and the simulation starts throwing on every tick.
//   node dev/recovery.mjs [url] [outDir]
// Run against a production preview (npm run build && npx vite preview --port 4173).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/?laps=1', outDir = 'dev/shots/race'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function scenario(name, breakIt) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.click('[data-act="play"]');
  await page.waitForTimeout(300);
  await page.click('[data-race="solo"]');
  await page.waitForTimeout(2500);
  const supported = await page.evaluate(breakIt);
  // software rendering draws only a few frames a second, so give the loop time to notice
  await page.waitForFunction(() => !window.__pw.loop.isRunning, null, { timeout: 20000 }).catch(() => undefined);
  const result = await page.evaluate(() => {
    const boot = document.getElementById('boot');
    return {
      overlayShown: !boot.classList.contains('gone'),
      message: document.getElementById('boot-status')?.textContent ?? '',
      loopRunning: window.__pw.loop.isRunning,
    };
  });
  await page.waitForTimeout(900); // the screen fades in
  await page.screenshot({ path: `${outDir}/recovery-${name}.png` });
  // the screen promises that a tap starts again: check it does
  await page.click('#boot');
  // (the stopped page never satisfies this; only a freshly started one does)
  const restarted = await page
    .waitForFunction(() => window.__ready === true && window.__pw.loop.isRunning, null, { timeout: 30000 })
    .then(() => true, () => false);
  await page.close();
  const ok = supported === false || (result.overlayShown && !result.loopRunning && restarted);
  console.log(JSON.stringify({ scenario: name, supported: supported !== false, ...result, restarted, ok }));
  return ok;
}

const lost = await scenario('context-lost', () => {
  const gl = window.__pw.stage.renderer.getContext();
  const ext = gl.getExtension('WEBGL_lose_context');
  if (!ext) return false;
  ext.loseContext();
  return true;
});
const fault = await scenario('fault', () => {
  window.__pw.race.tick = () => {
    throw new RangeError('scripted fault (dev/recovery.mjs)');
  };
  return true;
});
await browser.close();
if (!lost || !fault) process.exit(1);

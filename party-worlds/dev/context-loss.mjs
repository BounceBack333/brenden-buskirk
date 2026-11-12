#!/usr/bin/env node
// Lose the graphics context mid-race and check the game says so instead of freezing.
//   node dev/context-loss.mjs [url] [out.png]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/?laps=1', out = 'dev/shots/race/context-loss.png'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.click('[data-act="play"]');
await page.waitForTimeout(300);
await page.click('[data-race="solo"]');
await page.waitForTimeout(2500);
const result = await page.evaluate(async () => {
  const gl = window.__pw.stage.renderer.getContext();
  const ext = gl.getExtension('WEBGL_lose_context');
  if (!ext) return { supported: false };
  ext.loseContext();
  await new Promise((r) => setTimeout(r, 800));
  const boot = document.getElementById('boot');
  return {
    supported: true,
    overlayShown: !boot.classList.contains('gone'),
    message: document.getElementById('boot-status')?.textContent ?? '',
    loopRunning: window.__pw.loop.isRunning,
    paused: !!window.__pw.race?.paused,
  };
});
await page.screenshot({ path: out });
await browser.close();
console.log(JSON.stringify(result));
if (result.supported && (!result.overlayShown || result.loopRunning)) process.exit(1);

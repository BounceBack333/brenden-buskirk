#!/usr/bin/env node
/**
 * Screenshot helper for visual QA.
 *   node dev/shoot.mjs <url> <out.png> [width=1280] [height=720] [extraWaitMs=300]
 * Waits for `window.__ready === true` (set it once your page has rendered a frame), then
 * captures. Page console errors are echoed and make the process exit non-zero.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [url, out, w = '1280', h = '720', wait = '300'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node dev/shoot.mjs <url> <out.png> [width] [height] [extraWaitMs]');
  process.exit(2);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
} catch {
  errors.push('timed out waiting for window.__ready');
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('saved', out);

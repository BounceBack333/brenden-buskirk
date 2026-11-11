#!/usr/bin/env node
// Start a solo race, wait, screenshot. node dev/quick-race-shot.mjs [url] [out] [waitMs] [w] [h]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:5173/?hq', out = 'dev/shots/race/quick.png', wait = '9000', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(600);
await page.screenshot({ path: out.replace('.png', '-home.png') });
await page.click('[data-act="play"]');
await page.waitForTimeout(300);
await page.click('[data-race="solo"]');
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('saved', out);

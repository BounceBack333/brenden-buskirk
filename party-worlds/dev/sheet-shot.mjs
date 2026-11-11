#!/usr/bin/env node
// Screenshot the play sheet (and optionally other menu states). node dev/sheet-shot.mjs [url] [out] [w] [h]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:5173/', out = 'dev/shots/race/sheet.png', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.click('[data-act="play"]');
await page.waitForTimeout(400);
await page.click('[data-rivals="1"]');
await page.waitForTimeout(200);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('saved', out);

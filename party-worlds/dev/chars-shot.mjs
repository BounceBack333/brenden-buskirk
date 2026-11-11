#!/usr/bin/env node
// Screenshot the driver picker and the builder. node dev/chars-shot.mjs [url] [outPrefix] [w] [h]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:5173/?hq', out = 'dev/shots/adult/chars', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(500);
await page.click('[data-act="chars"]');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}-pick.png` });
const labels = await page.evaluate(() => [...document.querySelectorAll('#ui button')].map((b) => (b.getAttribute('data-act') || b.getAttribute('data-tab') || '') + ':' + b.textContent.trim().slice(0, 24)).slice(0, 60));
console.log(labels.join(' | '));
const make = await page.$('[data-act="make"], [data-tab="make"], [data-act="edit"]');
if (make) { await make.click(); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}-make.png` }); }
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('saved', out);

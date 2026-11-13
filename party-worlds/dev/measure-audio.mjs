#!/usr/bin/env node
// node dev/measure-audio.mjs [url] — offline-render every sound and print the table; exits 1 on a problem.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] ?? 'http://127.0.0.1:5173/dev/audio.html';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const { rows, problems } = await page.evaluate(() => window.__measure());
console.log('name'.padEnd(26) + 'ms'.padStart(6) + 'peak'.padStart(8) + 'rms'.padStart(9) + 'centroidHz'.padStart(12) + 'tailDb'.padStart(8));
for (const r of rows) console.log(r.name.padEnd(26) + String(r.ms).padStart(6) + String(r.peak).padStart(8) + String(r.rms).padStart(9) + String(r.centroid).padStart(12) + String(r.tailDb).padStart(8));
await browser.close();
if (errors.length || problems.length) { console.error('\nPROBLEMS:\n' + [...errors, ...problems].join('\n')); process.exit(1); }
console.log('\nno problems');

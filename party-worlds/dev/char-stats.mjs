#!/usr/bin/env node
// Prints triangles / draw calls / bones per preset character and checks the carry anchor.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5173/dev/characters.html';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + '?stats=1&carry=1&action=run&t=0.7', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await page.waitForTimeout(500);
const stats = await page.evaluate(() => window.__stats);
const probe = await page.evaluate(() => (window.__probe ? window.__probe() : null));
await browser.close();
console.log(JSON.stringify({ stats, probe, errors }, null, 1));

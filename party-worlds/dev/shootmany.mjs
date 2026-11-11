#!/usr/bin/env node
// node dev/shootmany.mjs <outDir> <w> <h> name=url name=url ...   (one browser, many pages; then tiles them with ffmpeg)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [out, w, h, ...pairs] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const files = [];
for (const pair of pairs) {
  const i = pair.indexOf('=');
  const name = pair.slice(0, i);
  const url = pair.slice(i + 1);
  await page.goto(url, { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }); } catch { errors.push('not ready: ' + name); }
  await page.waitForTimeout(250);
  const f = `${out}/${name}.png`;
  await page.screenshot({ path: f });
  files.push(f);
}
await browser.close();
const cols = Math.ceil(Math.sqrt(files.length));
const rows = Math.ceil(files.length / cols);
const args = [];
for (const f of files) args.push('-i', f);
args.push('-filter_complex', `${files.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) * +w}_${Math.floor(i / cols) * +h}`).join('|')}:fill=white`, '-frames:v', '1', '-y', `${out}/_sheet.png`);
if (files.length > 1) execFileSync('ffmpeg', ['-loglevel', 'error', ...args]);
console.log(`${files.length} shots, ${cols}x${rows} sheet → ${out}/_sheet.png`);
if (errors.length) { console.error('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(1); }

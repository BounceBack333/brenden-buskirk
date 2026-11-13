#!/usr/bin/env node
// Draws the home-screen icons from public/icon.svg. Run again whenever the SVG changes:
//   node dev/make-icons.mjs
// The PNGs are square and full-bleed (phones cut their own corners); the SVG keeps its rounded plate
// for browser tabs.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const pub = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(resolve(pub, 'icon.svg'), 'utf8').replace('rx="112"', 'rx="0"');
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:#0b0c1e}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: resolve(pub, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  console.log(`icon-${size}.png`);
}
await browser.close();

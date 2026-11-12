#!/usr/bin/env node
/**
 * A budget for what the player downloads: node scripts/check-size.mjs (after npm run build).
 * Prints the built files with their compressed sizes and fails if a budget is exceeded, so growth
 * is a decision somebody made and not something that happened.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/** kilobytes, gzipped */
const BUDGET = { js: 300, css: 160 };

const assets = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist', 'assets');
let files;
try {
  files = readdirSync(assets);
} catch {
  console.error('dist/assets not found. Run "npm run build" first.');
  process.exit(2);
}
let failed = false;
for (const kind of ['js', 'css']) {
  let raw = 0;
  let gz = 0;
  for (const f of files.filter((n) => n.endsWith(`.${kind}`))) {
    const buf = readFileSync(join(assets, f));
    raw += buf.length;
    gz += gzipSync(buf).length;
  }
  const kb = gz / 1024;
  const over = kb > BUDGET[kind];
  failed ||= over;
  console.log(`${kind.padEnd(4)} ${(raw / 1024).toFixed(0).padStart(6)} KB   gzipped ${kb.toFixed(0).padStart(4)} KB   budget ${String(BUDGET[kind]).padStart(4)} KB   ${over ? 'OVER BUDGET' : 'ok'}`);
}
const other = files.filter((n) => !n.endsWith('.js') && !n.endsWith('.css'));
if (other.length) console.log(`other files: ${other.join(', ')}`);
process.exit(failed ? 1 : 0);

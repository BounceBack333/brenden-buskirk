#!/usr/bin/env node
/**
 * Turns the Vite build in dist/ into ONE self-contained HTML fragment: styles (with the font)
 * and the whole game inlined, no external requests. Useful for hosts that serve a single page
 * and for sharing a private preview.
 *
 *   npm run build && node scripts/build-single-file.mjs <out.html> [--page]
 *
 * By default the output is a fragment (no <html>/<head>/<body>), for hosts that wrap the page
 * themselves. --page writes a complete standalone document instead.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--'));
const fullPage = args.includes('--page');
if (!out) {
  console.error('usage: node scripts/build-single-file.mjs <out.html> [--page]');
  process.exit(2);
}

const assets = join(root, 'dist', 'assets');
const files = readdirSync(assets);
const cssFile = files.find((f) => f.endsWith('.css'));
const jsFile = files.find((f) => f.endsWith('.js'));
if (!cssFile || !jsFile) {
  console.error('dist/assets is missing the built css/js. Run "npm run build" first.');
  process.exit(1);
}
const css = readFileSync(join(assets, cssFile), 'utf8');
// an inline script ends at the first "</script", wherever it appears, so neutralise any in the bundle
const js = readFileSync(join(assets, jsFile), 'utf8').replace(/<\/script/gi, '<\\/script');
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
if (!bodyMatch) {
  console.error('could not find <body> in dist/index.html');
  process.exit(1);
}
// keep the stage markup, drop the external script/style tags
const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();

const fragment = [
  '<title>BounceBack Party Worlds</title>',
  '<meta name="theme-color" content="#141a45">',
  `<style>${css}</style>`,
  body,
  `<script type="module">${js}</script>`,
].join('\n');

const page = fullPage
  ? `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n</head>\n<body>\n${fragment}\n</body>\n</html>\n`
  : fragment + '\n';

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(resolve(out), page);
console.log(`${fullPage ? 'page' : 'fragment'} written: ${resolve(out)} (${(page.length / 1024).toFixed(0)} KB)`);

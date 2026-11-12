import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// What a play-test note or a bug report should quote: version, commit, day built. A "+" after
// the commit means the build included changes that were not committed.
function buildLabel(): string {
  const here = import.meta.dirname;
  const version = (JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8')) as { version: string }).version;
  let commit = 'no-git';
  try {
    const git = (cmd: string): string => execSync(`git ${cmd}`, { cwd: here, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    commit = git('rev-parse --short HEAD') + (git('status --porcelain -- .') ? '+' : '');
  } catch {
    /* built from a copy without its history */
  }
  return `${version} · ${commit} · ${new Date().toISOString().slice(0, 10)}`;
}

// base './' keeps the build relocatable (GitHub Pages sub-path, static hosts, wrappers).
// STUBS=props,audio swaps the named kits for placeholders so the shell can run before (or
// without) the real ones. Never used for a shipped build.
const want = (process.env.STUBS ?? '').split(',');
const stubs = [
  ...(want.includes('props') ? [{ find: /^(\.\.?\/)+worlds\/birthday$/, replacement: resolve(import.meta.dirname, 'dev/stubs/birthday.ts') }] : []),
  ...(want.includes('audio') ? [{ find: /^\.\/audio$/, replacement: resolve(import.meta.dirname, 'dev/stubs/audio.ts') }] : []),
];

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(buildLabel()) },
  resolve: { alias: stubs },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 400_000, // inline the UI font so the build is index.html + one JS + one CSS
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html') },
    },
  },
  server: { port: 5173, strictPort: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});

import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// base './' keeps the build relocatable (GitHub Pages sub-path, static hosts, wrappers).
// STUBS=1 swaps the world-prop and audio kits for placeholders so the shell can run before
// (or without) the real kits. Never used for a shipped build.
const stubs = process.env.STUBS
  ? [
      { find: /^(\.\.?\/)+worlds\/birthday$/, replacement: resolve(import.meta.dirname, 'dev/stubs/birthday.ts') },
      { find: /^\.\/audio$/, replacement: resolve(import.meta.dirname, 'dev/stubs/audio.ts') },
    ]
  : [];

export default defineConfig({
  base: './',
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

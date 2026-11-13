#!/usr/bin/env node
// Does the built game actually start? The unit tests cannot say: they never open a browser.
// This serves dist/, opens it in a headless browser, starts a race and a Courier round, and
// fails on any page error.
//
//   npm run build && npm run smoke
//
// Browser: Playwright's own if Playwright is installed. Otherwise, or when one of these is set,
// playwright-core (a dev dependency that downloads nothing) drives a browser already on the
// machine: SMOKE_CHANNEL=chrome (how CI runs it) or SMOKE_EXECUTABLE=/path/to/chromium.
// It proves the build boots and both modes begin. It is not a play-through and not a play-test.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WAIT = 60_000;

if (!existsSync(resolve(root, 'dist', 'index.html'))) {
  console.error('smoke: dist/ is missing. Run "npm run build" first.');
  process.exit(2);
}

const installed = {
  ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}),
  ...(process.env.SMOKE_EXECUTABLE ? { executablePath: process.env.SMOKE_EXECUTABLE } : {}),
};
let chromium;
try {
  if (Object.keys(installed).length) throw new Error('use the installed browser');
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const freePort = () => new Promise((done, fail) => {
  const s = createServer();
  s.once('error', fail);
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => done(port));
  });
});

const port = await freePort();
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });

const failures = [];
let browser;
try {
  // wait for the server
  const t0 = Date.now();
  for (;;) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() - t0 > 20_000) throw new Error('the preview server did not start');
    await new Promise((r) => setTimeout(r, 200));
  }

  browser = await chromium.launch({
    ...installed,
    // software WebGL, for machines with no graphics card (CI)
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });

  // one page at a time: a page left running a race would slow the next one down on a small machine
  const withPage = async (run) => {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(WAIT);
    page.setDefaultNavigationTimeout(WAIT);
    page.on('pageerror', (e) => failures.push(`page error: ${String(e).slice(0, 300)}`));
    page.on('console', (m) => {
      if (m.type() === 'error') failures.push(`console error: ${m.text().slice(0, 300)}`);
    });
    try {
      await page.goto(url, { waitUntil: 'load' });
      try {
        await page.waitForFunction(() => window.__ready === true);
      } catch {
        // the start-up screen says why, when the game knows
        const said = await page.evaluate(() => document.getElementById('boot-status')?.textContent ?? '').catch(() => '');
        throw new Error(`the game did not start: "${said.replace(/\s+/g, ' ').slice(0, 240)}"`);
      }
      return await run(page);
    } finally {
      await page.close().catch(() => undefined);
    }
  };
  const step = async (name, run) => {
    try {
      const note = await withPage(run);
      console.log(`ok    ${name}${note ? `  (${note})` : ''}`);
      return true;
    } catch (e) {
      failures.push(`${name}: ${String(e?.message ?? e).split('\n')[0]}`);
      console.log(`FAIL  ${name}`);
      return false;
    }
  };

  const started = await step('the build starts', async (page) => {
    const build = await page.evaluate(() => window.__pw.build);
    if (!/^\d+\.\d+\.\d+ · \S+ · \d{4}-\d{2}-\d{2}$/.test(build)) throw new Error(`unexpected build label "${build}"`);
    return build;
  });

  // if it does not start at all, the other steps would only repeat that
  if (started) {
    await step('a race starts and the karts move', async (page) => {
      await page.click('[data-act="play"]');
      await page.click('[data-race="solo"]');
      await page.waitForFunction(() => window.__pw.race?.state.phase === 'racing');
      const from = await page.evaluate(() => window.__pw.race.state.karts.map((k) => [k.x, k.z]));
      await page.waitForFunction(
        (start) => window.__pw.race.state.karts.every((k, i) => Math.hypot(k.x - start[i][0], k.z - start[i][1]) > 3),
        from,
      );
      return `tick ${await page.evaluate(() => window.__pw.race.state.tick)}`;
    });
    await step('an armed race goes live and somebody opens fire', async (page) => {
      await page.click('[data-act="play"]');
      await page.click('[data-rules="death"]');
      await page.click('[data-race="solo"]');
      await page.waitForFunction(() => {
        const s = window.__pw.race?.state;
        return !!s && s.combat && s.lives > 0 && s.karts.some((k) => k.ammo < 20 || k.armor < 100);
      });
      return `tick ${await page.evaluate(() => window.__pw.race.state.tick)}`;
    });
    await step('a clean race has no weapons', async (page) => {
      await page.click('[data-act="play"]');
      await page.click('[data-rules="clean"]');
      await page.click('[data-race="solo"]');
      await page.waitForFunction(() => window.__pw.race?.state.phase === 'racing');
      if (await page.evaluate(() => window.__pw.race.state.combat)) throw new Error('the race is armed');
    });
    await step('settings open and show the build', async (page) => {
      await page.click('[data-act="settings"]');
      await page.waitForSelector('.sheet .build');
    });
    await step('the parked Courier round starts', async (page) => {
      await page.click('[data-act="play"]');
      await page.click('[data-mode="buddy"]');
      await page.waitForFunction(() => (window.__pw.round?.state.tick ?? 0) > 30);
      return `tick ${await page.evaluate(() => window.__pw.round.state.tick)}`;
    });
  }
} catch (e) {
  failures.push(String(e?.message ?? e).split('\n')[0]);
} finally {
  await browser?.close().catch(() => undefined);
  server.kill();
}

if (failures.length) {
  console.error(`\nsmoke: ${failures.length} problem${failures.length === 1 ? '' : 's'}`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('smoke: the build starts, races and opens its screens with no page errors');

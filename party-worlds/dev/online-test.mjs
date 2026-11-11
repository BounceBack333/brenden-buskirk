#!/usr/bin/env node
/**
 * Two real browser pages play one online round through the real room server.
 *   npm run server   (in another terminal; or pass --spawn to let this script start it)
 *   node dev/online-test.mjs [gameUrl] [outDir] [--spawn] [--delay=MS]
 *
 * Page A makes a room, page B joins with the code shown on A's screen, both press Ready, then
 * each page plays its role with real mouse/keyboard input. --delay adds artificial latency to
 * every WebSocket frame in both directions (per page), to see prediction and correction at work.
 *
 * Evidence class: automated multi-client browser test on one machine. It is NOT a test with
 * real people on separate devices.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const url = args[0] ?? 'http://127.0.0.1:5173/';
const out = args[1] ?? 'dev/shots/online';
const delay = Number((flags.find((f) => f.startsWith('--delay=')) ?? '--delay=0').split('=')[1]);
mkdirSync(out, { recursive: true });

let server = null;
if (flags.includes('--spawn')) {
  server = spawn('npx', ['tsx', 'server/main.ts'], { env: { ...process.env, PORT: '8787' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
}

const browser = await chromium.launch();
const errors = [];
async function open(name) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.stack || e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  if (delay > 0) {
    // hold every WebSocket message for `delay` ms each way
    await page.routeWebSocket(/.*/, (ws) => {
      const upstream = ws.connectToServer();
      ws.onMessage((m) => setTimeout(() => { try { upstream.send(m); } catch { /* closed */ } }, delay));
      upstream.onMessage((m) => setTimeout(() => { try { ws.send(m); } catch { /* closed */ } }, delay));
    });
  }
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'launches=2', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}

const state = (page) => page.evaluate(() => {
  const pw = window.__pw;
  const r = pw?.round;
  if (!r) return null;
  const s = r.state;
  return {
    you: pw.room ? pw.room.you : null,
    phase: s.phase, launchIndex: s.launchIndex, launcherSeat: s.launcherSeat, total: s.total, tick: s.tick,
    flyer: { x: s.flyer.x, y: s.flyer.y, vx: s.flyer.vx, vy: s.flyer.vy, mode: s.flyer.mode },
    catcher: { x: s.catcher.x, bx: s.catcher.bx, mode: s.catcher.mode },
    results: s.results.map((x) => ({ caught: x.caught, points: x.points })),
    corrections: r.corrections ?? null, snapshots: r.snapshots ?? null,
  };
});

async function act(page) {
  const s = await state(page);
  if (!s || s.you === null) return s;
  const iLaunch = s.launcherSeat === s.you;
  if (s.phase === 'aim' && iLaunch && !page.__pulling) {
    page.__pulling = true;
    const cx = 512, cy = 260, len = 576 * 0.36 * 0.78, ang = (48 * Math.PI) / 180;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(cx - Math.cos(ang) * len * (i / 8), cy + Math.sin(ang) * len * (i / 8));
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);
    await page.mouse.up();
    page.__pulling = false;
  } else if (s.phase === 'flight' && !iLaunch) {
    const lead = s.flyer.x + s.flyer.vx * Math.max(0.1, Math.min(1.2, (s.flyer.y - 2) / Math.max(2.5, -s.flyer.vy + 3.5)));
    const d = lead - s.catcher.x;
    if (d > 0.3) { await page.keyboard.up('KeyA'); await page.keyboard.down('KeyD'); }
    else if (d < -0.3) { await page.keyboard.up('KeyD'); await page.keyboard.down('KeyA'); }
    else { await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD'); }
  } else if (s.phase !== 'flight') {
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
  }
  return s;
}

const a = await open('A');
const b = await open('B');
let shotN = 0;
const shot = async (page, name) => page.screenshot({ path: `${out}/${String(++shotN).padStart(2, '0')}-${name}.png` });

// A: Play Together → Online room → Make a room
await a.click('[data-act="play"]');
await a.click('[data-act="online"]');
await a.click('[data-act="create"]');
await a.waitForSelector('.room-code', { timeout: 10000 });
const code = (await a.textContent('.room-code')).trim();
await shot(a, 'A-room-waiting');

// B: join with the code, typed in lower case like a person might
await b.click('[data-act="play"]');
await b.click('[data-act="online"]');
await b.fill('#room-code', code.toLowerCase());
await b.click('[data-act="join"]');
await b.waitForSelector('.room-code', { timeout: 10000 });
await a.waitForTimeout(400);
await shot(b, 'B-room-joined');
await a.click('[data-act="ready"]');
await b.waitForTimeout(300);
await shot(b, 'B-sees-A-ready');
await b.click('[data-act="ready"]');

// play
const t0 = Date.now();
let sa = null, sb = null, took = { flight: false, outcome: false };
while (Date.now() - t0 < 150000) {
  sa = await act(a);
  sb = await act(b);
  if (sa && sa.phase === 'flight' && !took.flight && sa.flyer.y > 4) { took.flight = true; await shot(a, 'A-flight'); await shot(b, 'B-flight'); }
  if (sa && sa.phase === 'outcome' && !took.outcome) { took.outcome = true; await a.waitForTimeout(250); await shot(a, 'A-outcome'); await shot(b, 'B-outcome'); }
  if (sa && sb && sa.phase === 'done' && sb.phase === 'done') break;
  await a.waitForTimeout(25);
}
await a.waitForTimeout(1500);
await shot(a, 'A-results');
await shot(b, 'B-results');

// rematch keeps the room: both press Again, a new round starts
let rematch = false;
try {
  await a.click('[data-act="again"]');
  await b.click('[data-act="again"]');
  await a.waitForFunction(() => window.__pw.round && window.__pw.round.state.phase !== 'done', null, { timeout: 8000 });
  rematch = true;
  await a.waitForTimeout(600);
  await shot(a, 'A-rematch');
} catch (e) {
  errors.push('rematch did not start: ' + e.message);
}

const summary = {
  code, delayMsEachWay: delay,
  A: sa && { you: sa.you, total: sa.total, results: sa.results, corrections: sa.corrections, snapshots: sa.snapshots },
  B: sb && { you: sb.you, total: sb.total, results: sb.results, corrections: sb.corrections, snapshots: sb.snapshots },
  agree: !!sa && !!sb && sa.total === sb.total && JSON.stringify(sa.results) === JSON.stringify(sb.results),
  finished: !!sa && !!sb && sa.phase === 'done' && sb.phase === 'done',
  rematch, errors,
};
console.log(JSON.stringify(summary, null, 1));
await browser.close();
if (server) server.kill();
if (errors.length || !summary.agree || !summary.finished || !rematch) process.exit(1);

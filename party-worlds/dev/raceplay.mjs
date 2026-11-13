#!/usr/bin/env node
/**
 * Automated race in a real browser with real keyboard (or touch) input.
 *   node dev/raceplay.mjs [url] [mode=solo|split] [outDir] [--touch] [--portrait] [--plank] [--rematch] [--size=WxH] [--slow=0.25] [--pad] [--track=pit]
 * A small pursuit driver in this script reads the kart's position from the page and presses the
 * same keys (or drags the same on-screen stick) a person would. It takes screenshots through the
 * race and fails on any page error.
 * This is evidence that a race can be started, driven, finished and restarted through the real
 * UI. It is not evidence that the race is fun, and it is not a person playing.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const url = args[0] ?? 'http://127.0.0.1:5173/';
const mode = args[1] ?? 'solo';
const out = args[2] ?? `dev/shots/race-${mode}`;
mkdirSync(out, { recursive: true });

const touchMode = flags.has('--touch');
const padMode = flags.has('--pad'); // drive with scripted game controllers (one per local player)
const portrait = flags.has('--portrait');
const sizeFlag = [...flags].find((f) => f.startsWith('--size='));
const viewport = sizeFlag
  ? { width: +sizeFlag.slice(7).split('x')[0], height: +sizeFlag.slice(7).split('x')[1] }
  : touchMode
    ? (portrait ? { width: 390, height: 844 } : { width: 844, height: 390 })
    : (portrait ? { width: 390, height: 844 } : { width: 1280, height: 720 });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touchMode, isMobile: touchMode });
if (padMode) {
  // stand-in controllers: the page sees two standard gamepads whose sticks and buttons this script sets
  await ctx.addInitScript(() => {
    const mk = (index) => ({ index, connected: true, id: 'Scripted pad', mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) });
    window.__fakePads = [mk(0), mk(1)];
    navigator.getGamepads = () => window.__fakePads;
  });
}
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e.stack || e)));
const cdp = touchMode ? await ctx.newCDPSession(page) : null;

const stageW = portrait ? viewport.height : viewport.width;
const stageH = portrait ? viewport.width : viewport.height;
// stage → client coordinates (the stage is rotated in portrait)
const toClient = (x, y) => (portrait ? { x: viewport.width - y, y: x } : { x, y });

let shotN = 0;
const shot = async (name) => {
  const file = `${out}/${String(++shotN).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  return file;
};
const click = (sel) => (touchMode ? page.tap(sel) : page.click(sel));

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(700);
await shot('home');
await click('[data-act="play"]');
await page.waitForTimeout(350);
await shot('play-sheet');
// --clean: the plain race, no weapons. --armed: weapons, and a wreck always comes back.
// Otherwise to the death. (The setting is remembered, so say which every time.)
await click(`[data-rules="${flags.has('--clean') ? 'clean' : flags.has('--armed') ? 'armed' : 'death'}"]`);
// --track=<id>: which circuit (the backyard when not given; this is remembered too)
const trackFlag = [...flags].find((f) => f.startsWith('--track='));
await click(`[data-track="${trackFlag ? trackFlag.slice(8) : 'backyard'}"]`);
await page.waitForTimeout(250);
await click(`[data-race="${mode}"]`);
await page.waitForTimeout(250);

// The headless browser draws in software and acknowledges input roughly once per frame, so a
// scripted driver reacts far later than a person. --slow=0.25 runs game time at a quarter speed
// to give the script a person's reaction time in game terms. It changes nothing else.
const slowFlag = [...flags].find((f) => f.startsWith('--slow='));
const slow = slowFlag ? Math.max(0.05, Math.min(1, +slowFlag.slice(7))) : 1;
if (slow !== 1) await page.evaluate((v) => { window.__pw.loop.timeScale = v; }, slow);

const track = await page.evaluate(() => {
  const t = window.__pw.track;
  return { id: t.id, samples: t.samples.map((p) => [p.x, p.z, p.tx, p.tz, p.hw, p.k]), plank: t.plank, pillars: t.pillars ?? [] };
});
const S = track.samples;
const N = S.length;

const read = () => page.evaluate(() => {
  const r = window.__pw?.race;
  if (!r) return null;
  const s = r.state;
  return {
    tick: s.tick, phase: s.phase, phaseTick: s.phaseTick, laps: s.laps, plankOpen: s.plankOpen,
    combat: s.combat, minesOut: s.mines.length,
    humans: r.setup.humans,
    fps: Math.round(1000 / Math.max(1, window.__pw.loop.frameMs)),
    karts: s.karts.map((k) => ({
      x: k.x, z: k.z, h: k.heading, vx: k.vx, vz: k.vz, idx: k.idx, lap: k.lap, drifting: k.drifting, driftDir: k.driftDir,
      steer: k.steer, charge: k.charge, boost: k.boostTicks, surface: k.surface, finished: k.finished, place: k.place, y: k.y, stun: k.stunTicks,
      armor: k.armor, ammo: k.ammo, mines: k.charges, wreck: k.wreckTicks, wrecks: k.wrecks, kills: k.kills, out: k.out,
    })),
  };
});

// ── input back-ends ──
// (f = fire, m = mine: only an armed race listens to them)
const KEYS = mode === 'split'
  ? [{ l: 'KeyA', r: 'KeyD', d: 'ShiftLeft', f: 'Space', m: 'KeyE' }, { l: 'ArrowLeft', r: 'ArrowRight', d: 'ArrowUp', f: 'Enter', m: 'ShiftRight' }]
  : [{ l: 'KeyA', r: 'KeyD', d: 'Space', f: 'KeyF', m: 'KeyE' }];
const held = new Set();
const key = async (code, on) => {
  if (on === held.has(code)) return;
  if (on) { held.add(code); await page.keyboard.down(code); } else { held.delete(code); await page.keyboard.up(code); }
};
// touch: one finger per player steers (a floating stick), a second finger anywhere drifts
const fingers = new Map();
const flush = async (type) => {
  const pts = [...fingers.entries()].map(([id, p]) => ({ ...toClient(p.x, p.y), id, radiusX: 8, radiusY: 8, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
};
const finger = async (id, x, y) => {
  const had = fingers.has(id);
  fingers.set(id, { x, y });
  await flush(had ? 'touchMove' : 'touchStart');
};
const lift = async (id) => {
  if (!fingers.has(id)) return;
  fingers.delete(id);
  await cdp.send('Input.dispatchTouchEvent', {
    type: fingers.size ? 'touchMove' : 'touchEnd',
    touchPoints: [...fingers.entries()].map(([fid, p]) => ({ ...toClient(p.x, p.y), id: fid, radiusX: 8, radiusY: 8, force: 1 })),
  });
};

// ── the driver: pure pursuit on the centre line, drift through the tight corners ──
const drivers = [0, 1].map(() => ({ drift: false, since: 0 }));
function decide(st, view) {
  const seat = st.humans[view];
  const k = st.karts[seat];
  const d = drivers[view];
  const speed = Math.hypot(k.vx, k.vz);
  let tx; let tz; let curve = 0;
  const pl = track.plank;
  // (the zones are the track's own: where a driver lines up for the shortcut, and where one turns for the prop)
  const inZone = (zn) => k.x > zn.x0 && k.x < zn.x1 && k.z > zn.z0 && k.z < zn.z1;
  const nearFork = inZone(pl.fork);
  const openIt = flags.has('--plank') && view === 0 && !st.plankOpen && k.lap >= 1 && inZone(pl.opener);
  if (openIt) {
    tx = pl.prop.x; tz = pl.prop.z;
  } else if (flags.has('--plank') && view === 0 && st.plankOpen && nearFork && k.surface !== 2) {
    tx = Math.max(pl.bx - 6, k.x - (5 + speed * 0.3)); tz = pl.az;
  } else {
    const p = S[(k.idx + Math.round(6 + speed * 0.55)) % N];
    for (let i = 2; i < 16; i++) curve += S[(k.idx + i) % N][5];
    curve /= 14;
    tx = p[0]; tz = p[1];
  }
  const fx = Math.cos(k.h); const fz = Math.sin(k.h);
  // something solid stood in the road: round it, on the side with more road
  if (!openIt) {
    for (const c of track.pillars) {
      const mx = c.x - k.x; const mz = c.z - k.z;
      const along = mx * fx + mz * fz;
      if (along < 0.5 || along > 24) continue;
      const clear = c.r + 0.62 + 1.1;
      if (Math.abs(fx * mz - fz * mx) > clear) continue;
      const q = S[(k.idx + Math.round(along)) % N];
      const lat = (c.x - q[0]) * -q[3] + (c.z - q[1]) * q[2];
      const lane = lat - (lat >= 0 ? 1 : -1) * (clear + 0.5);
      tx = q[0] - q[3] * lane + q[2] * 3; tz = q[1] + q[2] * lane + q[3] * 3;
      break;
    }
  }
  const dx = tx - k.x; const dz = tz - k.z;
  const err = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);
  let steer = Math.max(-1, Math.min(1, err * 2.6));
  const tight = Math.abs(curve) > 0.045;
  const dir = curve > 0 ? 1 : -1;
  if (!d.drift && !k.drifting && tight && speed > 10.5 && steer * dir > 0.35 && k.surface === 0) {
    d.drift = true; d.since = st.tick;
  }
  if (d.drift) {
    const failed = !k.drifting && st.tick - d.since > 20;
    if (failed || Math.abs(curve) < 0.012 || k.charge >= 1 || (k.drifting && k.driftDir * dir < 0)) d.drift = false;
    if (k.drifting) steer = Math.max(-1, Math.min(1, (err * 3.2 * k.driftDir - 1.2) / 0.8)) * k.driftDir;
  }
  return { steer, drift: d.drift, k };
}

const centres = () => (mode === 'split'
  ? [{ x: stageW * 0.25, y: stageH * 0.62 }, { x: stageW * 0.75, y: stageH * 0.62 }]
  : [{ x: stageW * 0.3, y: stageH * 0.62 }]);

const padSet = (view, steer, drift, fire = false, mine = false) => page.evaluate(([v, x, d, f, m]) => {
  const p = window.__fakePads[v];
  p.axes[0] = x;
  const set = (i, on) => { p.buttons[i].pressed = on; p.buttons[i].value = on ? 1 : 0; };
  set(0, d);
  set(7, f); // right trigger
  set(3, m); // Y
}, [view, steer, drift, fire, mine]);

async function apply(view, cmd) {
  if (padMode) {
    await padSet(view, cmd.steer, cmd.drift, !!cmd.fire, !!cmd.mine);
    return;
  }
  if (!touchMode) {
    const K = KEYS[view];
    await key(K.l, cmd.steer < -0.28);
    await key(K.r, cmd.steer > 0.28);
    await key(K.d, cmd.drift);
    await key(K.f, !!cmd.fire);
    await key(K.m, !!cmd.mine);
    return;
  }
  const c = centres()[view];
  const r = Math.max(34, stageH * 0.13);
  await finger(10 + view, c.x + cmd.steer * r * 0.95, c.y);
  if (mode === 'solo') {
    if (cmd.drift) await finger(20, stageW * 0.85, stageH * 0.7);
    else await lift(20);
  }
}

const seen = new Set();
const once = async (name, cond) => {
  if (!cond || seen.has(name)) return;
  seen.add(name);
  await shot(name);
};

const t0 = Date.now();
const log = { mode, touch: touchMode, pad: padMode, portrait, viewport, slow, fps: [], events: [] };
let last = null;
let started = false;
while (Date.now() - t0 < 1800000) { // half an hour: a three-lap race at full quality in software rendering takes about fifteen minutes
  const st = await read();
  if (!st) { await page.waitForTimeout(50); continue; }
  last = st;
  if (st.phase === 'countdown') {
    await once('countdown-face', st.phaseTick > 30);
    await once('countdown-swing', st.phaseTick > 110);
    // a well-timed start: press drift just before GO
    if (padMode) for (let v = 0; v < st.humans.length; v++) await padSet(v, 0, st.phaseTick >= 168);
    else if (!touchMode) for (let v = 0; v < st.humans.length; v++) await key(KEYS[v].d, st.phaseTick >= 168);
    else if (touchMode && !started) {
      started = true;
      for (let v = 0; v < st.humans.length; v++) { const c = centres()[v]; await finger(10 + v, c.x, c.y); }
    }
    await page.waitForTimeout(16);
    continue;
  }
  if (st.phase === 'over') break;
  let allDone = true;
  for (let v = 0; v < st.humans.length; v++) {
    const cmd = decide(st, v);
    if (cmd.k.finished || cmd.k.out) {
      await apply(v, { steer: 0, drift: false });
      continue;
    }
    allDone = false;
    // an armed race: squeeze the trigger in bursts once the guns are live, and leave a mine
    // whenever there is one to leave (by touch the guns fire by themselves)
    if (st.combat && st.phaseTick > 300 && cmd.k.wreck === 0) {
      cmd.fire = cmd.k.ammo > 0 && st.tick % 120 < 80;
      cmd.mine = cmd.k.mines > 0 && st.tick % 150 < 30;
    }
    await apply(v, cmd);
    if (process.env.DEBUG && v === 0 && st.phaseTick < 400) console.log(st.tick, 'cmd', cmd.steer.toFixed(2), cmd.drift ? 'D' : '-', 'kart steer', cmd.k.steer.toFixed(2), 'drifting', cmd.k.drifting, 'idx', cmd.k.idx, 'x', cmd.k.x.toFixed(1), 'z', cmd.k.z.toFixed(1), 'h', cmd.k.h.toFixed(2), 'surf', cmd.k.surface);
  }
  const me = st.karts[st.humans[0]];
  if (st.tick % 60 < 4) log.fps.push(st.fps);
  await once('go', st.phaseTick > 20 && st.phaseTick < 80);
  await once('racing', st.phaseTick > 240);
  await once('drift', me.drifting && me.charge >= 1);
  await once('boost', me.boost > 30);
  await once('grass', me.surface === 1);
  await once('plank-open', st.plankOpen);
  await once('on-plank', me.surface === 3);
  await once('airborne', me.y > 0.5);
  await once('hairpin', me.idx > N * 0.2 && me.idx < N * 0.26 && me.lap === 1);
  await once('lap-2', me.lap === 2 && st.phaseTick > 0 && me.idx > 6);
  await once('final-lap', me.lap === st.laps && me.idx > 4);
  await once('weapons-hot', st.combat && st.phaseTick > 300 && st.phaseTick < 420);
  await once('mine-on-road', st.combat && st.minesOut > 0);
  await once('battered', st.combat && me.armor < 45 && me.wreck === 0);
  await once('wrecked', st.combat && me.wreck > 0);
  await once('out', st.combat && me.out);
  await once('finished', me.finished);
  if (allDone) await page.waitForTimeout(60);
  else await page.waitForTimeout(12);
}
for (const code of [...held]) await key(code, false);
if (padMode) for (let v = 0; v < 2; v++) await padSet(v, 0, false);
if (touchMode) for (const id of [...fingers.keys()]) await lift(id);

await page.waitForSelector('.race-results, [data-act="again"]', { timeout: 20000 }).catch(() => errors.push('results never appeared'));
await page.waitForTimeout(700);
await shot('results');
const results = await page.evaluate(() => {
  const s = window.__pw.race?.state;
  return s ? { phase: s.phase, tick: s.tick, plankOpen: s.plankOpen, plankOpener: s.plankOpener, combat: s.combat, lives: s.lives, lastStanding: s.lastStanding, karts: s.karts.map((k) => ({ place: k.place, finished: k.finished, finishTick: k.finishTick, best: k.bestLapTicks, lap: k.lap, wrecks: k.wrecks, kills: k.kills, out: k.out })) } : null;
});
log.results = results;
log.text = await page.evaluate(() => document.querySelector('#ui')?.innerText ?? '');

if (padMode) log.hints = await page.evaluate(() => [...document.querySelectorAll('.race-hint')].map((h) => h.dataset.t || ''));
if (flags.has('--rematch') && padMode) {
  // the controller's A button takes the main action on the results
  await page.evaluate(() => { const b = window.__fakePads[0].buttons[0]; b.pressed = true; b.value = 1; });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = window.__fakePads[0].buttons[0]; b.pressed = false; b.value = 0; });
  await page.waitForTimeout(1500);
  const again = await read();
  log.rematch = again ? { phase: again.phase, tick: again.tick, by: 'controller' } : null;
  if (!again || again.phase !== 'countdown') errors.push('the controller A button did not start the next race');
  await shot('rematch');
} else if (flags.has('--rematch')) {
  await click('[data-act="again"]');
  await page.waitForTimeout(1500);
  const again = await read();
  log.rematch = again ? { phase: again.phase, tick: again.tick } : null;
  if (!again || again.phase !== 'countdown') errors.push('rematch did not start a new countdown');
  await shot('rematch');
}
log.wallSeconds = Math.round((Date.now() - t0) / 1000);
log.errors = errors;
writeFileSync(`${out}/log.json`, JSON.stringify(log, null, 1));
await browser.close();
const fpsSorted = [...log.fps].sort((a, b) => a - b);
console.log(JSON.stringify({
  mode, touch: touchMode, pad: padMode, portrait, slow,
  bestLapSeconds: results?.karts.map((k) => +(k.best / 60).toFixed(1)),
  finished: results?.karts.map((k) => `${k.place}${k.out ? 'x' : k.finished ? '' : '*'}`).join(','),
  raceSeconds: results ? +(results.tick / 60).toFixed(1) : null,
  plankOpen: results?.plankOpen,
  armed: results?.combat ?? false,
  lives: results?.lives ?? 0,
  wrecked: results?.karts.map((k) => k.wrecks).join(''),
  wrecksCaused: results?.karts.map((k) => k.kills).join(''),
  medianFps: fpsSorted[Math.floor(fpsSorted.length / 2)] ?? null,
  wallSeconds: log.wallSeconds, shots: shotN, errors: errors.length,
}));
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}

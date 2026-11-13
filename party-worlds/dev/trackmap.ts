/**
 * Draw a circuit from its data: npx tsx dev/trackmap.ts [trackId] [out.svg]
 *
 * The road at its real width, everything solid, the shortcut, the slow patch, crates and the
 * repair strip. For checking a layout before (and after) it is dressed; `node dev/trackmap.mjs`
 * is not needed, any browser opens the SVG.
 */
import { writeFileSync } from 'node:fs';
import { TRACK_IDS, trackById } from '../src/attractions/dash/track';

const id = process.argv[2] ?? TRACK_IDS[TRACK_IDS.length - 1]!;
const out = process.argv[3] ?? `dev/shots/track-${id}.svg`;
const t = trackById(id);
const b = t.bounds;
const W = b.x1 - b.x0;
const H = b.z1 - b.z0;
const S = t.samples;
const N = S.length;
const f = (n: number): string => n.toFixed(2);
let d = '';
// road: quads between successive samples
for (let i = 0; i < N; i++) {
  const a = S[i]!;
  const c = S[(i + 1) % N]!;
  d += `<polygon points="${f(a.x + a.tz * a.hw)},${f(a.z - a.tx * a.hw)} ${f(a.x - a.tz * a.hw)},${f(a.z + a.tx * a.hw)} ${f(c.x - c.tz * c.hw)},${f(c.z + c.tx * c.hw)} ${f(c.x + c.tz * c.hw)},${f(c.z - c.tx * c.hw)}" fill="#8a8a92" stroke="#8a8a92" stroke-width="0.2"/>`;
}
let marks = '';
for (let i = 0; i < N; i += 20) marks += `<text x="${f(S[i]!.x)}" y="${f(S[i]!.z)}" font-size="2.6" fill="#111" text-anchor="middle">${i}</text>`;
const bed = `<ellipse cx="${t.bed.x}" cy="${t.bed.z}" rx="${t.bed.rx}" ry="${t.bed.rz}" fill="#3a2a40" opacity="0.8"/>`;
const circles = t.circles.map((c) => `<circle cx="${c.x}" cy="${c.z}" r="${c.r}" fill="#d9603c"/>`).join('');
const caps = [...t.capsules, t.plank.blocker].map((c) => `<line x1="${c.x1}" y1="${c.z1}" x2="${c.x2}" y2="${c.z2}" stroke="#e8c14a" stroke-width="${c.r * 2}" stroke-linecap="round"/>`).join('');
const pl = t.plank;
const plank = `<line x1="${pl.ax}" y1="${pl.az}" x2="${pl.bx}" y2="${pl.bz}" stroke="#c99a62" stroke-width="${pl.hw * 2}"/><circle cx="${pl.prop.x}" cy="${pl.prop.z}" r="${pl.prop.r}" fill="#fff"/>`;
const zone = (z: { x0: number; x1: number; z0: number; z1: number }, color: string): string => `<rect x="${z.x0}" y="${z.z0}" width="${z.x1 - z.x0}" height="${z.z1 - z.z0}" fill="none" stroke="${color}" stroke-width="0.3" stroke-dasharray="1 1"/>`;
const kit = t.combat;
const crates = (kit?.crates ?? []).map((c) => `<rect x="${f(c.x - 0.8)}" y="${f(c.z - 0.8)}" width="1.6" height="1.6" fill="#40e0ff"/><text x="${f(c.x)}" y="${f(c.z - 1.4)}" font-size="2.4" fill="#40e0ff" text-anchor="middle">${c.item}</text>`).join('');
const fires = (kit?.fires ?? []).map((c) => `<circle cx="${f(c.x)}" cy="${f(c.z)}" r="0.9" fill="#ff8a2e"/>`).join('');
const boards = (kit?.boards ?? []).map((c) => `<rect x="${f(c.x - 1)}" y="${f(c.z - 1)}" width="2" height="2" fill="#ffd15c"/>`).join('');
const grid = t.grid.map((g) => `<circle cx="${g.x}" cy="${g.z}" r="0.62" fill="#fff" stroke="#000" stroke-width="0.15"/>`).join('');
const lobby = `<circle cx="${t.lobby.camera.x}" cy="${t.lobby.camera.z}" r="0.8" fill="#f0f"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0} ${b.z0} ${W} ${H}" width="${W * 9}" height="${H * 9}"><rect x="${b.x0}" y="${b.z0}" width="${W}" height="${H}" fill="#26303a"/>${bed}${d}${plank}${caps}${circles}${kit ? zone(kit.repair, '#3dff9a') : ''}${zone(pl.fork, '#fff')}${zone(pl.opener, '#f80')}${crates}${fires}${boards}${grid}${lobby}${marks}<line x1="${f(S[0]!.x)}" y1="${f(S[0]!.z - S[0]!.hw)}" x2="${f(S[0]!.x)}" y2="${f(S[0]!.z + S[0]!.hw)}" stroke="#fff" stroke-width="0.5"/></svg>`;
writeFileSync(out, svg);
let kmax = 0;
for (const p of S) kmax = Math.max(kmax, Math.abs(p.k));
console.log(`${t.name}: ${N} samples, length ${t.length.toFixed(1)}, tightest radius ${(1 / kmax).toFixed(1)}, written to ${out}`);

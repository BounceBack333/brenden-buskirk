/**
 * Procedural textures for the Birthday Continental. All generated at load from canvas —
 * no external assets. Every generator is lazy + cached and must only run in a browser.
 */
import * as THREE from 'three';
import { PALETTE } from '../../kit/materials';
import { canvasTexture, mixHex, seeded, TAU } from './util';

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/** World size of one gingham repeat (two checks). */
export const GINGHAM_TILE = 3.2;

/**
 * Cream gingham with a coral check. One tile = 2 × 2 checks. The half-tone squares are drawn
 * as real alternating threads so that a close camera sees weave and a far one sees a tint.
 */
export function ginghamTexture(): THREE.Texture {
  return cached('gingham', () =>
    canvasTexture(512, 512, (ctx, w, h) => {
      const half = w / 2;
      ctx.fillStyle = PALETTE.cloth;
      ctx.fillRect(0, 0, w, h);
      const coral = PALETTE.clothCheck;
      // horizontal coloured band (top half): coloured weft threads over cream warp
      ctx.fillStyle = coral;
      ctx.globalAlpha = 0.46;
      ctx.fillRect(0, 0, w, half);
      // vertical coloured band (left half)
      ctx.fillRect(0, 0, half, h);
      ctx.globalAlpha = 1;
      // the crossing square is the saturated one: pull it toward a single clean coral
      ctx.fillStyle = mixHex(coral, PALETTE.cloth, 0.12);
      ctx.globalAlpha = 0.72;
      ctx.fillRect(0, 0, half, half);
      ctx.globalAlpha = 1;

      // thread structure: fine alternating lines, direction follows the coloured yarn
      const thread = 4;
      for (let y = 0; y < h; y += thread) {
        const inBand = y < half;
        ctx.fillStyle = inBand ? 'rgba(170,52,44,0.10)' : 'rgba(150,110,70,0.05)';
        ctx.fillRect(0, y, w, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(0, y + 2, w, 1);
      }
      for (let x = 0; x < w; x += thread) {
        const inBand = x < half;
        ctx.fillStyle = inBand ? 'rgba(170,52,44,0.09)' : 'rgba(150,110,70,0.045)';
        ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 2, 0, 1, h);
      }
      // slubs: tiny irregularities so the cloth is not perfectly printed
      const r = seeded(7);
      for (let i = 0; i < 900; i++) {
        const x = r() * w;
        const y = r() * h;
        const len = 3 + r() * 9;
        ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(120,70,50,0.05)';
        if (r() < 0.5) ctx.fillRect(x, y, len, 1);
        else ctx.fillRect(x, y, 1, len);
      }
    }, { repeat: true, anisotropy: 8 }),
  );
}

/** Height map of the weave for a whisper of bump on the cloth. */
export function weaveBumpTexture(): THREE.Texture {
  return cached('weave', () =>
    canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const over = ((x + y) / 4) % 2 === 0;
          ctx.fillStyle = over ? '#a8a8a8' : '#5c5c5c';
          ctx.fillRect(x, y, 3, 3);
        }
      }
    }, { repeat: true, srgb: false, anisotropy: 4 }),
  );
}

/** Soft round blob: opaque core fading to nothing. `core` 0..1 = where the fade starts. */
export function softDiscTexture(core = 0.0): THREE.Texture {
  return cached(`softdisc:${core}`, () =>
    canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, (w / 2) * core, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, { mipmaps: true }),
  );
}

/** Photographic bokeh: an almost flat disc with a faintly brighter rim and a soft edge. */
export function bokehTexture(): THREE.Texture {
  return cached('bokeh', () =>
    canvasTexture(128, 128, (ctx, w, h) => {
      const c = w / 2;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,0.62)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.7)');
      g.addColorStop(0.86, 'rgba(255,255,255,1)');
      g.addColorStop(0.93, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }),
  );
}

/**
 * Any filled path, heavily defocused, as white-on-transparent. Uses shadowBlur (universally
 * supported) with the real shape drawn off-canvas so only its blurred shadow lands in view.
 */
export function blurredShapeTexture(key: string, size: number, blurPx: number, path: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  return cached(`blur:${key}:${size}:${blurPx}`, () =>
    canvasTexture(size, size, (ctx, w) => {
      const off = w * 2;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = blurPx;
      ctx.shadowOffsetX = off;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#ffffff';
      ctx.save();
      ctx.translate(-off, 0);
      ctx.beginPath();
      path(ctx, w);
      ctx.fill();
      ctx.restore();
    }),
  );
}

/** Out-of-focus pennant for the far bunting. */
export function softFlagTexture(): THREE.Texture {
  return blurredShapeTexture('flag', 128, 9, (ctx, s) => {
    ctx.moveTo(s * 0.14, s * 0.12);
    ctx.lineTo(s * 0.86, s * 0.12);
    ctx.lineTo(s * 0.5, s * 0.9);
    ctx.closePath();
  });
}

/** Out-of-focus rounded slab (chair backs, door, picture frames…). */
export function softSlabTexture(): THREE.Texture {
  return blurredShapeTexture('slab', 128, 16, (ctx, s) => {
    const m = s * 0.2;
    const r = s * 0.16;
    ctx.roundRect(m, m, s - 2 * m, s - 2 * m, r);
  });
}

/** World size the backdrop painting is meant to be stretched over. */
export const ROOM_WALL = { width: 640, yBottom: -50, yTop: 90 } as const;

/**
 * The far wall of the party room as one defocused painting: warm wall, glowing windows with
 * curtains, a darker furniture haze below table height. Painted small and stretched huge, so
 * nothing in it is sharp.
 */
export function roomBackdropTexture(): THREE.Texture {
  return cached('room', () =>
    canvasTexture(1024, 256, (ctx, w, h) => {
      const yOf = (worldY: number): number => ((ROOM_WALL.yTop - worldY) / (ROOM_WALL.yTop - ROOM_WALL.yBottom)) * h;
      const pxPerUnit = w / ROOM_WALL.width;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#ffe6c2');
      g.addColorStop(yOf(40) / h, '#ffdfb6');
      g.addColorStop(yOf(14) / h, '#fdd3a6');
      g.addColorStop(yOf(0) / h, '#f6c497');
      g.addColorStop(yOf(-18) / h, '#eab088');
      g.addColorStop(1, '#e0a07c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const blob = (x: number, y: number, rx: number, ry: number, color: string, a: number): void => {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(rx, ry);
        const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        rg.addColorStop(0, color);
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = a;
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, TAU);
        ctx.fill();
        ctx.restore();
      };
      const softRect = (x: number, y: number, rw: number, rh: number, color: string, a: number, blur: number): void => {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = w * 2;
        ctx.fillStyle = color;
        ctx.fillRect(x - w * 2, y, rw, rh);
        ctx.restore();
      };

      // tall windows pouring afternoon light, one every ~110 world units
      const winW = 30 * pxPerUnit;
      const top = yOf(54);
      const sill = yOf(7);
      const r = seeded(21);
      for (let x = 60; x < w; x += 176) {
        const cx = x + (r() - 0.5) * 16;
        blob(cx, (top + sill) / 2, winW * 1.9, (sill - top) * 0.95, '#fff4d2', 0.55);
        softRect(cx - winW / 2, top, winW, sill - top, '#fff8e3', 0.95, 7);
        // curtains
        const cw = winW * 0.26;
        const cc = x % 352 < 176 ? '#f4a38c' : '#f0b47c';
        softRect(cx - winW / 2 - cw, top - 6, cw, sill - top + 14, cc, 0.66, 6);
        softRect(cx + winW / 2, top - 6, cw, sill - top + 14, cc, 0.66, 6);
        // mullions, barely there
        softRect(cx - 1.5, top, 3, sill - top, '#f1cfa5', 0.5, 3);
        softRect(cx - winW / 2, (top + sill) / 2 - 1.5, winW, 3, '#f1cfa5', 0.4, 3);
      }
      // furniture as dark-warm haze around and below table height
      for (let x = 0; x < w; x += 118) {
        blob(x + r() * 60, yOf(-6) + r() * 10, 70 + r() * 50, 22 + r() * 16, '#c58560', 0.36);
      }
      // picture frames / shelves: faint darker slabs between windows
      for (let x = 148; x < w; x += 176) {
        softRect(x - 14 + (r() - 0.5) * 20, yOf(40), 26, 20, '#e9b58b', 0.5, 8);
      }
      // warm bounce near the ceiling
      blob(w / 2, -20, w * 0.7, 90, '#fff1d6', 0.5);
      // grain so gradients do not band
      for (let i = 0; i < 5200; i++) {
        ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(120,70,40,0.025)';
        ctx.fillRect(r() * w, r() * h, 2, 2);
      }
    }, { mipmaps: true, anisotropy: 1 }),
  );
}

/**
 * Printed paper for the cocktail parasol, unrolled: x = around, y = apex (top) → rim (bottom).
 * `segments` printed panels alternate between two tints.
 */
export function umbrellaPrintTexture(color: string, segments: number): THREE.Texture {
  return cached(`umbrella:${color}:${segments}`, () =>
    canvasTexture(512, 128, (ctx, w, h) => {
      const light = mixHex(color, '#ffffff', 0.22);
      const dark = mixHex(color, PALETTE.ink, 0.28);
      const cream = PALETTE.paper;
      const segW = w / segments;
      for (let i = 0; i < segments; i++) {
        ctx.fillStyle = i % 2 ? light : color;
        ctx.fillRect(i * segW, 0, segW + 1, h);
      }
      // darker crown
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      g.addColorStop(0, dark);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.3);
      ctx.globalAlpha = 1;
      // brush rings
      ctx.fillStyle = dark;
      ctx.fillRect(0, h * 0.2, w, h * 0.035);
      ctx.fillStyle = cream;
      ctx.fillRect(0, h * 0.66, w, h * 0.045);
      ctx.fillStyle = dark;
      ctx.fillRect(0, h * 0.745, w, h * 0.11);
      ctx.fillStyle = PALETTE.butter;
      ctx.fillRect(0, h * 0.78, w, h * 0.035);
      ctx.fillStyle = cream;
      ctx.fillRect(0, h * 0.935, w, h * 0.065);
      // blossoms on alternate panels (x is squeezed toward the apex, so petals are drawn wide)
      const r = seeded(11);
      for (let i = 0; i < segments; i += 2) {
        const cx = (i + 0.5) * segW;
        const cy = h * (0.44 + (r() - 0.5) * 0.06);
        const pr = 5.2;
        ctx.fillStyle = cream;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU + r();
          ctx.beginPath();
          ctx.ellipse(cx + Math.cos(a) * pr * 1.9, cy + Math.sin(a) * pr * 1.1, pr * 1.5, pr * 0.95, 0, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = PALETTE.sunflower;
        ctx.beginPath();
        ctx.ellipse(cx, cy, pr * 1.2, pr * 0.75, 0, 0, TAU);
        ctx.fill();
        // leaf dabs on the neighbouring panel
        ctx.fillStyle = cream;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(cx + segW, cy + 9, 5, 2.6, 0.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + segW, cy - 8, 4, 2.2, -0.5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }, { anisotropy: 4 }),
  );
}

/**
 * Lace-paper runner. The whole runner is one texture so the ends are properly scalloped.
 * Returns the texture; alpha carries the cut-out lace.
 */
export function doilyTexture(length: number, halfWidth: number): THREE.Texture {
  const key = `doily:${length.toFixed(2)}:${halfWidth}`;
  return cached(key, () => {
    const ppu = Math.min(64, Math.floor(2048 / length));
    const w = Math.max(64, Math.round(length * ppu));
    const hh = Math.max(32, Math.round(halfWidth * 2 * ppu));
    return canvasTexture(w, hh, (ctx, cw, ch) => {
      const u = ppu;
      const scallops = Math.max(2, Math.round(length / 0.8));
      const sw = cw / scallops; // scallop width in px
      const sr = sw * 0.5;
      const inset = sr * 0.9; // straight body starts this far from the edge
      ctx.clearRect(0, 0, cw, ch);
      // body
      ctx.fillStyle = PALETTE.paper;
      ctx.beginPath();
      ctx.roundRect(inset, inset, cw - inset * 2, ch - inset * 2, u * 0.12);
      ctx.fill();
      // scallops along both long edges
      for (let i = 0; i < scallops; i++) {
        const cx = (i + 0.5) * sw;
        if (cx < inset * 1.2 || cx > cw - inset * 1.2) continue;
        for (const cy of [inset, ch - inset]) {
          ctx.beginPath();
          ctx.arc(cx, cy, sr * 0.96, 0, TAU);
          ctx.fill();
        }
      }
      // scallops on the two short ends
      const endN = Math.max(2, Math.round((ch - inset * 2) / sw));
      const esw = (ch - inset * 2) / endN;
      for (let i = 0; i < endN; i++) {
        const cy = inset + (i + 0.5) * esw;
        for (const cx of [inset, cw - inset]) {
          ctx.beginPath();
          ctx.arc(cx, cy, esw * 0.48, 0, TAU);
          ctx.fill();
        }
      }
      // warm paper shading toward the middle so it is not a flat white bar
      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, 'rgba(255,236,214,0)');
      g.addColorStop(0.5, 'rgba(255,226,200,0.55)');
      g.addColorStop(1, 'rgba(255,236,214,0)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      // ribbon lines: the gentle edge pattern
      ctx.fillStyle = PALETTE.coral;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(inset * 1.5, inset * 1.75, cw - inset * 3, Math.max(2, u * 0.07));
      ctx.fillRect(inset * 1.5, ch - inset * 1.75 - Math.max(2, u * 0.07), cw - inset * 3, Math.max(2, u * 0.07));
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PALETTE.sunflower;
      // dashed centre stitch
      const dash = u * 0.34;
      for (let x = inset * 2; x < cw - inset * 2 - dash; x += dash * 2) {
        ctx.fillRect(x, ch / 2 - Math.max(1, u * 0.03), dash, Math.max(2, u * 0.06));
      }
      ctx.globalAlpha = 1;
      // punched lace: a hole in every scallop + a diamond row
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < scallops; i++) {
        const cx = (i + 0.5) * sw;
        if (cx < inset * 1.2 || cx > cw - inset * 1.2) continue;
        for (const cy of [inset * 0.92, ch - inset * 0.92]) {
          ctx.beginPath();
          ctx.arc(cx, cy, sr * 0.3, 0, TAU);
          ctx.fill();
        }
        for (const cy of [inset * 2.45, ch - inset * 2.45]) {
          ctx.beginPath();
          ctx.arc(cx + sw * 0.5, cy, sr * 0.17, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }, { anisotropy: 8 });
  });
}

/** Funfetti specks for cake sides (tileable). */
export function sprinkleTexture(): THREE.Texture {
  return cached('sprinkle', () =>
    canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = PALETTE.frostingWhite;
      ctx.fillRect(0, 0, w, h);
      const colors = [PALETTE.coral, PALETTE.teal, PALETTE.sunflower, PALETTE.sky, PALETTE.frosting, PALETTE.grape];
      const r = seeded(5);
      for (let i = 0; i < 64; i++) {
        const x = r() * w;
        const y = r() * h;
        const a = r() * TAU;
        const color = colors[Math.floor(r() * colors.length)]!;
        // draw wrapped copies so the tile is seamless
        for (const ox of [-w, 0, w]) {
          for (const oy of [-h, 0, h]) {
            ctx.save();
            ctx.translate(x + ox, y + oy);
            ctx.rotate(a);
            ctx.globalAlpha = 0.62;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(-7, -2.4, 14, 4.8, 2.4);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }, { repeat: true, anisotropy: 4 }),
  );
}

/**
 * Tone-on-tone gift-wrap prints: white ground with slightly darker motifs, meant to be
 * multiplied by a vertex colour so one material wraps every present and party hat.
 */
export function wrapPatternTexture(kind: 'dots' | 'stripes'): THREE.Texture {
  return cached(`wrap:${kind}`, () =>
    canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9c2bd';
      if (kind === 'dots') {
        for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]] as const) {
          ctx.beginPath();
          ctx.arc(x, y, w * 0.15, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.lineWidth = w * 0.18;
        ctx.strokeStyle = '#cfc8c3';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * w * 0.5 - w, h * 2);
          ctx.lineTo(i * w * 0.5 + w * 2, -h);
          ctx.stroke();
        }
      }
    }, { repeat: true, anisotropy: 4 }),
  );
}

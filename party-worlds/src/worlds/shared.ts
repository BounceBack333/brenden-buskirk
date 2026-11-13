/**
 * Bits every race world kit uses: a seeded scatter, canvas textures, and light lying on the
 * ground. Presentation only.
 */
import * as THREE from 'three';

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: () => number, size = 2): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)]!;
    ctx.globalAlpha = 0.25 + r() * 0.5;
    ctx.fillRect(r() * w, r() * h, size * (0.5 + r()), size * (0.5 + r()));
  }
  ctx.globalAlpha = 1;
}

let glowTex: THREE.Texture | null = null;
export function glow(): THREE.Texture {
  if (!glowTex) {
    glowTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }, false);
  }
  return glowTex;
}

/** A soft pool of light lying on the ground (additive). */
export function lightPool(x: number, z: number, r: number, color: string, strength = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: glow(), color, transparent: true, opacity: strength, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.05, z);
  m.renderOrder = 2;
  return m;
}

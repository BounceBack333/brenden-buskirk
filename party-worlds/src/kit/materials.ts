/**
 * Shared look. Every kit builds its meshes through these helpers so authored characters,
 * personalised characters and props read as one hand-made miniature world.
 *
 * Look: "vinyl toy on a party table" — soft matte bodies, a few glossy accents
 * (frosting, balloons, metal), warm key light, cool rim. No outlines, no hard toon bands.
 */
import * as THREE from 'three';

/** Palette for world + UI. Character colours come from their CharacterSpec. */
export const PALETTE = {
  cream: '#fff4dc',
  butter: '#ffd966',
  sunflower: '#ffb52e',
  coral: '#ff6b5e',
  berry: '#e2457b',
  grape: '#7a5cff',
  teal: '#1fb5a8',
  mint: '#8fe3c0',
  sky: '#6ec3ff',
  navy: '#22304f',
  ink: '#2b2233',
  cocoa: '#6b4630',
  sponge: '#f3c98b',
  frosting: '#ff9ec4',
  frostingWhite: '#fff8f0',
  cloth: '#fbefdc',
  clothCheck: '#f26a5b',
  steel: '#cfd6de',
  paper: '#fdfaf3',
  shadow: '#3b2a4a',
} as const;

export type PaletteKey = keyof typeof PALETTE;

const cache = new Map<string, THREE.Material>();

function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key) as T | undefined;
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

export const mat = {
  /** Matte vinyl/clay. Default for bodies, sponge, cardboard, wood. */
  clay(color: string, opts: { roughness?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
    const roughness = opts.roughness ?? 0.72;
    return cached(`clay:${color}:${roughness}:${opts.flat ? 1 : 0}`, () =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: !!opts.flat }));
  },
  /** Soft cloth / fur / felt: fully rough, slightly lifted by sheen-like emissive. */
  fabric(color: string): THREE.MeshStandardMaterial {
    return cached(`fabric:${color}`, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
  },
  /** Frosting, balloons, candy, wet noses, eyes. */
  glossy(color: string, opts: { roughness?: number } = {}): THREE.MeshStandardMaterial {
    const roughness = opts.roughness ?? 0.22;
    return cached(`glossy:${color}:${roughness}`, () =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.0, envMapIntensity: 1.1 }));
  },
  /** Cutlery, foil, bells. */
  metal(color: string = PALETTE.steel): THREE.MeshStandardMaterial {
    return cached(`metal:${color}`, () =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.9, envMapIntensity: 1.2 }));
  },
  /** Jelly, glass, cellophane. */
  jelly(color: string, opacity = 0.72): THREE.MeshPhysicalMaterial {
    return cached(`jelly:${color}:${opacity}`, () =>
      new THREE.MeshPhysicalMaterial({
        color, roughness: 0.12, metalness: 0, transparent: true, opacity,
        transmission: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.3,
      }));
  },
  /** Unlit colour for decals, UI-in-world, glows. */
  flat(color: string, opts: { opacity?: number; additive?: boolean } = {}): THREE.MeshBasicMaterial {
    const opacity = opts.opacity ?? 1;
    return cached(`flat:${color}:${opacity}:${opts.additive ? 1 : 0}`, () =>
      new THREE.MeshBasicMaterial({
        color, transparent: opacity < 1 || !!opts.additive, opacity,
        blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !(opacity < 1 || opts.additive),
      }));
  },
};

/** Mark a mesh (or a whole group) as shadow caster/receiver in one call. */
export function shadows<T extends THREE.Object3D>(obj: T, cast = true, receive = true): T {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
  return obj;
}

/** Small helper for building meshes tersely. */
export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, pos?: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  return m;
}

/** Dispose geometries under a root (materials are shared through the cache and are NOT disposed). */
export function disposeGeometry(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();
  });
}

/** Critically-damped-ish spring used everywhere for secondary motion. */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(initial = 0, public stiffness = 120, public damping = 14) {
    this.value = initial;
    this.target = initial;
  }
  kick(impulse: number): void {
    this.velocity += impulse;
  }
  update(dt: number): number {
    // semi-implicit Euler, sub-stepped for stability at low frame rates
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

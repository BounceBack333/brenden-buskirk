/**
 * Renders small head-and-shoulders portraits of characters with the game's own renderer, so
 * every picker shows the real in-game character rather than a stand-in icon.
 */
import * as THREE from 'three';
import { buildCharacter } from '../characters';
import type { CharacterSpec } from '../kit/contracts';
import type { Stage } from './stage';

const cache = new Map<string, string>();

export function portraitKey(spec: CharacterSpec): string {
  return JSON.stringify(spec);
}

export class PortraitStudio {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  private target: THREE.WebGLRenderTarget;
  private pixels: Uint8Array;
  private canvas = document.createElement('canvas');
  private readonly size: number;

  constructor(private stage: Stage, size = 144) {
    this.size = size;
    this.target = new THREE.WebGLRenderTarget(size, size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    this.pixels = new Uint8Array(size * size * 4);
    this.canvas.width = this.canvas.height = size;
    this.scene.environment = stage.scene.environment;
    this.scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight('#fff0d2', 2.4);
    key.position.set(-2, 4, 5);
    const rim = new THREE.DirectionalLight('#9fd0ff', 1.2);
    rim.position.set(3, 2, -4);
    this.scene.add(key, rim, new THREE.HemisphereLight('#cfe9ff', '#ffcf9e', 1.0));
  }

  /** Returns a data URL (cached per spec). Synchronous; costs one small render. */
  render(spec: CharacterSpec): string {
    return this.shoot(spec, false);
  }

  /** A close-up of the face alone: who is driving, at a size a glance can read. */
  face(spec: CharacterSpec): string {
    return this.shoot(spec, true);
  }

  private shoot(spec: CharacterSpec, close: boolean): string {
    const k = (close ? 'face:' : '') + portraitKey(spec);
    const hit = cache.get(k);
    if (hit) return hit;
    const rig = buildCharacter(spec);
    const holder = new THREE.Group();
    holder.add(rig.root);
    holder.rotation.y = close ? -1.12 : -0.85; // three-quarter view toward the camera
    this.scene.add(holder);
    rig.setAction('idle');
    rig.setExpression('happy');
    const ctx = { vx: 0, vy: 0, speed01: 0, tension01: 0, carrying: false };
    for (let i = 0; i < 12; i++) rig.update(1 / 30, ctx);

    // frame the whole character, biased toward the head
    const box = new THREE.Box3().setFromObject(holder);
    const h = Math.max(0.6, box.max.y - box.min.y);
    const cx = (box.min.x + box.max.x) / 2;
    const cy = box.min.y + h * 0.56;
    const dist = (h * 0.62) / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(cx + dist * 0.05, cy + dist * 0.12, dist);
    this.camera.lookAt(cx, cy, 0);
    const head = close ? holder.getObjectByName('head') : undefined;
    if (head) {
      // the head bone sits at the neck: frame from just below it to the top of the hair or ears
      holder.updateMatrixWorld(true);
      const p = head.getWorldPosition(new THREE.Vector3());
      const top = box.max.y;
      const half = Math.max(0.16, (top - p.y) * 0.62);
      const hy = p.y + (top - p.y) * 0.46;
      const d = half / Math.tan((this.camera.fov * Math.PI) / 360);
      this.camera.position.set(p.x + d * 0.04, hy + d * 0.06, p.z + d);
      this.camera.lookAt(p.x, hy, p.z);
    }
    this.camera.updateProjectionMatrix();

    const r = this.stage.renderer;
    const prevTarget = r.getRenderTarget();
    const prevClear = new THREE.Color();
    r.getClearColor(prevClear);
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.target);
    r.setClearColor('#ffffff', 0);
    r.clear();
    r.render(this.scene, this.camera);
    r.readRenderTargetPixels(this.target, 0, 0, this.size, this.size, this.pixels);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);

    // WebGL rows are bottom-up; flip into the 2D canvas
    const c2 = this.canvas.getContext('2d')!;
    const img = c2.createImageData(this.size, this.size);
    const row = this.size * 4;
    for (let y = 0; y < this.size; y++) {
      img.data.set(this.pixels.subarray((this.size - 1 - y) * row, (this.size - y) * row), y * row);
    }
    c2.putImageData(img, 0, 0);
    const url = this.canvas.toDataURL('image/png');

    this.scene.remove(holder);
    rig.dispose();
    cache.set(k, url);
    if (cache.size > 80) cache.delete(cache.keys().next().value as string);
    return url;
  }
}

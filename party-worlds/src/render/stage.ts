/**
 * The shared stage: renderer, tone, lights and environment. Game views AND the kit dev pages
 * all go through createStage so that everything is judged under the same light.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  key: THREE.DirectionalLight;
  /** Resize the drawing buffer to a logical CSS size (already landscape-corrected by the caller). */
  resize(width: number, height: number): void;
  /** Re-centre the shadow frustum on the area that matters right now. */
  focusShadows(cx: number, cy: number, halfWidth: number): void;
  render(): void;
  dispose(): void;
}

export interface StageOptions {
  /** Cap device pixel ratio. Phones are fill-rate bound; 2 is plenty. */
  maxPixelRatio?: number;
  shadows?: boolean;
  background?: string;
}

export function createStage(canvas: HTMLCanvasElement, opts: StageOptions = {}): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  const maxPR = opts.maxPixelRatio ?? 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps saturated party colours honest
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = opts.shadows ?? true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background ?? '#ffe7c2');
  scene.fog = new THREE.Fog('#ffe2bd', 60, 190);

  // Soft studio reflections for glossy frosting, balloons and cutlery.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 400);
  camera.position.set(0, 6, 40);
  camera.lookAt(0, 4, 0);

  // Warm key from upper left front: long readable shadows falling toward +x and away from camera.
  const key = new THREE.DirectionalLight('#fff0d2', 2.6);
  key.position.set(-14, 26, 18);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 4;
  const sc = key.shadow.camera;
  sc.near = 1;
  sc.far = 90;
  sc.left = -26;
  sc.right = 26;
  sc.top = 22;
  sc.bottom = -14;
  scene.add(key);
  scene.add(key.target);

  // Sky/table bounce.
  const hemi = new THREE.HemisphereLight('#cfe9ff', '#ffcf9e', 0.95);
  scene.add(hemi);

  // Cool rim from behind to peel characters off the warm background.
  const rim = new THREE.DirectionalLight('#9fd0ff', 1.1);
  rim.position.set(10, 12, -20);
  scene.add(rim);

  function resize(width: number, height: number): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function focusShadows(cx: number, cy: number, halfWidth: number): void {
    const hw = Math.max(12, halfWidth);
    key.target.position.set(cx, cy, 0);
    key.position.set(cx - 14, cy + 26, 18);
    sc.left = -hw;
    sc.right = hw;
    sc.top = hw * 0.85;
    sc.bottom = -hw * 0.55;
    sc.updateProjectionMatrix();
  }

  return {
    renderer,
    scene,
    camera,
    key,
    resize,
    focusShadows,
    render: () => renderer.render(scene, camera),
    dispose: () => {
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

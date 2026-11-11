// TEMP bootstrap while the kit is being built: static bind pose only.
import * as THREE from 'three';
import type { CharacterRig, CharacterSpec } from '../kit/contracts';
import { RIG } from '../kit/contracts';
import { buildHuman } from './human';
import { sanitizeSpec } from './spec';

export { PRESET_CHARACTERS } from './presets';
export { SPEC_OPTIONS, describeSpec, randomSpec, sanitizeSpec } from './spec';

export function buildCharacter(input: CharacterSpec): CharacterRig {
  const spec = sanitizeSpec(input);
  const body = buildHuman(spec);
  const root = new THREE.Group();
  root.add(body.bones[body.root]);
  root.add(body.mesh);
  const carryAnchor = new THREE.Object3D();
  carryAnchor.position.set(0, RIG.CARRY_Y, 0);
  root.add(carryAnchor);
  const umbrellaAnchor = new THREE.Object3D();
  root.add(umbrellaAnchor);
  const qz = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);
  for (const e of body.face.eyes) {
    body.bones[e.lidU].quaternion.copy(body.restQ[e.lidU]).multiply(qz.setFromAxisAngle(Z, 0.85));
    body.bones[e.lidD].quaternion.copy(body.restQ[e.lidD]).multiply(qz.setFromAxisAngle(Z, -0.9));
  }
  if (body.face.mouths) {
    const m = body.face.mouths;
    const show = new URLSearchParams(location.search).get('mouth') ?? 'smile';
    for (const key of ['smile', 'open', 'o', 'grit', 'wobble'] as const) {
      if (key !== show) body.bones[m[key]].scale.setScalar(0.0001);
    }
  }
  return {
    root, spec, carryAnchor, umbrellaAnchor,
    setAction() {}, setExpression() {}, setFacing() {}, setTilt() {}, update() {},
    dispose() { body.mesh.geometry.dispose(); },
  };
}

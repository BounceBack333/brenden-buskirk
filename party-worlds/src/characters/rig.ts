/**
 * The animation layer: turns a built body (people and pets alike) into a CharacterRig.
 *
 * How it works
 *  - Every frame the current action + expression write a TARGET pose: a flat list of numbers
 *    (lean, limb swings, lid openness, …). The live pose chases the target with a short time
 *    constant, so changing action can never pop.
 *  - The pose is then applied to bones. Arms (people) and the harness stand (pets) are aimed
 *    and stretched to the carry point so the basket always sits exactly where gameplay says.
 *  - Ears, hair, tails, bandanas and tongues are spring chains pushed by the air the character
 *    moves through and re-hung by gravity when the body tips.
 *
 * Nothing here allocates per frame, and nothing here affects gameplay.
 */
import * as THREE from 'three';
import { RIG } from '../kit/contracts';
import type { CharacterAction, CharacterRig, CharacterSpec, Expression, MotionContext } from '../kit/contracts';
import { Spring } from '../kit/materials';
import type { MouthSet } from './face';
import type { BodyDesc, ChainDesc } from './types';

// ───────────────────────────── pose channels ─────────────────────────────

let n = 0;
const C = {
  lift: n++, base: n++, sx: n++, sy: n++, bodyY: n++, pitch: n++, roll: n++, yaw: n++,
  headPitch: n++, headYaw: n++, headRoll: n++,
  sw0: n++, sw1: n++, sw2: n++, sw3: n++,
  sp0: n++, sp1: n++, sp2: n++, sp3: n++,
  ln0: n++, ln1: n++, ln2: n++, ln3: n++,
  reach: n++,
  lidU: n++, lidD: n++, lidSkew: n++, lookX: n++, lookY: n++, pupil: n++,
  browY: n++, browTilt: n++, cheek: n++, jaw: n++, tongue: n++, mood: n++, wag: n++,
} as const;
const COUNT = n;
/** first face channel: face channels chase their targets faster than the body */
const FACE_FROM = C.lidU;

const MOUTHS = ['smile', 'open', 'o', 'grit', 'wobble'] as const;
type MouthName = (typeof MOUTHS)[number];

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const PI = Math.PI;

function neutral(p: Float32Array): void {
  p.fill(0);
  p[C.sx] = 1;
  p[C.sy] = 1;
  p[C.ln0] = p[C.ln1] = p[C.ln2] = p[C.ln3] = 1;
  p[C.lidU] = 0.74;
  p[C.lidD] = 0.8;
  p[C.pupil] = 1;
}

interface ChainState {
  desc: ChainDesc;
  /** rest direction of the chain root in model space */
  dir: THREE.Vector3;
  /** sideways-wag axis in model space */
  wagAxis: THREE.Vector3;
  /** spring state: a rotation vector in model space */
  r: THREE.Vector3;
  v: THREE.Vector3;
  invBind: THREE.Quaternion[];
}

export function createRig(spec: CharacterSpec, body: BodyDesc): CharacterRig {
  const human = body.species === 'human';
  const dog = body.species === 'dog';
  const bones = body.bones;
  const restP = body.restP;
  const restQ = body.restQ;

  // root (contract: origin at the feet, faces +x) → facing → tilt about the body centre → body
  const root = new THREE.Group();
  root.name = `rig:${spec.id}`;
  const facingG = new THREE.Group();
  const tiltG = new THREE.Group();
  const bodyG = new THREE.Group();
  tiltG.position.y = RIG.CENTER_Y;
  bodyG.position.y = -RIG.CENTER_Y;
  root.add(facingG);
  facingG.add(tiltG);
  tiltG.add(bodyG);
  bodyG.add(bones[body.root]!);
  bodyG.add(body.mesh);

  const carryAnchor = new THREE.Object3D();
  carryAnchor.position.set(0, RIG.CARRY_Y, 0);
  const umbrellaAnchor = new THREE.Object3D();
  umbrellaAnchor.position.set(0, 1, 0);
  root.add(carryAnchor, umbrellaAnchor);

  // pets: the telescoping stand + cradle live in root space so squash and lean never move the basket
  const standB = body.stand >= 0 ? bones[body.stand]! : null;
  const cradleB = body.cradle >= 0 ? bones[body.cradle]! : null;
  if (standB) root.add(standB);
  if (cradleB) root.add(cradleB);
  const bodyPivot = new THREE.Vector3().copy(restP[body.body]!);
  const socketLocal = body.socket.clone().sub(bodyPivot);
  const ringLocal = body.ring.clone().sub(bodyPivot);

  // spring chains
  const chains: ChainState[] = body.chains.map((desc) => {
    const rootBone = desc.bones[0]!;
    const dir = Y.clone().applyQuaternion(body.bindQ[rootBone]!).normalize();
    const wagAxis = new THREE.Vector3().crossVectors(dir, Z);
    if (wagAxis.lengthSq() < 1e-4) wagAxis.set(1, 0, 0);
    wagAxis.normalize();
    return {
      desc, dir, wagAxis, r: new THREE.Vector3(), v: new THREE.Vector3(),
      invBind: desc.bones.map((b) => body.bindQ[b]!.clone().invert()),
    };
  });
  // the tongue is a tiny one-bone flap when it is out
  const tongueSpring = new Spring(0, 90, 7);
  const squash = new Spring(0, 170, 11);

  const cur = new Float32Array(COUNT);
  const tgt = new Float32Array(COUNT);
  neutral(cur);
  neutral(tgt);

  let action: CharacterAction = 'idle';
  let expression: Expression = 'neutral';
  let actionT = 0;
  let clock = (spec.id.length * 0.37) % 3; // de-sync idle motion between characters
  let runPhase = 0;
  let facing: 1 | -1 = 1;
  let facingYaw = 0;
  let tilt = 0;
  let blinkIn = 1.5 + (spec.name.length % 5) * 0.4;
  let blinkT = 0;
  let mouth: MouthName = 'smile';
  let mouthPop = 1;
  let lastVx = 0;
  let lastVy = 0;
  let disposed = false;

  // scratch
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const wind = new THREE.Vector3();
  const grav = new THREE.Vector3();

  const D = body.dims;
  const legLen = body.limbs[2].restLen;
  const armLen = body.limbs[0].restLen;

  // ───────────────────────────── target poses ─────────────────────────────

  function poseHuman(ctx: MotionContext, dt: number): MouthName {
    const t = actionT;
    const p = tgt;
    const breathe = Math.sin(clock * 2.1);
    let m: MouthName = 'smile';
    // a relaxed stand that most actions start from
    p[C.sy] = 1 + 0.012 * breathe;
    p[C.sw0] = 0.05 + 0.03 * breathe;
    p[C.sw1] = 0.05 - 0.03 * breathe;
    p[C.sp0] = p[C.sp1] = 0.17;
    p[C.sp2] = p[C.sp3] = 0.04;
    switch (action) {
      case 'idle':
        p[C.headYaw] = -0.22 + 0.2 * Math.sin(clock * 0.7);
        p[C.headPitch] = 0.04 + 0.03 * Math.sin(clock * 1.3);
        break;
      case 'run': {
        const s = Math.max(0, Math.min(1, ctx.speed01 ?? 1));
        runPhase += dt * (7 + 9 * s);
        const a = Math.sin(runPhase);
        p[C.sw2] = 0.95 * s * a;
        p[C.sw3] = -0.95 * s * a;
        p[C.sw0] = -0.8 * s * a;
        p[C.sw1] = 0.8 * s * a;
        p[C.pitch] = -0.2 * s;
        p[C.headPitch] = 0.16 * s;
        p[C.lift] = Math.abs(Math.cos(runPhase)) * 0.055 * s;
        break;
      }
      case 'anticipate': {
        const T = Math.max(0, Math.min(1, ctx.tension01 ?? 0));
        // sitting in the bowl, legs out in front like a toy
        p[C.bodyY] = -(D.hipY - 0.1) * (0.82 + 0.1 * T);
        p[C.sw2] = p[C.sw3] = 1.32 + 0.1 * T;
        p[C.sp2] = p[C.sp3] = 0.12;
        p[C.sw0] = p[C.sw1] = 0.45 + 0.5 * T;
        p[C.sp0] = p[C.sp1] = 0.5 - 0.25 * T;
        p[C.sy] = 1 - 0.15 * T;
        p[C.sx] = 1 + 0.1 * T;
        p[C.pitch] = 0.12 + 0.3 * T;
        p[C.headPitch] = -0.12 * T + 0.05 * Math.sin(clock * 1.7) * (1 - T);
        p[C.headYaw] = -0.2;
        // trembling with tension
        p[C.roll] = Math.sin(clock * 47) * 0.035 * T * T;
        p[C.lift] = Math.sin(clock * 61) * 0.006 * T;
        break;
      }
      case 'fly':
        // head-first: the whole body is laid along the direction of travel
        p[C.base] = -PI / 2;
        p[C.sy] = 1.1;
        p[C.sx] = 0.94;
        p[C.sw0] = -0.42 + 0.06 * Math.sin(clock * 19);
        p[C.sw1] = -0.42 - 0.06 * Math.sin(clock * 19);
        p[C.sp0] = p[C.sp1] = 0.34;
        p[C.sw2] = 0.1 * Math.sin(clock * 17);
        p[C.sw3] = -0.1 * Math.sin(clock * 17);
        p[C.sp2] = p[C.sp3] = 0.14;
        p[C.headPitch] = 1.05;
        p[C.headYaw] = -0.25;
        break;
      case 'float':
        // dangling from one raised arm under the umbrella
        p[C.sw0] = PI - 0.12;
        p[C.sp0] = 0.02;
        p[C.ln0] = 1.22;
        p[C.sw1] = 0.25 + 0.2 * Math.sin(clock * 3.1);
        p[C.sp1] = 0.75;
        p[C.sw2] = 0.3 * Math.sin(clock * 3.3);
        p[C.sw3] = -0.3 * Math.sin(clock * 3.3 + 0.6);
        p[C.roll] = 0.07 * Math.sin(clock * 2.3);
        p[C.pitch] = 0.06 * Math.sin(clock * 2.9);
        p[C.headPitch] = -0.22;
        p[C.headYaw] = -0.3;
        p[C.sy] = 1.05;
        break;
      case 'tumble':
        p[C.sw2] = p[C.sw3] = 1.5;
        p[C.sw0] = p[C.sw1] = 1.1;
        p[C.sp0] = p[C.sp1] = 0.35;
        p[C.sy] = 0.92;
        p[C.sx] = 1.06;
        p[C.headPitch] = -0.3;
        m = 'o';
        break;
      case 'splat':
        if (t < 1.15) {
          // flat on the cloth, face down, starfish
          p[C.base] = -PI / 2;
          p[C.lift] = 0.13 - RIG.CENTER_Y;
          p[C.sw0] = p[C.sw1] = PI - 0.45;
          p[C.sp0] = p[C.sp1] = 0.9;
          p[C.sp2] = p[C.sp3] = 0.5;
          p[C.headPitch] = 0.85;
        } else {
          // …then a slow wobble up to sitting
          const k = t - 1.15;
          p[C.bodyY] = -(D.hipY - 0.1);
          p[C.sw2] = p[C.sw3] = 1.32;
          p[C.sp2] = p[C.sp3] = 0.2;
          p[C.sw0] = p[C.sw1] = 0.25;
          p[C.sp0] = p[C.sp1] = 0.35;
          p[C.headRoll] = 0.22 * Math.sin(clock * 5.5) * Math.exp(-k * 1.2);
          p[C.headPitch] = -0.1;
        }
        break;
      case 'caught': {
        // head and hands pop over the rim of the basket
        const bob = t > 0.55 ? Math.abs(Math.sin((t - 0.55) * 8)) * 0.07 : 0;
        p[C.lift] = 0.6 + bob;
        p[C.sw0] = 2.35 + 0.25 * Math.sin(clock * 11);
        p[C.sw1] = 2.35 - 0.25 * Math.sin(clock * 11);
        p[C.sp0] = p[C.sp1] = 0.75;
        p[C.headRoll] = t < 0.6 ? 0.2 * Math.sin(clock * 9) : 0.05 * Math.sin(clock * 4);
        p[C.headYaw] = -0.45;
        p[C.headPitch] = 0.1;
        break;
      }
      case 'dive':
        p[C.pitch] = -1.12;
        p[C.bodyY] = -0.07;
        p[C.sw0] = p[C.sw1] = PI - 0.5;
        p[C.sp0] = p[C.sp1] = 0.2;
        p[C.sw2] = 0.25;
        p[C.sw3] = -0.15;
        p[C.headPitch] = 0.9;
        p[C.sy] = 1.08;
        m = 'grit';
        break;
      case 'slide':
        p[C.pitch] = -1.42;
        p[C.bodyY] = -(D.hipY - 0.12);
        p[C.sw0] = p[C.sw1] = PI - 0.3;
        p[C.sp0] = p[C.sp1] = 0.25;
        p[C.sw2] = 0.12;
        p[C.sw3] = -0.08;
        p[C.sp2] = p[C.sp3] = 0.2;
        p[C.headPitch] = 1.05;
        m = 'grit';
        break;
      case 'celebrate': {
        const hop = Math.abs(Math.sin(t * 6.5));
        p[C.lift] = hop * 0.22;
        p[C.sw0] = PI - 0.3 + 0.28 * Math.sin(t * 13);
        p[C.sw1] = PI - 0.3 - 0.28 * Math.sin(t * 13);
        p[C.sp0] = p[C.sp1] = 0.4;
        p[C.sp2] = p[C.sp3] = 0.06 + 0.2 * hop;
        p[C.sy] = 1 + 0.07 * Math.sin(t * 13);
        p[C.headPitch] = 0.25;
        p[C.headYaw] = -0.4;
        p[C.yaw] = t < 0.7 ? -PI * 2 * easeInOut(t / 0.7) : -PI * 2;
        m = 'open';
        break;
      }
      case 'sad':
        p[C.pitch] = -0.2;
        p[C.headPitch] = -0.42;
        p[C.sw0] = p[C.sw1] = 0.16;
        p[C.sp0] = p[C.sp1] = 0.06;
        p[C.sy] = 0.97;
        p[C.roll] = 0.03 * Math.sin(clock * 1.4);
        break;
      case 'wave':
        p[C.sp0] = 2.35 + 0.32 * Math.sin(clock * 10);
        p[C.sw0] = 0.1;
        p[C.headYaw] = -0.5;
        p[C.headRoll] = 0.12;
        p[C.roll] = 0.05;
        break;
    }
    if (ctx.carrying && action !== 'celebrate') {
      p[C.reach] = 1;
      if (action === 'idle') p[C.lift] = Math.abs(Math.sin(clock * 5.2)) * 0.02; // bouncing on the toes, ready
    }
    return m;
  }

  function posePet(ctx: MotionContext, dt: number): void {
    const t = actionT;
    const p = tgt;
    const breathe = Math.sin(clock * 2.4);
    p[C.sy] = 1 + 0.014 * breathe;
    p[C.wag] = 0.35;
    switch (action) {
      case 'idle':
        p[C.headYaw] = -0.25 + 0.22 * Math.sin(clock * 0.8);
        p[C.headRoll] = 0.12 * Math.sin(clock * 0.53);
        p[C.headPitch] = 0.05;
        p[C.wag] = 0.6;
        break;
      case 'run': {
        const s = Math.max(0, Math.min(1, ctx.speed01 ?? 1));
        runPhase += dt * (9 + 10 * s);
        const a = Math.sin(runPhase);
        const b = Math.sin(runPhase - 0.7);
        // a bounding gallop: front pair reaches while the hind pair drives
        p[C.sw0] = 0.85 * s * a;
        p[C.sw1] = 0.85 * s * Math.sin(runPhase + 0.35);
        p[C.sw2] = -0.85 * s * b;
        p[C.sw3] = -0.85 * s * Math.sin(runPhase - 0.35);
        p[C.pitch] = 0.1 * s * Math.sin(runPhase - 1);
        p[C.lift] = Math.abs(Math.cos(runPhase)) * 0.06 * s;
        p[C.headPitch] = 0.12 * s;
        p[C.wag] = 0.2;
        break;
      }
      case 'anticipate': {
        const T = Math.max(0, Math.min(1, ctx.tension01 ?? 0));
        // the pre-pounce crouch: chest down, rump up, wiggle
        p[C.bodyY] = -D.belly * (0.5 + 0.4 * T);
        p[C.pitch] = -0.14 * T;
        p[C.roll] = Math.sin(clock * 13) * 0.1 * T + Math.sin(clock * 47) * 0.02 * T;
        p[C.sy] = 1 - 0.1 * T;
        p[C.sx] = 1 + 0.06 * T;
        p[C.headPitch] = 0.2 * T;
        p[C.headYaw] = -0.2;
        p[C.mood] = -0.7 * T;
        p[C.wag] = 0.9 * T;
        break;
      }
      case 'fly':
        // superdog: front paws out, back paws trailing
        p[C.sw0] = p[C.sw1] = 1.22 + 0.05 * Math.sin(clock * 15);
        p[C.sw2] = p[C.sw3] = -1.22 - 0.05 * Math.sin(clock * 15);
        p[C.ln0] = p[C.ln1] = p[C.ln2] = p[C.ln3] = 1.1;
        p[C.sx] = 1.08;
        p[C.sy] = 0.96;
        p[C.headPitch] = 0.1;
        p[C.headYaw] = -0.2;
        p[C.wag] = 0;
        break;
      case 'float': {
        // doggy-paddle under the umbrella
        const k = clock * 9;
        p[C.sw0] = 0.5 + 0.5 * Math.sin(k);
        p[C.sw1] = 0.5 - 0.5 * Math.sin(k);
        p[C.sw2] = -0.3 + 0.4 * Math.sin(k + 1.5);
        p[C.sw3] = -0.3 - 0.4 * Math.sin(k + 1.5);
        p[C.pitch] = 0.14;
        p[C.roll] = 0.07 * Math.sin(clock * 2.3);
        p[C.headPitch] = -0.12;
        p[C.headYaw] = -0.25;
        p[C.wag] = 0.3;
        break;
      }
      case 'tumble':
        p[C.sw0] = p[C.sw1] = -0.9;
        p[C.sw2] = p[C.sw3] = 0.9;
        p[C.sx] = 0.93;
        p[C.headPitch] = -0.3;
        p[C.wag] = 0;
        break;
      case 'splat':
        if (t < 1.1) {
          // a soft flop: belly down, legs out, chin on the cloth, ears down for a moment
          p[C.bodyY] = -D.belly;
          p[C.sp0] = p[C.sp1] = 1.2;
          p[C.sp2] = p[C.sp3] = 1.2;
          p[C.sw0] = p[C.sw1] = 0.5;
          p[C.sw2] = p[C.sw3] = -0.5;
          p[C.headPitch] = -0.38;
          p[C.mood] = -1;
          p[C.wag] = 0;
        } else {
          // …and shake it off
          const k = t - 1.1;
          p[C.roll] = 0.34 * Math.sin(clock * 24) * Math.exp(-k * 2.6);
          p[C.headRoll] = -0.3 * Math.sin(clock * 24 + 0.8) * Math.exp(-k * 2.6);
          p[C.wag] = Math.min(1, k * 0.8);
          p[C.headYaw] = -0.3;
        }
        break;
      case 'caught': {
        // looking out over the rim like a dog in a box
        const bob = t > 0.55 ? Math.abs(Math.sin((t - 0.55) * 8)) * 0.06 : 0;
        p[C.lift] = 0.62 + bob;
        p[C.pitch] = 0.72;
        p[C.sw0] = p[C.sw1] = 0.75;
        p[C.sw2] = p[C.sw3] = -0.3;
        p[C.headPitch] = -0.55;
        p[C.headYaw] = -0.4;
        p[C.headRoll] = t < 0.6 ? 0.22 * Math.sin(clock * 9) : 0.08 * Math.sin(clock * 3);
        p[C.wag] = 1.3;
        break;
      }
      case 'dive':
        p[C.sw0] = p[C.sw1] = 1.2;
        p[C.sw2] = p[C.sw3] = -1.1;
        p[C.ln0] = p[C.ln1] = p[C.ln2] = p[C.ln3] = 1.12;
        p[C.bodyY] = -D.belly * 0.35;
        p[C.pitch] = -0.1;
        p[C.sx] = 1.1;
        p[C.headPitch] = 0.12;
        p[C.mood] = -0.4;
        p[C.wag] = 0;
        break;
      case 'slide':
        p[C.bodyY] = -D.belly;
        p[C.sw0] = p[C.sw1] = 1.3;
        p[C.sw2] = p[C.sw3] = -1.3;
        p[C.headPitch] = -0.15;
        p[C.mood] = -0.5;
        p[C.wag] = 0.2;
        break;
      case 'celebrate': {
        const hop = Math.abs(Math.sin(t * 7));
        p[C.lift] = hop * 0.2;
        p[C.pitch] = 0.34 * hop;
        p[C.sw0] = 0.6 + 0.3 * Math.sin(t * 14);
        p[C.sw1] = 0.6 - 0.3 * Math.sin(t * 14);
        p[C.headPitch] = 0.1;
        p[C.headYaw] = -0.35;
        p[C.yaw] = t < 0.7 ? -PI * 2 * easeInOut(t / 0.7) : -PI * 2;
        p[C.wag] = 1.6;
        break;
      }
      case 'sad':
        p[C.bodyY] = -D.belly * 0.3;
        p[C.headPitch] = -0.4;
        p[C.mood] = -1;
        p[C.wag] = 0;
        break;
      case 'wave':
        p[C.sw0] = 1.45 + 0.3 * Math.sin(clock * 10);
        p[C.sp0] = 0.25;
        p[C.roll] = -0.07;
        p[C.headYaw] = -0.5;
        p[C.headRoll] = 0.14;
        p[C.wag] = 1.1;
        break;
    }
    if (ctx.carrying) p[C.reach] = 1;
  }

  function faceTargets(humanMouth: MouthName): MouthName {
    const p = tgt;
    let m: MouthName = humanMouth;
    switch (expression) {
      case 'neutral':
        break;
      case 'happy':
        p[C.lidU] = 0.7;
        p[C.lidD] = 0.55;
        p[C.browY] = 0.004;
        p[C.cheek] = 0.12;
        p[C.jaw] = 0.25;
        p[C.tongue] = dog ? 0.55 : 0;
        break;
      case 'nervous':
        p[C.lidU] = 1.02;
        p[C.lidD] = 0.98;
        p[C.pupil] = 0.72;
        p[C.browY] = 0.008;
        p[C.browTilt] = 0.42;
        p[C.cheek] = 0.2;
        p[C.mood] = Math.min(p[C.mood]!, -0.6);
        p[C.lookX] = 0.25 * Math.sin(clock * 7);
        m = 'wobble';
        break;
      case 'thrilled':
        p[C.lidU] = 1.05;
        p[C.lidD] = 0.9;
        p[C.pupil] = 1.12;
        p[C.browY] = 0.012;
        p[C.jaw] = 1;
        p[C.tongue] = dog ? 1 : 0.5;
        p[C.mood] = Math.max(p[C.mood]!, 0.4);
        m = 'open';
        break;
      case 'determined':
        p[C.lidU] = 0.56;
        p[C.lidD] = 0.6;
        p[C.browY] = -0.004;
        p[C.browTilt] = -0.4;
        p[C.pupil] = 0.95;
        if (m === 'smile') m = 'grit';
        break;
      case 'dizzy':
        p[C.lidU] = 0.82;
        p[C.lidD] = 0.82;
        p[C.lidSkew] = 0.22;
        p[C.lookX] = Math.cos(clock * 9);
        p[C.lookY] = Math.sin(clock * 9);
        p[C.browTilt] = 0.25;
        p[C.jaw] = 0.35;
        p[C.tongue] = 0.6;
        m = 'o';
        break;
      case 'oops':
        p[C.lidU] = 0.95;
        p[C.lidD] = 0.9;
        p[C.pupil] = 0.82;
        p[C.browY] = 0.01;
        p[C.browTilt] = 0.5;
        p[C.jaw] = 0.2;
        p[C.mood] = Math.min(p[C.mood]!, -0.8);
        m = 'o';
        break;
      case 'cheer':
        // eyes squeezed into happy arcs
        p[C.lidU] = 0.3;
        p[C.lidD] = 0.42;
        p[C.browY] = 0.012;
        p[C.cheek] = 0.22;
        p[C.jaw] = 1;
        p[C.tongue] = dog ? 1 : 0.35;
        p[C.mood] = Math.max(p[C.mood]!, 0.6);
        p[C.wag] = Math.max(p[C.wag]!, 1.4);
        m = 'open';
        break;
    }
    return m;
  }

  // ───────────────────────────── applying a pose ─────────────────────────────

  /** Aim a one-segment limb at a point in MODEL space and stretch it to reach. */
  function reachLimb(i: 0 | 1, tx: number, ty: number, tz: number, pitch: number, blend: number): void {
    const limb = body.limbs[i];
    const side = i === 0 ? 1 : -1;
    // shoulder in model space after the torso's drop and lean
    const sx = 0;
    const sy = D.shoulderY - D.hipY;
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const shX = c * sx - s * sy;
    const shY = D.hipY + cur[C.bodyY]! + s * sx + c * sy;
    const shZ = side * D.shoulderZ;
    // direction to the target, back in the torso's frame
    const dxm = tx - shX;
    const dym = ty - shY;
    const dx = c * dxm + s * dym;
    const dy = -s * dxm + c * dym;
    const dz = tz - shZ;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
    const swing = Math.atan2(dx, -dy);
    const spread = -Math.asin(Math.max(-1, Math.min(1, dz / len)));
    const bone = bones[limb.bone]!;
    q1.setFromAxisAngle(Z, swing);
    q2.setFromAxisAngle(X, spread);
    q1.multiply(q2);
    bone.quaternion.slerp(q1, blend);
    const want = Math.max(0.6, Math.min(3.2, len / limb.restLen));
    const k = bone.scale.y + (want - bone.scale.y) * blend;
    bone.scale.set(1, k, 1);
    bones[limb.tip]!.scale.set(1, 1 / k, 1);
  }

  function applyPose(ctx: MotionContext, dt: number): void {
    const p = cur;
    const sq = squash.update(dt);
    // whole body
    facingG.rotation.y = facingYaw + p[C.yaw]!;
    tiltG.rotation.z = tilt + p[C.base]!;
    tiltG.position.y = RIG.CENTER_Y + p[C.lift]!;
    const sy = Math.max(0.5, p[C.sy]! + sq);
    const sxz = Math.max(0.5, p[C.sx]! - sq * 0.5);
    bodyG.scale.set(sxz, sy, sxz);

    const b = bones[body.body]!;
    b.position.copy(restP[body.body]!);
    b.position.y += p[C.bodyY]!;
    q1.setFromAxisAngle(Z, p[C.pitch]!);
    q2.setFromAxisAngle(X, p[C.roll]!);
    b.quaternion.copy(q1).multiply(q2);

    const h = bones[body.head]!;
    q1.setFromAxisAngle(Y, p[C.headYaw]!);
    q2.setFromAxisAngle(Z, p[C.headPitch]!);
    q1.multiply(q2);
    q2.setFromAxisAngle(X, p[C.headRoll]!);
    h.quaternion.copy(q1).multiply(q2);

    // limbs: swing fore/aft, spread outward, stretch
    for (let i = 0; i < 4; i++) {
      const limb = body.limbs[i as 0 | 1 | 2 | 3];
      const side = i % 2 === 0 ? 1 : -1;
      const bone = bones[limb.bone]!;
      q1.setFromAxisAngle(Z, p[C.sw0 + i]!);
      q2.setFromAxisAngle(X, -side * p[C.sp0 + i]!);
      bone.quaternion.copy(q1).multiply(q2);
      let len = p[C.ln0 + i]!;
      // a planted leg shortens as the body sinks, so feet stay on the ground instead of through it
      const leg = human ? i >= 2 : true;
      if (leg && p[C.bodyY]! < 0 && Math.abs(p[C.sw0 + i]!) < 0.5 && p[C.sp0 + i]! < 0.6) {
        len *= Math.max(0.3, 1 + p[C.bodyY]! / limb.restLen);
      }
      bone.scale.set(1, len, 1);
      bones[limb.tip]!.scale.set(1, 1 / len, 1);
    }

    // carrying
    const reach = p[C.reach]!;
    const cx = ctx.carryX ?? 0;
    const cy = ctx.carryY ?? RIG.CARRY_Y;
    carryAnchor.position.set(cx, cy, 0);
    if (human) {
      if (reach > 0.01) {
        // hands under the basket; the target is given in root space, undo the body squash
        const ty = (cy - 0.03 - p[C.lift]!) / sy;
        const tx = cx / sxz;
        reachLimb(0, tx, ty, 0.2, p[C.pitch]!, reach);
        reachLimb(1, tx, ty, -0.2, p[C.pitch]!, reach);
      }
      if (body.hair >= 0) {
        // hair and hats give way under the basket
        const press = reach * (cy < 0.9 ? 0 : 1);
        bones[body.hair]!.scale.set(1 + 0.06 * press, 1 - 0.2 * press, 1 + 0.06 * press);
      }
      if (body.hat >= 0) {
        q1.setFromAxisAngle(Z, 0.7 * reach);
        bones[body.hat]!.quaternion.copy(restQ[body.hat]!).multiply(q1);
      }
    }

    applyFace(dt);
  }

  function applyFace(dt: number): void {
    const p = cur;
    const f = body.face;
    // blinking (not while the eyes are doing something expressive)
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0.12;
      blinkIn = 2.2 + ((clock * 7.3) % 2.6);
    }
    blinkT = Math.max(0, blinkT - dt);
    const blink = blinkT > 0 && expression !== 'cheer' && expression !== 'dizzy' ? 0.06 : 1;
    for (let e = 0; e < 2; e++) {
      const eye = f.eyes[e as 0 | 1];
      const skew = e === 0 ? p[C.lidSkew]! : -p[C.lidSkew]!;
      q1.setFromAxisAngle(Z, Math.max(0, (p[C.lidU]! + skew) * blink));
      bones[eye.lidU]!.quaternion.copy(restQ[eye.lidU]!).multiply(q1);
      q1.setFromAxisAngle(Z, -Math.max(0, (p[C.lidD]! - skew * 0.5) * blink));
      bones[eye.lidD]!.quaternion.copy(restQ[eye.lidD]!).multiply(q1);
      q1.setFromAxisAngle(Y, -p[C.lookX]! * 0.32);
      q2.setFromAxisAngle(Z, p[C.lookY]! * 0.28);
      bones[eye.iris]!.quaternion.copy(restQ[eye.iris]!).multiply(q1).multiply(q2);
      const ps = Math.max(0.4, p[C.pupil]!);
      bones[eye.pupil]!.scale.set(1, ps, ps);
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const bi = f.brows[i as 0 | 1];
      const brow = bones[bi]!;
      v1.set(0, p[C.browY]!, 0).applyQuaternion(restQ[bi]!);
      brow.position.copy(restP[bi]!).add(v1);
      q1.setFromAxisAngle(X, side * p[C.browTilt]!);
      brow.quaternion.copy(restQ[bi]!).multiply(q1);
      const ck = 1 + p[C.cheek]!;
      bones[f.cheeks[i as 0 | 1]]!.scale.set(ck, ck, ck);
    }
    if (f.mouths) {
      mouthPop = Math.min(1, mouthPop + dt * 9);
      const set: MouthSet = f.mouths;
      for (const name of MOUTHS) {
        const s = name === mouth ? 0.55 + 0.45 * easeOutBack(mouthPop) : 0.0001;
        bones[set[name]]!.scale.set(s, s, s);
      }
    }
    if (f.jaw !== undefined && f.jaw >= 0) {
      q1.setFromAxisAngle(Z, -0.5 * p[C.jaw]!);
      bones[f.jaw]!.quaternion.copy(restQ[f.jaw]!).multiply(q1);
    }
    if (f.tongue !== undefined && f.tongue >= 0) {
      const out = Math.max(0, Math.min(1.1, p[C.tongue]!));
      const tb = bones[f.tongue]!;
      tb.scale.set(0.5 + 0.5 * out, 0.06 + 0.94 * out, 0.4 + 0.6 * out);
      q1.setFromAxisAngle(X, tongueSpring.update(dt) * out);
      tb.quaternion.copy(restQ[f.tongue]!).multiply(q1);
    }
  }

  function applyChains(ctx: MotionContext, dt: number): void {
    // air moving past the character, in model space
    const f = Math.cos(facingYaw + cur[C.yaw]!);
    const ang = -(tilt + cur[C.base]!);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const lx = -ctx.vx * f;
    const ly = -ctx.vy;
    wind.set((c * lx - s * ly) / 3.4, (s * lx + c * ly) / 3.4, 0);
    // a jolt when velocity changes suddenly (launch, catch, landing)
    const ax = (ctx.vx - lastVx) * f;
    const ay = ctx.vy - lastVy;
    lastVx = ctx.vx;
    lastVy = ctx.vy;
    const jolt = Math.min(6, Math.sqrt(ax * ax + ay * ay));
    // gravity as the body sees it, minus gravity at rest → pure "re-hang" term
    grav.set(-s, -c + 1, 0);
    const mood = cur[C.mood]!;
    const wagAmt = cur[C.wag]!;
    const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
    const hdt = dt / steps;
    for (const ch of chains) {
      const d = ch.desc;
      // target rotation vector: bend toward the wind and toward "down"
      v1.copy(wind).addScaledVector(grav, d.hang * 1.6);
      v2.crossVectors(ch.dir, v1).multiplyScalar(d.gain);
      if (d.role === 'earR' || d.role === 'earL') {
        // ears go back and down with a low mood, perk forward with a high one
        v2.z += -0.5 * mood;
      } else if (d.role === 'tail') {
        v2.addScaledVector(ch.wagAxis, Math.sin(clock * (9 + wagAmt * 5)) * 0.55 * Math.min(1.6, wagAmt));
        if (mood < 0) v2.z += -0.7 * mood;
      }
      const tl = v2.length();
      if (tl > d.limit) v2.multiplyScalar(d.limit / tl);
      if (jolt > 0.4) ch.v.addScaledVector(v3.crossVectors(ch.dir, wind.lengthSq() > 0.01 ? wind : Y), jolt * 0.8);
      for (let k = 0; k < steps; k++) {
        v3.copy(v2).sub(ch.r).multiplyScalar(d.stiff).addScaledVector(ch.v, -d.damp);
        ch.v.addScaledVector(v3, hdt);
        ch.r.addScaledVector(ch.v, hdt);
      }
      const rl = ch.r.length();
      if (rl > d.limit * 1.6) {
        ch.r.multiplyScalar((d.limit * 1.6) / rl);
        ch.v.multiplyScalar(0.5);
      }
      // spread the bend along the chain, a little more toward the tip
      const nb = d.bones.length;
      for (let i = 0; i < nb; i++) {
        const bi = d.bones[i]!;
        const share = nb === 1 ? 1 : (0.75 + 0.5 * (i / (nb - 1))) / nb;
        v3.copy(ch.r).multiplyScalar(share).applyQuaternion(ch.invBind[i]!);
        const a = v3.length();
        if (a > 1e-5) {
          q1.setFromAxisAngle(v3.multiplyScalar(1 / a), a);
          bones[bi]!.quaternion.copy(restQ[bi]!).multiply(q1);
        } else {
          bones[bi]!.quaternion.copy(restQ[bi]!);
        }
      }
    }
    tongueSpring.target = 0;
    tongueSpring.kick((wind.x * 0.6 + Math.sin(clock * 14) * 0.3) * dt * 40);
  }

  function applyAttachments(): void {
    bodyG.updateWorldMatrix(true, false);
    const b = bones[body.body]!;
    b.updateWorldMatrix(true, false);
    root.updateWorldMatrix(true, false);
    const reach = cur[C.reach]!;
    if (human) {
      const hand = bones[body.limbs[0].tip]!;
      bones[body.limbs[0].bone]!.updateWorldMatrix(false, false);
      hand.updateWorldMatrix(false, false);
      v1.setFromMatrixPosition(hand.matrixWorld);
      root.worldToLocal(v1);
      umbrellaAnchor.position.copy(v1);
    } else {
      v1.copy(ringLocal).applyMatrix4(b.matrixWorld);
      root.worldToLocal(v1);
      umbrellaAnchor.position.copy(v1);
      if (standB && cradleB) {
        if (reach > 0.02) {
          // cradle at the carry point; stand telescopes from it down to the harness socket
          cradleB.position.copy(carryAnchor.position);
          cradleB.scale.setScalar(reach);
          v2.copy(socketLocal).applyMatrix4(b.matrixWorld);
          root.worldToLocal(v2);
          v3.copy(v2).sub(carryAnchor.position);
          const len = v3.length() || 1e-4;
          standB.position.copy(carryAnchor.position);
          standB.quaternion.setFromUnitVectors(Y, v3.multiplyScalar(1 / len));
          standB.scale.set(reach, (len / body.standLen) * reach, reach);
        } else {
          cradleB.scale.setScalar(0.0001);
          standB.scale.setScalar(0.0001);
        }
      }
    }
  }

  // ───────────────────────────── contract ─────────────────────────────

  const rig: CharacterRig = {
    root,
    spec,
    carryAnchor,
    umbrellaAnchor,
    setAction(next: CharacterAction): void {
      if (next === action) return;
      // a little squash or stretch sells the change
      if (next === 'caught' || next === 'splat') squash.kick(-2.6);
      else if (next === 'fly') squash.kick(2.2);
      else if (next === 'dive') squash.kick(1.2);
      else if (next === 'celebrate') squash.kick(1.5);
      if (next !== 'run') runPhase = 0;
      action = next;
      actionT = 0;
    },
    setExpression(next: Expression): void {
      expression = next;
    },
    setFacing(dir: 1 | -1): void {
      facing = dir;
    },
    setTilt(radians: number): void {
      tilt = Number.isFinite(radians) ? radians : 0;
    },
    update(dtIn: number, ctx: MotionContext): void {
      if (disposed) return;
      const dt = Number.isFinite(dtIn) ? Math.max(0, Math.min(0.1, dtIn)) : 0;
      clock += dt;
      actionT += dt;
      // turn around the short way, quickly
      const wantYaw = facing === 1 ? 0 : PI;
      facingYaw += (wantYaw - facingYaw) * Math.min(1, dt * 16);

      neutral(tgt);
      let m: MouthName = 'smile';
      if (human) m = poseHuman(ctx, dt);
      else posePet(ctx, dt);
      m = faceTargets(m);
      if (m !== mouth) {
        mouth = m;
        mouthPop = 0;
      }

      // chase the target: body in ~90 ms, face in ~50 ms; a spin is followed exactly
      const kb = dt <= 0 ? 0 : 1 - Math.exp(-dt / 0.085);
      const kf = dt <= 0 ? 0 : 1 - Math.exp(-dt / 0.05);
      for (let i = 0; i < COUNT; i++) {
        const k = i >= FACE_FROM ? kf : kb;
        cur[i] = cur[i]! + (tgt[i]! - cur[i]!) * k;
      }
      cur[C.yaw] = tgt[C.yaw]!;

      applyPose(ctx, dt);
      if (dt > 0) applyChains(ctx, dt);
      applyAttachments();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      body.mesh.geometry.dispose();
      body.mesh.skeleton.dispose();
    },
  };

  // settle into the first pose so a freshly built character never shows its bind pose
  const still: MotionContext = { vx: 0, vy: 0 };
  for (let i = 0; i < 4; i++) rig.update(1 / 30, still);
  return rig;

  // (function declarations below are hoisted)
  function easeInOut(x: number): number {
    const k = Math.max(0, Math.min(1, x));
    return k * k * (3 - 2 * k);
  }
  function easeOutBack(x: number): number {
    const k = Math.max(0, Math.min(1, x)) - 1;
    return 1 + 2.2 * k * k * k + 1.2 * k * k;
  }
}

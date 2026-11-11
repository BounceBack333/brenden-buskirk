/**
 * Internal description of a built character body. The builders (human.ts, pet.ts) produce one
 * of these; rig.ts animates it without caring which species it is.
 */
import type * as THREE from 'three';
import type { Species } from '../kit/contracts';
import type { EyeRig, MouthSet } from './face';

/** A one-segment stretchy limb: pivot bone + tip (hand / foot / paw) bone. Rest pose hangs straight down. */
export interface LimbDesc {
  bone: number;
  tip: number;
  restLen: number;
}

export type ChainRole = 'earR' | 'earL' | 'tail' | 'hair' | 'sway' | 'pom' | 'tongue' | 'cloth' | 'stache' | 'whisk';

/** A spring-driven appendage. Bones have rest frames with local +y along the chain. */
export interface ChainDesc {
  role: ChainRole;
  bones: number[];
  stiff: number;
  damp: number;
  /** radians of bend per unit of "wind" */
  gain: number;
  /** max bend per bone, radians */
  limit: number;
  /** 0..1 how strongly it re-hangs toward world-down when the body rotates */
  hang: number;
}

export interface FaceDesc {
  eyes: [EyeRig, EyeRig];
  brows: [number, number];
  cheeks: [number, number];
  mouths?: MouthSet;
  /** pets */
  jaw?: number;
  tongue?: number;
  /** eyes hidden behind shades: skip blink/lid work visually (still animated, just unseen) */
  shades?: boolean;
}

export interface BodyDesc {
  species: Species;
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  restP: THREE.Vector3[];
  restQ: THREE.Quaternion[];
  /** skeleton root (model origin = ground under the body centre) */
  root: number;
  /** torso (people) / trunk (pets): parent of the limbs */
  body: number;
  head: number;
  /** [right arm | right front, left arm | left front, right leg | right hind, left leg | left hind]; right = +z */
  limbs: [LimbDesc, LimbDesc, LimbDesc, LimbDesc];
  face: FaceDesc;
  chains: ChainDesc[];
  /** bone holding all hair (squashes under a carried basket); -1 when none */
  hair: number;
  /** party-hat bone (tips back under a carried basket); -1 when none */
  hat: number;
  /** model-space y of the highest hair/hat vertex and of the head centre, bind pose */
  topY: number;
  headY: number;
  skullTopY: number;
  /** pets: detached bones for the telescoping stand + cradle (parented to the rig root) */
  stand: number;
  cradle: number;
  /** pets: model-space bind position of the stand socket on the harness, and of the umbrella ring */
  socket: THREE.Vector3;
  ring: THREE.Vector3;
  /** bind length of the stand geometry (socket → cradle) */
  standLen: number;
  /** model-space rest orientation of every bone */
  bindQ: THREE.Quaternion[];
  /** useful proportions (model space, bind pose) */
  dims: {
    /** leg pivot height */
    hipY: number;
    /** arm / front-leg pivot height */
    shoulderY: number;
    /** half distance between shoulders / hips (model z) */
    shoulderZ: number;
    hipZ: number;
    /** x of front and hind leg pivots (pets) */
    frontX: number;
    hindX: number;
    /** how far the trunk can drop before the belly (pets) / bottom (people) meets the ground */
    belly: number;
    seatY: number;
    /** pets: lowest point of the rump (for sitting) */
    rumpX: number;
    rumpY: number;
    headCX: number;
    headCY: number;
    headR: number;
    /** bottom of the head */
    chinY: number;
  };
  triangles: number;
}

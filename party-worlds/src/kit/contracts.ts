/**
 * Shared contracts between the game core and the three "kits":
 *   - characters  (src/characters)        recognisable people + pets
 *   - world props (src/worlds/birthday)   the Birthday Continental art kit
 *   - audio       (src/audio)             procedural sound + music
 *
 * RULES
 *  - Kits are presentation only. Nothing in a kit may influence gameplay state.
 *    The simulation (src/attractions/<name>/sim.ts) owns positions, collisions and outcomes.
 *  - World units: 1 unit = roughly the height of a tiny person. x = right, y = up, z = toward camera.
 *    Gameplay happens on the z = 0 plane; scenery may use depth.
 *  - Every character, whatever its species or cosmetic size, uses the SAME gameplay
 *    collider and the SAME canonical anchors below. Looks never buy reach.
 */
import type * as THREE from 'three';

// ───────────────────────────── Characters ─────────────────────────────

export type Species = 'human' | 'dog' | 'cat';

export type HairStyle = 'short' | 'curly' | 'long' | 'bun' | 'ponytail' | 'afro' | 'spiky' | 'bald' | 'buzz' | 'mohawk';
export type FacialHair = 'none' | 'beard' | 'mustache' | 'stubble';
export type Glasses = 'none' | 'round' | 'square' | 'shades';
export type Hat = 'none' | 'cap' | 'beanie' | 'party' | 'helmet' | 'cowboy';
/** Grown-ups are the default; a kid keeps the big head and small body. Cosmetic only. */
export type Age = 'adult' | 'kid';
export type Outfit = 'tee' | 'hoodie' | 'jacket' | 'suit' | 'tank';
/** A person-shaped driver who is not a person. Cosmetic only: same body, same collider. */
export type Creature = 'none' | 'bear' | 'fox' | 'rabbit' | 'frog' | 'robot' | 'alien' | 'luchador';
export type EarType = 'floppy' | 'pointy' | 'folded' | 'long';
export type CoatPattern = 'solid' | 'patches' | 'mask' | 'socks' | 'tabby' | 'tuxedo' | 'spots';
export type TailType = 'curl' | 'long' | 'stub' | 'plume';

/**
 * A character is described entirely by data. The same spec always builds the same character,
 * so it can be stored, sent over the network, and (later) produced by a photo-interpretation step.
 * Colours are '#rrggbb'. Numbers are 0..1 unless noted.
 */
export interface CharacterSpec {
  id: string;
  name: string;
  species: Species;
  /** slim → stocky. Cosmetic only. */
  build: number;
  /** short → tall. Cosmetic only; visual scale stays within ±10%. */
  stature: number;
  /** human: skin · pets: main coat */
  primary: string;
  /** human: hair · pets: second coat colour (patches, mask, socks, stripes) */
  secondary: string;
  /** human: top/shirt · pets: collar or bandana */
  accent: string;
  eyeColor: string;

  // human only
  hairStyle?: HairStyle;
  facialHair?: FacialHair;
  glasses?: Glasses;
  hat?: Hat;
  /** trousers / skirt colour */
  bottom?: string;
  age?: Age;
  outfit?: Outfit;
  creature?: Creature;

  /** paint of this driver's kart (any species). Defaults to `accent`. Cosmetic only. */
  kart?: string;

  // pets only
  earType?: EarType;
  /** short → long muzzle */
  snout?: number;
  pattern?: CoatPattern;
  tail?: TailType;
  /** sleek → fluffy */
  fluff?: number;
}

/** Body-level performance. The kit blends between these; it never teleports a pose. */
export type CharacterAction =
  | 'idle'        // standing, breathing, looking around
  | 'run'         // ground locomotion, speed from MotionContext.speed01, direction from facing
  | 'anticipate'  // crouched in the spoon; MotionContext.tension01 0..1 drives squash + nerves
  | 'fly'         // ballistic: streamlined along travel, limbs/ears/hair trailing
  | 'float'       // hanging under the open umbrella: dangling, swaying, paddling (pets)
  | 'tumble'      // out of control spin after a rim hit or miss (spin comes from setTilt)
  | 'splat'       // flat on the table after a miss, then a slow wobble up
  | 'caught'      // sitting in the basket: head pops over the rim, dizzy then delighted
  | 'dive'        // catcher lunge: fully stretched toward facing
  | 'slide'       // belly slide / recovery after a dive
  | 'celebrate'   // jump, arms/paws up, spin
  | 'sad'         // slump, short, never humiliating
  | 'wave'        // greeting for menus
  | 'drive';      // seated in a kart: hands or paws on the wheel, leaning with MotionContext.steer

export type Expression =
  | 'neutral' | 'happy' | 'nervous' | 'thrilled' | 'determined' | 'dizzy' | 'oops' | 'cheer';

export interface MotionContext {
  /** world-space velocity of the character, units/second */
  vx: number;
  vy: number;
  /** 0..1 run intensity for 'run' */
  speed01?: number;
  /** 0..1 spoon tension for 'anticipate' */
  tension01?: number;
  /** true while the character is holding the catch basket (carry pose overlays idle/run) */
  carrying?: boolean;
  /**
   * Where the basket's bottom-centre is in root space while carrying, when gameplay has moved
   * it off the default (a dive pushes it forward and down). Defaults to (0, RIG.CARRY_Y).
   */
  carryX?: number;
  carryY?: number;
  /** -1 … 1 steering while driving (leans the driver, turns the head and the wheel) */
  steer?: number;
  /** extra head turn in radians while driving (a glance at a rival alongside) */
  lookYaw?: number;
  /**
   * Where the steering wheel's rim is in the character's own root space while driving (x forward,
   * y up, z = half the distance between the hands). The kart's owner knows this; a bigger driver
   * sits in the same kart, so the numbers shrink as the driver's scale grows.
   */
  wheelX?: number;
  wheelY?: number;
  wheelZ?: number;
}

/** Canonical, species-independent numbers every rig must honour. */
export const RIG = {
  /** Height of the body centre above root origin (feet). The view rotates the body about this point. */
  CENTER_Y: 0.45,
  /** While `carrying`, the basket's bottom-centre sits exactly here in root space (z = 0). */
  CARRY_Y: 1.05,
  /** Nominal standing height of a human rig. Pets are lower but must still reach CARRY_Y when carrying. */
  HUMAN_HEIGHT: 1.0,
} as const;

export interface CharacterRig {
  /** Root origin = ground contact point under the body centre. Character faces +x by default. */
  readonly root: THREE.Group;
  readonly spec: CharacterSpec;
  /**
   * Where a carried basket attaches. In any action with `carrying: true` this MUST be at
   * local (0, RIG.CARRY_Y, 0) (pets wear a small back harness with a stand to reach it).
   */
  readonly carryAnchor: THREE.Object3D;
  /**
   * Where the cocktail umbrella handle attaches during 'float' (human: raised hand ·
   * pets: a ring on the back harness). The umbrella is parented here by the view.
   */
  readonly umbrellaAnchor: THREE.Object3D;
  setAction(action: CharacterAction): void;
  setExpression(expression: Expression): void;
  /** +1 faces +x, -1 faces -x. Turning is smoothed by the kit. */
  setFacing(dir: 1 | -1): void;
  /** Rotate the whole body about its centre (RIG.CENTER_Y) around the z axis, radians. */
  setTilt(radians: number): void;
  /** Advance animation + secondary motion (ears, hair, tail, cheeks). Call once per rendered frame. */
  update(dt: number, ctx: MotionContext): void;
  dispose(): void;
}

// ───────────────────────────── World props ─────────────────────────────

/** Anything with secondary motion implements this. */
export interface Animated {
  readonly root: THREE.Group;
  update(dt: number): void;
}

export interface SpoonCatapult extends Animated {
  /** Passenger parent. The view places the launcher rig here; it follows the bend. */
  readonly seat: THREE.Object3D;
  /**
   * Bend the spoon back. pull01 = 0 rest … 1 fully drawn. aimRad = launch elevation in radians
   * (0 = flat toward +x, PI/2 = straight up); the bowl visibly leans to match.
   */
  setPull(pull01: number, aimRad: number): void;
  /** Release: snap forward with overshoot and a decaying wobble. Purely cosmetic. */
  fire(power01: number): void;
}

export interface CatchBasket extends Animated {
  /** Squash and spring when something lands in it. strength 0..1 */
  thump(strength: number): void;
  /** Rattle when the rim is clipped. dir = -1 left rim, +1 right rim */
  rattle(dir: number): void;
}

export interface CocktailUmbrella extends Animated {
  /** 0 closed … 1 fully open. The kit animates the canopy with a little overshoot. */
  setOpen(open01: number): void;
  /** How worn the paper is, 0 fresh … 1 spent (canopy droops, colour fades). */
  setWear(wear01: number): void;
}

export interface JellyDome extends Animated {
  /** Wobble after an impact. strength 0..1, dirX = horizontal direction of the hit. */
  boing(strength: number, dirX: number): void;
}

export interface Balloon extends Animated {
  bump(dx: number, dy: number): void;
  /** Burst with a visible scrap; stays popped (the table remembers). */
  pop(): void;
  readonly popped: boolean;
}

export interface RingGate extends Animated {
  /** Flash + spin when a flyer threads it. */
  celebrate(): void;
  /** Dim when already collected this launch. */
  setCollected(collected: boolean): void;
}

export interface TableFan extends Animated {
  /** 0 off … 1 full */
  setStrength(strength01: number): void;
}

export interface WindStreamers extends Animated {
  /** Wind vector in units/s². Streamers and motes lean and drift to show it. */
  setWind(wx: number, wy: number): void;
}

export interface TableScene extends Animated {
  /** y of the table top (always 0) is the ground; this group holds cloth, backdrop room, set dressing. */
  readonly groundY: 0;
}

// ───────────────────────────── Audio ─────────────────────────────

export type SfxName =
  | 'ui_tap' | 'ui_back' | 'ui_confirm' | 'ui_toggle'
  | 'countdown' | 'go' | 'swap'
  | 'launch' | 'umbrella_open' | 'umbrella_close' | 'umbrella_spent'
  | 'boing' | 'balloon_bump' | 'balloon_pop' | 'ring'
  | 'rim' | 'catch' | 'catch_perfect' | 'miss_splat'
  | 'dive' | 'skid' | 'footstep'
  | 'score_tick' | 'star' | 'fanfare' | 'whoops'
  | 'boost' | 'boost_big' | 'charge' | 'bump' | 'kart_bump' | 'land' | 'lap' | 'final_lap' | 'plank'
  | 'gun' | 'gun_hit' | 'gun_empty' | 'explosion' | 'mine_drop' | 'crate' | 'repair' | 'weapons_hot' | 'ram' | 'respawn'
  | 'rocket' | 'shock' | 'shield_up' | 'shield_block' | 'overdrive';

export type MusicMode = 'off' | 'menu' | 'play' | 'tense' | 'win' | 'race' | 'combat';

export interface SfxOptions {
  /** 0..1 loudness/brightness scaling. Default 1. */
  intensity?: number;
  /** -1 left … +1 right */
  pan?: number;
  /** playback pitch multiplier, default 1 */
  pitch?: number;
}

export interface AudioKit {
  /** Must be called from a user gesture (iOS). Safe to call repeatedly. */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  setVolumes(v: { master: number; sfx: number; music: number }): void;
  play(name: SfxName, opts?: SfxOptions): void;
  /** Continuous spoon-stretch voice: 0..1 while pulling, null to stop. */
  setTension(tension01: number | null): void;
  /** Continuous air rush in flight: 0..1 by speed, null to stop. */
  setWind(speed01: number | null): void;
  /** Continuous flutter while the umbrella is open: 0..1, null to stop. */
  setFlutter(open01: number | null): void;
  /** Continuous kart engine: revs 0..1 (pitch) and load 0..1 (boost growl); null to stop. */
  setEngine(revs01: number | null, load01?: number): void;
  /** Continuous tyre scrub while sliding: 0..1, null to stop. */
  setSkid(amount01: number | null): void;
  music(mode: MusicMode): void;
  /** Pause everything when the page is hidden; resume after. */
  suspend(): void;
  resume(): void;
}

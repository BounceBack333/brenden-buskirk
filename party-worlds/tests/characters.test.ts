/**
 * The character kit builds drivers from data. Whatever the builder UI, a saved profile or (one
 * day) a photo step hands it, it must produce a sound rig: no exception, no NaN, within budget.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PRESET_CHARACTERS, SPEC_OPTIONS, buildCharacter, describeSpec, kartColorOf, randomSpec, sanitizeSpec } from '../src/characters';
import type { CharacterAction, CharacterSpec, MotionContext } from '../src/kit/contracts';

const ACTIONS: CharacterAction[] = ['idle', 'run', 'anticipate', 'fly', 'float', 'tumble', 'splat', 'caught', 'dive', 'slide', 'celebrate', 'sad', 'wave', 'drive'];
const TRI_BUDGET = 8000;

/** Build, animate briefly, and report anything that is not a finite number. */
function check(spec: CharacterSpec, actions: CharacterAction[] = ['drive']): { triangles: number; problems: string[] } {
  const problems: string[] = [];
  const rig = buildCharacter(spec);
  let triangles = 0;
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.array.length; i++) {
      if (!Number.isFinite(pos.array[i]!)) { problems.push(`${spec.id}: vertex ${i} is not finite`); break; }
    }
    triangles += m.geometry.index ? m.geometry.index.count / 3 : pos.count / 3;
  });
  const ctx: MotionContext = { vx: 12, vy: 1, speed01: 0.8, tension01: 0.5, steer: 0.6, lookYaw: 0.3, wheelX: 0.3, wheelY: 0.36, wheelZ: 0.09 };
  for (const a of actions) {
    rig.setAction(a);
    rig.setExpression(a === 'drive' ? 'determined' : 'cheer');
    for (let i = 0; i < 4; i++) rig.update(1 / 30, ctx);
    rig.root.updateMatrixWorld(true);
    rig.root.traverse((o) => {
      if (problems.length) return;
      for (const v of o.matrixWorld.elements) {
        if (!Number.isFinite(v)) { problems.push(`${spec.id}: ${o.name || o.type} has a non-finite transform in '${a}'`); return; }
      }
    });
  }
  rig.dispose();
  return { triangles, problems };
}

describe('the authored cast', () => {
  it('has unique ids and names, mostly grown-ups, and at most two kids', () => {
    const ids = new Set(PRESET_CHARACTERS.map((c) => c.id));
    const names = new Set(PRESET_CHARACTERS.map((c) => c.name));
    expect(ids.size).toBe(PRESET_CHARACTERS.length);
    expect(names.size).toBe(PRESET_CHARACTERS.length);
    const people = PRESET_CHARACTERS.filter((c) => c.species === 'human');
    expect(people.filter((c) => c.age === 'kid').length).toBeLessThanOrEqual(2);
    expect(people.filter((c) => c.age !== 'kid').length).toBeGreaterThanOrEqual(10);
    expect(people[0]!.age).not.toBe('kid'); // the default driver is a grown-up
    expect(PRESET_CHARACTERS.some((c) => c.name.toLowerCase() === 'bailey')).toBe(false); // no real pet without a reference
  });
  it('every member is already a valid spec', () => {
    for (const c of PRESET_CHARACTERS) {
      const clean = sanitizeSpec(c);
      expect(clean).toMatchObject(c); // nothing the cast says is changed or dropped
      expect(sanitizeSpec(clean)).toEqual(clean); // and cleaning is stable
    }
  });
  it('every member builds and performs every action without a bad number, inside the triangle budget', () => {
    for (const c of PRESET_CHARACTERS) {
      const r = check(c, ACTIONS);
      expect(r.problems).toEqual([]);
      expect(r.triangles, `${c.id} triangles`).toBeLessThanOrEqual(TRI_BUDGET);
      expect(r.triangles).toBeGreaterThan(500);
    }
  });
  it('every member has a description and a kart colour', () => {
    for (const c of PRESET_CHARACTERS) {
      expect(describeSpec(c).length).toBeGreaterThan(8);
      expect(kartColorOf(c)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

const base = PRESET_CHARACTERS.find((c) => c.id === 'rex')!;

describe('anything the builder can ask for', () => {
  it('every kind of driver wears every hat and outfit', () => {
    for (const creature of SPEC_OPTIONS.creature) {
      for (const hat of SPEC_OPTIONS.hat) {
        const outfit = SPEC_OPTIONS.outfit[(SPEC_OPTIONS.hat.indexOf(hat) + SPEC_OPTIONS.creature.indexOf(creature)) % SPEC_OPTIONS.outfit.length]!;
        const r = check(sanitizeSpec({ ...base, id: `t-${creature}-${hat}`, creature, hat, outfit }));
        expect(r.problems, `${creature} + ${hat} + ${outfit}`).toEqual([]);
        expect(r.triangles).toBeLessThanOrEqual(TRI_BUDGET);
      }
    }
  });
  it('every hairstyle goes with every hat, beard and pair of glasses, at both ages and both extremes of build', () => {
    let n = 0;
    for (const hairStyle of SPEC_OPTIONS.hairStyle) {
      for (const hat of SPEC_OPTIONS.hat) {
        const facialHair = SPEC_OPTIONS.facialHair[n % SPEC_OPTIONS.facialHair.length]!;
        const glasses = SPEC_OPTIONS.glasses[n % SPEC_OPTIONS.glasses.length]!;
        const age = SPEC_OPTIONS.age[n % 2]!;
        const r = check(sanitizeSpec({ ...base, id: `h-${n}`, hairStyle, hat, facialHair, glasses, age, build: n % 3 === 0 ? 0 : 1, stature: n % 2 }));
        expect(r.problems, `${hairStyle} + ${hat} + ${facialHair} + ${glasses} + ${age}`).toEqual([]);
        n++;
      }
    }
    expect(n).toBe(SPEC_OPTIONS.hairStyle.length * SPEC_OPTIONS.hat.length);
  });
  it('random people, dogs and cats all build', () => {
    for (const species of SPEC_OPTIONS.species) {
      for (let seed = 1; seed <= 12; seed++) {
        const spec = randomSpec(species, seed);
        expect(randomSpec(species, seed)).toEqual(spec); // the same seed is the same character
        expect(check(spec).problems).toEqual([]);
      }
    }
  });
});

describe('specs from outside', () => {
  it('rubbish becomes a valid default, never an exception', () => {
    for (const bad of [null, undefined, 42, 'nope', '{"species":"dragon"}', [], { species: 'human', build: 'huge', hat: 'crown', primary: 'red', age: 'ancient', creature: 'unicorn', outfit: 'cape', kart: 'fast' }]) {
      const s = sanitizeSpec(bad);
      expect(['human', 'dog', 'cat']).toContain(s.species);
      expect(s.build).toBeGreaterThanOrEqual(0);
      expect(s.build).toBeLessThanOrEqual(1);
      expect(s.primary).toMatch(/^#[0-9a-f]{6}$/);
      if (s.species === 'human') {
        expect(SPEC_OPTIONS.age).toContain(s.age);
        expect(SPEC_OPTIONS.creature).toContain(s.creature);
        expect(SPEC_OPTIONS.outfit).toContain(s.outfit);
        expect(SPEC_OPTIONS.hat).toContain(s.hat);
      }
      expect(check(s).problems).toEqual([]);
    }
  });
  it('a person saved before ages existed comes back as a grown-up', () => {
    const old = { id: 'old', name: 'Old Save', species: 'human', build: 0.5, stature: 0.5, primary: '#e2a878', secondary: '#46291c', accent: '#ff6b5e', eyeColor: '#4a2a18', hairStyle: 'short' };
    expect(sanitizeSpec(old).age).toBe('adult');
  });
  it('a grown-up and a kid are the same height on paper, and the grown-up has the smaller head', () => {
    const adult = buildCharacter(sanitizeSpec({ ...base, age: 'adult' }));
    const kid = buildCharacter(sanitizeSpec({ ...base, age: 'kid' }));
    const height = (r: typeof adult): number => new THREE.Box3().setFromObject(r.root, true).max.y;
    expect(height(adult)).toBeGreaterThan(0.85);
    expect(height(adult)).toBeLessThan(1.35);
    expect(height(kid)).toBeGreaterThan(0.85);
    expect(height(kid)).toBeLessThan(1.35);
    const headScale = (r: typeof adult): number => r.root.getObjectByName('head')!.getWorldScale(new THREE.Vector3()).x;
    expect(headScale(adult)).toBeLessThan(headScale(kid));
    adult.dispose();
    kid.dispose();
  });
});

/**
 * Character kit — public surface.
 *
 * A character is data (CharacterSpec). buildCharacter turns that data into a skinned,
 * animated rig that honours the CharacterRig contract for people, dogs and cats alike.
 */
import type { CharacterRig, CharacterSpec } from '../kit/contracts';
import { buildHuman } from './human';
import { buildPet } from './pet';
import { createRig } from './rig';
import { sanitizeSpec } from './spec';

export { PRESET_CHARACTERS } from './presets';
export { SPEC_OPTIONS, describeSpec, kartColorOf, randomSpec, sanitizeSpec } from './spec';
export type { FieldOption, Swatch } from './spec';

export function buildCharacter(input: CharacterSpec): CharacterRig {
  const spec = sanitizeSpec(input);
  const body = spec.species === 'human' ? buildHuman(spec) : buildPet(spec);
  return createRig(spec, body);
}

/**
 * Everything about CharacterSpec as DATA: allowed values, curated swatches, validation,
 * deterministic random generation and a friendly one-line description.
 * No three.js in here on purpose — this file is safe to run on a server.
 */
import type {
  CharacterSpec, CoatPattern, EarType, FacialHair, Glasses, HairStyle, Hat, Species, TailType,
} from '../kit/contracts';
import { clamp01, hashString, hexToHsl, hexToRgb, mulberry32, normalizeHex } from './util';

export interface Swatch {
  name: string;
  hex: string;
}

export interface FieldOption {
  key: keyof CharacterSpec;
  label: string;
  kind: 'text' | 'color' | 'enum' | 'range';
  /** kind 'color': curated swatches (any '#rrggbb' is still accepted by sanitizeSpec). */
  swatches?: readonly Swatch[];
  /** kind 'enum': allowed values, first is the default. */
  values?: readonly string[];
  /** kind 'range': always 0..1; labels for the two ends. */
  lowLabel?: string;
  highLabel?: string;
}

const HAIR_STYLES: readonly HairStyle[] = ['short', 'curly', 'long', 'bun', 'ponytail', 'afro', 'spiky', 'bald'];
const FACIAL_HAIR: readonly FacialHair[] = ['none', 'beard', 'mustache', 'stubble'];
const GLASSES: readonly Glasses[] = ['none', 'round', 'square', 'shades'];
const HATS: readonly Hat[] = ['none', 'cap', 'beanie', 'party'];
const EAR_TYPES: readonly EarType[] = ['floppy', 'pointy', 'folded', 'long'];
const PATTERNS: readonly CoatPattern[] = ['solid', 'patches', 'mask', 'socks', 'tabby', 'tuxedo', 'spots'];
const TAILS: readonly TailType[] = ['curl', 'long', 'stub', 'plume'];
const SPECIES: readonly Species[] = ['human', 'dog', 'cat'];

const SKIN: readonly Swatch[] = [
  { name: 'porcelain', hex: '#fbe0cc' },
  { name: 'peach', hex: '#f4c9a4' },
  { name: 'honey', hex: '#e2a878' },
  { name: 'almond', hex: '#c98d5e' },
  { name: 'chestnut', hex: '#a56b43' },
  { name: 'cocoa', hex: '#7c4a2d' },
  { name: 'espresso', hex: '#56341f' },
];

const HAIR: readonly Swatch[] = [
  { name: 'black', hex: '#221a1c' },
  { name: 'dark brown', hex: '#46291c' },
  { name: 'chestnut', hex: '#7b4526' },
  { name: 'ginger', hex: '#c8612a' },
  { name: 'golden', hex: '#d9a441' },
  { name: 'blond', hex: '#f0d58c' },
  { name: 'silver', hex: '#d7d3da' },
  { name: 'white', hex: '#f6f1e9' },
  { name: 'berry pink', hex: '#e2457b' },
  { name: 'teal', hex: '#1fb5a8' },
  { name: 'grape', hex: '#7a5cff' },
];

const CLOTHES: readonly Swatch[] = [
  { name: 'coral', hex: '#ff6b5e' },
  { name: 'sunflower', hex: '#ffb52e' },
  { name: 'butter', hex: '#ffd966' },
  { name: 'mint', hex: '#8fe3c0' },
  { name: 'teal', hex: '#1fb5a8' },
  { name: 'sky blue', hex: '#55b6f5' },
  { name: 'blue', hex: '#3d6fd1' },
  { name: 'grape', hex: '#7a5cff' },
  { name: 'berry pink', hex: '#e2457b' },
  { name: 'pink', hex: '#ff9ec4' },
  { name: 'green', hex: '#5fa34a' },
  { name: 'cream', hex: '#f6ead2' },
  { name: 'navy', hex: '#2f3b5c' },
  { name: 'cocoa', hex: '#6b4630' },
];

const HUMAN_EYES: readonly Swatch[] = [
  { name: 'dark brown', hex: '#4a2a18' },
  { name: 'hazel', hex: '#8a5a2b' },
  { name: 'green', hex: '#3f8a52' },
  { name: 'blue', hex: '#3c7fc4' },
  { name: 'grey', hex: '#6f7f8f' },
];

const DOG_COAT: readonly Swatch[] = [
  { name: 'tan', hex: '#d9a05b' },
  { name: 'golden', hex: '#e9b550' },
  { name: 'cream', hex: '#f3e2c0' },
  { name: 'white', hex: '#fbf6ee' },
  { name: 'chocolate', hex: '#7b4a2a' },
  { name: 'ginger', hex: '#c8703a' },
  { name: 'charcoal', hex: '#454653' },
  { name: 'black', hex: '#27242b' },
  { name: 'grey', hex: '#9a9fb0' },
];

const CAT_COAT: readonly Swatch[] = [
  { name: 'ginger', hex: '#e8943a' },
  { name: 'black', hex: '#2b2a33' },
  { name: 'grey', hex: '#8f93a3' },
  { name: 'cream', hex: '#f1e3c8' },
  { name: 'white', hex: '#fbf6ee' },
  { name: 'chocolate', hex: '#6f452c' },
  { name: 'sandy', hex: '#d8b98a' },
  { name: 'blue-grey', hex: '#7d8798' },
];

const SECOND_COAT: readonly Swatch[] = [
  { name: 'white', hex: '#fbf6ee' },
  { name: 'cream', hex: '#f3e2c0' },
  { name: 'tan', hex: '#e0a45c' },
  { name: 'ginger', hex: '#b55f1c' },
  { name: 'chocolate', hex: '#6b4028' },
  { name: 'charcoal', hex: '#3a3a44' },
  { name: 'black', hex: '#231f26' },
  { name: 'silver', hex: '#c9ccd6' },
];

const COLLARS: readonly Swatch[] = [
  { name: 'teal', hex: '#1fb5a8' },
  { name: 'coral', hex: '#ff6b5e' },
  { name: 'berry pink', hex: '#e2457b' },
  { name: 'grape', hex: '#7a5cff' },
  { name: 'sunflower', hex: '#ffb52e' },
  { name: 'sky blue', hex: '#55b6f5' },
  { name: 'red', hex: '#e23b3b' },
  { name: 'green', hex: '#5fa34a' },
];

const DOG_EYES: readonly Swatch[] = [
  { name: 'dark brown', hex: '#3d2415' },
  { name: 'amber', hex: '#a8691f' },
  { name: 'hazel', hex: '#7a5a2a' },
  { name: 'ice blue', hex: '#7fc4e8' },
];

const CAT_EYES: readonly Swatch[] = [
  { name: 'green', hex: '#6fae3a' },
  { name: 'yellow', hex: '#e8c63a' },
  { name: 'amber', hex: '#f0a030' },
  { name: 'blue', hex: '#58b0e6' },
  { name: 'copper', hex: '#c8742a' },
];

/**
 * Allowed enum values and curated swatches, for a builder UI. Every list starts with its default.
 * `fields[species]` is the full, ordered form for that species.
 */
export const SPEC_OPTIONS = {
  species: SPECIES,
  hairStyle: HAIR_STYLES,
  facialHair: FACIAL_HAIR,
  glasses: GLASSES,
  hat: HATS,
  earType: EAR_TYPES,
  pattern: PATTERNS,
  tail: TAILS,
  /** Patterns that suit each pet best; every CoatPattern is still accepted for both. */
  patternsFor: {
    dog: ['solid', 'patches', 'mask', 'socks', 'spots', 'tuxedo', 'tabby'] as readonly CoatPattern[],
    cat: ['tabby', 'tuxedo', 'solid', 'patches', 'socks', 'mask', 'spots'] as readonly CoatPattern[],
  },
  colors: {
    skin: SKIN,
    hair: HAIR,
    top: CLOTHES,
    bottom: CLOTHES,
    humanEyes: HUMAN_EYES,
    dogCoat: DOG_COAT,
    catCoat: CAT_COAT,
    secondCoat: SECOND_COAT,
    collar: COLLARS,
    dogEyes: DOG_EYES,
    catEyes: CAT_EYES,
  },
  limits: { nameMaxLength: 18, idMaxLength: 40 },
  fields: {
    human: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'primary', label: 'Skin', kind: 'color', swatches: SKIN },
      { key: 'hairStyle', label: 'Hair', kind: 'enum', values: HAIR_STYLES },
      { key: 'secondary', label: 'Hair colour', kind: 'color', swatches: HAIR },
      { key: 'eyeColor', label: 'Eyes', kind: 'color', swatches: HUMAN_EYES },
      { key: 'facialHair', label: 'Facial hair', kind: 'enum', values: FACIAL_HAIR },
      { key: 'glasses', label: 'Glasses', kind: 'enum', values: GLASSES },
      { key: 'hat', label: 'Hat', kind: 'enum', values: HATS },
      { key: 'accent', label: 'Top', kind: 'color', swatches: CLOTHES },
      { key: 'bottom', label: 'Bottoms', kind: 'color', swatches: CLOTHES },
      { key: 'build', label: 'Build', kind: 'range', lowLabel: 'slim', highLabel: 'stocky' },
      { key: 'stature', label: 'Height', kind: 'range', lowLabel: 'little', highLabel: 'tall' },
    ],
    dog: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'primary', label: 'Coat', kind: 'color', swatches: DOG_COAT },
      { key: 'pattern', label: 'Markings', kind: 'enum', values: ['solid', 'patches', 'mask', 'socks', 'spots', 'tuxedo', 'tabby'] },
      { key: 'secondary', label: 'Marking colour', kind: 'color', swatches: SECOND_COAT },
      { key: 'earType', label: 'Ears', kind: 'enum', values: EAR_TYPES },
      { key: 'tail', label: 'Tail', kind: 'enum', values: TAILS },
      { key: 'snout', label: 'Muzzle', kind: 'range', lowLabel: 'short', highLabel: 'long' },
      { key: 'fluff', label: 'Coat length', kind: 'range', lowLabel: 'sleek', highLabel: 'fluffy' },
      { key: 'eyeColor', label: 'Eyes', kind: 'color', swatches: DOG_EYES },
      { key: 'accent', label: 'Bandana', kind: 'color', swatches: COLLARS },
      { key: 'build', label: 'Build', kind: 'range', lowLabel: 'slim', highLabel: 'stocky' },
      { key: 'stature', label: 'Legs', kind: 'range', lowLabel: 'short', highLabel: 'long' },
    ],
    cat: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'primary', label: 'Coat', kind: 'color', swatches: CAT_COAT },
      { key: 'pattern', label: 'Markings', kind: 'enum', values: ['tabby', 'tuxedo', 'solid', 'patches', 'socks', 'mask', 'spots'] },
      { key: 'secondary', label: 'Marking colour', kind: 'color', swatches: SECOND_COAT },
      { key: 'earType', label: 'Ears', kind: 'enum', values: ['pointy', 'folded', 'floppy', 'long'] },
      { key: 'tail', label: 'Tail', kind: 'enum', values: ['long', 'plume', 'curl', 'stub'] },
      { key: 'snout', label: 'Muzzle', kind: 'range', lowLabel: 'flat', highLabel: 'long' },
      { key: 'fluff', label: 'Coat length', kind: 'range', lowLabel: 'sleek', highLabel: 'fluffy' },
      { key: 'eyeColor', label: 'Eyes', kind: 'color', swatches: CAT_EYES },
      { key: 'accent', label: 'Collar', kind: 'color', swatches: COLLARS },
      { key: 'build', label: 'Build', kind: 'range', lowLabel: 'slim', highLabel: 'stocky' },
      { key: 'stature', label: 'Legs', kind: 'range', lowLabel: 'short', highLabel: 'long' },
    ],
  } as Record<Species, readonly FieldOption[]>,
} as const;

// ───────────────────────────── defaults ─────────────────────────────

const DEFAULTS: Record<Species, CharacterSpec> = {
  human: {
    id: 'guest', name: 'Guest', species: 'human', build: 0.5, stature: 0.5,
    primary: '#e2a878', secondary: '#46291c', accent: '#ff6b5e', eyeColor: '#4a2a18',
    hairStyle: 'short', facialHair: 'none', glasses: 'none', hat: 'none', bottom: '#2f3b5c',
  },
  dog: {
    id: 'pup', name: 'Pup', species: 'dog', build: 0.5, stature: 0.5,
    primary: '#d9a05b', secondary: '#fbf6ee', accent: '#1fb5a8', eyeColor: '#3d2415',
    earType: 'floppy', snout: 0.5, pattern: 'solid', tail: 'curl', fluff: 0.4,
  },
  cat: {
    id: 'kitty', name: 'Kitty', species: 'cat', build: 0.4, stature: 0.5,
    primary: '#e8943a', secondary: '#b55f1c', accent: '#1fb5a8', eyeColor: '#6fae3a',
    earType: 'pointy', snout: 0.15, pattern: 'tabby', tail: 'long', fluff: 0.3,
  },
};

function num01(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? clamp01(n) : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function colour(v: unknown, fallback: string): string {
  return normalizeHex(v) ?? fallback;
}

function cleanName(v: unknown, fallback: string, max: number): string {
  if (typeof v !== 'string') return fallback;
  // Drop control characters and markup brackets, collapse whitespace.
  let s = '';
  for (const ch of v.slice(0, 200)) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c === 127 || ch === '<' || ch === '>' || (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e)) continue;
    s += ch;
  }
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return fallback;
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

function cleanId(v: unknown, fallback: string, max: number): string {
  if (typeof v !== 'string' && typeof v !== 'number') return fallback;
  const s = String(v).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
  return s || fallback;
}

/**
 * Turn ANY input (storage, network, hand-edited JSON) into a valid CharacterSpec.
 * Unknown fields are dropped, numbers are clamped to 0..1, colours normalised to '#rrggbb',
 * enums fall back to the species default. Never throws.
 */
export function sanitizeSpec(input: unknown): CharacterSpec {
  try {
    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch { input = null; }
    }
    const o = (input !== null && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const species = oneOf(o.species, SPECIES, 'human');
    const d = DEFAULTS[species];
    const name = cleanName(o.name, d.name, SPEC_OPTIONS.limits.nameMaxLength);
    const autoId = `${species}-${hashString(name + '|' + String(o.primary ?? '') + '|' + String(o.secondary ?? '')).toString(36)}`;
    const out: CharacterSpec = {
      id: cleanId(o.id, autoId, SPEC_OPTIONS.limits.idMaxLength),
      name,
      species,
      build: num01(o.build, d.build),
      stature: num01(o.stature, d.stature),
      primary: colour(o.primary, d.primary),
      secondary: colour(o.secondary, d.secondary),
      accent: colour(o.accent, d.accent),
      eyeColor: colour(o.eyeColor, d.eyeColor),
    };
    if (species === 'human') {
      out.hairStyle = oneOf(o.hairStyle, HAIR_STYLES, d.hairStyle ?? 'short');
      out.facialHair = oneOf(o.facialHair, FACIAL_HAIR, 'none');
      out.glasses = oneOf(o.glasses, GLASSES, 'none');
      out.hat = oneOf(o.hat, HATS, 'none');
      out.bottom = colour(o.bottom, d.bottom ?? '#2f3b5c');
    } else {
      out.earType = oneOf(o.earType, EAR_TYPES, d.earType ?? 'floppy');
      out.snout = num01(o.snout, d.snout ?? 0.5);
      out.pattern = oneOf(o.pattern, PATTERNS, d.pattern ?? 'solid');
      out.tail = oneOf(o.tail, TAILS, d.tail ?? 'long');
      out.fluff = num01(o.fluff, d.fluff ?? 0.4);
    }
    return out;
  } catch {
    return { ...DEFAULTS.human };
  }
}

// ───────────────────────────── random ─────────────────────────────

const HUMAN_NAMES = ['Mika', 'Sol', 'Wren', 'Ansel', 'Noor', 'Kit', 'Emre', 'Tavi', 'Lumi', 'Bram', 'Odalys', 'Fenn', 'Suki', 'Ravi', 'Greta', 'Milo'];
const DOG_NAMES = ['Pickle', 'Biscuit', 'Tater', 'Figgy', 'Dumpling', 'Sprout', 'Pretzel', 'Nugget', 'Crumpet', 'Bramble', 'Dot', 'Radish'];
const CAT_NAMES = ['Pudding', 'Clementine', 'Sable', 'Miso', 'Tofu', 'Pesto', 'Bean', 'Fig', 'Nimbus', 'Olive', 'Pip-Pip', 'Velvet'];

/** A plausible character for the species. The same (species, seed) always gives the same spec. */
export function randomSpec(species: Species, seed: number): CharacterSpec {
  const sp = oneOf(species, SPECIES, 'human');
  const s = Number.isFinite(seed) ? Math.floor(seed) : 0;
  const rnd = mulberry32((s * 2654435761 + SPECIES.indexOf(sp) * 97 + 12345) >>> 0);
  const pick = <T>(list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const id = `${sp}-r${(s >>> 0).toString(36)}`;
  if (sp === 'human') {
    const natural = HAIR.slice(0, 8);
    const top = pick(CLOTHES);
    let bottom = pick(CLOTHES);
    if (bottom.hex === top.hex) bottom = CLOTHES[(CLOTHES.indexOf(top) + 5) % CLOTHES.length];
    return sanitizeSpec({
      id, name: pick(HUMAN_NAMES), species: sp,
      build: r2(rnd()), stature: r2(rnd()),
      primary: pick(SKIN).hex,
      secondary: (rnd() < 0.88 ? pick(natural) : pick(HAIR)).hex,
      accent: top.hex, bottom: bottom.hex,
      eyeColor: pick(HUMAN_EYES).hex,
      hairStyle: pick(HAIR_STYLES),
      facialHair: rnd() < 0.7 ? 'none' : pick(FACIAL_HAIR),
      glasses: rnd() < 0.65 ? 'none' : pick(GLASSES),
      hat: rnd() < 0.7 ? 'none' : pick(HATS),
    });
  }
  const dog = sp === 'dog';
  const coat = pick(dog ? DOG_COAT : CAT_COAT);
  let second = pick(SECOND_COAT);
  if (second.hex === coat.hex || second.name === coat.name) second = SECOND_COAT[(SECOND_COAT.indexOf(second) + 3) % SECOND_COAT.length];
  return sanitizeSpec({
    id, name: pick(dog ? DOG_NAMES : CAT_NAMES), species: sp,
    build: r2(rnd()), stature: r2(rnd()),
    primary: coat.hex, secondary: second.hex,
    accent: pick(COLLARS).hex,
    eyeColor: pick(dog ? DOG_EYES : CAT_EYES).hex,
    earType: dog ? pick(EAR_TYPES) : rnd() < 0.8 ? 'pointy' : 'folded',
    snout: r2(dog ? 0.2 + rnd() * 0.8 : rnd() * 0.35),
    pattern: pick(dog ? SPEC_OPTIONS.patternsFor.dog.slice(0, 5) : SPEC_OPTIONS.patternsFor.cat.slice(0, 5)),
    tail: dog ? pick(TAILS) : rnd() < 0.65 ? 'long' : rnd() < 0.7 ? 'plume' : pick(TAILS),
    fluff: r2(rnd()),
  });
}

// ───────────────────────────── description ─────────────────────────────

const NATURAL_NAMES: readonly Swatch[] = [
  { name: 'black', hex: '#221c20' },
  { name: 'charcoal', hex: '#454653' },
  { name: 'dark brown', hex: '#46291c' },
  { name: 'chocolate', hex: '#7b4a2a' },
  { name: 'chestnut', hex: '#8e4f2c' },
  { name: 'ginger', hex: '#c8652c' },
  { name: 'ginger', hex: '#e8943a' },
  { name: 'golden', hex: '#dba842' },
  { name: 'tan', hex: '#d9a05b' },
  { name: 'sandy', hex: '#d8b98a' },
  { name: 'blond', hex: '#f0d58c' },
  { name: 'cream', hex: '#f3e2c0' },
  { name: 'white', hex: '#fbf6ee' },
  { name: 'silver', hex: '#d7d3da' },
  { name: 'grey', hex: '#9a9fb0' },
  { name: 'grey', hex: '#7d8798' },
];

const GENERAL_NAMES: readonly Swatch[] = [
  ...CLOTHES,
  { name: 'red', hex: '#e23b3b' },
  { name: 'orange', hex: '#ff8a3d' },
  { name: 'yellow', hex: '#ffe04a' },
  { name: 'lime', hex: '#b5d94a' },
  { name: 'olive', hex: '#7d8f4e' },
  { name: 'mustard', hex: '#d9a035' },
  { name: 'purple', hex: '#8e44c8' },
  { name: 'lilac', hex: '#c4b0f0' },
  { name: 'white', hex: '#fbf8f2' },
  { name: 'grey', hex: '#a0a4ad' },
  { name: 'charcoal', hex: '#3d3d47' },
  { name: 'black', hex: '#1f1c22' },
  { name: 'brown', hex: '#7b4a2a' },
  { name: 'tan', hex: '#d9a05b' },
];

function nearest(hex: string, table: readonly Swatch[]): { name: string; dist: number } {
  const [r, g, b] = hexToRgb(hex);
  let best = table[0].name;
  let bestD = Infinity;
  for (const s of table) {
    const [R, G, B] = hexToRgb(s.hex);
    const rm = (r + R) / 2;
    const dr = r - R;
    const dg = g - G;
    const db = b - B;
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) {
      bestD = d;
      best = s.name;
    }
  }
  return { name: best, dist: Math.sqrt(bestD) };
}

/** Everyday name for a clothing / accessory colour. */
export function colourName(hex: string): string {
  return nearest(normalizeHex(hex) ?? '#888888', GENERAL_NAMES).name;
}

/** Everyday name for a hair or coat colour (falls back to the general names for dyed colours). */
export function naturalColourName(hex: string): string {
  const h = normalizeHex(hex) ?? '#888888';
  const nat = nearest(h, NATURAL_NAMES);
  const [, sat, light] = hexToHsl(h);
  if (nat.dist > 110 || (sat > 0.6 && light > 0.3 && light < 0.8 && nat.dist > 70)) return nearest(h, GENERAL_NAMES).name;
  return nat.name;
}

function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function article(phrase: string): string {
  return (/^[aeiou]/i.test(phrase) ? 'an ' : 'a ') + phrase;
}

/**
 * One friendly line, e.g. "Scruffy tan dog with floppy ears and a teal bandana".
 * Accepts any input (it is sanitised first).
 */
export function describeSpec(spec: CharacterSpec): string {
  const s = sanitizeSpec(spec);
  if (s.species === 'human') {
    const lead: string[] = [];
    if (s.stature < 0.2) lead.push('little');
    else if (s.stature > 0.82) lead.push('tall');
    if (s.build > 0.78) lead.push('stocky');
    else if (s.build < 0.18) lead.push('slim');
    const hair = naturalColourName(s.secondary);
    const bits: string[] = [];
    switch (s.hairStyle) {
      case 'bald': lead.push('bald'); break;
      case 'short': bits.push(`short ${hair} hair`); break;
      case 'curly': bits.push(`curly ${hair} hair`); break;
      case 'long': bits.push(`long ${hair} hair`); break;
      case 'bun': bits.push(`${hair} hair in a bun`); break;
      case 'ponytail': bits.push(`${article(hair)} ponytail`); break;
      case 'afro': bits.push(`${article(hair)} afro`); break;
      case 'spiky': bits.push(`spiky ${hair} hair`); break;
      default: break;
    }
    if (s.facialHair === 'beard') bits.push(`${article(hair)} beard`);
    else if (s.facialHair === 'mustache') bits.push(`${article(hair)} moustache`);
    else if (s.facialHair === 'stubble') bits.push('stubble');
    if (s.glasses === 'round') bits.push('round glasses');
    else if (s.glasses === 'square') bits.push('square glasses');
    else if (s.glasses === 'shades') bits.push('shades');
    if (s.hat === 'cap') bits.push('a cap');
    else if (s.hat === 'beanie') bits.push('a beanie');
    else if (s.hat === 'party') bits.push('a party hat');
    bits.push(`${article(colourName(s.accent))} top`);
    return capitalise(`${[...lead, 'person'].join(' ')} with ${joinList(bits)}`);
  }
  const fluff = s.fluff ?? 0.4;
  const lead: string[] = [];
  if (fluff > 0.78) lead.push('fluffy');
  else if (fluff >= 0.5) lead.push('scruffy');
  else if (fluff < 0.18) lead.push('sleek');
  if (s.stature < 0.15) lead.push('low-slung');
  lead.push(naturalColourName(s.primary));
  const second = naturalColourName(s.secondary);
  const bits: string[] = [];
  switch (s.pattern) {
    case 'tabby': lead.push('tabby'); break;
    case 'tuxedo': lead.push('tuxedo'); break;
    case 'spots': lead.push('spotted'); break;
    case 'patches': bits.push(`${second} patches`); break;
    case 'mask': bits.push(`${article(second)} mask`); break;
    case 'socks': bits.push(`${second} socks`); break;
    default: break;
  }
  bits.push(`${s.earType ?? 'floppy'} ears`);
  if (bits.length < 2) {
    if (s.tail === 'plume') bits.push('a plume tail');
    else if (s.tail === 'curl') bits.push('a curly tail');
  }
  bits.push(`${article(colourName(s.accent))} ${s.species === 'dog' ? 'bandana' : 'collar'}`);
  return capitalise(`${lead.join(' ')} ${s.species} with ${joinList(bits)}`);
}

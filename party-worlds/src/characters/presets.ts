/**
 * The authored cast. Every name and look is invented for this game.
 *
 * Grown-ups first: people you might actually know, and a few drivers who are not people at all.
 * Then two kids, then dogs and cats. Each one is meant to be recognisable from silhouette and
 * colour blocking alone (see docs/ART_BIBLE.md, "Recognition").
 */
import type { CharacterSpec } from '../kit/contracts';

export const PRESET_CHARACTERS: CharacterSpec[] = [
  // ── grown-ups ──
  {
    // stubble, shades, leather jacket: thinks he is faster than he is
    id: 'rex', kart: '#e23b3b', name: 'Rex', species: 'human', age: 'adult', build: 0.5, stature: 0.7,
    primary: '#d9a273', secondary: '#2a1d18', accent: '#2b2a33', eyeColor: '#4a2a18',
    hairStyle: 'short', facialHair: 'stubble', glasses: 'shades', hat: 'none', outfit: 'jacket', bottom: '#3d4f7a',
  },
  {
    // silver bun, cat-eye glasses, and she will absolutely put you in the flowerbed
    id: 'dolores', kart: '#ff3d8b', name: 'Dolores', species: 'human', age: 'adult', build: 0.55, stature: 0.25,
    primary: '#e8b998', secondary: '#dcd8e0', accent: '#b0346e', eyeColor: '#5a6f86',
    hairStyle: 'bun', facialHair: 'none', glasses: 'square', hat: 'none', outfit: 'jacket', bottom: '#3b3550',
  },
  {
    id: 'zadie', name: 'Zadie', species: 'human', age: 'adult', build: 0.4, stature: 0.62,
    primary: '#7c4a2d', secondary: '#241a1a', accent: '#ff6b5e', eyeColor: '#3a2014',
    hairStyle: 'afro', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'tank', bottom: '#1f8f8a',
  },
  {
    // beard, cap, the size of a fridge
    id: 'mike', name: 'Big Mike', species: 'human', age: 'adult', build: 1.0, stature: 0.9,
    primary: '#f0c4a4', secondary: '#8a4f24', accent: '#c8452e', eyeColor: '#3c7fc4',
    hairStyle: 'short', facialHair: 'beard', glasses: 'none', hat: 'cap', outfit: 'tee', bottom: '#3a4a38',
  },
  {
    id: 'tomo', kart: '#7a5cff', name: 'Tomo', species: 'human', age: 'adult', build: 0.2, stature: 0.8,
    primary: '#f0c79a', secondary: '#1f1a20', accent: '#7a5cff', eyeColor: '#3a2416',
    hairStyle: 'short', facialHair: 'none', glasses: 'square', hat: 'none', outfit: 'hoodie', bottom: '#2f3b5c',
  },
  {
    id: 'rosa', kart: '#f2f0ea', name: 'Rosa', species: 'human', age: 'adult', build: 0.35, stature: 0.5,
    primary: '#e0aa7c', secondary: '#3b2218', accent: '#f2f0ea', eyeColor: '#8a5a2b',
    hairStyle: 'long', facialHair: 'none', glasses: 'none', hat: 'helmet', outfit: 'jacket', bottom: '#c0392b',
  },
  {
    // walrus moustache, cowboy hat, has opinions about racing lines
    id: 'gus', name: 'Gus', species: 'human', age: 'adult', build: 0.85, stature: 0.45,
    primary: '#f2c3a2', secondary: '#f3eee6', accent: '#5f8f52', eyeColor: '#6f7f8f',
    hairStyle: 'bald', facialHair: 'mustache', glasses: 'round', hat: 'cowboy', outfit: 'tee', bottom: '#8a6a44',
  },
  {
    id: 'dex', name: 'Dex', species: 'human', age: 'adult', build: 0.55, stature: 0.75,
    primary: '#a56b43', secondary: '#1f1a1c', accent: '#8fe3c0', eyeColor: '#3a2014',
    hairStyle: 'buzz', facialHair: 'stubble', glasses: 'none', hat: 'beanie', outfit: 'hoodie', bottom: '#ff7a3d',
  },
  {
    id: 'vik', kart: '#ff3d8b', name: 'Vik', species: 'human', age: 'adult', build: 0.3, stature: 0.55,
    primary: '#c98d5e', secondary: '#e2457b', accent: '#1c1b26', eyeColor: '#3a2014',
    hairStyle: 'mohawk', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'tank', bottom: '#2b2a33',
  },
  {
    // bald, round glasses, came straight from the office
    id: 'otis', kart: '#ffb52e', name: 'Otis', species: 'human', age: 'adult', build: 0.7, stature: 0.6,
    primary: '#6b4028', secondary: '#1f1a1c', accent: '#3b4a6b', eyeColor: '#3a2014',
    hairStyle: 'bald', facialHair: 'beard', glasses: 'round', hat: 'none', outfit: 'suit', bottom: '#2c3550',
  },

  // ── not people ──
  {
    id: 'trueno', name: 'El Trueno', species: 'human', age: 'adult', creature: 'luchador', build: 0.9, stature: 0.5,
    primary: '#c98d5e', secondary: '#c8452e', accent: '#ffb52e', eyeColor: '#3a2014',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'tank', bottom: '#c8452e',
  },
  {
    id: 'bruno', kart: '#ff7a3d', name: 'Bruno', species: 'human', age: 'adult', creature: 'bear', build: 0.95, stature: 0.85,
    primary: '#7b4a2a', secondary: '#e0b98a', accent: '#c8452e', eyeColor: '#2a1a12',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'jacket', bottom: '#2f3b5c',
  },
  {
    id: 'roxy', name: 'Roxy', species: 'human', age: 'adult', creature: 'fox', build: 0.25, stature: 0.5,
    primary: '#e2702a', secondary: '#fbf3e6', accent: '#1fb5a8', eyeColor: '#c98a1c',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'hoodie', bottom: '#2b2a33',
  },
  {
    id: 'clover', name: 'Clover', species: 'human', age: 'adult', creature: 'rabbit', build: 0.4, stature: 0.3,
    primary: '#e9e3da', secondary: '#fbf8f2', accent: '#7a5cff', eyeColor: '#7a2f3f',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'suit', bottom: '#2b2a33',
  },
  {
    id: 'ribbit', name: 'Señor Ribbit', species: 'human', age: 'adult', creature: 'frog', build: 0.75, stature: 0.2,
    primary: '#6fae3a', secondary: '#d9e8a0', accent: '#ffb52e', eyeColor: '#c98a1c',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'cowboy', outfit: 'tee', bottom: '#6b4630',
  },
  {
    id: 'unit7', name: 'Unit 7', species: 'human', age: 'adult', creature: 'robot', build: 0.6, stature: 0.6,
    primary: '#aab2c2', secondary: '#6a7286', accent: '#ff6b5e', eyeColor: '#58e6ff',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'tee', bottom: '#5a6274',
  },
  {
    id: 'zorp', kart: '#7a5cff', name: 'Zorp', species: 'human', age: 'adult', creature: 'alien', build: 0.1, stature: 0.4,
    primary: '#8fd6a0', secondary: '#5fa37a', accent: '#b8c0d0', eyeColor: '#1a1030',
    hairStyle: 'bald', facialHair: 'none', glasses: 'none', hat: 'none', outfit: 'jacket', bottom: '#6a7286',
  },

  // ── the two kids ──
  {
    id: 'pip', name: 'Pip', species: 'human', age: 'kid', build: 0.3, stature: 0.0,
    primary: '#f6cfa8', secondary: '#d2622a', accent: '#ffb52e', eyeColor: '#3f8a52',
    hairStyle: 'spiky', facialHair: 'none', glasses: 'none', hat: 'none', bottom: '#3d6fd1',
  },
  {
    id: 'juno', name: 'Juno', species: 'human', age: 'kid', build: 0.3, stature: 0.3,
    primary: '#e2a878', secondary: '#6b3a1e', accent: '#ff9ec4', eyeColor: '#4a2a18',
    hairStyle: 'ponytail', facialHair: 'none', glasses: 'none', hat: 'helmet', bottom: '#3d6fd1',
  },

  // ── dogs: four different silhouettes ──
  {
    // floppy-eared scruffy terrier mix
    id: 'waffles', name: 'Waffles', species: 'dog', build: 0.45, stature: 0.55,
    primary: '#d9a05b', secondary: '#f3e2c0', accent: '#1fb5a8', eyeColor: '#3d2415',
    earType: 'floppy', snout: 0.5, pattern: 'solid', tail: 'stub', fluff: 0.62,
  },
  {
    // pointy ears, white face mask, curled tail
    id: 'pepper', name: 'Pepper', species: 'dog', build: 0.5, stature: 0.8,
    primary: '#4a4d5c', secondary: '#f6f3ec', accent: '#e23b3b', eyeColor: '#7fc4e8',
    earType: 'pointy', snout: 0.62, pattern: 'mask', tail: 'curl', fluff: 0.35,
  },
  {
    // long ears, long nose, very short legs
    id: 'noodle', name: 'Noodle', species: 'dog', build: 0.7, stature: 0.0,
    primary: '#7b4a2a', secondary: '#e0a45c', accent: '#ffb52e', eyeColor: '#3d2415',
    earType: 'long', snout: 0.95, pattern: 'socks', tail: 'long', fluff: 0.1,
  },
  {
    // a cloud with a plume tail
    id: 'mochi', name: 'Mochi', species: 'dog', build: 0.6, stature: 0.3,
    primary: '#fbf6ee', secondary: '#f3d9b8', accent: '#e2457b', eyeColor: '#3d2415',
    earType: 'folded', snout: 0.2, pattern: 'solid', tail: 'plume', fluff: 1.0,
  },

  // ── cats ──
  {
    id: 'marmalade', name: 'Marmalade', species: 'cat', build: 0.5, stature: 0.5,
    primary: '#e8943a', secondary: '#b3581a', accent: '#1fb5a8', eyeColor: '#6fae3a',
    earType: 'pointy', snout: 0.15, pattern: 'tabby', tail: 'long', fluff: 0.3,
  },
  {
    id: 'domino', name: 'Domino', species: 'cat', build: 0.3, stature: 0.65,
    primary: '#2b2a33', secondary: '#fbf8f2', accent: '#ff6b5e', eyeColor: '#e8c63a',
    earType: 'pointy', snout: 0.1, pattern: 'tuxedo', tail: 'long', fluff: 0.15,
  },
  {
    id: 'thistle', name: 'Thistle', species: 'cat', build: 0.7, stature: 0.3,
    primary: '#8f93a3', secondary: '#c9ccd6', accent: '#7a5cff', eyeColor: '#f0a030',
    earType: 'pointy', snout: 0.05, pattern: 'solid', tail: 'plume', fluff: 1.0,
  },
];

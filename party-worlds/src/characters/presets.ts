/**
 * The authored cast. Every name and look is invented for this game.
 * People first, then dogs, then cats — each one is meant to be recognisable from
 * silhouette + colour blocking alone (see docs/ART_BIBLE.md, "Recognition").
 */
import type { CharacterSpec } from '../kit/contracts';

export const PRESET_CHARACTERS: CharacterSpec[] = [
  // ── people ──
  {
    // the kid: big head on a tiny body, traffic-cone hair, sunflower jumper
    id: 'pip', name: 'Pip', species: 'human', build: 0.3, stature: 0.0,
    primary: '#f6cfa8', secondary: '#d2622a', accent: '#ffb52e', eyeColor: '#3f8a52',
    hairStyle: 'spiky', facialHair: 'none', glasses: 'none', hat: 'none', bottom: '#3d6fd1',
  },
  {
    // the granddad: bald dome, walrus moustache, round glasses, birthday hat
    id: 'gus', name: 'Grandpa Gus', species: 'human', build: 0.9, stature: 0.35,
    primary: '#f2c3a2', secondary: '#f3eee6', accent: '#5f8f52', eyeColor: '#6f7f8f',
    hairStyle: 'bald', facialHair: 'mustache', glasses: 'round', hat: 'party', bottom: '#7a5a3c',
  },
  {
    id: 'zadie', name: 'Zadie', species: 'human', build: 0.45, stature: 0.62,
    primary: '#7c4a2d', secondary: '#241a1a', accent: '#ff6b5e', eyeColor: '#3a2014',
    hairStyle: 'afro', facialHair: 'none', glasses: 'none', hat: 'none', bottom: '#1f8f8a',
  },
  {
    id: 'tomo', name: 'Tomo', species: 'human', build: 0.2, stature: 0.9,
    primary: '#f0c79a', secondary: '#1f1a20', accent: '#7a5cff', eyeColor: '#3a2416',
    hairStyle: 'short', facialHair: 'none', glasses: 'square', hat: 'none', bottom: '#2f3b5c',
  },
  {
    id: 'bea', name: 'Nana Bea', species: 'human', build: 0.72, stature: 0.22,
    primary: '#c98d5e', secondary: '#dcd8e0', accent: '#e2457b', eyeColor: '#4a2a18',
    hairStyle: 'bun', facialHair: 'none', glasses: 'none', hat: 'none', bottom: '#5b4a8a',
  },
  {
    id: 'rosa', name: 'Rosa', species: 'human', build: 0.35, stature: 0.55,
    primary: '#e0aa7c', secondary: '#3b2218', accent: '#55b6f5', eyeColor: '#8a5a2b',
    hairStyle: 'long', facialHair: 'none', glasses: 'none', hat: 'none', bottom: '#f6ead2',
  },
  {
    id: 'lev', name: 'Lev', species: 'human', build: 1.0, stature: 1.0,
    primary: '#f7d6bd', secondary: '#c9872f', accent: '#1fb5a8', eyeColor: '#3c7fc4',
    hairStyle: 'curly', facialHair: 'beard', glasses: 'none', hat: 'none', bottom: '#6b4630',
  },
  {
    id: 'juno', name: 'Juno', species: 'human', build: 0.3, stature: 0.3,
    primary: '#e2a878', secondary: '#6b3a1e', accent: '#ff9ec4', eyeColor: '#4a2a18',
    hairStyle: 'ponytail', facialHair: 'none', glasses: 'none', hat: 'cap', bottom: '#3d6fd1',
  },
  {
    id: 'dex', name: 'Dex', species: 'human', build: 0.55, stature: 0.75,
    primary: '#a56b43', secondary: '#1f1a1c', accent: '#8fe3c0', eyeColor: '#3a2014',
    hairStyle: 'short', facialHair: 'stubble', glasses: 'shades', hat: 'beanie', bottom: '#ff7a3d',
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

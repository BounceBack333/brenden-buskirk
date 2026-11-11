# Art & Audio Bible (v0.1)

One sentence: **our people and pets, shrunk onto a party table, built like well-loved vinyl toys and photographed in warm afternoon light.**

Everything here is a rule the kits must follow so that authored characters, personalised characters and props read as one world. Code-level contracts live in `src/kit/contracts.ts`; shared materials and palette live in `src/kit/materials.ts`; shared lighting lives in `src/render/stage.ts`.

## Scale

- 1 world unit ≈ one tiny person. A cupcake is 3 units tall. A teaspoon is 9 units long. A birthday cake is a cliff.
- Scale is the joke and the wonder. Props are **ordinary objects at true relative size** — never "game platforms" dressed up. If a shape cannot be named as a real table object, replace it.
- Gameplay lives on the `z = 0` plane, seen from the side with a slight downward tilt. Set dressing sits behind (`z < -2.5`) or in front and below the camera line; it never hides a gameplay object.

## Characters

- **Proportions:** head ≈ 42% of standing height for people. Short limbs, mitten hands, small feet. Pets are true quadrupeds with a big head (≈ 38% of body length), stubby legs, expressive ears and tail.
- **Recognition comes from five levers, in this order:** silhouette (hair / ears / tail), colour blocking (skin or coat + pattern), face furniture (glasses, facial hair, muzzle length), build, outfit accent. A character must be identifiable as a 48-pixel-tall silhouette-plus-colours.
- **Faces:** real 3D eyes (white + coloured iris + pupil + highlight) that can blink, widen, squint and look. Brows are separate movable shapes. Mouths are simple swappable shapes (smile, open, small "o", gritted, wobble). Pets add a muzzle, nose, and a tongue that can flap. Faces are readable from the gameplay camera at ~1/12 of screen height — exaggerate.
- **Selective exaggeration:** squash and stretch the whole body up to ±25%. Ears, hair tufts, tails, cheeks and tongues are spring-driven and lag behind motion. Never distort a face into something grotesque; the result must stay affectionate.
- **Pets are never hurt.** A missed landing is a soft "flop and shake it off", ears down for half a second, then back up.
- **Fairness:** cosmetic size and species never change the collider or the anchors (`RIG` constants).

## Materials

| Use | Helper | Notes |
|---|---|---|
| Bodies, sponge, wood, card | `mat.clay` | matte vinyl |
| Fur, clothes, felt, cloth | `mat.fabric` | fully rough |
| Frosting, balloons, candy, eyes, noses | `mat.glossy` | one clean highlight |
| Cutlery, foil | `mat.metal` | reflects the studio environment |
| Jelly, cellophane | `mat.jelly` | translucent with clearcoat |
| Decals, glows | `mat.flat` | unlit |

- Rounded everything: bevels, capsules, lathe profiles. No razor edges, no visible low-poly facets on hero objects (≥ 24 radial segments where a silhouette is curved).
- Triangle budget: a character ≤ 6k triangles; a hero prop ≤ 3k; the whole arena ≤ 150k. Draw calls for one character ≤ 30 (merge static sub-parts).
- No external textures or models. Patterns (gingham, sprinkles, coat patches, tabby stripes) are generated at load with `CanvasTexture` or vertex colours.

## Palette & light

- World palette is `PALETTE` in `materials.ts`: cream cloth with coral check, butter and sunflower warm lights, teal / berry / grape accents. Character colours come from their spec and should be the most saturated things on screen after interactive objects.
- **Interactive objects carry the strongest colour + a glossy highlight.** Decoration stays one step paler and more matte.
- Warm key light from the upper left, cool rim from behind, soft contact shadows on the cloth. Backdrop is a warm, out-of-focus party room: large soft shapes and bokeh, never detailed.

## Animation

- Every action has **anticipation → action → follow-through → settle**. Launch: the spoon creaks back, the passenger scrunches and their eyes widen; release: stretch along travel, ears/hair trail; landing: squash, then a head pop.
- Gameplay timing is owned by the simulation. Animation exaggerates around it but never delays an input or changes an outcome.
- Reduced-motion mode removes camera shake, zoom punches and time effects — never information.

## Sound

- Timbre identity: **music box, kalimba, wood, paper, rubber, glass, breath.** No sampled voices. Small objects, close-miked.
- Every interactive event has a sound that carries information: tension rises in pitch as the spoon bends; air rush follows speed; the umbrella opens with a papery *fwup*; jelly *boings* lower when hit harder; the rim is a tick of tin; a catch is a soft paper thump + two rising notes; a perfect catch adds a bell.
- Music is a small looping music-box motif in a major pentatonic that thins out in tense moments and resolves on a catch.
- Nothing is harsh, nothing mocks. A miss gets a soft descending two-note "whoops", not a buzzer.

## Interface

- Typeface: Fredoka (bundled, OFL). Big rounded numerals. Minimum touch target 56 px; primary actions 72 px.
- Never rely on colour alone: every state also has a shape, icon or label.
- UI sits on paper-like cards with a navy ink colour (`PALETTE.navy`), coral for primary actions, teal for confirmations.

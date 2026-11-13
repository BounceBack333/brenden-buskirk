# Art & Audio Bible (v0.2)

One sentence: **grown-ups, their pets and a few things that are neither, shrunk into ordinary places, raced like an arcade cabinet you remember and finished like something made this year.** The racing world, Backyard After Dark, is that at night under string lights; the parked Birthday Continental is the earlier daytime toy-box look.

**For adults (D-022).** Funny, not cute. If a choice makes the game look like it is for small children — a blush, a bubble font, a pastel card, a bounce where a snap would do — it is the wrong choice.

Everything here is a rule the kits must follow so that authored characters, personalised characters and props read as one world. Code-level contracts live in `src/kit/contracts.ts`; shared materials and palette live in `src/kit/materials.ts`; shared lighting lives in `src/render/stage.ts`.

## Scale

- 1 world unit ≈ one tiny person. A cupcake is 3 units tall. A teaspoon is 9 units long. A birthday cake is a cliff.
- Scale is the joke and the wonder. Props are **ordinary objects at true relative size** — never "game platforms" dressed up. If a shape cannot be named as a real table object, replace it.
- **Racing:** a kart is about 1.7 units long, a toy you could hold in your palm. A paving slab is 4 units, the garden hose is over a unit thick, a tennis ball is a boulder, a ladder left on the lawn is a wall as long as the straight, a chair leg is a pillar going up out of sight. The camera rides two units up behind the kart; anything that matters to a decision (road edge, plank, peg) must read from there at speed.
- **Courier (parked):** gameplay lives on the `z = 0` plane, seen from the side with a slight downward tilt. Set dressing sits behind (`z < -2.5`) or in front and below the camera line; it never hides a gameplay object.

## Characters

- **Proportions:** a grown-up is about four heads tall, with a neck, shoulders wider than the head and a jaw. The head is built full size and worn at 60 %, so faces keep their detail. A kid (two in the cast, an option in the builder) keeps the old proportions: head ≈ 42 % of height. Pets are true quadrupeds with a big head, stubby legs, expressive ears and tail.
- **Not people:** bear, fox, rabbit, frog, robot, alien, masked wrestler, each on the adult body with its own head. They wear the same clothes as everyone else, which is most of the joke.
- **Recognition comes from five levers, in this order:** silhouette (hair / ears / tail), colour blocking (skin or coat + pattern), face furniture (glasses, facial hair, muzzle length), build, outfit accent. A character must be identifiable as a 48-pixel-tall silhouette-plus-colours.
- **Faces:** real 3D eyes (white + coloured iris + pupil + highlight) that can blink, widen, squint and look. Brows are separate movable shapes. Mouths are simple swappable shapes (smile, open, small "o", gritted, wobble). Pets add a muzzle, nose, and a tongue that can flap. Faces are readable from the gameplay camera at ~1/12 of screen height — exaggerate.
- **Selective exaggeration:** squash and stretch the whole body up to ±25%. Ears, hair tufts, tails, cheeks and tongues are spring-driven and lag behind motion. Never distort a face into something grotesque; the result must stay affectionate.
- **Pets are never hurt.** A missed landing is a soft "flop and shake it off", ears down for half a second, then back up.
- **Fairness:** cosmetic size and species never change the collider or the anchors (`RIG` constants).
- **Drivers:** scaled 1.28× in the kart with a low seat back, so head, hair or ears and shoulders show from behind. The game brings faces to the player rather than hoping the chase view will: countdown, HUD portrait, rival tags, finish, results (D-018).
- **Direction, not yet acted on:** the review of the first build asked for drivers that read less baby-like over time. The present cast is provisional.

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
- **Backyard After Dark:** dusk rather than black, because it has to read on a phone. Cool moonlit ambient, one warm low key from the work lamp, coloured pools under the string lights, a starry dome with a low moon and a warm horizon, fireflies. Chalk-white edge lines on the road. Kart headlamps throw a pool ahead; tail-lamps are red. Spark colour means something: straw (sliding), pink (boost ready), blue (big boost ready).

## Animation

- Every action has **anticipation → action → follow-through → settle**. Launch: the spoon creaks back, the passenger scrunches and their eyes widen; release: stretch along travel, ears/hair trail; landing: squash, then a head pop.
- Gameplay timing is owned by the simulation. Animation exaggerates around it but never delays an input or changes an outcome.
- Reduced-motion mode removes camera shake, zoom punches and time effects — never information.

## Sound

- Timbre identity: **music box, kalimba, wood, paper, rubber, glass, breath.** No sampled voices. Small objects, close-miked.
- Every interactive event has a sound that carries information: tension rises in pitch as the spoon bends; air rush follows speed; the umbrella opens with a papery *fwup*; jelly *boings* lower when hit harder; the rim is a tick of tin; a catch is a soft paper thump + two rising notes; a perfect catch adds a bell.
- Music is a small looping music-box motif in a major pentatonic that thins out in tense moments and resolves on a catch.
- Nothing is harsh, nothing mocks. A miss gets a soft descending two-note "whoops", not a buzzer.
- **Racing:** a small buzzy two-voice engine that follows speed and opens up under boost; a filtered-noise skid while sliding; a chime at each charge level; a rising whoosh for the boost; wooden clatter when the plank drops; two plucked notes for each lap and a brighter three-note figure for the last. Race music is a quicker minor-pentatonic pattern on the same instruments. Lobby and race share one four-chord loop (Am – F – C – G): slow pads in the lobby; kick, snare, saw bass and a square arpeggio at 126 bpm in the race. All of it has been measured for level and clipping and none of it has been heard by a person.

## Interface

- Typefaces: Barlow Condensed for anything shouted (uppercase, italic at weight 800 for titles, places and numerals) and Barlow for anything read. Both bundled, OFL. Minimum touch target 56 px; primary actions 72 px.
- Never rely on colour alone: every state also has a shape, icon or label.
- UI is dark glass with a thin cool border. One hot gradient (pink through orange to amber) is reserved for the thing to press and the thing just won; cyan labels; butter yellow for needle ("cannot lose this one"). Buttons lean nine degrees, like the cabinet menus they are borrowed from.

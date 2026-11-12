# BounceBack Party Worlds

**Our people and pets, inside impossible little worlds.**

A combat racing game for adults: you and your friends (or a bear in a jacket, a frog in a cowboy hat, your dog) as armed tin-toy racers in places hidden in ordinary objects. The playable prototype is **Backyard Dash**: three laps of a patio at night. Karts drive themselves, you steer; hold DRIFT through a corner and let go for a boost; shoot whoever is in front of you and leave mines for whoever is behind; take the road past the repair strip or risk the plank across the flowerbed, once somebody has knocked the peg out from under it. Run out of armour and you are a wreck for a few seconds.

This is a **web build** (TypeScript + Three.js). It is not a native iOS app. Nobody has play-tested it yet. See `docs/PROGRESS.md` for exactly what is and is not proven.

An earlier co-operative attraction, **Catapult Courier**, is kept as a parked experiment and is still playable from the play sheet (`docs/DECISIONS.md`, D-016).

## Run it

```bash
npm install
npm run dev          # game at http://127.0.0.1:5173
```

Open it on a phone or tablet on the same network with `npm run dev -- --host 0.0.0.0`, then visit `http://<your-computer-ip>:5173`. That is also the way to see it full-screen without any viewer around it; "Add to Home Screen" then gives it an icon and opens it without browser bars (a web manifest and icons are included; nobody has tried this on a device yet).

Every build has a label (version, commit, day built) on the last line of Settings. Quote it in play-test notes and bug reports.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | 152 automated tests: race rules, combat rules, tracks, medals and series, the character kit, the simulation purity rule, saved data, the game loop, Courier rules, private-room server |
| `npm run check` | Everything a change must pass: type-check, tests, race fingerprint, build, size budget. CI runs exactly this |
| `npm run smoke` | Starts the built game in a headless browser, begins an armed race, a clean one and a Courier round, fails on any page error (after a build; CI runs it too) |
| `npm run size` | Built file sizes against the budget (after a build) |
| `npm run fingerprint` | Compares eighteen bot races (nine plain, nine armed) with the recorded ones in `dev/fingerprint.txt`; fails if a race plays differently. `npm run fingerprint -- --update` records a change that was meant |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Production build into `dist/` (static files; host anywhere) |
| `npm run server` | Private-room server for Courier on port 8787 (`PORT`, `ALLOWED_ORIGINS`, `LAUNCHES` env vars) |
| `node scripts/build-single-file.mjs out.html --page` | One self-contained HTML file (after `npm run build`) |
| `node dev/make-icons.mjs` | Redraws the home-screen icons after `public/icon.svg` changes (needs Playwright, see below) |

### Play modes
- **Race** — you against three rivals. Rivals are bots and are labelled; your second character drives the quickest one. Pick how hard they race: Gentle, Keen or Fierce.
- **Split screen** — two people on one device, left and right halves, plus two bot rivals. Best on a tablet or a laptop. It is a first-to-three series: the score carries across rematches.
- **Alone** there are bronze, silver and gold times to beat (three-lap races).
- **Armed or Clean** — races are armed (guns, mines, armour, wrecks) unless you pick Clean on the play sheet, which is the plain race exactly as it was. Each keeps its own best times and medals.
- **Parked: Catapult Courier** — with a bot partner, same screen, or an online room (needs `npm run server`).

### Controls
| | Touch | Keyboard |
|---|---|---|
| Steer | Drag left / right anywhere in your half | A / D or ← / → |
| Drift, then boost | Hold DRIFT (or a second finger) while turning; let go | Space, Shift or J |
| Start boost | Press DRIFT just before GO | same |
| Brake / reverse | BRAKE | S or ↓ |
| Fire (armed races) | The guns fire by themselves when a rival is in your sights; switch "Auto fire" off in Settings for a FIRE button | F (or W, ↑, Enter) |
| Drop a mine (armed races) | MINE | E |
| Split screen | Each half is its own stick; steering hard starts the drift by itself, and the guns fire by themselves | Player 1: A / D steer, W drift, S brake, Space fire, E mine · Player 2: ← / → steer, ↑ drift, ↓ brake, Enter fire, right Shift mine |
| Game controller | — | Stick or d-pad to steer, A (or right bumper) to drift, B to brake; armed, right trigger or X fires and Y drops a mine. One controller per player in split screen. A also presses the main button between races; Start pauses |

`?laps=1` on the URL shortens a race for quick checks (personal bests are only kept for three-lap races). The game lowers its own picture quality if the device cannot hold about 50 frames per second; `?hq` turns that off (useful for screenshots on slow machines).

## How it is put together

```
src/
  core/         deterministic maths, fixed-step loop, pointers, always-landscape viewport, local profile
  kit/          contracts between the game and its art/audio kits; shared materials
  render/       stage (renderer + lights), camera rig, particles, portraits
  characters/   people, dogs and cats from data: builder → skinned mesh → animation rig
  worlds/backyard/   Backyard After Dark: the patio, its props and the karts
  worlds/birthday/   the Birthday Continental prop kit (Courier)
  audio/        procedural sound effects and music (no audio files)
  attractions/dash/      the race: track, simulation, rival bots and levels, view, HUD/controls/session
  attractions/courier/   parked: rules, simulation, bot, controls, view, local + online sessions
  net/          wire protocol and browser room client
  ui/           HUD, menus, styles
server/         private-room server (authoritative simulation over WebSockets)
tests/          simulation and server tests
dev/            dev pages and automation: play-through, online test, audio measurement, probes
docs/           the design and decision records — start with GDD.md
```

The rule that shapes the code: **each simulation is a pure, deterministic function of inputs** (`src/attractions/dash/sim.ts` and `src/attractions/courier/sim.ts`, using only `src/core/dmath.ts`). The same module runs in the browser, in the bots and in tests (and, for Courier, on the server), which is what makes authority, prediction and input-replay validation possible.

## Adding a track

A track is data plus a kit to draw it; nothing else names a track.

1. In `src/attractions/dash/track.ts`, write a builder like `buildBackyard` (centre line, solid circles and capsules, start grid, one gated shortcut with its `fork` and `opener` zones, medal times, menu parking spots) and add it to `BUILDERS`.
2. In `src/worlds/`, write a kit that returns a `RaceWorld` for it and add it to `KITS` in `src/worlds/index.ts`. Until you do, the new track is drawn with the backyard's kit so it can be driven straight away.
3. `npm run check`. The registry tests check and race every registered track.

Choosing between tracks in the menu is not built: `main.ts` uses `DEFAULT_TRACK` in one place.

## Automated checks you can run

```bash
npm test
node dev/raceplay.mjs "http://127.0.0.1:5173/?laps=1" solo dev/shots/race --slow=0.25      # a whole race through the real UI, by keys
node dev/raceplay.mjs "http://127.0.0.1:5173/?laps=1" split dev/shots/split --slow=0.25 --rematch
node dev/raceplay.mjs "http://127.0.0.1:5173/?laps=1" solo dev/shots/touch --touch --slow=0.2   # by touch, on an emulated phone
sh dev/race-evidence.sh                                                                    # all of the above and more, one summary line each
LEVEL=1 npx tsx dev/humanish.ts                                                            # stand-in drivers against a rival level
npx tsx dev/raceprobe.ts                                                                   # rivals race each other: lap times, boosts, bumps
node dev/measure-audio.mjs                                                                 # every sound, rendered offline
LEVEL=1 npx tsx dev/combatprobe.ts                                                         # how violent an armed race is: wrecks, hits, mines, repairs
node dev/combat-shots.mjs                                                                  # freeze on a shot, a wreck, a mine and a respawn, to look at the effects
```

The `dev/*.mjs` play-through scripts need Playwright with a Chromium browser (`npm i -D playwright`); it is not a dependency of the game. The smoke test alone works without it, driving a Chrome that is already installed: `SMOKE_CHANNEL=chrome npm run smoke`. `node dev/raceplay.mjs … --pad` drives with stand-in game controllers, and `node dev/recovery.mjs` breaks the game mid-race two ways (the graphics context is taken away; the simulation starts throwing) and checks that it says so and restarts.

`--slow` runs game time slower for the scripted driver only: the headless browser draws in software and acknowledges input about once a frame, so without it the script reacts far later than a person would. Courier's checks (`dev/playthrough.mjs`, `dev/online-test.mjs`, `dev/touch-test.mjs`, `dev/botmatch.ts`) still work.

## Documents

| File | What it is |
|---|---|
| `docs/MASTER_BRIEF.md` | The founder's charter, verbatim |
| `docs/RACING_BRIEF.md` | The change of direction to racing, and the brief for this build |
| `docs/GDD.md` | Living game design document |
| `docs/DECISIONS.md` | Why things are the way they are |
| `docs/ATTRACTIONS.md` | Attraction registry and acceptance criteria |
| `docs/SCORING.md` | Scoring rules and a fully worked sample tour |
| `docs/NETWORKING.md` | Authority model, failure recovery, measured traffic |
| `docs/ART_BIBLE.md` | Look, sound and budgets |
| `docs/PROGRESS.md` | What is built, with evidence, and what is not |
| `docs/DEPENDENCIES.md` | Decisions and resources still needed |
| `docs/PLAYTEST.md` | Observation plan for the first real sessions |
| `docs/ASSETS.md` | Asset and licence record |
| `docs/research/avatar-pipeline.md` | Photo-to-character research (with its evidence caveats) |

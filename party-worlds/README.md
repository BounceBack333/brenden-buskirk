# BounceBack Party Worlds

**Our people and pets, inside impossible little worlds.**

A social game where you, the people you love, and your pets are shrunk onto an ordinary table. First playable attraction: **Catapult Courier** — one of you is flung off a bent spoon and feathers a cocktail umbrella on the way down; the other sprints and dives to catch them in a cupcake liner. Roles swap every launch, and the table remembers what you do to it.

This is a **web build** (TypeScript + Three.js). It is not a native iOS app. Nobody has play-tested it yet. See `docs/PROGRESS.md` for exactly what is and is not proven.

## Run it

```bash
npm install
npm run dev          # game at http://127.0.0.1:5173
```

Open it on a phone on the same network with `npm run dev -- --host 0.0.0.0`, then visit `http://<your-computer-ip>:5173`.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm test` | 45 automated tests: simulation rules + private-room server |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Production build into `dist/` (static files; host anywhere) |
| `npm run server` | Private-room server on port 8787 (`PORT`, `ALLOWED_ORIGINS`, `LAUNCHES` env vars) |
| `node scripts/build-single-file.mjs out.html --page` | One self-contained HTML file (after `npm run build`) |

### Play modes
- **With Buddy** — just you; your second character is played by a labelled bot partner.
- **Same screen** — two players on one device; Player 1 owns the left half, Player 2 the right.
- **Online room** — two devices, a four-letter code. Needs the room server: run `npm run server` and the game finds it on `localhost`; for another host add `?server=wss://your-host` to the game URL or build with `VITE_ROOM_SERVER`.

### Controls
| | Touch | Keyboard / mouse |
|---|---|---|
| Launch | Drag back anywhere in your area, let go | Mouse drag, or hold and release Space |
| Umbrella (in flight) | Hold | Space or W |
| Run (catcher) | Drag left / right | A / D or ← / → |
| Dive | DIVE button, quick tap, or a second finger | Shift, S or ↓ |

`?launches=2` on the URL shortens a local round for quick checks.

## How it is put together

```
src/
  core/         deterministic maths, fixed-step loop, pointers, always-landscape viewport, local profile
  kit/          contracts between the game and its art/audio kits; shared materials
  render/       stage (renderer + lights), camera rig, particles, portraits
  characters/   people, dogs and cats from data: builder → skinned mesh → animation rig
  worlds/birthday/   the Birthday Continental prop kit
  audio/        procedural sound effects and music (no audio files)
  attractions/courier/   rules, simulation, bot, controls, view, local + online sessions
  net/          wire protocol and browser room client
  ui/           HUD, menus, styles
server/         private-room server (authoritative simulation over WebSockets)
tests/          simulation and server tests
dev/            dev pages and automation: play-through, online test, audio measurement, probes
docs/           the design and decision records — start with GDD.md
```

The rule that shapes the code: **the simulation is a pure, deterministic function of inputs** (`src/attractions/courier/sim.ts`, using only `src/core/dmath.ts`). The same module runs in the browser, in the bot, in tests and on the server, which is what makes online authority, prediction and input-replay validation possible.

## Automated checks you can run

```bash
npm test
node dev/playthrough.mjs "http://127.0.0.1:5173/?launches=2" buddy dev/shots/play     # a full round through the real UI
node dev/playthrough.mjs "http://127.0.0.1:5173/?launches=1" buddy dev/shots/port --portrait
LAUNCHES=2 npm run server &  node dev/online-test.mjs                                # two browsers, one room
node dev/touch-test.mjs                                                             # one launch with real touch events
node dev/measure-audio.mjs                                                          # every sound, rendered offline
npx tsx dev/botmatch.ts                                                             # balance: bots play 240 rounds
```

## Documents

| File | What it is |
|---|---|
| `docs/MASTER_BRIEF.md` | The founder's charter, verbatim |
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

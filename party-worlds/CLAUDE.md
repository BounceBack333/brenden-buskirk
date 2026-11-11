# Party Worlds — project instructions

Original social game. Read `docs/GDD.md` and `docs/PROGRESS.md` before changing anything substantial; `docs/MASTER_BRIEF.md` is the founder's intent and `docs/DECISIONS.md` records what has been decided since.

## Rules that must hold

1. **The simulation is deterministic and pure.** Code under `src/attractions/*/sim.ts` and `rules.ts` may use only `+ - * /`, `Math.sqrt/floor/round/abs/min/max` and `src/core/dmath.ts`. No `Math.sin`, `Math.random`, `Date`, DOM or rendering. The server and the tests run the same file.
2. **Presentation never changes outcomes.** Kits (`characters`, `worlds`, `audio`), the view and the HUD only read state. Looks, species and cosmetic size never change colliders or reach (`RIG` in `src/kit/contracts.ts`).
3. **Outcomes are authoritative.** Online, a catch, a miss and every point come from the server only.
4. **Report evidence honestly.** Use the status words in `docs/PROGRESS.md`. A scripted play-through is not a play-test; a local simulation is not verified online play; this web build is not a native iOS app. Never write measurements, reactions or results that were not observed.
5. **Bots and assists are labelled** wherever they appear, including results.
6. **No real people's photos or likenesses** in development. The cast is invented. Do not name a character "Bailey" without an authorised reference.
7. **No external assets.** Everything is generated in code. If that changes, record the source and licence in `docs/ASSETS.md` first.
8. Keep the game inside `party-worlds/`. The repository root is the founder's portfolio site: do not touch it.

## Working here

- `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run server`.
- Look at what you build: `node dev/playthrough.mjs <url> <mode> <outDir>` drives a round and saves screenshots; `dev/tile.sh` stitches them.
- Tuning numbers live in `src/attractions/courier/rules.ts`. After changing them run `npx tsx dev/probe.ts` (where launches land) and `npx tsx dev/botmatch.ts` (balance), then the tests.
- When a decision changes behaviour or scope, add an entry to `docs/DECISIONS.md` and update `docs/PROGRESS.md` in the same change.
- New attraction: complete its entry in `docs/ATTRACTIONS.md` (players, controls, scoring, ties, accessibility, network authority, disconnects, acceptance criteria) before writing code.

# Party Worlds — project instructions

Original social combat-racing game (racing has been the core since D-016 and has been armed since D-025; Catapult Courier is a parked experiment kept intact). Read `docs/GDD.md` and `docs/PROGRESS.md` before changing anything substantial; `docs/MASTER_BRIEF.md` is the founder's intent, `docs/RACING_BRIEF.md` is the direction that followed it, and `docs/DECISIONS.md` records what has been decided since.

## Rules that must hold

1. **The simulation is deterministic and pure.** Code under `src/attractions/*/sim.ts` and `rules.ts` may use only `+ - * /`, `Math.sqrt/floor/round/abs/min/max` and `src/core/dmath.ts`. No `Math.sin`, `Math.random`, `Date`, DOM or rendering. The server and the tests run the same file.
2. **Presentation never changes outcomes.** Kits (`characters`, `worlds`, `audio`), the view and the HUD only read state. Looks, species and cosmetic size never change colliders or reach (`RIG` in `src/kit/contracts.ts`).
3. **Outcomes are authoritative.** Online, a catch, a miss and every point come from the server only. Race results come from the race simulation only.
   **One kart for everyone:** nothing a player picks changes `KART` numbers or the collider. Rival bots differ only by the skill and throttle stated in `src/attractions/dash/rivals.ts`; no rubber band.
   **One kit for everyone (D-025):** every kart has the same armour, guns, mines and number of lives (`COMBAT` in `combat.ts`). Weapons are never bought, unlocked, random or a side effect of a look.
4. **Report evidence honestly.** Use the status words in `docs/PROGRESS.md`. A scripted play-through is not a play-test; a local simulation is not verified online play; this web build is not a native iOS app. Never write measurements, reactions or results that were not observed.
5. **Bots and assists are labelled** wherever they appear, including results.
6. **No real people's photos or likenesses** in development. The cast is invented. Do not name a character "Bailey" without an authorised reference.
   **Cars against cars (D-025):** no bystanders, nothing to run over, nobody hurt: a wrecked driver is dizzy, and one who is out of the race is still only dizzy. Keep it that way.
   **The game is for adults (D-022):** grown-up drivers by default, funny rather than cute, no toy-box styling. Hooks must be things that end (a series, a medal); no timers, punishing streaks, random rewards or anything bought.
7. **No external assets.** Everything is generated in code. If that changes, record the source and licence in `docs/ASSETS.md` first.
8. Keep the game inside `party-worlds/`. The repository root is the founder's portfolio site, published by GitHub Pages from `main`: do not touch it. The single exception is `.github/workflows/party-worlds.yml`, which only checks this folder.

## Working here

- `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run server`. Before pushing: `npm run check` (type-check, tests, race fingerprint, build, size budget), then `npm run smoke` (the built game starts in a headless browser and a race begins). CI runs both.
- **A change that alters how a race plays fails the fingerprint.** If it was meant to (tuning, a rule, a track edit), run `npm run fingerprint -- --update`, commit `dev/fingerprint.txt` with the change and say why in `docs/DECISIONS.md`. If it was not meant to, find out what changed play.
- Saved data is read by `parseProfile` in `src/core/profile.ts`. A new saved field needs its default, its check there and a line in `tests/profile.test.ts`; never trust what storage hands back.
- Tracks are data: see "Adding a track" in `README.md`. Nothing outside `track.ts` and `src/worlds/index.ts` should name a track.
- Look at what you build: `node dev/raceplay.mjs <url> solo|split <outDir> --slow=0.25` drives a race and saves screenshots (`dev/playthrough.mjs` does the same for Courier); `dev/tile.sh` stitches them; `node dev/recovery.mjs` breaks the game on purpose and checks it recovers. Headless frame rates are software rendering and mean nothing for phones.
- Combat numbers live in `src/attractions/dash/combat.ts` (`COMBAT`); crates and the repair strip are track data. After changing them run `LEVEL=0|1|2 npx tsx dev/combatprobe.ts` (wrecks, hits, mines and karts put out per race; `LIVES=n` sets how many wrecks a kart has in it), then the tests, and record the new armed fingerprints. The plain-race fingerprints must not move because of a weapons change. `node dev/combat-shots.mjs` freezes on a shot, a wreck and a mine so the effects can be looked at.
- Race tuning lives in `src/attractions/dash/track.ts` (`KART`, `RACE`, the circuit) and `rivals.ts` (levels). After changing it run `npx tsx dev/raceprobe.ts` (rivals against each other) and `LEVEL=0|1|2 npx tsx dev/humanish.ts` (stand-in drivers against a level), then the tests. Courier's numbers are in `src/attractions/courier/rules.ts` (`dev/probe.ts`, `dev/botmatch.ts`).
- When a decision changes behaviour or scope, add an entry to `docs/DECISIONS.md` and update `docs/PROGRESS.md` in the same change.
- New attraction: complete its entry in `docs/ATTRACTIONS.md` (players, controls, scoring, ties, accessibility, network authority, disconnects, acceptance criteria) before writing code.

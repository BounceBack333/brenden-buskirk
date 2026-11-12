# Progress and acceptance record

Last updated: 2026-11-12 (armed racing, D-025).

## Status words

| Word | Meaning |
|---|---|
| **Implemented and tested** | Built, and an automated test or measurement listed here exercises it |
| **Implemented, automation only** | Built and driven through the real UI by a script; no person has used it |
| **Implemented, untested** | Built; nothing has exercised it yet |
| **Simulated** | Shown by bots or a scripted stand-in for the real thing |
| **Proposed** | Designed on paper only |
| **Blocked** | Cannot proceed without the named dependency |

One recording of Catapult Courier was made by the founder and reviewed by an advisor; that review is the reason for the change of direction (D-016). Apart from that, nothing in this project has been played by a person, and nothing has run on a physical phone that we have observed. There are no player reactions, retention figures, revenue figures or device frame rates in this repository, because none exist.

## Milestone: armed racing (D-025)

**Asked for:** "more like death race than Mario kart".

| Area | Status | Evidence |
|---|---|---|
| Combat rules: armour, guns, mines, crates, ramming, wall damage, wrecks, the repair strip | Implemented and tested | `tests/combat.test.ts` (26): guns locked at the start, hit only what is ahead, in range and not behind the pot; magazine and reload; mines arm, bite, expire; crates and repairs; ram and wall damage; a wreck stops, is credited, and comes back shielded; a finished kart is out of it; three whole bot races add up; same inputs give the same race |
| The plain race is unchanged, and still there | Implemented and tested | The nine recorded plain fingerprints are identical after the change; a test plays a plain race with the trigger held and gets the same hash; "Clean" on the play sheet |
| Rivals fight with the same kit | Implemented and tested (they do); Simulated (how much) | Whole-race tests. `dev/combatprobe.ts`, 20 races a level: about 3 / 3.5 / 5 wrecks a race across four karts at Gentle / Keen / Fierce, the stand-in wrecked about once a race, races 3 to 6 s longer than plain |
| Controls: FIRE, MINE, Auto fire | Implemented, automation only | Keyboard (solo F and E; shared keyboard Space/E and Enter/right Shift), touch buttons, controller (right trigger, Y). Auto fire defaults on for touch |
| HUD: armour and gun bars, brackets on the target, armour under rivals' names, wreck list, mines and crates on the minimap | Implemented, automation only | Reviewed at 1280×720 in frames frozen on a shot, a wreck, a mine going off and a respawn (`dev/combat-shots.mjs`). First version had a fault found this way: tracers and flashes expired before a slow device drew one frame; each is now drawn at least once |
| Look: guns, a spiked ram and plates on the karts; tracers, blasts, smoke, burning wrecks; a higher camera when armed | Implemented, **seen by me only** | Same frames |
| Sound: guns, hits, explosions, mines, crates, repair, the weapons-live alarm | Implemented, **measured but never heard** | `dev/measure-audio.mjs` renders all ten offline: none silent, none clipping (peaks 0.04 to 0.42; the gun is the quietest of the loud ones on purpose, it repeats ten times a second) |
| Results and stakes | Implemented, automation only | A Wrecks column (caused, and times wrecked); armed and plain races keep separate bests and medals |
| The checks start an armed race | Implemented and tested | `npm run smoke`: an armed race goes live and somebody opens fire; a Clean race has no weapons |
| Scripted play-throughs (build `0.1.0 · 9fdf715`) | Implemented, automation only | Seven races through the real UI with nothing else running: armed solo by keys over three laps (plank, rematch; the scripted driver posted 53.73 s and was given gold), armed split screen by keys, armed solo by touch landscape and upright, armed split screen by thumbs, armed split screen by two stand-in controllers (two wrecks; a wrecked kart came back and finished second), and a Clean solo race. Zero page errors in all seven. The recovery checks, the four frozen effect frames and a Courier round also passed. The three-lap run was done twice: the first time the script's own fifteen-minute limit ran out as the race ended and it reported that the results never appeared; the limit is now thirty minutes |
| Two things seen in those screenshots and changed afterwards (build `fa9476e`) | Implemented, automation only | Smoke from a wreck blotted out the wrecked driver's view: smaller now. In split screen the wreck list sat under a lap counter: moved. After the change: check and smoke pass, and the effect frames were looked at again. The seven races were not rerun for it |

**Total:** 152 of 152 tests pass (32 race and track, 26 combat, 6 medals and series, 10 character kit, 17 purity, 7 saved data, 9 game loop, 26 Courier, 19 room server); type-check clean; 18 fingerprints match; build 941 KB JS + 197 KB CSS (270 KB + 120 KB gzipped), inside the budget.

## Milestone: things that must not break in someone's hands (D-024)

Nothing here changes how the game plays; the race fingerprint is unchanged and is now enforced.

| Area | Status | Evidence |
|---|---|---|
| Saved data is read defensively | Implemented and tested | `tests/profile.test.ts` (7): nothing, rubbish, wrong kinds field by field, out-of-range volumes, bad records, old casts, junk and duplicate characters; reading is idempotent. A build was started in a headless browser on a deliberately broken save: zero page errors, bad fields at their defaults, good ones kept |
| A game that keeps failing stops and says so | Implemented and tested (the counting); automation only (the screen) | `tests/loop.test.ts` (9): tick rate at 30, 60, 120 and 144 Hz displays, no catch-up after a long gap, one bad frame survived, a persistent failure reported exactly once, an every-other-frame failure caught too. `dev/recovery.mjs` makes the simulation throw mid-race in a headless browser: the screen appears with the cause and the build, and a tap starts the game again |
| Lost graphics context | Implemented, automation only | Same script, same screen. Not seen on a real phone |
| Play cannot change by accident | Implemented and tested | `npm run check` compares nine bot races with `dev/fingerprint.txt`. A 1 % change to one handling number was caught (and reverted). The GitHub runner and this machine print the same nine hashes |
| The built game is started by the checks | Implemented and tested | `npm run smoke` passes on this machine against the production build: it starts, a race begins and all four karts move, Settings opens, a Courier round begins, zero page errors. On GitHub it ran in the runner's own Chrome after `npm run check` and passed first time; the whole job took 74 s |
| Scripted play-throughs on this build (`0.1.0 · 5886685`) | Implemented, automation only | Run after everything above, on the production build of the pushed commit, nothing else running. Five races through the real UI (solo by keys over three laps with the plank and a rematch; split screen by keys; solo by touch, landscape and upright; split screen by thumbs), one split-screen race by two stand-in controllers with the rematch from the A button, the two recovery checks, and a Courier round to its results: zero page errors in all nine. A first attempt at this batch is not counted: I ran the smoke test on the same four cores while it was driving, and the scripted driver ran out of time on the first race |
| Build label | Implemented, automation only | Last line of Settings and on the recovery screen, for example `0.1.0 · 0a991fe+ · 2026-11-12` |
| Home-screen icons and web manifest | Implemented, untested | Built, served and parsed locally. **Never installed on a phone**; needs the build hosted (`DEPENDENCIES.md` #2) |

**Total at that point:** 124 of 124 tests (32 race and track, 6 medals and series, 10 character kit, 15 purity, 7 saved data, 9 game loop, 26 Courier, 19 room server); type-check clean; fingerprint matches; build 915 KB JS + 192 KB CSS (261 KB + 119 KB gzipped), as `npm run size` prints them.

## Milestone: less scrap, fewer assumptions (D-023)

Nothing here changes how the game plays; `npm run fingerprint` printed the same nine state hashes before and after.

| Area | Status | Evidence |
|---|---|---|
| Tracks are data: registry, track id in the race, per-track medals, rival cues, menu parking, world kits; self-fitting minimap | Implemented and tested | Identical fingerprint; `tests/dash.sim.test.ts` checks and races every registered track; a race on an unknown track id falls back to the default |
| The purity rule is enforced | Implemented and tested | `tests/purity.test.ts` reads the seven simulation sources and fails on any platform-dependent maths, clock, DOM or rendering import |
| The character kit is tested | Implemented and tested | `tests/characters.test.ts`: all 26 cast members through all 14 actions; every kind of driver in every hat; every hairstyle with every hat, beard and glasses at both ages; random specs; rubbish input. No exception, no non-finite number, triangle budget held |
| One command, and CI | Implemented and tested | `npm run check`; the same steps passed from a clean checkout here, and passed on GitHub Actions (first run: 36 s) |
| Size budget | Implemented and tested | `scripts/check-size.mjs`: JS 261 KB and CSS 119 KB gzipped, against budgets of 300 and 160 |
| Font payload | Reduced | One format per weight instead of two: CSS 326 → 196 kB, gzipped 220 → 122 kB (the build tool's figures, in thousands of bytes) |
| Game controllers | Implemented, automation only | A split-screen race driven by two stand-in controllers finished cleanly and the A button started the next race; hints read "Steer with the stick" and "Hold A in a corner". **No real controller has been plugged in** |
| Lost graphics context | Implemented, automation only | `dev/recovery.mjs` (was `context-loss.mjs`) takes the context away mid-race: the game pauses, stops its loop and shows "The picture was interrupted. Tap to carry on." Not seen on a real phone |
| Reduced motion in the race | Implemented, untested | Removes the countdown and finish orbits and the speed zoom, as well as shake and roll |
| Compiler rejects unused code | Done | `noUnusedLocals` and `noUnusedParameters` are on; nine leftovers removed |

**Total at that point:** 108 of 108 tests (32 race and track, 6 medals and series, 10 character kit, 15 purity, 26 Courier, 19 room server); type-check clean; build 913 KB JS + 191 KB CSS (261 KB + 119 KB gzipped), as `npm run size` prints them.

## Milestone: the grown-up pass (D-022)

**Asked for:** a game adults enjoy and come back to; nostalgia plus new; adult avatar characters, funny and different and animals welcome, one or two kids at most; not a child's game.

| Asked for | Status | Evidence |
|---|---|---|
| Adult drivers instead of babies and dolls | Implemented, automation only | Grown-ups are the default: about four heads tall, neck, shoulders, jaw, smaller eyes, a nose. Contact sheets of the whole cast reviewed by eye, standing and seated in karts. **Nobody but me has looked at them** |
| Funny, different, animals | Implemented, automation only | Seven drivers who are not people (bear, fox, rabbit, frog, robot, alien, masked wrestler) on the adult body; outfits, a racing helmet, a cowboy hat, a mohawk. Dogs and cats remain |
| Only one or two kids | Done | Two in the cast, labelled Kid; "Age" is an option in the builder. Seats saved from the old cast reset once |
| Not a child's game: the look | Implemented, automation only | Dark glass and neon interface, condensed italic type, slanted buttons, glow-tape track edges, moodier light. Screens reviewed at 1280×720 and 844×390: home, play sheet, driver picker and builder, race HUD, results |
| Not a child's game: the sound | Implemented, **measured but never heard** | Lobby and race are synth tracks on one four-chord loop; the music box is gone from both. Offline render: no clipping, nothing silent |
| Something to come back for | Implemented and tested (the arithmetic); automation only (the screens) | Two players: a first-to-three series whose score carries across rematches (`tests/stakes.test.ts`). Solo: bronze, silver and gold times with the gap to the next. Both end; nothing punishes stopping (D-022) |
| "Every person in the world gets hooked" | **Not something a build can claim** | What exists is a race, a score to settle and a time to beat. Whether anyone wants a second race is the open question it has always been, and only people can answer it |

**Checks on this build:** 79 of 79 automated tests; type-check clean; production build 930 KB JS + 326 KB CSS (267 KB + 220 KB gzipped; the CSS is mostly the two bundled typefaces). The five scripted play-throughs were run again on it (before the boombox, the neon sign and a one-line results fix were added), zero page errors:

| Run | What happened |
|---|---|
| Solo, keyboard, three laps, then the main button | The scripted driver opened the plank, used it and won on Gentle in 55.17 s: **Silver, 0.17 s off Gold**, and the main button read "Go for Gold". Pressing it started a new countdown |
| Split screen, two keyboards, one lap, then the main button | Rex first, Zadie third behind a bot. Scoreboard: "Rex 1–0 Zadie · Rex leads. First to 3". "Next race" started the next one |
| Solo, touch, landscape phone | Finished fourth, 14 s back, with one very slow lap: the scripted thumb, not a person |
| Solo, touch, phone upright | Finished fourth, 5.5 s back |
| Split screen, two thumbs | Rex beat Zadie by 0.22 s; series 1–0 |

The parked Courier mode completed one scripted round with the adult cast, zero page errors.

**What is weak or unknown here:**
- Taste. Whether this is the right kind of adult, and whether the non-people are funny, is the founder's call and then real players'.
- Bodies are simple: one-piece arms and legs, no elbows or knees. Seated in a kart that reads fine; standing in the picker's preview they are a little stiff.
- Medal times (55 / 58.5 / 63 s) come from the stand-in drivers.
- The parked Courier mode was tuned for the old bodies; with adults it has had one scripted round and no visual review.
- Still one track, still local only, still never played by a person or run on a phone.

## Milestone: racing prototype — Backyard Dash

**What exists:** a complete race on one track. Lobby with your two drivers in their karts → play sheet (Race or Split screen, rival level) → countdown that meets your driver face to face → three laps with drifting, boosts, towing, contact, a shortcut that somebody has to open → results with portraits, times, gaps, best laps and who opened the plank → Rematch.

**How to run:** `npm install && npm run dev`, open `http://127.0.0.1:5173`. On another device on the same network: `npm run dev -- --host 0.0.0.0`. Single-file build: `npm run build && node scripts/build-single-file.mjs out.html --page`.

What the review asked for, and where it stands:

| Asked for | Status | Evidence |
|---|---|---|
| One short track, a 60–90 s race | Implemented and tested | Backyard After Dark, 305 units. Rivals at equal throttle: winner 54.6 s on average over 24 races, laps 18.5 s on average (`dev/raceprobe.ts`). Stand-in drivers: 57–70 s |
| One handling model: steering, grip, sliding, contact, recovery | Implemented and tested | `tests/dash.sim.test.ts` — 29 tests: auto-acceleration and top speed, steering direction, drift keeps speed and charges, early release pays nothing, grass and boost, braking and reverse, karts shove apart, nothing passes through the pot or the tennis ball, determinism, no NaN under random abuse |
| Simple touch controls: steer plus one satisfying manoeuvre | Implemented, automation only | Drag to steer; hold DRIFT and release for a boost (two levels, shown by spark colour and a meter). Scripted touch on an emulated phone drove a lap (below). **Whether it is satisfying is unknown** |
| A dependable route and a faster one that needs better execution | Implemented and tested; the trade-off is **simulated** | Plank 34 units against 60 by road. Stand-in drivers: the plank saved about 5 s over a race at a 150 ms reaction delay (52.0 s against 57.2–57.4 s) and cost about 4 s at 250 ms (64 s against 60 s), from falling into the soil |
| One world interaction that stays for the race | Implemented and tested | The plank is blocked until someone bumps the peg; the bumper loses 28 % of their speed once; it stays open for everyone; results name them (tests + scripted run) |
| Two real players in the first social test | **Ready, not done** | Split screen: two views, two sets of controls, two bot rivals. Driven by two scripted keyboards and by two scripted thumbs. No two people have played it |
| Fast recovery and rematching | Implemented, automation only | Wall hits nose you along the wall; a hard hit is one spin (0.37 s); stuck or wrong-way karts are put back on the road; Rematch from results starts a new countdown (scripted) |
| Existing characters, used provisionally | Implemented, automation only | All 16 cast members and any built character drive; a `drive` pose for people and pets |
| Characters easier to read | Implemented, automation only | Drivers 1.28× with a low seat back; face-to-face countdown; portrait by your place; portraits on rival tags and results (D-018). Judged from screenshots only |
| A direct, full-screen presentation | Partly | A full-screen button appears where the browser allows it (not iPhone Safari). A single self-contained HTML file can be opened straight from disk on a laptop, with no viewer around it (checked: it boots from a `file://` address). The private preview still sits inside a viewer; a bare URL for a phone needs hosting, which needs your go-ahead (`DEPENDENCIES.md` #2) |
| Less baby-like characters over time | Not started | Needs direction (`DEPENDENCIES.md` #8) |
| Keep the Courier build | Done | Reachable from the play sheet; its 45 tests still pass |

An independent review of the racing code was run before this was called ready (D-021). Its most important finding: the open lawn was a shortcut worth 7–10 s a race. That is closed by a ladder lying along the lawn; the reviewer's own lawn-cutting driver now fails to finish. Eight smaller defects it found are fixed; two risks it raised need a device.

Other things built for this milestone:

| Area | Status | Evidence |
|---|---|---|
| Rival bots, three levels (Gentle, Keen, Fierce), labelled | Implemented and tested; tuned on **simulated** drivers | Tests: levels are ordered; Gentle rivals are over 2 s slower than Fierce across two laps. No rubber band (D-019) |
| Tow behind another kart | Implemented and tested | Part of the sim; rivals and stand-ins both benefit |
| Start boost and stall | Implemented and tested | Tests |
| Chase camera, countdown and finish orbits, boost FOV, shake | Implemented, automation only | Screenshot review. A bug that showed the kart from the front mid-race was found this way and fixed |
| Race HUD: place, driver portrait, lap, clock, minimap, drift meter, banners, wrong-way, rival tags that avoid each other | Implemented, automation only | Screenshot review at 1280×720, 844×390 and split |
| Backyard After Dark world kit and karts | Implemented, automation only | Screenshot review. One race view: 78 draw calls and 62k triangles, with about 2 ms of script per frame (measured in the page); split screen draws it twice |
| Race audio: engine, skid, boost, charge, bumps, laps, plank, race music | Implemented, **measured but never heard** | `dev/measure-audio.mjs` renders every sound offline, the race set included: no NaN, nothing silent, no clipping (ten sounds stacked peak at 0.72), every one-shot ends. The engine never stops, so it was set to sit level with the skid and under the one-shots (RMS about 0.04–0.06 against 0.04–0.09 for boosts and chimes). That balance is a guess made from numbers |
| Hints that retire once the action is done | Implemented, automation only | Start, steer, drift, peg |
| Personal best per mode and rival level | Implemented, untested | Stored on the device; three-lap races only |

**Automated play-throughs** (headless Chromium, software rendering, scripted input through the real UI, production build). Game time was slowed for the scripted driver because this browser acknowledges input about once per 100 ms frame; without that a script reacts 0.5–1.5 s late, which no driver survives. Each run failed on any page error.

| Run (`dev/race-evidence.sh`) | Window | What happened |
|---|---|---|
| Solo, keyboard, three laps, then Rematch | 1280×720 | The scripted driver knocked the peg out, took the plank, and won on Gentle in 54.32 s (best lap 17.75 s). Waffles, a bot, +1.78 s. Results offered Keen. Rematch started a new countdown |
| Split screen, two keyboards, one lap, then Rematch | 1280×720 | Player 1 first in 19.87 s, player 2 second at +0.90 s, a bot third at +1.45 s. A bot opened the plank. Rematch started |
| Solo, touch (floating stick, second finger to drift), one lap | 844×390, emulated phone | Third, 0.98 s behind the winning bot; best lap 20.43 s against the bots' 19.5–19.9 s |
| Solo, touch, phone held upright (stage rotated), one lap | 390×844, emulated phone | First in 20.70 s |
| Split screen, two thumbs with automatic drift, one lap | 1180×820, emulated tablet | Player 1 first in 18.53 s, player 2 second at +0.73 s |

Five runs, zero page errors. They were run on the build that includes every fix in D-021 except the last two, which changed only the engine's loudness and the wording of the finish banner.

**Stand-in drivers against each rival level** (`dev/humanish.ts`, 12 races each, **simulated**: a pursuit driver with a reaction delay; "thumb" steers proportionally, "keys" all-or-nothing):

| Stand-in | Gentle | Keen | Fierce |
|---|---|---|---|
| Thumb, 150 ms, drifts | avg place 1.1, wins 11 | 1.6, wins 5 | 3.4, wins 0 |
| Thumb, 150 ms, drifts, takes the plank | 1.0, wins 12 | 1.0, wins 12 | 1.2, wins 10 |
| Thumb, 250 ms, drifts | 2.4, wins 0 | 3.0, wins 0 | 4.0 |
| Thumb, 250 ms, never drifts | 2.1, wins 3 | 2.8, wins 2 | 4.0 |
| Thumb, 250 ms, drifts, tries the plank | 2.9, wins 1 | 3.8 | 4.0 |
| Thumb, 350 ms, calm, never drifts | 3.8 (finishes about 11 s behind the winner) | 4.0 | 4.0 |
| Thumb, 350 ms, over-corrects, never drifts | does not finish in time | same | same |
| Keys, 150 ms, drifts | 1.5, wins 6 | 2.5, wins 1 | 3.9 |
| Keys, 250 ms, drifts | 3.3 | 4.0 | 4.0 |

**What was observed (by me, through screenshots, logs and measurements):**
- The first rivals were too quick and too alike: three bots finished within 1.3 s of each other and every stand-in came last every time. This is what the rival levels fix.
- A stand-in that reacts late and steers hard cannot hold the road at all. Whether a real newcomer is like that is not known; it is the first thing to watch for.
- All-or-nothing keys are harder than a thumb at the same reaction delay (68 s against 60 s at 250 ms on Gentle). That is a stand-in's result; two people on one keyboard are at least equally handicapped.
- The first chase camera averaged angles across the wrap-around and looked at the kart from the front after the first corner. Fixed.
- From behind, a normally proportioned driver was a tuft of hair over a seat back. Hence the bigger drivers and the portraits.
- BRAKE originally sat under the steering thumb. Moved beside DRIFT.
- I did not see that the lawn was a shortcut; the independent reviewer did, by writing a driver that tried it. A boost also made flowerbed soil quicker than the road, which undercut the plank. Both fixed (D-021).
- The race used to end on the tick the player finished, so beaten rivals showed "lap 3 of 3" instead of a gap. It now runs on for 2.5 s.

**What passed (at that point):** 74 of 74 automated tests; type-check clean; production build (911 KB JS + 225 KB CSS; 261 KB + 153 KB gzipped); the play-throughs above with zero page errors.

**What failed or is weak:**
- Frame rate on a real device is unknown, and split screen doubles the drawing. Headless numbers are software rendering and mean nothing here.
- Nothing about feel is known: whether the drift is satisfying, whether the speed is right, whether the plank reads as a choice.
- The scripted drivers only cope with game time slowed four or five times, because this browser hands them input late. The play-throughs show that the game holds together and can be driven through its real controls; they say nothing about how it feels at full speed in a hand.
- Split screen on a phone is small. It wants a tablet or a laptop.
- Sound has never been listened to.
- Online racing does not exist.

**What remains uncertain:** everything that needs people. `GDD.md` §12 lists it.

**Next concrete action:** race a friend in split screen on a tablet or laptop, and answer the one question at the top of `PLAYTEST.md`.

## Review through five lenses → one decision

**Play design.** A race now has things to be better at: the start, every corner, the route, one shared decision, and each other. Weak points: one track will be learned in an evening; there is nothing to do to a rival except be near them; the peg is a once-per-race event, and on Fierce the leading rival always takes it on lap two, so that decision can be made for you; a race decided by a plank fall has no way back except the tow.

**First-use experience.** Two taps from home to a countdown; the kart drives itself; hints arrive one at a time. Unproven: whether "hold and release" is found from one line of text, whether a thumb can steer at this speed on first touch, whether the default Gentle rivals feel like a race or a parade.

**Shareability.** The countdown face-off and the finish orbit are the frames with people in them; the plank dropping is the event. There is still no clip capture, and the drivers are templates, not likenesses.

**Engineering.** The race reuses the deterministic-simulation discipline, the character kit, the audio engine and the shell. Unknowns: phone frame time in split screen; touch behaviour on iOS Safari; whether the two-finger drift fights the floating stick on a real screen. The shell now hosts two attractions with separate views and HUDs; that seam was only added when the second one existed.

**Business.** Nothing is sold and nothing should be yet. The fairness rules that a shop would have to respect are now in code and in the project rules: one kart, no bought speed.

**The decision.** Stop building and get two people to race. If they ask for another, the next build is the second half of the social promise: racing someone who is not in the room (online), then a second track. If they do not, the handling and the track are what to change, before anything is added.

## Parked: Stage A — Catapult Courier

*Kept as a record. This build is intact and playable; it is no longer being developed (D-016). Counts in this section are as they were at the end of that stage.*

**What exists:** Catapult Courier, a complete round with a beginning, a skilful middle, a readable outcome, a results screen and instant rematch, on the Birthday Continental table, with people, dogs and cats as characters.

**How to run:** `npm install && npm run dev`, open `http://127.0.0.1:5173`. Single-file build: `npm run build && node scripts/build-single-file.mjs out.html --page`.

| Area | Status | Evidence |
|---|---|---|
| Deterministic simulation (launch, umbrella, wind, jelly, balloons, rings, basket rims, dive) | Implemented and tested | `tests/courier.sim.test.ts` — 26 tests: identical inputs → identical hashes; no NaN under random abuse; role enforcement; catch geometry; no tunnelling; dive timing; scoring |
| Arena keeps the catcher involved | Implemented and tested | Test asserts ≥ 60 % of the aim space lands in the lane; probe measures 72–75 % |
| No flight can stall | Implemented and tested | Jelly tires after two bounces, the liner goes soft after eight rattles, a wedged flyer is called a miss within 0.75 s, hard cap 9 s. 1,440 bot launches after the fix: zero timeouts |
| "The table remembers" | Implemented and tested (within a round) | Popped balloons stay popped; every miss leaves a splat in the launcher's colour |
| Buddy, the labelled bot partner | Simulated partner, implemented and tested | 240 bot-with-bot rounds: 82 % / 93 % / 99 % catches at skill 0.3 / 0.65 / 0.9. Labelled "bot" in the play sheet, HUD and results |
| Touch, mouse and keyboard controls | Implemented, automation only | `dev/playthrough.mjs` completes rounds with mouse and keyboard; `dev/touch-test.mjs` performs the pull, release and umbrella hold with real touch events on an emulated 844×390 phone (Chromium engine, not iOS Safari). No person has tried the gestures |
| Same-screen two-player | Implemented, automation only | Script launches from both halves; catching in this mode was not scripted |
| Always-landscape rotation for portrait windows | Implemented, automation only | Play-through at 390×844 completes a launch with remapped pointer input |
| Camera (lean-in, pull-reveal, flight framing, outcome close-up) | Implemented, automation only | Screenshot review of every phase |
| HUD, hints that retire once learned, results breakdown, personal best | Implemented, automation only | Screenshot review |
| Characters: 9 people, 4 dogs, 3 cats, 13 actions, 8 expressions | Implemented, automation only | Contact sheets reviewed by eye for a person, a dog and a cat in every action. 4.4k–5.6k triangles, 3 draw calls, 31–37 bones each (measured) |
| Character builder with live in-game preview and real portraits | Implemented, automation only | Script picks, edits, randomises, switches species |
| Fairness of looks | Implemented by construction | One collider and one carry point for all species (`RIG`); the basket is placed by the simulation, never by the character |
| Audio: 26 sound effects, 3 continuous voices, adaptive music-box score | Implemented, **measured but never heard** | `dev/measure-audio.mjs` renders every sound offline: no NaN, nothing silent, no clipping (ten sounds stacked peak at 0.72), every one-shot ends. Mix balance and musicality are unverified by ear |
| Accessibility options | Implemented, automation only | Reduced motion, open aim assist (labelled on results), tap-umbrella, left-handed dive, non-colour cues |
| Private online rooms (server) | Implemented and tested | `tests/rooms.test.ts` — 19 tests incl. two real WebSocket clients finishing a round and agreeing on every result; rejoin, bot takeover, rematch, flood and garbage handling |
| Online play in the browser | Implemented, automation only | `dev/online-test.mjs`: two browser pages made and joined a room by code, readied up, finished a round with identical results on both, and started a rematch; zero page errors. Same machine, no added latency, never on two real devices |
| Production build | Implemented and tested | `npm run build`: 845 KB JS + 217 KB CSS (237 KB + 151 KB gzipped), one HTML file |
| Private hosted preview | Published, **not verified on a phone** | Single-file build published as a private page for the founder |

**What was observed (by me, through screenshots and logs):**
- The first arena sent only 24 % of launches into the lane. Reworked to 72–75 %.
- At the first scale, characters were about 28 px tall on a 720p screen in wide shots. The arena was compressed 1.8× so the widest framing keeps a character near 1/12 of the screen height.
- Flights could bounce on the jelly forever or wedge between the basket and the cake. Fixed and guarded by tests.
- The bot partner caught 97–100 % and left the human nothing to do. It now misjudges like a person.
- A local catcher could not see their own character while the camera leaned in on the launcher. Fixed.

**What passed:** 45 of 45 automated tests; type-check clean; production build; scripted full rounds in buddy, same-screen and portrait configurations with zero page errors.

**What failed or is weak:**
- Frame time is unknown. Headless software rendering shows ~100 ms per frame, which says nothing about a phone. The play scene issues 103–122 draw calls and 138k–149k triangles per frame **including the shadow pass**.
- The set dressing is still visually busy behind the play plane, even with depth haze.
- The parallel build of the art kits was cut off by a usage limit before its review stage ran, so the character, prop and audio kits have had one author and no independent review.
- Sound has never been listened to.

**What remains uncertain:** everything that needs a person — whether both roles are fun, whether the pull and dive gestures are discoverable, whether the characters are recognisable enough to matter, and how it feels at real network latency.

**Next concrete action:** open the private preview on an iPhone, play one solo round and one same-screen round with another person, and answer the five questions at the top of `PLAYTEST.md`.

### Review at the end of Stage A (superseded by D-016)

**Play design.** The action has anticipation, release, a controllable flight and a contact moment, with a real choice (aim at your catcher or through the donut). Weak points: the catcher has little to do while the other player aims; the umbrella is optional in many flights; one arena with a fixed six-launch script will wear thin; the balloons rarely matter; "the table remembers" is so far cosmetic inside one round.

**First-use experience.** Three taps from home to playing, hints appear in context and retire once done. Unproven: whether a one-thumb tap-to-dive is discoverable on a shared phone, whether a child can pull far enough for full power, and whether the first seconds (banner, name tags, hint) are too many messages at once. A remote pair has no way to react to each other yet (no emotes).

**Shareability.** The strongest image in the build is a pet peeking out of the basket its person is holding overhead. The world reads at a glance. Template characters are charming, but "that is exactly my dog" needs more than four dog silhouettes can promise, and there is no clip capture.

**Engineering.** Sound foundations: one deterministic simulation shared by client, bot, server and tests. Unknowns: frame time on a phone, audio start-up and touch behaviour on iOS Safari, behaviour inside an embedded web view, play at real latency. The app shell is wired to one attraction on purpose; shared systems should be extracted when a second attraction exists, not before.

**Business.** Nothing is sold and nothing should be yet. Template characters cost nothing to produce, so the first measurable cost question arrives with photo-driven characters.

**The decision.** Do not add content on top of an untested core. The next step is a real pair playing this build (`PLAYTEST.md`). The next build step, in parallel, is the smallest thing that tests the central-loop bet: a second attraction that *uses* what the first left on the table (Sprinkle Sprint, where splats and popped balloons change the race) plus the one-move "Set the Table" choice between them. If real pairs say the catcher is bored while the other aims, fix that before either.

## Stage status at a glance

| Stage | Status |
|---|---|
| A — first exceptional interaction | Rebuilt as a race (Backyard Dash) after review of the first attempt; **awaiting human play** |
| B — meaningful variety | Not started. A second track, or online racing, depending on what the first races show |
| C — one coherent session (several races, standings, rematch) | Rematch exists; standings across races do not |
| D — personalisation from photos | Blocked on: processor choice, consent flow, budget (see `DEPENDENCIES.md`) |
| E — observe real groups | Plan written (`PLAYTEST.md`); blocked on people |
| F — release candidate | Not started |
| G — second world | Not started |

# Progress and acceptance record

Last updated: 2026-11-11 (end of the first working session).

## Status words

| Word | Meaning |
|---|---|
| **Implemented and tested** | Built, and an automated test or measurement listed here exercises it |
| **Implemented, automation only** | Built and driven through the real UI by a script; no person has used it |
| **Implemented, untested** | Built; nothing has exercised it yet |
| **Simulated** | Shown by bots or a local stand-in for the real thing |
| **Proposed** | Designed on paper only |
| **Blocked** | Cannot proceed without the named dependency |

Nothing in this project has been played by a person other than through scripts, and nothing has run on a physical phone that we have observed. There are no player reactions, retention figures, revenue figures or device frame rates in this repository, because none exist yet.

## Milestone: Stage A — first exceptional interaction

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

## Review through five lenses → one decision

**Play design.** The action has anticipation, release, a controllable flight and a contact moment, with a real choice (aim at your catcher or through the donut). Weak points: the catcher has little to do while the other player aims; the umbrella is optional in many flights; one arena with a fixed six-launch script will wear thin; the balloons rarely matter; "the table remembers" is so far cosmetic inside one round.

**First-use experience.** Three taps from home to playing, hints appear in context and retire once done. Unproven: whether a one-thumb tap-to-dive is discoverable on a shared phone, whether a child can pull far enough for full power, and whether the first seconds (banner, name tags, hint) are too many messages at once. A remote pair has no way to react to each other yet (no emotes).

**Shareability.** The strongest image in the build is a pet peeking out of the basket its person is holding overhead. The world reads at a glance. Template characters are charming, but "that is exactly my dog" needs more than four dog silhouettes can promise, and there is no clip capture.

**Engineering.** Sound foundations: one deterministic simulation shared by client, bot, server and tests. Unknowns: frame time on a phone, audio start-up and touch behaviour on iOS Safari, behaviour inside an embedded web view, play at real latency. The app shell is wired to one attraction on purpose; shared systems should be extracted when a second attraction exists, not before.

**Business.** Nothing is sold and nothing should be yet. Template characters cost nothing to produce, so the first measurable cost question arrives with photo-driven characters.

**The decision.** Do not add content on top of an untested core. The next step is a real pair playing this build (`PLAYTEST.md`). The next build step, in parallel, is the smallest thing that tests the central-loop bet: a second attraction that *uses* what the first left on the table (Sprinkle Sprint, where splats and popped balloons change the race) plus the one-move "Set the Table" choice between them. If real pairs say the catcher is bored while the other aims, fix that before either.

## Stage status at a glance

| Stage | Status |
|---|---|
| A — first exceptional interaction | Built; awaiting human play |
| B — meaningful variety (two contrasting attractions) | Proposed; specs in `ATTRACTIONS.md` |
| C — one coherent tour (board choice, scoring, rematch) | Proposed; rules in `GDD.md` §5 and `SCORING.md`. Online rooms and rematch are ahead of schedule |
| D — personalisation from photos | Blocked on: processor choice, consent flow, budget (see `DEPENDENCIES.md`) |
| E — observe real groups | Plan written (`PLAYTEST.md`); blocked on people |
| F — release candidate | Not started |
| G — second world | Not started |

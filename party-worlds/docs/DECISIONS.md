# Decision record

Newest first. Each entry: what was decided, why, what it costs, and what would change it.

## D-022 · A game for grown-ups that looks like one (2026-11-11)
The founder, on seeing the racing build: it feels like a child's game; the characters are babies and dolls; make it something adults enjoy and come back to, "nostalgia plus new age", with adult drivers who can be funny, different, animals, anything, and only one or two kid options.
**What changed.**
- **Drivers are adults by default.** About four heads tall instead of two and a bit; a neck, shoulders wider than the head, a jawline, eyes a sensible size, a nose with a bridge, almost no blush. Done by building the head at the size every face part, hairstyle, pair of glasses and hat was designed for, and wearing it at 60 % on a new, longer body (`BodyDesc.headScale`), so nothing had to be redrawn.
- **Clothes say who someone is:** tee, hoodie, jacket, suit, vest. A racing helmet and a cowboy hat; a buzz cut and a mohawk.
- **Drivers who are not people,** on the same adult body: a bear, a fox, a rabbit, a frog, a robot, an alien, a masked wrestler. This is where "funny, different, animals" lives.
- **The cast:** ten adults, seven non-people, two kids (the old proportions, kept as an option and labelled Kid), four dogs, three cats. Seats saved from the old cast are reset once, so nobody opens the new build to last week's toddler.
- **The kart's paint belongs to the driver** and is what stands for them on the minimap, tags and results.
- **The look:** dark glass and thin neon instead of cream cards; a condensed italic typeface and slanted buttons (the bones of the arcade racers adults grew up on) with a modern finish. Glow-tape road edges, pink on the inside of the lap and blue on the outside. Moodier light.
- **The sound:** the music box is gone from the race and the lobby; both are synth tracks on one four-chord loop.
- **Something to race for:** two people play a first-to-three series with a scoreboard that carries across rematches; alone there are bronze, silver and gold times and the gap to the next one.
**On "addicted".** The aim is that people want another race and feel fine about having wanted it. So the hooks are a score to settle, a time to beat and a rival to move up to, and each of them ends: a series finishes at three, gold is gold. There are no timers that punish leaving, no streaks that break if you stop, no random rewards, nothing for sale. That is the brief's "trustworthy" promise applied to this request, and it is a limit on what will be built here.
**Cost.** Kids' proportions and the Courier poses were tuned for the old bodies; adults in Courier are untested beyond one scripted round. Font payload grew (CSS 225 → 326 KB). Medal times and everything about tone are untested on people.
**What would change it.** The founder's eye, first. Then real adults: if they still pick the dog every time, or nobody laughs at the frog, the cast is wrong.

## D-021 · An independent review of the racing code, and a ladder on the lawn (2026-11-11)
A second reviewer read the racing code cold and ran its own probes. What it found and what was done:
- **The whole infield was a shortcut.** A straight line across the lawn skipped either end of the lap and won by 7–10 s at every rival level. Fixed with an object, not a rule: an aluminium ladder lies along the middle of the lawn from the big pot to the hairpin, rails and end rungs solid, with the tennis ball plugging the last gap. The same cut now ends against the rails. A boost also used to make soil faster than road (it ignored 65 % of a surface penalty); it now ignores 40 %, so boosted grass is about road pace and boosted soil is slower.
- Editing a preset character left the original on the grid as a bot **with the same name**. Rivals are now chosen to share neither identity nor name with your drivers.
- Driving back over the start line ranked you a lap ahead. A kart behind the line now counts as behind until it crosses forward again.
- The race stopped dead on the tick the last person finished. It now runs on for 2.5 s, so a rival half a second behind gets a time rather than "lap 3 of 3", and karts roll on past the flag.
- Engine and skid kept sounding on the pause screen, and could not be stopped while the phone had suspended audio. Both fixed.
- A kart caught mid-blink could stay invisible in the lobby; rebuilding a kart leaked the old one; the visible hose ran 7 units past its collider. Fixed.
- Input: the first finger down was the steering finger for good, so a resting palm took the wheel. A second finger that is clearly steering while the first has not moved now takes over. A well-timed tap now earns the start boost without being held through GO. Split-screen hints name W and ↑ for drift rather than the two Shift keys, which on Windows can raise the Sticky Keys prompt (Shift still works). A tall desktop window is letterboxed instead of rotated.
**Not acted on:** nearest-road tracking can lose a kart that jumps more than 70 samples ahead; with the ladder in place no route does that. Four-finger system gestures on an iPad in split screen are a risk only a device can show.
**Why it mattered:** the lawn cut would have decided the first real race between two people the moment one of them tried it.

## D-020 · Experiments measured and dropped: keyboard wind-up, steering help (2026-11-11)
Two additions were built, measured against the stand-in drivers in `dev/humanish.ts`, and removed.
- **Keyboard wind-up** (a held key starts at half lock and winds on): 67.1 s against 64.6 s for plain all-or-nothing keys over three laps with a 250 ms reaction delay. Worse, so plain keys stay; the kart's own 60 ms steering smoothing is the only filter.
- **Steering help** (a nudge back from the road's edge, costing the big boost): it helped one stand-in (keys, 250 ms, drifting: 68.5 → 65.4 s), did nothing for the thumb stand-in it was meant for (62.4 → 62.8 s), and the slowest stand-in failed to finish with or without it.
**Why dropped:** the brief for this build is one handling model. An assist nobody has shown to help is one more thing to explain and to get wrong.
**What would change it:** real first-time players who cannot stay on the patio on Gentle. The measurement lines are in `PROGRESS.md`.

## D-019 · Rival pace is two stated dials and no rubber band (2026-11-11)
Rivals differ in *skill* (lines, drifting, mistakes) and in *throttle* (85–100 % of the kart's top speed, fixed for the race, shown on the play sheet). Three levels: Gentle (default), Keen, Fierce. People always have full throttle. Nothing reacts to where a player is on the track; the only catch-up in the game is the tow behind another kart, which works for everyone.
**Why:** with skill alone the three rivals finished within 1.3 s of each other and every stand-in driver with a human reaction delay came last in every race. Easing the throttle is the honest version of a slower rival; it is one number a player can be told.
**Cost:** on Gentle and Keen the rivals' karts are, by a stated amount, slower than yours. Results name the level.
**What would change it:** people finding Gentle patronising or Fierce unreachable; the ladder was tuned on stand-ins, not people.

## D-018 · Drivers sit big in small karts, and the game brings faces to you (2026-11-11)
A chase camera shows the back of a head, and the review of the first build said characters were too small to read. So: drivers are scaled 1.28× in the kart and the seat back is cut down so head and shoulders show from behind; the countdown starts face to face with your driver and swings round behind for GO; the finish orbits back to the face; the HUD carries your driver's portrait beside your place; rival name tags carry portraits; results rows carry portraits.
**Why:** "it's us" is the first promise. In a racer it has to be kept by presentation, because the play view cannot do it alone.
**Cost:** none to fairness: the kart's collider is one radius for everyone (`KART.radius`).

## D-017 · Backyard Dash is deliberately one of everything (2026-11-11)
One track (Backyard After Dark, 305 units, about 18–20 s a lap, three laps), one kart, one handling model (karts accelerate by themselves; you steer; velocity swings toward the nose quickly with grip and lazily in a slide), one manoeuvre (hold DRIFT in a corner, release for a boost; two levels), one route choice (a scaffold plank across the flowerbed, 34 units against 60 by road, narrow, with slow soil either side), one world interaction (the plank is propped up on a clothes peg; whoever knocks the peg out loses a little speed and opens the shortcut for everyone for the rest of the race).
**Why:** the brief for this build. A race people want to win first; variety later.
**Not in this build on purpose:** items, coins, more tracks, kart stats, online racing.

## D-016 · Racing is the core; adult friend groups are the audience; Catapult Courier is parked (2026-11-11)
The founder shared a recording of Catapult Courier with an advisor. The review: the world, the role swap and the catch were liked; characters were too small; and, decisively, the build had drifted from what excited the founder, which is racing against friends. Direction given: make racing the core of the next prototype with adult friend groups as the primary audience; keep personalised people and pets and miniature worlds; keep the Courier build as a parked experiment.
**What changed:** the app opens on the racing lobby; Courier, its online rooms and its tests are kept intact and reachable from the play sheet under "Parked experiment". D-002 (one table, one evening) is suspended, not withdrawn: "the world remembers" survives as the plank.
**Cost:** Stage A's open questions about Courier (is the catcher bored, is the dive discoverable) are no longer being pursued. Online play exists for Courier only.
**What would change it:** the racing test failing where Courier's would not, i.e. two friends finish a race and do not ask for another.

## D-015 · The art, character and audio kits were finished by one author (2026-11-11)
The first parallel build (one agent per kit, each followed by an independent review) was cut off by a usage limit after roughly two thirds of the character and prop work and before any audio or review. The remainder — the whole animation layer, the audio kit, integration — was written directly instead of relaunching.
**Why:** relaunching risked the same limit with nothing playable at the end.
**Cost:** no independent review of those kits yet. Recorded as owed in `DEPENDENCIES.md`.

## D-014 · No flight may stall (2026-11-11)
Bot rounds found flights that bounced on the jelly indefinitely or wedged between the basket and the cake. Rules added: the jelly gives its full spring twice and then tires; the paper liner stops deflecting after eight rattles; a flyer that has moved less than 0.3 units in 0.75 s is called a miss; hard cap 9 s.
**Why:** a ten-second stall with nothing to do is worse than an unlucky miss.

## D-013 · The arena is 24 character-heights long, not 43 (2026-11-11)
Screenshots of the first assembled build showed characters about 28 px tall on a 720p screen at the widest framing, and half that on a phone. Every distance and speed was divided by 1.8 (times unchanged), so the widest shot keeps a character near 1/12 of the screen height.
**Cost:** tiny-ness is slightly less extreme, and catches became more forgiving; the bot partner and "perfect" window were re-tuned to compensate.
**Also:** a soft haze plane sits just behind the play plane so the set dressing stops competing with the things you play with.

## D-012 · Outcomes are never predicted online (2026-11-11)
Clients predict motion; a catch, a miss and every point come only from the server.
**Why:** a "CAUGHT +100" that is taken back destroys trust faster than three frames of delay.
**Cost:** celebration starts a few frames after contact at typical latency.
**Revisit if:** real-latency play shows the delay reads as mushy.

## D-011 · One input applied per server tick, queued (2026-11-11)
The server queues each seat's inputs and consumes one per tick, instead of "latest wins".
**Why:** otherwise two packets arriving in one tick lose a press or the final aim; the release packet also carries the final aim so the launch is exactly what the player let go of.
**Cost:** up to a few ticks of extra input delay after a stall (queue is trimmed to catch up).

## D-010 · A dropped online player is replaced by a labelled bot after 10 s (2026-11-11)
**Why:** the stayer should get to finish; a co-op round cannot be completed alone.
**Cost:** that result is not a fair personal best, so it is marked and excluded.

## D-009 · Private rooms are 2 players, code-based, no accounts (2026-11-11)
**Why:** the first social promise is a pair (parent–child, couple). No accounts means no personal data and no moderation surface while the game is being found.
**Revisit when:** a second attraction supports 3–4 players.

## D-008 · Bonuses bank only on a catch; a miss scores zero (2026-11-11)
**Why:** the delivery is one shared result. It keeps the catcher essential and makes "we nearly had that donut" a reason to go again.
**Risk:** harsh for small children. The open aim assist exists for that; partial credit is the fallback if playtests show frustration.

## D-007 · The default aim preview shows only the first part of the flight (2026-11-11)
**Why:** if both players see the whole arc the catch is solved before release. Reading the bend is the catcher's skill.
**Alternative kept:** full arc + landing ring as an *open* assist, labelled on results.

## D-006 · The arena must send most launches into the catcher's lane (2026-11-11)
First layout: 24 % of the aim space reached the lane, so the catcher was a spectator. Reworked (shallow jelly as a forgiving trampoline, wider lane, obstacle removed): 69 %. A test fails the build below 60 %.
**Why:** in a co-op catch game a launch that never reaches the lane is the worst outcome — one player did nothing.

## D-005 · Template characters first; photo personalisation later (2026-11-11)
People, dogs and cats are built from ~15 data fields by code. No photo pipeline is connected.
**Why:** it needs no vendor, no personal data and no spend; the same data spec can later be filled by a photo-interpretation step. Research (`research/avatar-pipeline.md`) could only read vendor pages via search excerpts in this environment, so no vendor is selected.
**Revisit when:** real pairs have reacted to template characters, and the founder has approved a processor, a budget and a consent flow.

## D-004 · Always-landscape by rotating the stage (2026-11-11)
If the window is portrait, the whole stage is CSS-rotated 90° and touches are remapped.
**Why:** embedded web views and orientation-locked phones cannot rotate; the game still fills the screen when the phone is turned.

## D-003 · Simulation is a pure deterministic module, separate from rendering (2026-11-11)
**Why:** one implementation serves local play, prediction, the server, the bot, tests and future replays; and it is the part that would be ported to another engine.
**Cost:** simulation code must avoid `Math.sin` etc. and use `core/dmath.ts`.

## D-002 · Central loop: one table, one evening; the table remembers (2026-11-11)
See GDD §2 for the comparison of five candidates.

## D-001 · Build stack: TypeScript + Three.js (web), not Unity (2026-11-11)
**Found:** Linux container; Node 22, headless Chromium with WebGL2; no Unity, Godot, Xcode or macOS.
**Decided:** build the playable in web technology so it can be run, seen and tested here and opened on a phone by link.
**What this is not:** a native iOS build. It has not been run on an iPhone by us.
**Path to the App Store, to be chosen with evidence:** (a) wrap this build with Capacitor (needs a Mac + Xcode + Apple developer account; real-device performance unknown), or (b) port to Unity, reusing the simulation rules, tuning numbers, tests-as-spec and art direction.
**Revisit when:** a Mac is available, or device profiling shows the web build cannot hold frame rate.

## Title
"BounceBack Party Worlds" stays as the working title. No stronger name has been cleared; a title needs a trademark and App Store search that cannot be done from here.

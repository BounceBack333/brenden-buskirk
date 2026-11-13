# Decision record

Newest first. Each entry: what was decided, why, what it costs, and what would change it.

## D-028 · A second track, built for a fight: The Grease Pit (2026-11-13)
Asked whether to build a track designed for fighting, with a track picker, the founder said: "Do it."
**What it is.** A figure of eight on a garage floor at night, 369 units round against the backyard's 305. The lane is swept concrete through sawdust; off it is slow, and the oil spill is slower.
- **The firing line.** A straight a hundred units long and eleven wide, half as wide again as anything in the backyard: room to pull alongside, room to dodge. Three paint tins stand in it, each to one side. A tin stops bullets and rockets, and it also stops karts.
- **The gate.** Two concrete blocks pinch the south straight to under six units, one kart and a bit. The mines are handed out just before it. The jerry can and the tyres close the inside, so the gate is the only way through.
- **The crossing.** The back leg crosses the firing line at right angles, on the level, under a yellow box. Whoever is coming down the straight is in somebody's sights, and there is a rocket crate on the approach.
- **The long way and the short way**, as in the backyard: a board across the oil spill, held shut by a wheel chock anybody can knock out, and the repair strip on the long way round.
- **Seven crates** against the backyard's five: two of rockets, two of mines, a shockwave in the hairpin where the pack bunches, a ram to carry through the junction, a shield on the long way round.
- **Armed**, the oil drum inside the west hairpin is alight and there are chevron boards behind both chains.
**Choosing.** The play sheet has a Track row. The choice is saved with the other settings; times and medals were already kept per track.
**How the crossing works without a bridge.** A kart's place on the lap is only ever searched for a little way ahead of where it last was, so the other road, which is 125 samples away round the lap, is never mistaken for this one. The consequence is deliberate: turn onto the other road at the junction and the game treats you as off the road (slow), credits nothing, and after two and a half seconds stands you back where you left. There is a test for exactly that.
**What had to change to make room for it.**
- A track's set dressing is now its own (`BackyardDressing`, `PitDressing`); a track says what it calls its shortcut and its prop, so the hints and banners read "chock" and "board" here; each world kit says how it is lit (`WorldMood`).
- The fires and chevron boards of an armed race moved out of the effects code into track data.
- `Track.pillars`: solid things standing in the road. Rivals steer round them on the side with more road. The backyard has none, so its rivals drive exactly as before.
- The play sheet's two big choices put their icon beside the title, so the sheet with one more row still fits a phone on its side without scrolling (measured at 1280×720, 844×390 and 667×375).
**Found on the way.**
- *The left-hand edge tape had never been drawn, on the backyard either.* Its strip was wound the other way and was culled. Both edges show now: warm on your left, cold on your right. This is the first time anybody has seen the backyard with both.
- The first layout had three gaps a kart fitted through (past the drum, round the inside of the gate, past the end of the strip light). The tests written for the track found all three before a browser was opened.
**Numbers**, all simulated (`TRACK=pit` with `dev/raceprobe.ts`, `dev/humanish.ts`, `dev/combatprobe.ts`):
- Rivals against each other: a lap in about 22 s, a race in about 65 s (backyard 18.6 and 55); under one wall hit a race across four karts, no resets.
- To the death, thirty races a level: 3.7 / 4.3 / 4.2 wrecks a race at Gentle / Keen / Fierce (backyard 2.6 / 4.0 / 4.3) and 1.0 / 1.0 / 1.1 karts put out (backyard 0.5 / 0.9 / 0.9); five or six rockets a race against four, about six mines against four. More of everything except ramming: a wide road means fewer accidental hits (2.3 a race against 2.3 to 5.7).
- The stand-in drivers finish two to three seconds further behind the same rivals here than in the backyard. Wide, simple corners suit a rival that never lifts. Not corrected: the fix would be a per-track throttle for rivals, and nobody has raced them here yet.
- Medal times set the same way as the backyard's: 67.5 / 71.5 / 75 s, and 71.5 / 76 / 80 s armed.
**The backyard** races exactly as it did: all 27 of its fingerprints are identical. 27 were recorded for the pit.
**Kept.** One kart and one kit for everyone; cars against cars; nothing bought, unlocked or random. Every crate on the new track always holds the same thing, as on the old one.
**Cost.** About 6 KB more script (281 KB gzipped of a 300 KB budget: the next world kit will need the budget looked at, or the kits loaded on demand). A longer race: about 75 s for a first-timer against 62.
**Not done.** No change to armour or guns. Nothing on the new track is a new rule: it is the same race in a different place. Nobody but me has seen it.
**What would change it.** Somebody playing both. Whether the crossing is funny or just confusing, whether anyone hides behind a tin on purpose, and whether 75 seconds is too long for one race are all unknown (`PLAYTEST.md`).

## D-027 · Things in the crates (2026-11-13)
The founder played the build to the death and said: "I like it. We're improving." Then, asked what felt off: "It felt good. Vehicles are weak, more power ups would be cool. Different weapons and such." (No word on the device or on how long was played.)
**Read as:** the karts do not hit hard enough. The guns take three magazines to wreck anybody and the only other thing to pick up was mines. If "weak" meant "die too easily", the remedy is the armour figure instead; that has been asked.
**What changed.** A kart now has one slot, filled by whatever crate it last drove through and emptied by one button. Each crate always holds the same thing and shows it on every face, so what you carry is a matter of where you drove, never of luck.
- **Rockets** (two): fly ahead at more than twice a kart's speed and lean toward whoever was in front when they left. 45 armour and a spin. The big pot and the tennis ball stop them.
- **Shockwave** (one): everything within nine units loses 22 armour and bogs down for most of a second. For the middle of the pack.
- **Shield** (one): nothing hurts for five seconds. A mine or a rocket still goes off against it.
- **Ram** (one; "overdrive" in the code): a four-second boost in which whatever you touch takes 40 and you take nothing.
- **Mines** (two): as before.
Where they are on the backyard circuit is part of the design: rockets at the start of the long straight, mines before the chicane, the shield on the long way round the flowerbed (one more reason not to take the plank), the ram on the run to the sweeper, the shockwave where the pack bunches round the pot.
**Controls:** the MINE button became the slot's button and shows what is in it (same key, same place).
**Rivals** use all five the way they are meant to be used and go looking for a crate when their slot is empty.
**Numbers** from `dev/combatprobe.ts`, thirty races a level, two lives: 2.6 / 4.0 / 4.3 wrecks a race across four karts at Gentle / Keen / Fierce; 0.5 / 0.9 / 0.9 karts put out per race; about four rockets a race with two or three hitting, one or two shockwaves, one or two shields and rams. Simulated.
**The plain race** is still the plain race: its nine fingerprints have not moved.
**Not done.** No change to armour or to the guns themselves. If the reading above is wrong, that is the next thing to change.

## D-026 · To the death (2026-11-13)
The founder was asked which way to push the armed race (harsher wrecks, more weapons, a meaner track) and said to continue. So: further in all three directions, as far as could be done without guessing at new content.
**What changed.**
- **To the death** is now the default way to race, beside Armed and Clean on the play sheet. Each kart has two wrecks in it. The second puts it out for good: it burns where it stopped, then is gone, leaving a scorch mark. If only one kart is left running before anyone has taken the flag, it has won there and then. Karts that are out rank behind everything still running, the later out the higher. Alone, the race is called 2.5 s after you go out; you are not left watching.
- **The spoils.** Wrecking a rival gives back 25 armour and a full magazine. Fighting is now a way to stay alive, not only a way to slow somebody down.
- **The yard remembers.** Every mine and every wreck leaves a burn on the road for the rest of the race.
- **A meaner yard when armed.** Fires burning in old tin cans down the middle of the lawn and behind the hairpin; red and white chevron boards round the outside of the hairpin; redder, closer light. All of it is where no kart can go, so none of it had to be made solid and the circuit is unchanged.
- **A harder score** for armed races: faster (138 against 126), staying in A minor, a bass that drives every eighth.
**Why two lives.** `dev/combatprobe.ts`, thirty races a level. With three lives no kart was put out in ninety races but one: the rule would have been decoration. With one life about two karts went out every race and the stand-in was out of more than half of them. With two, 0.3, 0.6 and 1.1 karts went out per race at Gentle, Keen and Fierce and the stand-in was out of 2, 9 and 9 races in thirty: a real risk, and most races still settled at the flag. Simulated; nobody has played it.
**The plain race** is still exactly the plain race: its nine fingerprints have not moved. The armed ones changed (the spoils) and nine more were recorded for races to the death.
**Kept from D-025.** Cars against cars only; nobody is hurt (a driver who is out sits in the smoke looking dizzy); every kart has the same kit and the same number of lives.
**Cost.** Going out early ends your race, which is the point and may also be the thing that makes somebody put the phone down. Armed (a wreck always comes back) is one tap away for that reason. The leader's rear is still the most dangerous place on the track.
**Not done.** No new weapons: a second gun or a rocket means another button, and nobody has yet said the first two are too few. No new track: the yard was re-dressed, not replaced.
**What would change it.** People. Whether being put out makes two friends shout at each other or makes one of them stop playing is the thing to watch (`PLAYTEST.md`).

## D-025 · Armed: more Death Race than Mario Kart (2026-11-12)
The founder, on the racing build: "let's make it more like death race than Mario kart".
**Read as:** a combat racer. The race is still what you win, but the karts are armed and can be wrecked. The rules are our own; nothing is taken from any film or game beyond the genre.
**What a kart carries** (identical for everyone, people and rivals; nothing chosen, bought, unlocked or random):
- *Armour*, 100. At nothing the kart is a wreck: 2.5 s stopped, then back on the road where it had got to with full armour and about two seconds of shield. Nobody is eliminated.
- *Twin guns.* Locked for the first 5 s after GO. Hold FIRE: ten rounds a second, 2 armour a round, 24 units of range, straight ahead within about five degrees. The big pot and the tennis ball stop a shot. Twenty rounds, refilling by themselves once you stop shooting.
- *Mines*, up to two, from three crates beside the racing line (a crate comes back after 15 s). A mine arms after 0.6 s, lasts 20 s, takes 35 armour and spins whoever drives over it, its owner included.
- *Ramming.* A hard hit costs the kart that is hit up to 22 and the rammer 30 % of that. A wall hit hard enough to spin you costs 10.
- *The repair strip*, on the far side of the flowerbed bend: 45 armour back, once per pass. The plank skips it, so the short way now costs something.
- *Credit.* Whoever last hurt a kart in the previous 5 s gets the wreck, even if a wall finished the job.
**Controls added:** FIRE (hold) and MINE (press). On a touch screen the guns start out firing by themselves whenever a rival is in the sights ("Auto fire" in Settings; always on when two share a touch screen), so a thumb still only steers and drifts. Brackets mark whoever the guns would hit and turn red while rounds land.
**Rivals** use the same kit through the same inputs. The sharper ones squeeze sooner, steer round mines and swing over for a crate; a battered one skips the plank for the repair strip. Still no rubber band.
**The plain race is kept** as "Clean" on the play sheet, and it is provably the same race: the nine recorded plain fingerprints did not move. Nine armed ones were recorded beside them. Armed and plain races keep separate best times and medals; armed medal times are four to five seconds slower.
**Where the numbers came from:** `dev/combatprobe.ts`, a stand-in driver against each rival level, twenty races each. Across the four karts there were about 3, 3.5 and 5 wrecks a race at Gentle, Keen and Fierce; the stand-in was wrecked about once a race; a race took three to six seconds longer than a plain one. Simulated. Nobody has played it.
**Lines drawn.** Cars against cars only: there are no bystanders and nothing to run over. Nobody is hurt: a wrecked driver is dizzy and back in three seconds. Equal kit: weapons are never a purchase, an unlock or a side effect of how a kart looks.
**What this overrides.** The advisor's racing brief asked for one manoeuvre and simple controls. This adds two inputs and a second thing to manage, at the founder's direction. Auto fire and the Clean race are the mitigations.
**Cost.** More on screen (armour, guns, brackets, a list of wrecks). Two people on one keyboard have five keys each. The leader is shot at from behind, which works as a catch-up; mines are the leader's answer.
**What would change it.** People playing it. Whether being wrecked is funny or infuriating, whether guns that fire themselves feel like yours, and whether anyone lays a mine on purpose are all unknown (`PLAYTEST.md`).

## D-024 · Things that must not break in someone's hands (2026-11-12)
A second pass with no new play in it, aimed at the first time this runs on a real phone with nobody watching a console.
**What changed.**
- *A save can contain anything.* Saved data outlives the build that wrote it. The profile is now read field by field (`parseProfile`): a field that is missing or the wrong kind falls back to its own default and the rest of the save is kept; volumes are held between 0 and 1; saved characters are cleaned, de-duplicated and capped. Before this, whatever was in storage under `settings` was passed straight to the sound engine and the menus.
- *A game that keeps failing says so.* The loop now catches what a tick or a frame throws. An occasional bad frame is survived, as it always was. A game that keeps failing stops and shows a screen with the cause and the build, and a tap starts it again; a lost graphics context uses the same screen. The first version counted only failures in a row, passed its unit tests, and never tripped in a real browser: at 60 Hz a failed tick was being skipped on alternate frames. It now keeps a leaky count and tries the failed tick again. `dev/recovery.mjs` breaks the game both ways in a headless browser and checks the screen and the restart.
- *Play does not change by accident.* The race fingerprint is a recorded baseline (`dev/fingerprint.txt`) and `npm run check`, and so CI, fails if a race plays differently. Changing play on purpose means updating that file in the same commit, which makes the change visible in review. The GitHub runner printed the same nine hashes as the machine this was written on: the first time "identical on every machine" was checked on two.
- *Somebody has to start the game.* The checks never opened a browser, so a build that failed to boot would have passed them. `npm run smoke` serves the production build, opens it in a headless browser, starts a race and a Courier round, and fails on any page error. CI runs it in the runner's own Chrome through `playwright-core`, a development dependency that downloads no browser; it passed there on its first run.
- *Which build was that?* Every build carries a label (version, commit, day; a "+" if it was built from uncommitted changes), shown at the foot of Settings and on the recovery screen. The observation plan asked for one and there was none.
- *A place on the home screen.* A web manifest and icons drawn from `public/icon.svg`; the old coral favicon from before the redesign is gone. Launched from a phone's home screen the game should run without browser bars, which matters most on iPhone, where browsers have not offered full screen to ordinary pages (the button hides itself where it is not offered). Untested: it needs the build hosted, which is the founder's decision (`DEPENDENCIES.md` #2).
**Cost.** The three icon PNGs are the first binary files in the project (about 220 KB in the repository; fetched only by a phone that installs the game; outside the script and style budget). They are generated, by `dev/make-icons.mjs`.
**Left alone on purpose.** No offline cache: a cache that can serve yesterday's build is the wrong risk while builds change daily. Text is still English and written inline, so the game cannot be translated without a pass over the interface code; listed as owed. Courier is still bundled with the race.
**What would change it.** A recovery screen seen on a real device: the cause line is there to be photographed and sent back.

## D-023 · Less scrap, fewer assumptions (2026-11-12)
A pass with no new play in it: remove waste, and stop the code assuming things that will not stay true.
**Assumptions removed.**
- *There is one track.* A race now carries its track id; tracks live in a registry (`track.ts`); medal times, the rivals' cues for the shortcut and the menu's parking spots are track data; world kits are looked up per track (`src/worlds/index.ts`); the minimap fits itself to any centre line; the ramp and the rivals' line no longer assume which way the plank lies. A second circuit is a builder, a kit and one registry line. `dev/fingerprint.ts` printed identical state hashes before and after, so nothing about how a race plays changed.
- *Somebody will remember the rules.* The simulation purity rule is now a test that reads the simulation sources. The character kit is built and animated in every option combination, and fed rubbish, in a test. Every registered track is checked and raced in a test. 108 tests, up from 79.
- *Somebody will run the checks.* `npm run check` is one command (type-check, tests, build, size budget) and a GitHub Actions workflow runs it on pull requests that touch `party-worlds/`. This is the one file outside `party-worlds/`: it reads the repository, never touches the portfolio site, deploys nothing, and can be deleted to switch it off.
- *Everyone has a keyboard to share.* Game controllers drive (stick or d-pad, A to drift, B to brake), one per player in split screen, and A presses the main button between races.
- *The graphics context stays.* If a phone takes it away the game says so and restarts cleanly instead of freezing.
**Scrap removed.** Every bundled font was being shipped in two formats (CSS 326 → 196 kB as the build tool counts it). Unused variables are gone and the compiler now rejects new ones. The old typeface dependency is gone. Settings that only matter to the parked experiment sit under its name.
**Left alone on purpose.** The stylesheet is still layered (structure, then the night theme): folding it into one pass risks visual regressions for a maintenance gain, so it is mapped at the top of the file and listed as owed. Courier is still bundled rather than loaded on demand, because the single-file preview wants one script. No second track, no ghost laps, no elbows: those are content and craft, and the next input should be people racing.
**Found on the way.** `main` of this repository is published by GitHub Pages. Merging this pull request would put the game's source and documents under the site's address (not a playable build). See `DEPENDENCIES.md`.

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

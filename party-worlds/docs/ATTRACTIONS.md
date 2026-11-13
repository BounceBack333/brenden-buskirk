# Attraction registry

One entry per attraction. Nothing is built until its entry is complete.

| # | Attraction | World | Family | Status |
|---|---|---|---|---|
| 0 | **Backyard Dash** (the core since D-016) | Backyard After Dark | Kart racing | **Implemented, simulation tested, driven end to end by script; human play untested** |
| 1 | Catapult Courier (parked) | Birthday Continental | Aim & launch + on-foot | Implemented, simulation tested; human play untested; no longer being developed |
| 2 | Sprinkle Sprint | Birthday Continental | On-foot momentum | Proposed |
| 3 | Candle Keeper | Birthday Continental | Giant vs tiny (1v1 swap / 3v1 block) | Proposed |

---

## 0. Backyard Dash

**The enjoyable action:** throw a tin-toy kart sideways through a corner, hold the slide while the sparks change colour, and let go.
**The decision:** every corner, how long to hold the drift (release at pink for a boost, hang on for blue and a bigger one, or straighten early and get nothing). Every lap, the road (60 units, dependable) or the plank (34 units, narrow, slow soil either side). Once per race, whether to be the one who slows down to knock the peg out and open the plank for everybody.
**Beginner success:** the kart drives itself; steering alone finishes a race. Against Gentle rivals a stand-in driver that never drifts averaged second place (simulated, see `PROGRESS.md`).
**Expert learning:** start boost timing, two-level drift boosts, towing behind a rival, the plank line and the jump off its end, how much grass a boost will carry you over at an apex.
**What the other player changes:** they are on the track with you: they shove, they tow, they block the plank, and whoever opens the shortcut changes the race for both of you.
**Why outcomes are understandable:** your place and your driver's face are always on screen; drift charge is a meter and a spark colour; the minimap shows everyone and the open plank; results give each driver's race time, gap and best lap, and name who opened the shortcut.
**Memorable moment:** the plank dropping mid-race because your friend hit the peg, and you being the one who uses it.
**Why replay:** "I had you until the hairpin." Rematch is one tap from the results; a win against bots offers the next rival level.

| Field | Definition |
|---|---|
| Players | 1–2 people on one device, always four karts. Solo: you and three labelled bot rivals (your second character drives one). Split screen: two people side by side and two bot rivals. |
| Teams | None. Everyone for themselves. |
| Controls — touch | Drag left/right anywhere in your half to steer (floating stick). Hold **DRIFT** (or a second finger) while turning to slide; release to boost. **BRAKE** slows and then reverses. Split screen, or the Auto-drift setting: steering hard starts the drift and easing off releases it, so one thumb is enough. Armed: guns fire by themselves when a rival is in the sights (Auto fire; a FIRE button appears if that is switched off), and the second button uses whatever is in the slot and is labelled with it (MINE, ROCKET, SHOCK, SHIELD, RAM). |
| Controls — keyboard | Solo: A/D or ←/→ steer, Space/Shift/J drift, S/↓ brake. Split: player 1 A/D steer, W (or Space, Left Shift) drift, S brake; player 2 ←/→ steer, ↑ (or Enter, Right Shift) drift, ↓ brake. Hints name W and ↑: two Shift keys held together misbehave on some keyboards. Armed, solo: F (or W / ↑ / Enter) fires, E drops a mine. Armed, shared keyboard: player 1 Space fires and E mines (W or Left Shift still drifts); player 2 Enter fires and Right Shift mines (↑ still drifts). |
| Controls — game controller | Stick or d-pad steers, A / right bumper / right trigger drifts, B / X / left trigger brakes. Alone, any controller; in split screen the first is player 1's and the second player 2's. A presses the main button between races; Start pauses. Armed: right trigger or X fires, Y or left bumper drops a mine, A or right bumper drifts, B or left trigger brakes. |
| Timing | Countdown 3 s (camera meets your driver, swings behind). Three laps, about 55–70 s. When the last person finishes the race runs on 2.5 s so rivals close behind get a time. The race is called 25 s after the first finisher; anyone still out is placed by distance. |
| Start | Pressing DRIFT in the last 0.37 s before GO gives a start boost (a tap is enough). Holding it from much earlier stalls you briefly. |
| Scoring | Finishing order. Shown: race time (winner), gap (others) or lap reached (unfinished), best lap. Personal best race time is kept per mode and rival level, three-lap races only. Armed races also show wrecks caused and times wrecked, and keep their own best times and medals. Wrecks do not change the finishing order. |
| Ties | Two karts crossing on the same tick are ordered by seat. (Cosmetic at this stage; revisit before any ranked play.) Two karts put out on the same tick are ordered by seat too. |
| Rivals | Bots, labelled "bot" on tags and results. Three levels, each two stated dials: skill and throttle (Gentle 85–93 %, Keen 90–96 %, Fierce 97–100 %). No rubber band (D-019). |
| Fairness | One kart for everyone: one collider radius, one top speed, one handling table (`KART`). Characters and colours change nothing. People always have full throttle. Armed: one armour value, one pair of guns, the same mines from the same crates for every kart (`COMBAT`). |
| Accessibility | Auto-accelerate; one-thumb play with Auto-drift; left-handed button swap; reduced motion (no camera shake or roll); hints that retire once the action has been done; place, lap and wrong-way are text, not colour alone. No rapid tapping. Not done: text scaling, colour-blind review of spark colours (the meter repeats them as position). Armed: Auto fire means no extra button is needed; the Clean race has no weapons at all; damage is shown three ways (bar, red edge, sound). |
| The world remembers | The plank starts propped up and blocked. Bumping the peg costs the bumper 28 % of their speed once, drops the plank, and it stays down for everyone for the rest of the race. Results name who did it. |
| No free laps | The lawn inside the circuit is closed by solid things: the pot, a ladder lying along the middle, a tennis ball. A lap needs both checkpoints. Rolling back over the line puts you a lap behind, not ahead. |
| Recovery | Walls nose you along them; a hard hit spins you once (0.37 s); stuck or facing the wrong way for a while puts you back on the road, ghosted for a moment. |
| Combat (armed races, D-025) | Armour 100. Guns: locked 5 s after GO; 10 rounds a second, 2 armour each, 24 units, straight ahead; the pot and the ball give cover; 20 rounds, self-refilling. Mines: two at most, from three crates (back after 15 s); arm in 0.6 s, last 20 s, 35 armour and a spin. Ramming: up to 22 to the kart hit, 30 % of that to the rammer. Hard wall hit: 10. Wreck: 2.5 s stopped, then put back with full armour and a 1.8 s shield; credited to whoever hurt it in the last 5 s. Repair strip on the long way round the flowerbed: +45, once per pass. A finished kart can neither shoot nor be hurt. Whoever is credited with a wreck takes 25 armour and a full magazine (D-026). Since D-027 the two mines are one of five things a crate can hold; a kart carries one kind at a time: mines (2), rockets (2: 36 units a second, lean toward whoever was ahead, 45 and a spin), a shockwave (1: 22 and a stall to everything within 9), a shield (1: no damage for 5 s), a ram (1: a 4 s boost; what it touches takes 40, it takes nothing). A crate always holds the same thing and is back 15 s after it is taken. |
| To the death (D-026, the default) | Two lives each. The second wreck puts a kart out for good: no input, no laps, no damage; solid for 2.5 s, then gone. Out karts rank behind everything running, the later out the higher. If one kart is left running before anyone has finished it wins at once (shown as "last one running", no time posted). A person who is out counts as home: alone, the race is called 2.5 s later. "Armed" is the same race with no limit on wrecks; "Clean" has no weapons. Each of the three keeps its own best times and medals. |
| Network authority | Not online. The simulation is the same pure deterministic module as Courier's (`src/attractions/dash/sim.ts`, inputs are steer/drift/brake per tick), so a server can run it unchanged; prediction for four moving karts is the unsolved part. *(Proposed.)* |
| Disconnect | Not applicable locally. Online plan: a dropped seat is driven by a labelled bot at the level's middle skill until they return. *(Proposed.)* |
| Animation needs | `drive` pose for people and pets (hands or paws on the wheel, lean into turns, glance at a kart alongside), expressions by state (determined in a drift, thrilled on boost, dizzy when spun, cheer or oops at the flag), wave for the winner. |

**Acceptance criteria**
- [x] Deterministic: identical inputs give identical state hashes (test).
- [x] No NaN and always ends under random input abuse (test).
- [x] Nobody moves before GO; a well-timed press boosts and an early one stalls (tests).
- [x] A drift keeps its speed, charges, and pays out only if held long enough (tests).
- [x] Karts cannot overlap, and nothing drives through the pot or the tennis ball (tests).
- [x] The plank starts blocked, opens when the peg is bumped, and stays open for everyone; falling off it lands in slow soil (tests).
- [x] Cutting across the lawn does not count as a lap, and no straight line across the infield gets through (tests; an independent reviewer's lawn-cutting driver went from winning by 10 s to not finishing).
- [x] Rolling back over the start line does not rank you a lap ahead (test).
- [x] Every registered track is self-consistent and can be raced to the flag by the rivals (tests).
- [x] Two stand-in game controllers drive a split-screen race and start the next one from the results (automated play-through).
- [x] Rival levels are ordered and Gentle rivals are clearly slower than Fierce (tests).
- [x] The faster route is faster only when driven well: stand-in drivers gain about 5 s with the plank at a 150 ms reaction delay and lose about 4–5 s at 250 ms (simulated).
- [x] A whole race can be started, driven, finished and rematched in a real browser by scripted keys and by scripted touch, solo and split screen (automated play-through).
- [x] Armed: guns hit only what is ahead, in range and in the open; mines arm, bite and expire; a wreck is stopped, credited and put back shielded; every kart carries the same kit (tests).
- [x] Armed: the plain race is untouched: its recorded fingerprints did not move, and a plain race ignores the trigger (tests).
- [x] Armed: rivals shoot, mine, reload and repair through the same inputs as a person, and a race still ends (tests; simulated for how often).
- [x] To the death: the last life puts a kart out for good, the last kart running wins, a race never waits for someone who is out, and the standings add up (tests).
- [ ] To the death: being put out makes people shout at each other, not stop playing. *(needs people)*
- [ ] Armed: being wrecked makes people laugh or swear at each other, not put the phone down. *(needs people)*
- [ ] Armed: somebody lays a mine on purpose and says so. *(needs people)*
- [ ] Two friends can each name something they did better than the other after one race. *(needs people)*
- [ ] They choose another race without being asked. *(needs people)*
- [ ] A first-time player finishes a Gentle race on the patio more often than off it. *(needs people)*
- [ ] 60 fps on a mid-range phone in split screen. *(needs a device)*

---

## 1. Catapult Courier

**The enjoyable action:** bend a spoon back and fling someone you know; sprint under them and catch them.
**The decision:** aim at your catcher (safe) or through the donut (+40, harder to reach); spend 1.6 s of umbrella paper early to brake or late to glide.
**Beginner success:** any reasonable pull lands in the lane (≈ 69 % of the whole aim space does, enforced by a test).
**Expert learning:** reading the short dotted arc, jelly routes, wind under an open umbrella, last-moment dives, perfect centre catches.
**What the other player changes:** everything — the delivery only scores if both do their part.
**Why outcomes are understandable:** drop shadow straight below the flyer; rim physics you can see; "So close! 0.4 away"; per-launch breakdown.
**Memorable moment:** the diving catch off the rim.
**Why replay:** stars, personal best, "we nearly had that donut".

| Field | Definition |
|---|---|
| Players | 2 (duet co-op). Solo with **Buddy**, a labelled bot. 4 as 2v2 alternating pairs (rules in `SCORING.md`; not built). |
| Teams | One pair, shared score. Roles swap every launch. |
| Controls — launcher | Drag back anywhere in your area, release to launch (angle 18–80°, power by drag length; a feeble release cancels). In flight: hold to open the umbrella (or tap, if set). |
| Controls — catcher | Drag left/right to run (floating stick). Dive: DIVE button, quick tap, or second finger. |
| Same-screen | Player 1 owns the left half, Player 2 the right half, whichever role they have. |
| Keyboard (desktop) | Mouse drag or hold Space to draw; Space/W to open the umbrella; A/D or arrows to run; Shift/S/↓ to dive. |
| Timing | 6 launches. Intro 1.1 s → aim (≤ 20 s, clock shown for the last 5) → flight (≈ 1.5–4 s) → outcome 2.2–2.5 s. A round is about 75–100 s. |
| Raw scoring | Catch 100 · perfect +25 · dive +15 · donut +40 each · jelly +30. Miss 0, bonuses not banked. |
| Tour conversion | Co-op: stars. 2v2: higher pair total → Party Points. |
| Ties (2v2) | More catches → more perfect catches → shared placement. |
| Accessibility | Tap-umbrella option; left-handed dive button; reduced motion; open aim assist (flagged on results); non-colour pips; hints vanish after first success. No rapid tapping anywhere. Armed: Auto fire means no extra button is needed; the Clean race has no weapons at all; damage is shown three ways (bar, red edge, sound). |
| Network authority | Server runs the same deterministic sim with both players' inputs. Outcome and score are authoritative only. Motion may be predicted locally from the last snapshot. |
| Disconnect | Launcher drops while seated → aim clock lobs for them. Either player drops mid-round → round pauses 10 s for a rejoin, then Buddy (labelled) finishes that seat so the stayer completes the round; result marked "finished with a bot". *(Proposed; needs the room server.)* |
| Animation needs | anticipate (tension-driven), fly, float, tumble, splat, caught, run/idle while carrying, dive, slide, celebrate; expressions per phase. All species. |
| The table remembers | Popped balloons stay popped; every miss leaves a splat in the launcher's colour. |

**Acceptance criteria**
- [x] Deterministic: identical inputs give identical state hashes (test).
- [x] No NaN and always terminates under random input abuse (test).
- [x] Only the launching seat can launch; only the catching seat moves the basket (test).
- [x] A centred drop is a perfect catch; a wide drop misses and leaves a splat; nothing is caught through the basket wall (tests).
- [x] ≥ 60 % of the aim space reaches the catcher's lane (test).
- [x] A full round can be completed in a real browser by scripted touch input (automated play-through).
- [ ] Two first-time players complete a round without verbal help. *(needs people)*
- [ ] Both players report having something to do every launch. *(needs people)*
- [ ] 60 fps on a mid-range phone with both characters, confetti and audio. *(needs a device)*

---

## 2. Sprinkle Sprint (proposed — spec for review, not built)

A side-on foot race across the same table. Auto-run; one thumb: tap to hop, hold for a higher hop, swipe down to slide under cutlery.

| Field | Definition |
|---|---|
| Players | 2–4, each in their own lane, free-for-all. Solo vs verified ghost. |
| The table remembers | Splats from Courier are sticky patches (–30 % speed for 0.5 s) in the splatter's own lane and bouncy in everyone else's; popped balloons are missing spring pads. |
| Decision | High route over cupcakes (faster, needs clean hops) vs low route (safe, longer). |
| Raw scoring | Finish time; unfinished → furthest checkpoint, then time at it. |
| Ties | Same tick → tied. Two karts put out on the same tick are ordered by seat too. |
| Network authority | Each runner's inputs are validated by replaying them; runners do not collide, so no shared-physics dispute. |
| Disconnect | Runner is removed; others' race is unaffected. Leaver gets last-place PP. |
| Open question | Is auto-run with hop/slide enough skill expression, or does it need a speed-tuck? Prototype before committing. |

## 3. Candle Keeper (proposed — spec for review, not built)

One player is the **giant**: their own character, enormous, leaning over the cake with a lungful of air. The others are tiny keepers on top of the cake holding paper umbrellas as wind shields.

| Field | Definition |
|---|---|
| Players | 2 (1v1, swap, compare) · 4 (rotating 3v1 block per `SCORING.md`) · 3 (2v1 block). |
| Giant | Aim a wind cone by dragging; hold to inhale (cheeks swell — a 0.7 s visible tell), release to blow. Three breaths, each recharging over 5 s. Cannot blow through a held umbrella. |
| Keepers | Run across the cake top, plant an umbrella to shield one candle, or carry a sparkler to relight one (3 s, interruptible). |
| Counterplay | Bait a breath, then relight during the recharge. Giant can feint by exhaling early. |
| Fairness | The giant's reach, cone and breath are fixed numbers; the giant's *look* is the player's character and changes nothing. Armed: one armour value, one pair of guns, the same mines from the same crates for every kart (`COMBAT`). |
| Raw scoring | Giant: candles out at the horn. Keepers: candles lit. Same 0–8 scale. |
| Network authority | Server-timed breaths and candle states; inhale start is the timestamped input so latency cannot shorten the tell. |
| Open question | Is keeping fun, or only relighting? Prototype the 1v1 first. |

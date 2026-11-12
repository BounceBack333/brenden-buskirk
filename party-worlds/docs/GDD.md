# Game Design Document (living)

Working title: **BounceBack Party Worlds**. Status words used throughout are defined in `PROGRESS.md`. This document was rewritten when racing became the core (D-016); the earlier design is kept in §11.

## 1. Identity

**You and your friends, as armed tin-toy racers on a track hidden in an ordinary place — and the place remembers what you did to it. Made for adults: the karts are toys, the guns are loaded, the grudges are real.**

Described without other games: you pick a small, expressive version of yourself or your pet, sit it in a toy kart, and race three laps of a patio at night against your friends. The garden hose is a banked wall, a scaffold plank is a shortcut, a lost tennis ball is a boulder. Someone knocks the peg out from under the plank and it stays down for everybody.

**Audience:** adults. Friend groups first: people who would play one more race to settle it. (Changed from "families and pairs" by D-016; the look and cast followed in D-022.)

**Tone:** nostalgia plus new. The nostalgia is the back garden, the toy karts and the arcade-racer bones (slanted menus, scoreboard numerals, a four-chord synth loop). The new is the finish: dark glass, thin neon, clean type. Funny rather than cute: a frog in a cowboy hat, a rabbit in a suit, a grandmother who will put you in the flowerbed.

Three promises, in priority order when they conflict:
1. **It's us.** Drivers are recognisable grown-ups (or gloriously not people at all), and the game brings their faces to the screen. Looks never change how anyone drives.
2. **I beat you fairly.** One kart, one handling model, one set of weapons and one set of rules for everyone on the track. Nothing bought, nothing hidden, no rubber band.
3. **I can see why.** Every result can be explained by pointing at something that happened: a boost held too long, a plank missed, a peg someone else paid for.

## 2. Central loop

`Pick drivers → countdown (meet your driver) → three laps (≈ 60 s) → results (who, by how much, who opened the shortcut, and the score) → Next race`

A race is never just a race (D-022). Two people are playing a **first-to-three series**: the scoreboard carries across rematches, says who cannot afford to lose the next one, and ends. One person is chasing **bronze, silver and gold** times, sees the gap to the next, and is offered tougher rivals after gold. Each of these is finite on purpose.

The test this build exists to pass, in the advisor's words: *can you and a friend identify something you did better, get competitive about the result, and choose another race without being prompted?*

What a race gives you to be better at:
- **The start.** A press in the last third of a second before GO.
- **Every corner.** Hold the drift longer for a bigger boost, at the cost of a wider line.
- **Every lap.** Road or plank.
- **Once.** Pay to open the plank, or wait for someone else to.
- **Each other.** Tow behind a kart, shove one wide, sit in the plank's mouth.

### Armed (D-025)

The founder asked for "more like death race than Mario kart". Since then a race is armed unless you choose Clean, and there is a second thing to manage: **armour**.

- **Guns.** Hold FIRE (or let them fire themselves) and whoever is straight ahead and in range loses armour. Aiming is steering. Twenty rounds, then a wait.
- **Mines.** Two at most, from crates beside the racing line. Leave one where somebody has to drive: the chicane, the plank.
- **Ramming.** A hard hit hurts the kart that takes it far more than the one that gives it.
- **A wreck** costs about four seconds: stopped, then back on the road with full armour and a moment of shield. Nobody is out of the race.
- **The repair strip** is on the long way round the flowerbed. The plank is quicker and skips it. Battered, which way do you go?

Everyone carries exactly the same kit, rivals included. It is cars against cars: no bystanders, nobody hurt, a wrecked driver is dizzy for three seconds. The results add a Wrecks column, so there are two things to brag about.

## 3. Memorable moments → requirements

| Moment | Player action | Skill / decision | The other player | Why it's understandable | Feedback | Smallest test |
|---|---|---|---|---|---|---|
| "I had you until the hairpin" | Drift the hairpin, release on blue | How long to hold | Is beside you doing the same | Charge meter, spark colour, place number | Skid, chime per level, boost roar, FOV kick | **Built** |
| "You opened it and I used it" | Bump the peg, or don't | Pay 28 % of your speed now for everyone's shortcut | Benefits, or blocks the plank | Banner names who; plank visibly drops; minimap shows it | Clatter, banner, results line | **Built** |
| "I went for the plank and binned it" | Leave the road for 34 units of narrow board | Risk a lap for 1.6 s | Takes the place you gave up | Soil is visibly slow; place number drops | Dust, face goes "oops" | **Built** |
| "That is so obviously you" | Pick or build a driver | — | Recognises them at the countdown and on the results | Face-to-face countdown, HUD portrait, results portraits | — | **Built** (template characters) |
| "One more" | Tap Rematch | — | Taps it first | — | Countdown starts within about a second | **Built** |

## 4. First world — Backyard After Dark

Physical personality: **hard things bounce you, soft ground drags, narrow wood is fast.** Paving slabs grip. Grass costs 45 % of your speed, flowerbed soil 60 % (a boost takes the edge off, but never makes soft ground quicker than the road). The hose, the bricks, the chair legs, the pot, the ladder on the lawn and the tennis ball are solid; a hard hit spins you once.

What players can do *because of* that behaviour: clip an apex over grass on a boost, lean on the hose through the hairpin, thread the brick chicane, and cross the bed on the plank. What they cannot do is cross the lawn: a ladder lies along the middle of it (D-021).

Layout: start straight under a garden chair → east hairpin inside the coiled hose, lit by a work lamp → brick chicane → the fork (road north round the flowerbed, or plank straight across it with a jump at the far end) → long sweeper round the big pot → back under the chair. 305 units; 18–20 s a lap.

## 5. Rivals

Bots fill the grid and are labelled wherever they appear. Three levels (D-019): **Gentle** (default), **Keen**, **Fierce**. Each is two stated dials: how sharply they drive and how much throttle they use. A solo win offers the next level.

Against stand-in drivers (`dev/humanish.ts`; simulated, not people):

| Stand-in | Gentle | Keen | Fierce |
|---|---|---|---|
| Sharp (150 ms), drifts | wins 11/12 | wins 5/12 | wins 0/12 |
| Sharp, drifts, takes the plank | wins 12/12 | wins 12/12 | wins 10/12 |
| Slower (250 ms), drifts | 2nd–3rd | 3rd | last |
| Slower, never drifts | 2nd, wins 3/12 | 3rd, wins 2/12 | last |

Read as intent, not proof: Gentle is for learning to drive, Keen asks for drift boosts, Fierce asks for the plank.

## 6. Session formats

| Format | Status | Notes |
|---|---|---|
| Race — solo against three bot rivals | **Implemented, automation only** | Your second character drives the quickest rival |
| Split screen — two people, one device, two bot rivals | **Implemented, automation only** | The format for the first social test. Wants a tablet or a laptop; cramped on a phone |
| Online race | Proposed | The room server exists (built for Courier); racing needs its own prediction work |
| Four people | Proposed | Needs online, or four-way split on a big screen |
| Catapult Courier | Parked | Still playable from the play sheet |

## 7. Difficulty, accessibility, mixed skill

Built: auto-accelerate (steering alone finishes a race); one-thumb play (Auto-drift setting, and always in split-screen touch); left-handed button swap; reduced motion (no shake, no camera roll); hints that disappear once the action has been performed; place, lap and "wrong way" in words; rival levels; a 25 s grace after the winner so nobody is left circulating.

Mixed-skill play between two people is carried by the track, not by handicaps: the tow lets the one behind close up, and the plank is a gamble the one behind can take. Whether that is enough is a question for people.

Not done: text scaling, a colour-blind review of spark colours, screen-reader pass, steering help (tried and dropped, D-020).

## 8. Characters and personalisation

- **Built:** a parametric template system — grown-ups, the not-quite-people (bear, fox, rabbit, frog, robot, alien, masked wrestler), two kids, dogs and cats — from about twenty data fields, with an authored cast of twenty-six, a builder, a driving pose for all of them, and face portraits rendered by the game.
- **Adults are the default** (D-022): about four heads tall, with outfits, helmets and hats. The first pass exists; whether it is the right kind of grown-up is the founder's call.
- **Not built:** photo → character. See `research/avatar-pipeline.md`. No real photos are used anywhere in development, and no character is named after a real pet.
- **Fairness (enforced in code):** every kart has the same collider and the same numbers whatever is sitting in it.

## 9. Multiplayer model (summary; details in `NETWORKING.md`)

The race simulation is a pure, fixed-step, deterministic function of per-tick inputs, like Courier's. Local split screen uses it directly. Online racing is not built.

## 10. Business stance (unchanged from the brief; nothing implemented)

Free complete core; paid personal avatars, exact cosmetics, whole worlds a host can share with guests. No paid randomness, no paid retries, nothing that buys speed, grip or a smaller collider, no shop on the loss → rematch path.

## 11. Parked: the table design

Before D-016 the central loop was "one table, one evening": three or four short co-operative attractions on a birthday table, with a one-move "Set the Table" choice between them and physical leftovers carried from one attraction to the next. Catapult Courier (spoon launch, basket catch) is the built piece of that; its registry entry, scoring rules (`SCORING.md`) and online rooms are intact. Two ideas from it are still alive in the racer: the world keeping what you did to it, and a choice that changes things for the other player.

## 12. What we do not know yet

1. Whether two friends want a second race. Everything else is secondary.
2. Whether drifting is discoverable from one hint, and satisfying once found.
3. Whether a first-time adult can stay on the patio at this speed with a thumb.
4. Whether the plank is a real argument between two people or just a shortcut one of them forgets.
5. Whether split screen on the device they actually have is big enough.
6. Real-device frame time, in split screen especially.
7. Whether the drivers are recognisable enough from behind, with the portrait, to matter.
8. Whether the new cast reads as adult and funny to adults, or merely as taller toys.
9. Whether a first-to-three series gets played out, and whether a second one gets started.
10. Whether the medal times are in the right place for real hands.

# Game Design Document (living)

Working title: **BounceBack Party Worlds**. Status words used throughout are defined in `PROGRESS.md`.

## 1. Identity

**Our people and pets, shrunk onto an ordinary table, playing with everything on it — and the table remembers.**

Described without other games: you and someone you love become tiny, expressive versions of yourselves (or your dog, or your cat) on a birthday table. You fling each other off spoons, catch each other in cupcake liners, bounce off jelly. Whatever you knock over, pop or splat stays that way for the rest of the session, tagged with the face of whoever did it.

Three promises, in priority order when they conflict:
1. **It's us.** Characters are recognisable and affectionate. Looks never change how anyone plays.
2. **Both of us matter.** Every attraction gives each player a real job; roles swap or are equally interesting.
3. **I can see why.** Every outcome can be explained by pointing at something on screen.

## 2. Central loop — candidates and decision

| | A. Tour + abstract board | **B. One table, one evening** | C. Always-a-giant | D. Launch toy only | E. Borrowed size |
|---|---|---|---|---|---|
| What it is | Attractions joined by a separate board game | 3–4 attractions on the *same physical table*; between them each player makes one visible change to it; physical consequences persist | Every round one player is the giant running the world | Every activity is a launch/catch variant | Partners share one conserved "size"; as one grows the other shrinks |
| Distinct identity | Low (familiar) | **High** | High | Medium | High |
| Readable in 10 s | Medium (board rules) | **High** (it's a table) | High | High | Medium |
| Physical satisfaction | From attractions only | **From attractions + causing lasting change** | High | High | Unknown |
| Social interaction | Medium | **High** (my change, your problem) | High but 2-player awkward | Medium | High |
| Strategy | High but abstract | **Embodied: you can point at it** | Medium | Low | Medium |
| Variety w/o relearning | High | High | Medium | Low | Medium |
| Production cost | Board is a second game | **One arena per world, reused** | Asymmetric balance ×N | Low | New tech risk |
| Clip-ability | Low | **High** | High | Medium | High |

**Decision: B.** The board is not a separate layer; it is the table. Giant roles (C) become specific attractions inside it. Borrowed size (E) is parked as the most promising untested mechanic for a later lab.

### The loop
`Pick characters → attraction (≈90 s) → Set the Table (≤10 s each) → attraction → Set the Table → attraction → standings → rematch`

### "The table remembers" — the fourth signature idea
- **Persistent consequences.** Popped balloons stay popped. A missed landing leaves a frosting splat in the misser's colour. A knocked candle stays down. *(Implemented in Catapult Courier: balloons + splats persist for the round.)*
- **Carry-over.** Those leftovers become ingredients of the next attraction: a splat is a sticky patch in a foot race; a popped balloon is a missing bounce. *(Proposed — needs a second attraction.)*
- **Set the Table.** Between attractions each player makes exactly one physical change to the shared arena. *(Proposed; rules in §5.)*

Test we hold ourselves to: **can a player point at something in the arena and say which earlier choice caused it?**

## 3. Memorable moments → requirements

| Moment | Player action | Skill / decision | Partner contributes | Why it's understandable | Feedback | Net requirement | Smallest test |
|---|---|---|---|---|---|---|---|
| "You launched yourself and I actually caught you" | Pull spoon, release; feather umbrella | Aim near the catcher; spend umbrella paper wisely | Reads the bend, sprints, dives | Short dotted arc + drop shadow + rim physics | Creak → twang → rush → thump + confetti | Shared sim; outcome authoritative | **Catapult Courier (built)** |
| "That looks exactly like my dog" | Build or pick a character | — | Recognises them | Silhouette + colour blocking | Portraits are real renders | Spec is ~15 fields of data | Character builder (built, template-based) |
| "I knew you were going for that shortcut" | Aim through the donut | Risk a harder arc for +40 | Repositions before release | Donut is visible; bonus only if caught | Chime, "+40 if caught" | — | Courier rings (built) |
| "Our decision changed the next round" | One table move | Safe vs greedy | Negotiates | Flag with chooser's face on the changed object | Camera visits each change | Ordered, agreed choices | Set the Table (proposed) |
| "I understand why I lost, I want another go" | — | — | — | "So close! 0.4 away", per-launch breakdown | Soft "whoops", instant Again | — | Results screen (built) |

## 4. First world — The Birthday Continental

Physical personality: **soft things spring, sticky things hold, light things float.** Jelly is a trampoline, frosting is a landing you slide down, balloons are bumpers that pop, a spoon is a catapult, a hand fan is weather, the cake is a cliff.

What players can do *because of* that behaviour: bounce a short launch into range (jelly), be saved or ruined by a backstop that may no longer exist (balloons), glide under a paper umbrella (air), and leave marks that matter later (frosting).

## 5. Set the Table (board rules — proposed)

- **Who:** every player, one move each. Order = reverse current standings (last place moves first).
- **What:** three face-up cards drawn from the next attraction's move list (e.g. *slide the jelly*, *tie on a balloon*, *turn the fan*, *hang a second donut*, *shorten the runway*). Each card states its tradeoff in one line.
- **Cost:** free, but a taken card is gone. One "spare move" token can be earned per tour (three stars in any attraction) and spent once.
- **Visible:** instantly. The camera visits the object; a small flag with the chooser's face is planted beside it and stays through the next attraction.
- **Conflicts:** none possible — moves are sequential. Undoing someone's move with your own is legal and costs you your move.
- **Time:** 8 s each, then auto-pass. Four players ≤ 35 s.
- **Reset:** table moves and leftovers reset between tours. Nothing persists into public competitive play.
- Winning creates options (a spare move), never better physics.

## 6. Session formats

| Format | Status | Notes |
|---|---|---|
| Quick Play — one attraction | **Implemented** (Courier) | Same-screen 2P, or solo with a labelled bot |
| Duet Adventure — complete 2-player session | Partly: one attraction with full role swap | Needs two more attractions + Set the Table |
| Party Tour — 3–4 players, individual standings | Proposed | Rules + worked example in `SCORING.md` |
| Crew Cup — fixed 2v2 | Proposed | Only attractions with symmetric team roles |
| Solo Challenges | Proposed | Courier is deterministic-by-input, so verified ghosts are feasible |

## 7. Difficulty, accessibility, mixed skill

Built: touch-only play (no motion input); landscape that works even when the OS cannot rotate; hold *or* tap umbrella; left-handed dive button; reduced motion (steady wide camera, no shake/zoom); open **aim assist** (full arc + landing ring) that is labelled on the results; cues never colour-only (pips use ✓/× and shape); 56 px+ targets; hints that disappear once the action is performed.

Mixed-skill design in Courier: the launcher can make the catcher's job easy (aim at them) or hard (go for the donut); a strong catcher rescues a wild launch with a dive. A novice contributes on launch one.

Not yet done: text scaling option, colour-blind review of the palette, screen-reader pass, haptics on iOS (Safari exposes none).

## 8. Characters and personalisation

- **Built:** a parametric template system — people, dogs and cats from ~15 data fields, with an authored cast, a builder, and live portraits rendered by the game.
- **Not built:** photo → character. See `research/avatar-pipeline.md`. Working hypothesis: *templates driven by a photo-interpretation step* is the cheapest first experiment; generated geometry is a later comparison. No real photos are used anywhere in development.
- **Fairness rule (enforced in code):** every character uses the same collider and the same carry height (`RIG` constants). Pets stay quadrupeds and wear a harness to carry the basket.

## 9. Multiplayer model (summary; details in `NETWORKING.md`)

The simulation is a pure, fixed-step, deterministic function of inputs (`core/dmath.ts`). That gives: server authority by simply running the same code; validation of any claimed result by replaying its inputs; replays/ghosts stored as inputs.

## 10. Business stance (unchanged from the brief; nothing implemented)

Free complete core; paid personal avatars, exact cosmetics, whole worlds a host can share with guests. No paid randomness, no paid retries, no shop on the loss → rematch path. Costs must be measured before any forecast is written.

## 11. What we do not know yet

1. Whether launch-and-catch is fun for *both* people over ten rounds — needs real pairs (see `PLAYTEST.md`).
2. Whether one-thumb dive (tap) is discoverable on a shared phone.
3. Whether template characters are recognisable enough to produce "that's my dog!".
4. Real-device frame time, heat and battery.
5. How the game feels at 80–150 ms round-trip latency.

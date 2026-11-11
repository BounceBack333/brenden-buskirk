# Attraction registry

One entry per attraction. Nothing is built until its entry is complete.

| # | Attraction | World | Family | Status |
|---|---|---|---|---|
| 1 | Catapult Courier | Birthday Continental | Aim & launch + on-foot | **Implemented, simulation tested; human play untested** |
| 2 | Sprinkle Sprint | Birthday Continental | On-foot momentum | Proposed |
| 3 | Candle Keeper | Birthday Continental | Giant vs tiny (1v1 swap / 3v1 block) | Proposed |

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
| Accessibility | Tap-umbrella option; left-handed dive button; reduced motion; open aim assist (flagged on results); non-colour pips; hints vanish after first success. No rapid tapping anywhere. |
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
| Ties | Same tick → tied. |
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
| Fairness | The giant's reach, cone and breath are fixed numbers; the giant's *look* is the player's character and changes nothing. |
| Raw scoring | Giant: candles out at the horn. Keepers: candles lit. Same 0–8 scale. |
| Network authority | Server-timed breaths and candle states; inhale start is the timestamped input so latency cannot shorten the tell. |
| Open question | Is keeping fun, or only relighting? Prototype the 1v1 first. |

# Scoring integrity

Raw results are never compared across attractions. Each attraction produces its own raw result, which is converted to **Party Points (PP)** by placement.

Status: Catapult Courier raw scoring is **implemented and tested**. Party Points, Set the Table and the two other attractions in the worked example are **proposed**.

## 1. Raw result → Party Points

| Competitors in the attraction | 1st | 2nd | 3rd | 4th |
|---|---|---|---|---|
| 4 individuals | 5 | 3 | 2 | 1 |
| 3 individuals | 5 | 3 | 1 | — |
| 2 temporary pairs (each member receives the pair's points) | 4 | 2 | — | — |
| 2 individuals (Duet head-to-head) | 3 | 1 | — | — |

- **Ties:** tied competitors each receive the points of the best tied place; the places they occupy are skipped (two tied for 2nd → both 3 PP, next player is 4th).
- **Unfinished round** (app closed, session ended): the attraction awards no PP to anyone and is shown as "not finished".
- **Forfeit / leave:** the leaver receives last-place PP for that attraction; everyone else is ranked among themselves. Leaving is never punished beyond that attraction.
- **Disconnect:** see each attraction's entry in `ATTRACTIONS.md`. Default: a labelled bot finishes the leaver's part so other players' conditions are unchanged; the leaver may rejoin at the next attraction.
- **Assists:** any open assist (e.g. aim assist) is shown on the results. Private groups may allow them. Assisted results never enter an unassisted leaderboard category.
- **Final tie** on PP: most 1st places → better placement in the last attraction → joint winners. No sudden-death round in casual play.

## 2. Catapult Courier raw scoring (implemented)

Per delivery, only if caught: catch 100 · perfect (dead centre, no rim) +25 · diving catch +15 · each donut threaded +40 · jelly bounce on the way +30. A miss scores 0 and banks no bonuses. Both partners always share every point: the delivery is one joint result.

- Duet (co-op): 6 launches, roles swap every launch → one team score → 0–3 stars (30 % / 60 % / 90 % of "every delivery caught with its donut").
- 2v2 in a tour: pairs alternate launches on the same table, 4 launches per pair (two per role), same donut/wind script per launch number. Higher pair total wins. Tie → more catches → more perfect catches → shared placement.
- Aim clock: 20 s, then a gentle automatic lob, so nobody can stall.

## 3. Rotating 3-versus-1 — the whole role block (rule for any 3v1 attraction)

Defined before any 3v1 attraction is built.

1. **Everyone is the solo player exactly once.** A 4-player block is four equal-length rounds on the same published layout.
2. **Per-role raw score on the same scale.** Example (Candle Keeper, proposed): eight candles, 40 s. Giant's score = candles out at the horn (0–8). Each keeper's score = candles still lit (0–8), shared by all three keepers.
3. **Block score** = your solo-round score + the *average* of your three trio-round scores. Both roles therefore weigh the same.
4. **Conversion:** rank block scores → Party Points (table above).
5. **Role order:** later solo players have watched more. Mitigation: the layout is fixed and shown to everyone before round 1; the first solo player rotates each tour; results always display the order. This is a known, disclosed advantage — a 3v1 block is not a clean measure of individual skill.
6. **Disconnect:** a labelled bot takes the leaver's seat for the rest of the block so remaining players keep comparable conditions. The leaver gets last-place PP. In any ranked context the block is void for everyone; in casual play it stands for those who stayed.
7. **Partial block** (session ends before all four rounds): no PP awarded.
8. **Captures** (where an attraction has them): ≤ 3 s out of play, visible timer, automatic return at a safe point, 1.5 s of protection. No chained captures, no spawn trapping, rescues may shorten the wait but are never required.
9. With **3 players** the block is three rounds of 2v1 and the trio average is taken over two rounds. With 2 players the attraction is replaced by its 1v1 role-swap variant.

## 4. Worked example — one complete Party Tour

Players: **Rosa, Theo, Imani, Jun.** Three attractions on the Birthday table.

### Attraction 1 — Catapult Courier, temporary pairs (Rosa + Theo vs Imani + Jun)

| Launch | Rosa + Theo | Points | Imani + Jun | Points |
|---|---|---|---|---|
| 1 | Caught, threaded the donut | 100 + 40 = **140** | Caught | **100** |
| 2 | Perfect catch | 100 + 25 = **125** | Missed by 0.6 | **0** |
| 3 | Threaded the donut, then missed | **0** (bonus not banked) | Caught, threaded the donut | 100 + 40 = **140** |
| 4 | Diving catch after a jelly bounce | 100 + 15 + 30 = **145** | Caught | **100** |
| Total | | **410** | | **340** |

Party Points: Rosa 4, Theo 4 (winning pair) · Imani 2, Jun 2.
Table memory: Rosa + Theo's launch-3 splat stays on the cloth; Imani + Jun popped a balloon on launch 2.

### Set the Table (order = reverse standings; Imani and Jun are tied last, Jun's pair missed more recently so Jun moves first)
Jun slides the jelly toward the start line. Imani hangs a second donut. Theo passes. Rosa turns the fan.

### Attraction 2 — Sprinkle Sprint, free-for-all foot race (proposed attraction)

| Player | Raw result | Place | PP |
|---|---|---|---|
| Jun | 41.2 s | 1st | 5 |
| Rosa | 43.0 s | tied 2nd | 3 |
| Imani | 43.0 s | tied 2nd | 3 |
| Theo | did not finish, reached checkpoint 3 of 4 | 4th (3rd is skipped) | 1 |

### Attraction 3 — Candle Keeper, rotating 3v1 block (proposed attraction)

| Round | Giant | Candles out (giant's score) | Candles lit (each keeper's score) |
|---|---|---|---|
| 1 | Rosa | 5 | Theo, Imani, Jun: 3 |
| 2 | Theo | 3 | Rosa, Imani, Jun: 5 |
| 3 | Imani | 6 | Rosa, Theo, Jun: 2 |
| 4 | Jun | 4 | Rosa, Theo, Imani: 4 |

| Player | Giant | Keeper rounds | Keeper average | Block score | Place | PP |
|---|---|---|---|---|---|---|
| Imani | 6 | 3, 5, 4 | 4.00 | **10.00** | 1st | 5 |
| Rosa | 5 | 5, 2, 4 | 3.67 | **8.67** | 2nd | 3 |
| Jun | 4 | 3, 5, 2 | 3.33 | **7.33** | 3rd | 2 |
| Theo | 3 | 3, 2, 4 | 3.00 | **6.00** | 4th | 1 |

### Final standings

| Player | Courier | Sprint | Candle Keeper | Total PP |
|---|---|---|---|---|
| **Imani** | 2 | 3 | 5 | **10** |
| Rosa | 4 | 3 | 3 | **10** |
| Jun | 2 | 5 | 2 | **9** |
| Theo | 4 | 1 | 1 | **6** |

Imani and Rosa tie on 10. First tiebreak, most 1st places: one each. Second tiebreak, placement in the last attraction: Imani 1st, Rosa 2nd → **Imani wins the tour.**

### What this result does and does not mean
- **Teammates:** Rosa and Theo each took 4 PP from a joint score; the tour cannot tell who contributed more. Partnerships rotate between tours for that reason.
- **Role order:** Jun was the last giant and had watched three others; Rosa went in cold.
- **Conditions:** table changes were chosen by players and applied to everyone, but the pair that launches second on a given number sees one more consequence than the pair that launched first.

A casual tour is a good evening, not a ranking. Trusted standings would need fixed conditions, no table moves, validated results and comparable categories.

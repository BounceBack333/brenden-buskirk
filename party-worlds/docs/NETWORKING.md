# Networking

Status words are defined in `PROGRESS.md`. Nothing here has been played by real people on separate devices over the internet yet.

## Authority model

The room server (`server/`) runs the exact simulation module the browser runs (`src/attractions/courier/sim.ts`). Clients send **inputs only**. A client cannot claim a position, a catch or a score, because the protocol has no message for it.

| Thing | Owner | Notes |
|---|---|---|
| Player inputs | Each client | One small tuple per tick, sequence-numbered. The server queues them and applies exactly one per tick, in order. |
| Movement, flight, shared objects | Server | Clients predict locally from the last snapshot; the server's state always wins. |
| Catches, misses, score, round transitions | Server only | Never predicted. A client that "sees" a catch waits for the server to say so. |
| Role assignment, who flies first | Server | Rematches alternate the first launcher. |
| Board choices (Set the Table) | Server — *proposed* | Will be ordered, acknowledged messages; not built. |
| Entitlements, leaderboard submissions | *Not built* | Any ranked result must be produced by the server's own simulation, or re-simulated from recorded inputs. |

### Why determinism matters here
`src/core/dmath.ts` restricts the simulation to operations that are bit-exact everywhere (no `Math.sin`). A test replays random inputs and checks state hashes match. Consequences:
- prediction on the client normally lands exactly where the server will;
- a result can be validated after the fact by replaying its inputs;
- replays and ghosts are input logs, not recorded positions.

We do **not** assume engine physics is deterministic in general. An attraction that needs a third-party physics engine (stacking, soft bodies) will need a different sync strategy and its own entry in this file.

## What the client does (implemented, tested by automation only)

`src/attractions/courier/netsession.ts`
1. Every local tick: sample input, send it, apply it to a local copy of the round.
2. Every snapshot (30 Hz): take the server's state, drop acknowledged inputs, replay the rest on top.
3. Stop predicting at a catch or a miss; wait for the server.
4. Play my own actions (launch, umbrella, dive) immediately; play everything else when the server reports it.

**Latest automated run** (`dev/online-test.mjs`, 2026-11-11, two headless browser pages and the real server on one machine, no added latency): room created, joined by typing the code, both ready, a two-launch round completed, both pages ended with identical results, rematch started in the same room, zero page errors. 140 and 146 of 1,556 snapshots needed a visible correction on the two pages. Both pages were starved for CPU (software rendering at a few frames per second, sending inputs in bursts), so that correction rate says little about a real device; it has not been measured on one. The scripted players missed both catches, which is a limit of the script, not a finding about the game.

Known limits of v1: the other player's stick/umbrella changes are seen one snapshot late and can cause a small visible correction; contact sounds for shared objects arrive one snapshot after the picture; there is no interpolation buffer for the remote player.

## Rooms and failure recovery

| Situation | Behaviour | Status |
|---|---|---|
| Join by code | 4 letters, no vowels or look-alikes. Lower case accepted. | Implemented and tested |
| Invitation link | `?room=CODE` goes straight to the room | Implemented, untested on devices |
| Expired / mistyped code | "That room has closed, or the code is not quite right." Back to the code entry with the text kept. | Implemented and tested |
| Party full | "That room already has two players." | Implemented and tested |
| Room mid-round | "They are in the middle of a round. Try again in a minute." Late joining is not allowed. | Implemented and tested |
| Version mismatch | Refused at hello with a refresh prompt | Implemented and tested |
| Ready states | Round starts only when both are ready and connected | Implemented and tested |
| Temporary network loss | Round **freezes** for 10 s. The client auto-reconnects and rejoins with a secret seat token. | Server side tested; browser auto-rejoin untested |
| Player gone for good | After 10 s a **labelled bot** takes the seat so the stayer finishes. Result is marked "finished with a bot" and never counts as a personal best. | Implemented and tested (server); UI label implemented |
| Leaving on purpose mid-round | No wait: the bot takes over immediately. | Implemented and tested |
| Host departure | There is no host. The room lives on the server; either player can stay. | By design |
| Duplicate / stale inputs | Dropped by sequence number | Implemented and tested |
| Duplicate result submission | Not possible: results are computed by the server, not submitted | By design |
| Rematch | Same room, both press Again, first launcher alternates | Implemented and tested |
| Someone leaves on the results screen | Seat frees up; the stayer can share the code again | Implemented and tested |
| Empty room | Closed after 60 s | Implemented and tested |
| Flooding / garbage | 150 msgs/s cap, 4 KB message cap, strict parsing, names stripped of markup | Implemented and tested |
| Asset mismatch | Not applicable yet (no downloadable content) | — |

## Measured traffic (v1, JSON, localhost)

From `tests/rooms.test.ts` over real WebSockets on one machine (2026-11-11): **771 bytes per snapshot** on average, 30 snapshots/s, **186 kbit/s down per client**. Upstream is one input tuple of roughly 40 bytes per tick (not separately measured).

That is acceptable for a prototype on Wi-Fi and wasteful for mobile data. The obvious next step, when online play is being tuned with real latency, is a binary delta snapshot (the changing part of the state is ~12 numbers).

## Not built
- Hosting, TLS, accounts, matchmaking, persistence, horizontal scale, abuse reporting.
- 3–4 player rooms.
- Latency testing: no artificial delay or packet-loss runs have been done.

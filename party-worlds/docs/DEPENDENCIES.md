# Open dependencies and decisions needed

Short list. Each item says what it blocks and who can unblock it.

## Needs the founder

| # | Decision or action | Blocks | Notes |
|---|---|---|---|
| 1 | **Race a friend.** Split screen on a tablet or laptop; then a solo race on your phone | Every next step should be shaped by this | The one question and what to watch for are in `PLAYTEST.md` |
| 2 | **A way to open the build full-screen.** The private preview runs inside a viewer that takes screen space, which the review flagged | A fair first impression on a phone | On a laptop: open the single self-contained HTML file from disk (`npm run build && node scripts/build-single-file.mjs out.html --page`). On a phone, options, none taken: host the static build somewhere you choose (public or behind a password), or run `npm run dev -- --host 0.0.0.0` on your own network. Public hosting needs your go-ahead |
| 3 | **Where should the game live?** A dedicated repository, or keep it in `party-worlds/` here | Clean history, CI, a hosting path | This repository is your portfolio site; nothing outside `party-worlds/` was changed |
| 4 | **Online racing: yes, and when?** | Two phones, two homes | The room server exists for Courier. Racing needs a host (small monthly cost, a provider, TLS) and prediction work for four moving karts. Not started |
| 5 | **Native iOS route:** Capacitor wrapper of this build, or an engine port | App Store work | Needs a Mac with Xcode and an Apple developer account. Neither exists in this environment |
| 6 | **Photo-to-character:** which processor, what consent text, what budget | "That is exactly me" | Research note in `research/avatar-pipeline.md`; a direct read of vendor documentation needs these hosts allowed: developers.tripo3d.ai, docs.meshy.ai, developer.apple.com, www.ftc.gov |
| 7 | **Authorised reference for Bailey** | A real Bailey driver | Until then the cast uses invented dogs only |
| 8 | **Is this the right kind of grown-up?** | Everything further on the cast and the look | A first adult pass exists (D-022). Your reaction to it is the input: too plain, too silly, wrong style, who is missing |

## Needs equipment or people

| # | Need | Blocks |
|---|---|---|
| 9 | A mid-range iPhone and Android phone for profiling | Frame time (split screen especially), heat, battery, real input feel |
| 10 | Ears | Engine, skid and boost sounds and the race music have been measured, never heard |
| 11 | Two people | Everything in `PLAYTEST.md` |

## Technical debt accepted knowingly

- One track, one kart, three rival levels. Variety comes after the core is shown to be wanted.
- Rival levels were tuned against scripted stand-in drivers, not people.
- Split screen draws the scene twice; nothing has been done to make the second view cheaper.
- Ties on the line are broken by seat number.
- The race is local only. Courier's online rooms are intact but nothing was added to them.
- The racing code has had one independent review (D-021). The art, character and audio kits have had none since the first parallel build was interrupted (D-015).
- Nearest-road tracking searches a window of the lap; a kart that somehow jumped more than 70 units of track ahead would be treated as lost until put back. No route allows it now.
- No analytics, accounts, commerce, moderation or crash reporting exist. None were needed to find out whether the core is fun.

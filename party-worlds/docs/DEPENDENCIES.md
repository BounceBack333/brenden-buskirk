# Open dependencies and decisions needed

Short list. Each item says what it blocks and who can unblock it.

## Needs the founder

| # | Decision or action | Blocks | Notes |
|---|---|---|---|
| 1 | **Race a friend.** Split screen on a tablet or laptop; then a solo race on your phone | Every next step should be shaped by this | The one question and what to watch for are in `PLAYTEST.md` |
| 2 | **A way to open the build full-screen.** The private preview runs inside a viewer that takes screen space, which the review flagged | A fair first impression on a phone | Options, none taken: host the static build somewhere you choose (public or behind a password), or run `npm run dev -- --host 0.0.0.0` on your own network. Public hosting needs your go-ahead |
| 3 | **Where should the game live?** A dedicated repository, or keep it in `party-worlds/` here | Clean history, CI, a hosting path | This repository is your portfolio site; nothing outside `party-worlds/` was changed |
| 4 | **Online racing: yes, and when?** | Two phones, two homes | The room server exists for Courier. Racing needs a host (small monthly cost, a provider, TLS) and prediction work for four moving karts. Not started |
| 5 | **Native iOS route:** Capacitor wrapper of this build, or an engine port | App Store work | Needs a Mac with Xcode and an Apple developer account. Neither exists in this environment |
| 6 | **Photo-to-character:** which processor, what consent text, what budget | "That is exactly me" | Research note in `research/avatar-pipeline.md`; a direct read of vendor documentation needs these hosts allowed: developers.tripo3d.ai, docs.meshy.ai, developer.apple.com, www.ftc.gov |
| 7 | **Authorised reference for Bailey** | A real Bailey driver | Until then the cast uses invented dogs only |
| 8 | **How grown-up should drivers look?** | The review asked for less baby-like characters over time | A direction or two or three reference styles you like would be enough to start |

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
- The art, character and audio kits were finished by a single author after the first parallel build was interrupted; an independent review pass is still owed (D-015).
- No analytics, accounts, commerce, moderation or crash reporting exist. None were needed to find out whether the core is fun.

# Open dependencies and decisions needed

Short list. Each item says what it blocks and who can unblock it.

## Needs the founder

| # | Decision or action | Blocks | Notes |
|---|---|---|---|
| 1 | **Play it.** Open the private preview on your phone; one solo round, one same-screen round with someone | Everything in Stage B onward should be shaped by this | Five questions in `PLAYTEST.md` |
| 2 | **Where should the game live?** A dedicated repository, or keep it in `party-worlds/` here | Clean history, CI, GitHub Pages path | This repository is your portfolio site; nothing outside `party-worlds/` was changed |
| 3 | **Public hosting of the web build** (e.g. GitHub Pages) | Sharing a link with friends | Merging this PR to `main` does not publish the game: there is no built copy in the repository. Say the word and a deploy step can be added |
| 4 | **Hosting the room server** (any small Node host with WebSockets + TLS) | Online play outside one machine | Needs a provider, a domain or URL, and a small monthly cost. Not chosen, nothing deployed |
| 5 | **Native iOS route:** Capacitor wrapper of this build, or a Unity port | App Store work | Needs a Mac with Xcode and an Apple developer account. Neither exists in this environment |
| 6 | **Photo-to-character:** which processor, what consent text, what budget | Stage D | Research note could only read vendor pages through search excerpts; a direct read needs these hosts allowed: developers.tripo3d.ai, docs.meshy.ai, developer.apple.com, www.ftc.gov |
| 7 | **Authorised reference for Bailey** | A real "Bailey's Tag Town" character | Until then the cast uses invented dogs only |
| 8 | **Children's accounts:** intended audience and regions | Any photo feature for under-13s; Kids Category decision | Research summary in `research/avatar-pipeline.md` |

## Needs equipment or people

| # | Need | Blocks |
|---|---|---|
| 9 | A mid-range iPhone and Android phone for profiling | Frame time, heat, battery, real input feel |
| 10 | Ears | Mix balance and music quality (measured, never heard) |
| 11 | Two people on two devices on different networks | "Verified online play" |

## Technical debt accepted knowingly

- Snapshots are full JSON (771 bytes, 30/s). Fine on Wi-Fi; needs binary deltas before mobile data.
- One attraction, one arena, one set of six launches. Variety is the next stage, not an oversight.
- The kits were finished by a single author after the parallel build was interrupted; an independent review pass is still owed.
- No analytics, accounts, commerce, moderation or crash reporting exist. None were needed to find out whether the core is fun.

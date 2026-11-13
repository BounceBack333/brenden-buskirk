# Open dependencies and decisions needed

Short list. Each item says what it blocks and who can unblock it.

## Needs the founder

| # | Decision or action | Blocks | Notes |
|---|---|---|---|
| 1 | **Race a friend.** Split screen on a tablet or laptop; then a solo race on your phone | Every next step should be shaped by this | The one question and what to watch for are in `PLAYTEST.md` |
| 2 | **A way to open the build full-screen.** The private preview runs inside a viewer that takes screen space, which the review flagged | A fair first impression on a phone | On a laptop: open the single self-contained HTML file from disk (`npm run build && node scripts/build-single-file.mjs out.html --page`). On a phone the build has to be hosted somewhere you choose (public or behind a password), or served from your own network with `npm run dev -- --host 0.0.0.0`. Once it has an address, "Add to Home Screen" should give a full-screen game with its own icon (the manifest and icons are in place, D-024; never tried on a device). On iPhone that is likely the only route to full screen. Public hosting needs your go-ahead |
| 3 | **Where should the game live, and should this be merged?** A dedicated repository, or keep it in `party-worlds/` here | Clean history, a hosting path | **`main` of this repository is published by GitHub Pages.** Merging this pull request would put the game's source files and these documents under your site's address (not a playable build: it is unbuilt). If that is not what you want, do not merge it here; the game can move to its own repository first. The only file added outside `party-worlds/` is the check workflow in `.github/workflows/` |
| 3b | **Use that same Pages site to host a playable build?** | A bare URL for phones (see #2) | Possible with a build-and-publish step. It would be a public deployment, so it waits for your yes |
| 4 | **Online racing: yes, and when?** | Two phones, two homes | The room server exists for Courier. Racing needs a host (small monthly cost, a provider, TLS) and prediction work for four moving karts. Not started |
| 5 | **Native iOS route:** Capacitor wrapper of this build, or an engine port | App Store work | Needs a Mac with Xcode and an Apple developer account. Neither exists in this environment |
| 6 | **Photo-to-character:** which processor, what consent text, what budget | "That is exactly me" | Research note in `research/avatar-pipeline.md`; a direct read of vendor documentation needs these hosts allowed: developers.tripo3d.ai, docs.meshy.ai, developer.apple.com, www.ftc.gov |
| 7 | **Authorised reference for Bailey** | A real Bailey driver | Until then the cast uses invented dogs only |
| 8b | **Is this the right kind of fight?** | Everything further on weapons | Four passes exist (D-025 to D-028): guns, armour, two wrecks and you are out, five things in the crates, and now a track built for it. Your reaction is the input. Still open from last time: did "vehicles are weak" mean they do not hit hard enough (answered with the crates) or that they die too easily (armour has not been touched)? And on the new track: is the crossing fun or just confusing, and is a 75-second race too long |
| 8 | **Is this the right kind of grown-up?** | Everything further on the cast and the look | A first adult pass exists (D-022). Your reaction to it is the input: too plain, too silly, wrong style, who is missing |

## Needs equipment or people

| # | Need | Blocks |
|---|---|---|
| 9 | A mid-range iPhone and Android phone for profiling | Frame time (split screen especially), heat, battery, real input feel |
| 10 | Ears | Engine, skid and boost sounds and the race music have been measured, never heard |
| 11 | Two people | Everything in `PLAYTEST.md` |

## Technical debt accepted knowingly

- Two tracks, one kart, three rival levels.
- The stand-in drivers finish two to three seconds further behind the same rivals on the Grease Pit than in the backyard (D-028). Not corrected until somebody has raced there.
- The script is at 281 KB gzipped of a 300 KB budget. A third world kit will not fit without loading kits on demand or raising the budget.
- Rival levels were tuned against scripted stand-in drivers, not people. So were the combat numbers (damage, magazine, mines, how long a wreck lasts).
- Being in front means being shot at. Mines are the answer the leader has; whether that feels fair is unknown.
- Two people on one keyboard have five keys each in an armed race. Controllers or a touch screen are kinder.
- A kart that turns onto the other road at the Grease Pit's crossing drives on what looks like road and is treated as off it, then is put back (D-028). It is the right outcome and it may look like a bug to whoever does it.
- Two lives was chosen from simulated races. With real people it may want to be one or three.
- Split screen draws the scene twice; nothing has been done to make the second view cheaper.
- Ties on the line are broken by seat number.
- The race is local only. Courier's online rooms are intact but nothing was added to them.
- The racing code has had one independent review (D-021). The art, character and audio kits have had none since the first parallel build was interrupted (D-015).
- Nearest-road tracking searches a window of the lap; a kart that somehow jumped more than 70 units of track ahead would be treated as lost until put back. No route allows it now.
- The stylesheet is layered (structure, then the night theme over it). It works and is mapped at the top of the file; folding it into one pass is owed.
- Arms and legs are single pieces: no elbows or knees.
- All text is English and written inline in the interface code. Translating the game needs a pass that moves it into one table first.
- No offline cache: the game needs its host each time it is opened (D-024).
- The parked Courier mode ships in the same script as the race instead of being loaded when asked for.
- The check workflow uses GitHub Actions minutes (74 s for the first run that also started the game in a browser; about half a minute before that). On a private repository that comes out of the plan's included minutes.
- No analytics, accounts, commerce, moderation or crash reporting exist. None were needed to find out whether the core is fun.

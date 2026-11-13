#!/bin/sh
# Runs the automated race play-throughs one after another and collects one summary line each.
# Five races to the death (keyboard, touch), one armed without lives (controllers), one with weapons off.
#   sh dev/race-evidence.sh [baseUrl] [outDir]
# Needs a preview of the production build at baseUrl: npm run build && npx vite preview --host 127.0.0.1 --port 4173
# (not the dev server: saving a source file reloads the page and ruins the run).
# Scripted input in a headless browser: evidence that the screens, controls and rules hold
# together end to end. It is not a play-test.
base="${1:-http://127.0.0.1:4173/}"
out="${2:-dev/shots}"
sum="$out/race-evidence.jsonl"
mkdir -p "$out"
: > "$sum"
run() {
  name="$1"; shift
  echo "== $name" >&2
  node dev/raceplay.mjs "$@" 2>>"$out/race-evidence.err" | tail -1 | sed "s/^{/{\"run\":\"$name\",/" >> "$sum"
}
run solo-keys-3laps      "${base}?hq"        solo  "$out/race-solo"        --slow=0.25 --plank --rematch
run split-keys-1lap      "${base}?hq&laps=1" split "$out/race-split"       --slow=0.25 --rematch
run solo-touch-landscape "${base}?laps=1"    solo  "$out/race-touch"       --touch --slow=0.2
run solo-touch-portrait  "${base}?laps=1"    solo  "$out/race-portrait"    --touch --portrait --slow=0.2
run split-touch-1lap     "${base}?laps=1"    split "$out/race-split-touch" --touch --slow=0.2 --size=1180x820
run split-pads-1lap      "${base}?laps=1"    split "$out/race-pad"         --pad --slow=0.25 --rematch --armed
# and the plain race, weapons off, which must still play as it always did
run solo-keys-clean      "${base}?hq&laps=1" solo  "$out/race-clean"       --slow=0.25 --clean
cat "$sum"

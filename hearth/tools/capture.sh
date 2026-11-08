#!/bin/bash
# Captures Hearth screenshots at laptop and phone sizes using headless Chrome.
# Run from anywhere:  bash hearth/tools/capture.sh
# Output: hearth/screenshots/*.png
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/screenshots"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
mkdir -p "$OUT"

chrome() {
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" \
    --virtual-time-budget=6000 "$@" 2>/dev/null
}

# Every shot goes through viewport.html so phone widths are exact.
frame_url() {
  local q="${3//=/%3D}"
  echo "file://$HERE/tools/viewport.html?w=$1&h=$2&q=${q//&/%26}"
}

# shot <name> <width> <height> <scale> <query>
shot() {
  chrome --window-size="$2,$3" --force-device-scale-factor="$4" \
    --screenshot="$OUT/$1.png" "$(frame_url "$2" "$3" "$5")" >/dev/null
  echo "  $1.png"
}

# fullpage <name> <width> <scale> <query>
fullpage() {
  local height
  height=$(chrome --window-size="$2,900" --dump-dom "$(frame_url "$2" 900 "$4")" \
    | grep -o 'data-page-height="[0-9]*"' | grep -o '[0-9]*')
  shot "$1" "$2" "$height" "$3" "$4"
}

echo "Laptop (1440×900 @2x)"
shot laptop-ritual   1440 900 2 "demo=today"
shot laptop-survey   1440 900 2 "demo=today&at=survey&assistant=stressed"
shot laptop-shop     1440 900 2 "demo=today&at=shop&level=4"
shot laptop-game     1440 900 2 "demo=today&at=game&level=9"
shot laptop-history  1440 900 2 "demo=checked&at=history"
shot laptop-final    1440 900 2 "demo=final"
shot laptop-fresh    1440 900 2 "demo=fresh"

echo "Phone (390×844 @3x)"
shot phone-ritual    390 844 3 "demo=today"
shot phone-checked   390 844 3 "demo=checked"
shot phone-creature  390 844 3 "demo=final&at=creature"
shot phone-survey    390 844 3 "demo=today&at=survey&assistant=tired"
shot phone-shop      390 844 3 "demo=today&at=shop"
shot phone-game      390 844 3 "demo=today&at=game&level=12"
shot phone-history   390 844 3 "demo=checked&at=history"
shot phone-feeling   390 844 3 "demo=today&at=feeling&assistant=stressed"

echo "Full-page scrolls"
fullpage phone-full  390 2 "demo=today&assistant=good"
fullpage laptop-full 1440 1 "demo=today&assistant=good"

# mockup <name> <width> <height> <query>  (device frames, transparent background)
mockup() {
  chrome --window-size="$2,$3" --force-device-scale-factor=2 --default-background-color=00000000 \
    --screenshot="$HERE/mockups/$1.png" "file://$HERE/tools/mockup.html?$4" >/dev/null
  echo "  $1.png"
}

echo "Device mockups"
mkdir -p "$HERE/mockups"
for name in ritual checked creature survey shop game history feeling; do
  mockup "phone-$name" 510 925 "kind=phone&shot=phone-$name"
done
for name in ritual survey final shop game history fresh; do
  mockup "laptop-$name" 1380 880 "kind=laptop&shot=laptop-$name"
done
mockup combo-ritual   1460 880 "kind=combo&shot=laptop-ritual&phone=phone-ritual"
mockup combo-keeper   1460 880 "kind=combo&shot=laptop-final&phone=phone-creature"
mockup combo-game     1460 880 "kind=combo&shot=laptop-game&phone=phone-game"

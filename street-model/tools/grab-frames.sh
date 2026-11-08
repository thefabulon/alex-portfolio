#!/bin/bash
# run.sh <video path> <tag> <n> <width> <port>
cd "$(dirname "$0")"
ln -sf "$1" "$2.mp4"; rm -f out/"$2"_*
python3 -I srv.py "$PWD" "$PWD/out" "$5" & SRV=$!
sleep 1
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir="$PWD/prof$5" "http://127.0.0.1:$5/grab.html?src=$2.mp4&n=$3&tag=$2&w=$4&rate=0.25" >/dev/null 2>&1 & CH=$!
for i in $(seq 1 400); do [ -f "out/$2_info.json" ] && break; sleep 1; done
kill $CH $SRV 2>/dev/null; wait 2>/dev/null
ls out | grep "^$2_"; cat "out/$2_info.json" 2>/dev/null; echo

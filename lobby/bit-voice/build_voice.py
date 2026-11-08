#!/usr/bin/env python3
"""Record everything Bambam (Alex's lobby robot assistant) can say, in an ElevenLabs voice.

The API key is never stored in the website. Run this on your computer,
and only the finished mp3 files get published:

    ELEVENLABS_API_KEY=sk_... ELEVENLABS_VOICE_ID=... python3 lobby/bit-voice/build_voice.py

It reads every line out of PROJECTS and LINES in index.html, saves one mp3 per
line, named by a hash of the text, and writes manifest.json. Lines that are
already recorded are skipped, so after you edit Bambam's lines just run it again.
Add --clean to delete mp3s for lines that no longer exist.
"""
import json, os, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MODEL = os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")

# Run in macOS's built-in JavaScript engine: cut PROJECTS and LINES out of index.html,
# evaluate them, and list every spoken line with the same hash the page uses.
EXTRACT_JS = r"""
function run(argv) {
  ObjC.import('Foundation');
  const src = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js;
  const grab = (start, end) => { const i = src.indexOf(start); return src.slice(i, src.indexOf(end, i) + end.length - 1); };
  let VR = false; const inVR = () => VR;
  const PROJECTS = eval("(" + grab("const PROJECTS = [", "\n];").replace("const PROJECTS = ", "") + ")");
  const LINES = eval("(" + grab("const LINES = {", "\n};").replace("const LINES = ", "") + ")");
  const out = new Set();
  const add = x => [].concat(x || []).forEach(l => out.add(typeof l === "string" ? l : l.t));
  Object.values(LINES).forEach(v => { if (typeof v !== "function") add(v); });
  add("Grab a cartridge from the rack, then plug it into the console!");
  PROJECTS.forEach(p => {
    add(p.pickup); add(p.again); add(p.enter); add(p.blurb);
    [false, true].forEach(v => { VR = v; add(LINES.loaded(p)); });
  });
  """ + "const voiceKey = " + "%s" + r""";
  return JSON.stringify([...out].map(t => [voiceKey(t), t]));
}
"""

def page_hash_fn():
    """Copy voiceKey() out of index.html so the script and the page always agree."""
    src = (ROOT / "index.html").read_text()
    i = src.index("function voiceKey(")
    j = src.index("\n}", i) + 2
    return src[i:j].replace("function voiceKey(", "function (", 1)

def lines():
    js = EXTRACT_JS % page_hash_fn()
    script = HERE / ".extract.js"
    script.write_text(js)
    try:
        out = subprocess.run(["osascript", "-l", "JavaScript", str(script), str(ROOT / "index.html")],
                             capture_output=True, text=True, check=True).stdout
    finally:
        script.unlink()
    return json.loads(out)

def speak(text, key, voice):
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_96",
        data=json.dumps({"text": text, "model_id": MODEL}).encode(),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

def main():
    key, voice = os.environ.get("ELEVENLABS_API_KEY"), os.environ.get("ELEVENLABS_VOICE_ID")
    if not key or not voice:
        sys.exit("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID first (see the top of this file).")
    all_lines = lines()
    todo = [(h, t) for h, t in all_lines if not (HERE / f"{h}.mp3").exists()]
    print(f"{len(all_lines)} lines, {len(todo)} to record ({sum(len(t) for _, t in todo)} characters)")
    for n, (h, t) in enumerate(todo, 1):
        try:
            (HERE / f"{h}.mp3").write_bytes(speak(t, key, voice))
            print(f"  {n}/{len(todo)} {h}  {t[:60]}")
        except urllib.error.HTTPError as e:
            sys.exit(f"ElevenLabs said {e.code}: {e.read().decode()[:300]}")
    keep = {h for h, _ in all_lines}
    if "--clean" in sys.argv:
        for f in HERE.glob("*.mp3"):
            if f.stem not in keep:
                f.unlink(); print("  removed", f.name)
    recorded = sorted(h for h in keep if (HERE / f"{h}.mp3").exists())
    (HERE / "manifest.json").write_text(json.dumps({"voice": voice, "model": MODEL, "lines": recorded}, indent=1) + "\n")
    print(f"manifest.json: {len(recorded)} lines recorded")

if __name__ == "__main__":
    main()

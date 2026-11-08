# Hearth

A cozy daily-ritual app designed by Alex. Pick three small intentions, check in on how you feel, grow a companion creature with your streak, and take a two-minute Brain Break.

- **App:** `index.html` (open it in any browser, no build step)
- **Portfolio showcase:** `showcase.html`, with phone and laptop mockups and a write-up of every feature
- **Screenshots:** `screenshots/` (raw captures), `mockups/` (in device frames, transparent PNG)

## Run it

Open `index.html` in a browser. Everything saves to that browser's local storage, so no account or server is needed.

Demo scenes, for screenshots or showing people:

| URL | Shows |
| --- | --- |
| `index.html?demo=fresh` | First visit, empty state |
| `index.html?demo=today` | 12-day streak, survey answered, check-in pending |
| `index.html?demo=checked` | Flame lit, all intentions ticked |
| `index.html?demo=final` | 30-day streak, golden keeper in its final form |

Add `&skin=ember|tidepool|meadow|marshy` to pick a theme, `&at=survey|creature|shop|game|history` to jump to a section, `&assistant=tired|stressed|good` to show a helper reply, `&level=1-20` to load a game level, or `&keeper=ember&look=galaxy` to show one of Alex's characters as the keeper. Demo data stays in memory and never touches saved progress.

## Features

1. **Today's ritual**: three editable intentions and a daily check-in that lights the flame (+1 coal).
2. **Gentle check-in**: feeling, energy, stress and mood answers generate three intentions.
3. **A little company**: one small daily suggestion for "tired", "stressed" or "good".
4. **The little keeper**: a creature that evolves every 7 streak days and reaches its final form at 28. Colors: Ember, Golden, Moss. Hats: Cap, Leaf, Crown, Straw. The keeper can be the original spark or one of Alex's 3D characters (Jimbob, Srank, Jimmy, Ember, Bernie) in four looks; see `../characters/`.
5. **Keeper's shop**: spend coals on the Leaf hat (3), Crown (6) and Golden glow (9).
6. **Brain Break**: a 20-level canvas platformer with keyboard and touch controls. All 20 levels are verified beatable.
7. **Recent days**: a timeline of the last six days and the streak.
8. **Themes**: four color themes (Ember, Tidepool, Morning Meadow, Marshy), picked with the swatches at the top right. Each comes from a place or memory that feels calm. See `palettes/README.md` for the reasoning behind each.

## Regenerate screenshots

Needs Google Chrome on macOS.

```bash
bash tools/capture.sh
```

This writes `screenshots/*.png` (laptop 1440×900 @2x, phone 390×844 @3x, plus full-page scrolls) and `mockups/*.png`.

## Files

```
index.html         the app
hearth-store.js    local save layer (stands in for the Canva data SDK)
demo.js            ?demo= scenes
assets/            straw hat art
palettes/          theme colors (skins.css), theme rationale, swatch board, previews
showcase.html      portfolio page
showcase/          device-frame CSS
tools/             capture script, exact-width viewport, mockup renderer
```

## Origin

Hearth was first built in Canva Code. This version runs on its own: the Canva data SDK is replaced by `hearth-store.js`, and the straw-hat image is redrawn as an SVG. The Canva export was cut off partway through its script, so the shop, survey saving, Brain Break game and startup code were rewritten to match the original design.

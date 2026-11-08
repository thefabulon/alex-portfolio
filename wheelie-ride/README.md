# Wheelie Ride

A small three.js riding game. Pick a vehicle, build up speed, and hold a wheelie
without crossing the red line on the lean meter. Pull it back past the orange
mark and the rider drags a hand on the road. Cross the red line and the bike
loops out: the bike and rider fly apart, tumble and slide until they stop.

There are two versions:

- **`v2.html`, Orange County:** full-screen, on the real roads of Aliso Viejo,
  Laguna Hills, Laguna Niguel and Laguna Beach, with real gears, a rev counter,
  traffic, palm trees and the ocean. See [Version 2](#version-2-orange-county) below.
- **`index.html`, version 1:** the original single straight road.

## Run it

No build step. Open `index.html` or `v2.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000/v2.html
```

## Version 2: Orange County

The map covers Laguna Hills and the 5/405 in the north down to Dana Point,
and Laguna Beach to Mission Viejo, about 15 × 21 km. Roads, buildings,
coastline, land use and city limits come from OpenStreetMap. Hills come from
real elevation data.

**Start points** (menu, or <kbd>M</kbd> for the map and click any road): Anita
Street Beach on Coast Hwy, Main Beach, Laguna Canyon Rd at the 405, La Paz Rd
in Laguna Hills, Aliso Creek Rd and Pacific Park Dr in Aliso Viejo, Crown Valley
Pkwy in Laguna Niguel, and the I-405 at the El Toro Y.

| Key | Action |
| --- | --- |
| ↑ / W | Gas (pedal, on the bicycles) |
| ↓ / S | Brake (weak in a wheelie: only the back brake works). In the air: nose down |
| ← → / A D | Steer |
| Space (hold) | Wheelie. Low gears lift easier. In the air: nose up |
| E (hold) | Drag a foot to slow down |
| X / Z | Shift up / down (switches to manual) · G: auto or manual |
| C | Camera: chase → 1st person → side cam |
| M | Map: click a road to ride there |
| T | Afternoon or sunset |
| V | Sound on or off |
| R | Back on the road after a crash |
| Esc / H / P | Pause menu (the ride stops while it's open) |

**Screen.** Like the go-kart game: top left shows Free ride, a shortcut to
the map, and your hand-drag and air-time chips; top right has round buttons
for the pause menu, camera, sunset, map, sound and back-on-the-road. Esc opens
the pause menu, with every setting and the help.

**Jumps.** Ride over a crest, off a ridge or off the top of a slope fast
enough and you fly. In the air, Space pulls the nose up and the brake pushes
it down. Land on the back wheel and you ride away in a wheelie; land nose
first or too hard and you crash. Roads have their own smooth height, so they
don't bump you into the air; the open ground is where the jumps are.

**Sound.** Made live in the browser (no sound files): the H2R's inline-four
and supercharger whine, the Sur-Ron's electric motor, the bicycles' freewheel
and chain, tyres, wind, the hand-drag scrape, landings, crashes, traffic and
waves near the ocean. It starts on your first key press or click.

**Gauges.** The rev bar (top) is white, then green where you should shift, then
red at the limit. The dash (bottom right) shows speed in mph, the gear, and
RPM. Each ride has a real drivetrain in `src/v2/drivetrain.js`: gear teeth and
pedal cadence on the bicycles, a single-speed motor with a battery on the
Sur-Ron, and the Ninja H2R's real 6-speed ratios and torque curve.

**Files**

```
v2.html                 page and HUD
src/v2/styles.css       full-screen styling
src/v2/main.js          bikes, rider, riding, crash physics, cameras, HUD, input
src/v2/world.js         builds the world from the map data: terrain, ocean, sky,
                        roads, buildings, trees, signs, landmarks, traffic
src/v2/drivetrain.js    gears, RPM and pushing force for each ride
src/v2/sound.js         engine, tyre, wind and crash sounds, made live with Web Audio
src/v2/oc-map.js        the map data (made by the script below; don't edit)
tools/fetch_osm.py      downloads OpenStreetMap data into tools/cache/
tools/build_oc_map.py   turns it into src/v2/oc-map.js
```

**Rebuilding the map** (only needed to change the area or the landmarks):

```sh
python3 tools/fetch_osm.py      # slow: the servers time out a lot, it retries
python3 tools/build_oc_map.py   # about 40 seconds
```

The builder needs Python 3 and Pillow. Its downloads (about 130 MB) stay in
`tools/cache/`, which git ignores. Landmarks and start points are lists near
the bottom of `build_oc_map.py`.

**Testing settings** for the address bar: `?spawn=anita` (part of a start
point's name), `?bike=kawasaki`, `?view=first`, `?time=sunset`,
`?at=x,z,heading` (an exact spot, heading in degrees with 0 = north),
`?hold=ArrowUp,Space` (hold keys down), `?map=1`, `?debug=1` (prints draw
calls and triangles).

**Credits.** Map data © OpenStreetMap contributors (ODbL). Elevation: AWS
Terrain Tiles (USGS, SRTM and others, via Mapzen).

## Version 1

The original game: one straight road that slides past the bike.

### Controls

| Key | Action |
| --- | --- |
| ↑ | Accelerate |
| ↓ | Brake |
| ← → | Steer |
| Space (hold) | Wheelie. Past ~66° the rider hand drags; tap Space to hold it there |
| E (hold) | Drag / slow down |
| C | Switch camera: 3rd person → 1st person → side cam |
| Drag on the game | Look around (1st person only; it eases back when you let go) |

On-screen buttons mirror these for touch devices. The CAMERA switch in the top-right corner of the game picks a view (on phones it sits under the speed boxes).

### Camera views

Like the go-kart game, there are three cameras:

- **3rd person** (default): behind the bike, a little to the right.
- **1st person**: from inside the rider's helmet. You see your hands on the bars, and the front wheel rises into view as you pull a wheelie. The helmet and body are hidden so the camera isn't inside your head.
- **Side cam**: the original camera, off to the side. It's the easiest view for judging the wheelie angle.

In a crash, 1st person cuts to the 3rd-person crash camera. The game remembers the last view you used. Add `?view=first`, `?view=third` or `?view=side` to the address to open in a given view.

### Layout

```
index.html        page markup and HUD
src/styles.css    all styling (no CSS framework)
src/main.js       scene, vehicles, game loop and input
```

three.js r160 loads from cdnjs; fonts load from Google Fonts.

### Tuning

Vehicle stats live in `MODELS` near the top of `src/main.js`:
`max` is top speed in m/s, `turn` is steering response, and `raise` is how
quickly the front end lifts, and `mass` is used by the crash physics. `LEAN_LIMIT` sets the crash angle (~85°) and
`HAND_DRAG_ANGLE` sets where the hand touches the road (~66°). The hand-drag
pose itself is `DRAG_SHIFT`, `DRAG_BACK` and `DRAG_ROLL`, next to `buildBike()`.

Each vehicle is built by its own function: `buildBicycle()` (Street, Trail,
Sprint), `buildSurRon()` and `buildNinja()` (the Kawasaki Ninja H2R). The rider
is `buildRider()`: a gloss-black motocross helmet, and arms and legs made of two parts that
bend at the elbow and knee (`makeLimb()`, posed with two-bone IK in
`solveLimb()`). `FITS` says how the rider sits on each kind of bike: where the
hips, hands (`grip`) and feet go, how far they lean forward (`pitch`), an extra
1st-person head tilt (`eyeDown`), and which hard parts scrape the road in a
crash (`scrape`).

The crash physics is in the "Crash physics" section of `src/main.js`. The bike
and the rider each become a rigid body with contact points (`bikePoints()`,
`riderPoints()`). Each point has its own grip, and some throw sparks. Tune
`BOUNCE`, `GRASS_GRIP`, the air `drag` passed to `makeBody()`, and
`CAMERA_SPREAD` (how far apart the bike and rider can be before the camera stops
trying to keep both in shot).

The camera views are in the "Camera views" section of `src/main.js`. `EYE` is
where the 1st-person camera sits inside the helmet, `HEAD_DOWN` is how far it
looks down at the bars, and `HEAD_FOLLOW` is how much of the wheelie your head
follows. `DRAG_HEAD_TILT` and `DRAG_HEAD_TURN` turn your head toward the road
during a hand drag.

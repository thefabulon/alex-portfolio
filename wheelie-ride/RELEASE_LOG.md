# Wheelie Ride: Release Log

Every problem I ran into while building Wheelie Ride, what caused it, and how I fixed it.
Newest release first.

Each entry follows the same pattern:

- **Problem:** what I saw
- **Cause:** what was really going on
- **Fix:** what I changed
- **Takeaway:** what I'd do differently next time

---

## Best stories for slides

1. **Turning a real map into a 3D world (v0.12).** The game used to be one straight road sliding past the bike. Now it's my actual neighborhood: 15,900 real roads, 104,600 real buildings and real hills, from Laguna Hills down to Anita Street Beach.
2. **The ocean that was land (v0.12).** The elevation data said the Pacific was 0 m high, the same as a beach, so most of the ocean came out as dry land. I had to work out where the sea was from the coastline instead.
3. **Grass growing through the road (v0.12).** Patches of grass kept showing through the middle of La Paz Rd. Hiding the ground proved the road was fine; the ground was poking up through it.
4. **Sculpting a motocross helmet out of a ball (v0.11).** I cut the eyeport out of a sphere and pulled its lower front into a pointed chin bar using a rule, not a modelling program. A tiny hole on top turned out to be a `NaN` bug.
5. **Giving the rider elbows and knees (v0.10).** My rider's arms were straight sticks. Now the game works out where each elbow and knee should go, so the hands stay on the bars and the feet on the pegs on every bike.
6. **Teaching the bike to fall (v0.8).** Crashing used to just freeze the game. Now the bike and rider are real physics objects that flip, bounce, tumble and slide, using the same rules as a physics engine: gravity, bounce and friction at every point that touches the road.
7. **The rider who hung upside down (v0.6).** My first hand-drag pose flipped the rider over with the bike. I had to work out which way the body should lean and in what order to turn it.
8. **The wheel that sank into the road (v0.4).** My first fix looked right but did nothing. I had to work out why before I could fix it properly.
9. **Breaking out of Canva (v0.2).** The game only worked inside the tool I built it in. I had to separate my code from the platform's code.
10. **The button that lit up the wrong bike (v0.2).** Two styling systems were fighting, and the wrong one was winning.

---

## v0.13 (2026-11-07): Jumps, smooth roads, sound, and a go-kart style menu

### Problem 1: The menu didn't match my go-kart game

- **Problem:** Version 2 had a big panel of buttons down the left side of the screen. My go-kart game looks like a real racing game: a pause menu, and small round buttons in the corner.
- **Cause:** I'd copied an older version of the go-kart menu. The go-kart had been updated since then.
- **Fix:** I rebuilt the screen corners and the menu the same way as the go-kart:
  - **Top left:** "Free ride", a "Pick a place" button for the map, and two chips: hand drag and air time.
  - **Top right:** round buttons for the pause menu, camera, sunset, map, sound and back on the road. The camera's name pops up for a moment when you switch.
  - **Pause menu** (<kbd>Esc</kbd>, <kbd>H</kbd> or <kbd>P</kbd>): the ride stops while it's open. Big buttons on the left (Resume, Map, Back on the road, Lobby). On the right: ride, gears, start point, camera and world settings, with fold-out help.
  - **Keyboard hints** in the corner fade away after 12 seconds.
- **Takeaway:** Copy the latest version of the thing you're matching, not the one you remember.

### Problem 2: The bike was glued to the ground

- **Problem:** I wanted to get air off cliffs and bumps, but the bike never left the ground, even riding off a cliff at full speed.
- **Cause:** Every step, the game set the bike's height to the ground's height. The bike couldn't be anywhere else.
- **Fix:** Every step the game now asks: would gravity alone keep the bike on the ground?
  - **Taking off:** if the ground drops away faster than gravity can pull you down, you fly. Riding up a slope gives you upward speed, so the top of a ramp launches you. The suspension soaks up the first few centimetres, so small bumps don't make you hop.
  - **In the air:** Space pulls the nose up and the brake pushes it down, like throttle and back brake on a real bike. Steering barely works, the engine just revs, and there's a big AIR counter.
  - **Landing:** the game measures how fast you hit the ground, straight into it. Land on the back wheel and you ride away in a wheelie. Land nose first ("Over the bars!") or too hard ("Cased it!") and the crash physics takes over. Landing on a downslope is softest, like in real motocross.
  - **Testing:** I wrote a test that searches the real map for a drop-off and sends the bike over it. Off a 9 m drop at 40 mph: 1.6 s of air, 28 m far, 4.4 m high, a clean landing. Off a 26 m cliff: a correct "Cased it!" crash, because hitting flat ground from that height means landing at about 22 m/s.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Ask what the physics would do, instead of telling the bike where to be.

### Problem 3: Bumps in the road

- **Problem:** The roads felt bumpy, and with jumps added they could even throw you into the air.
- **Cause:** In v0.12 I made roads lie exactly on the ground's 30 m triangles, so grass couldn't poke through. But that means a road bends at every triangle edge, so there's a little bump every 30 m.
- **Fix:**
  - **Smooth heights:** every road now has its own smooth height, measured every 4 m along it and averaged over 15–70 m (freeways are smoothest, because real ones are built that way).
  - **Junctions:** roads that meet are pulled to the same height there, and the bigger road wins.
  - **Ground pushed down:** the ground under and beside each road is lowered just below the road surface. Each sample point pushes down the three corners of the ground triangle it sits in, so nothing pokes through.
  - **Edges:** a short edge hangs down from each road, so no gap shows where the ground dips away.
  - **Riding:** the bike, the traffic and the street lights all sit on the smooth height. Your up-and-down speed comes from the road's slope, so a curb is a small step, not a ramp.
  - Riding Crown Valley Pkwy at 67–99 mph, the bike's height now changes smoothly, with no jolts and no accidental air.
- **Takeaway:** A fix can create the next problem. Draping fixed grass in the road but made the road bumpy. The real fix was to give the road its own shape and make the ground get out of its way.

### Problem 4: The game was silent

- **Problem:** No engine, no wind, nothing.
- **Fix:** I made every sound live with the Web Audio API, out of oscillators (tones) and filtered noise, so there are no sound files (`src/v2/sound.js`):
  - **Ninja H2R:** an inline four fires twice per turn of the crank, so its note is rpm ÷ 60 × 2: 43 Hz at idle, 467 Hz at the 14,000 rpm redline. It's two sawtooth waves plus one an octave down, through some distortion and a filter that opens with the throttle. On top: the supercharger's whistle, and pops and crackles when you shut the throttle at high revs.
  - **Sur-Ron:** an electric motor whine at rpm ÷ 60 × 4 (its magnet pole pairs), louder the harder it works.
  - **Bicycles:** the freewheel clicks while you coast (24 clicks per turn of the wheel: slow ticks, then a buzz) and the chain whirs while you pedal.
  - **Everything else:** tyre noise that changes on road, dirt and sand; wind that grows with speed; the glove scraping in a hand drag; thumps when you land or crash; a click on every gear shift; traffic going past; and waves when you're near the ocean.
  - Browsers only allow sound after you press a key or click, so it starts then. It pauses with the menu, and <kbd>V</kbd> or the speaker button mutes it.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Sound can come from the same numbers as the gauges. The engine note is the RPM.

### Problem 5: The landing message never showed

- **Problem:** After my first test jump, the air-time chip still said 0.0 s, and no landing message appeared.
- **Cause:** I added the landing details to my test readout. The landing had happened, but it was a crash ("Cased it!"), so the message correctly never showed. The 26 m cliff I picked for the test was just too big.
- **Fix:** No bug in the game, but I made landings a little more forgiving (the H2R can now take about an 8 m drop onto flat ground), and I tested again on a 9 m drop.
- **Takeaway:** Before fixing "broken" code, check whether it did exactly what it should with the input you gave it.

---

## v0.12 (2026-11-07): Version 2, my neighborhood in Orange County

Version 2 is a new page, `v2.html`, next to the original. Version 1 still works exactly as before.

### Problem 1: The game was one endless straight road

- **Problem:** I wanted to ride around my real neighborhood: Aliso Viejo and Laguna Hills, Crown Valley, Pacific Park, La Paz, Aliso Creek Rd, the 405, and down Pacific Coast Highway to Anita Street Beach. Version 1 couldn't go anywhere.
- **Cause:** Version 1 was a treadmill. The bike never moved. The road stripes and trees slid toward the camera and jumped back to the far end when they passed it. You could only steer a few metres left and right.
- **Fix:**
  - The bike now has a real position on a map and a heading (which way it faces). Steering turns the heading, and speed moves you forward along it, so you can ride anywhere.
  - Steering works like a real bike. You can turn tightly at walking speed, but at high speed the tyres can only grip so hard (`TYRE_GRIP`), so turns get wider. The bike leans into corners.
  - Hills matter. Going uphill slows you down, downhill speeds you up, and the bike tips forward or back to match the slope.
  - What you're riding on matters: road is fastest, then grass, dirt and brush, and sand is slowest. Ride into the ocean and you crash ("Splash!").
  - You can hit things: buildings, tree trunks and cars. At low speed you just stop. Fast enough and you crash, and the crash card says what you hit.
  - The page is full-screen now, like my go-kart game, with a menu you can fold away (<kbd>H</kbd>).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Faking movement is easy until you want to go somewhere. A real position and heading made everything else possible: maps, traffic, landmarks.

### Problem 2: Getting the real roads

- **Problem:** I wanted the real roads, not ones I made up, so the turns and junctions would match what I see when I ride.
- **Cause:** The road shapes exist in OpenStreetMap (a free map anyone can edit, like Wikipedia for maps), but the public servers you ask for that data kept timing out (error 504) on big requests.
- **Fix:** I wrote a download script, `tools/fetch_osm.py`, that:
  - asks for small pieces at a time: the big roads, then the neighborhood streets in two halves, then the buildings in 36 small squares,
  - tries each piece again (up to 8 times) when the server times out,
  - saves every piece in `tools/cache/`, so running it again only downloads what's missing.
  - A second script, `tools/build_oc_map.py`, turns that into one file the game loads, `src/v2/oc-map.js`. It changes latitude and longitude into metres, simplifies the road shapes, and finds every spot where two roads meet, so traffic can turn there.
- **Takeaway:** When a server is unreliable, ask for less at a time, retry, and save what you get.

### Problem 3: Real hills, but flat roads

- **Problem:** Orange County is hilly. Aliso Viejo sits up to 250 m above the beach, and Laguna Canyon Rd runs along the bottom of a canyon. A flat world wouldn't look like home.
- **Cause:** Real ground height comes as elevation data, which is bumpy at the 30 m scale. Laying the roads straight on it would make them lumpy, and bridges would dip into the creeks they cross.
- **Fix:**
  - I downloaded real elevation data (AWS Terrain Tiles) and built the ground as a grid of points 30 m apart.
  - Along each road, the builder smooths the height out over 30 to 90 m (more on freeways), and bridges go in a straight line from end to end.
  - Then it **cuts and fills** the ground next to the road to match, the way real road builders do, blending back into the hillside over about 26 m.
- **Takeaway:** Real data needs cleaning before it looks real.

### Problem 4: The ocean came out as dry land

- **Problem:** On the map, only a thin strip of ocean ran along the coast. Out past it, where the Pacific should be, the ground was drawn as brown hills.
- **Cause:** I decided what was sea by checking which side of the coastline a point was on, but only within 240 m of the coast. Past that, I trusted the elevation data to say "below sea level". I tested a few points out at sea and they all came back as **0.0 m**. At this level of detail the elevation data has no sea floor, so the ocean is the same height as a beach.
- **Fix:** A **flood fill**, like the paint bucket in a drawing program. It starts from water that's definitely on the sea side of the coastline and spreads to every connected point near sea level. The land side of the coastline works as a wall, so the flood can't leak inland. The ocean is now one connected body of water, and it gets deeper further out.
- **Takeaway:** Test your data, not just your code. Three quick numbers (0.0, 0.0, -0.1) explained the whole bug.

### Problem 5: Grass growing through the road

- **Problem:** A patch of grass showed through the middle of La Paz Rd, right under my bike. The patch had sharp, zig-zag edges.
- **Cause:** I tested it. I turned the ground into a see-through wireframe, and the road under it was complete. So the road wasn't missing; the ground was poking up through it. The ground is made of triangles 30 m across. Where the builder graded the ground next to a road, neighbouring triangles tilt at different angles, so there's a crease. A road made of straight pieces cuts across the crease, and the bent ground ends up a few centimetres above the road.
  - My first fix (more points across the road) made it smaller but didn't get rid of it.
- **Fix:** Every road piece is now cut along the ground's own triangle edges, so each part lies exactly flat on one ground triangle. The lane lines and sidewalks are laid down the same way. Now nothing can poke through.
- **Takeaway:** Hiding one thing at a time tells you which part is broken. A fix that makes a bug smaller hasn't found its cause.

### Problem 6: The start points faced the wrong way

- **Problem:** I added start points (like "La Paz Rd · Laguna Hills") so you don't have to ride 20 km to get anywhere. When I checked the data, the headings were wrong, and the bike would have started on the wrong side of the road.
- **Cause:** Two mistakes:
  - **Two different angle systems.** Python's `atan2` measures angles from east, going anticlockwise. My game measures heading from north, and turning left makes it bigger. I had saved the Python angle as the game heading.
  - **A double minus.** To move the bike to the right-hand side of the road, I wrote `x += -sin(angle) * -offset`. The two minuses cancel, so it moved left.
- **Fix:** I convert the angle to the game's heading before saving it, and removed the extra minus.
- **Takeaway:** Write down which way angles are measured. Two systems that are both "right" will still disagree.

### Problem 7: Every place said "no city"

- **Problem:** I added a "Welcome to Laguna Hills" sign when you cross into a new city, but it never appeared, and the location label was always empty.
- **Cause:** I asked OpenStreetMap for the city boundaries with `out tags geom`. For city boundaries, that only sends back each city's name and a rectangle around it, not the outline. Every city came back with zero border pieces.
- **Fix:** I asked again with `out geom`, which sends the full outlines, and moved the request into the download script so it's repeatable. I also found that my "Pacific Park Dr · Aliso Viejo" start point was really in Laguna Niguel (the road runs through both cities), so I moved it to the Aliso Viejo end.
- **Takeaway:** Check that the data you got is the data you asked for. Counting the border pieces showed the bug in one line.

### Problem 8: Speckled windows at sunset

- **Problem:** At sunset, some windows looked speckled, like TV static.
- **Cause:** It took me three guesses:
  1. **Buildings drawn twice.** OpenStreetMap sometimes has two buildings in the same place, and two walls in the same spot flicker. I made the builder skip any building whose middle is inside a bigger one. It removed 545 doubles, but the speckles stayed.
  2. **Shadow acne.** A low sun hits walls at a very flat angle, and the shadow test speckles the wall. Moving the shadow test further off the surface when the sun is low (`normalBias`) fixed speckles on the walls, but not in the windows.
  3. **The real cause.** At sunset, some windows light up. Which ones is decided by a "random" formula that uses the building's number. That number is passed from the corners of each triangle to every pixel in between, and on the way 1234 can arrive as 1233.9999. The random formula is built to turn tiny differences into big ones, so each pixel came out different.
- **Fix:** I passed the building number with `flat`, which hands every pixel the exact number from one corner instead of blending, and I round it too.
- **Takeaway:** Write down each guess and what it ruled out. The first two weren't wasted: they fixed real problems on the way.

### Problem 9: A speedometer and gears that make sense

- **Problem:** I wanted a rev counter, a speedometer and a gear display like real bike games. A gear number means nothing if it isn't connected to anything.
- **Cause:** Version 1's speed was one number that went up while you held ↑. There was no engine, no gears and no RPM.
- **Fix:** Each ride now has a real drivetrain (`src/v2/drivetrain.js`):
  - **Bicycles** have chainrings and cogs. The "RPM" is how fast your legs turn (cadence). Low gears push hard but spin out; high gears are fast but heavy. The gear shows the teeth, like "53×17" on the road bike.
  - **Sur-Ron** is electric, with one fixed gear, so it shows **D**. It shows motor RPM, power in kW, and a battery that drains as you ride (braking puts a little back).
  - **Ninja H2R** uses the real bike's 6-speed gear ratios, a torque curve that peaks at 12,500 rpm, and a 14,000 rpm redline. It shifts like the real one: no power for 0.06 s on the way up (a quickshifter) and a throttle blip on the way down. It shifts itself, or you can switch to manual (<kbd>Z</kbd> <kbd>X</kbd>).
  - **Gears change how easily you can wheelie.** The force at the back tyre is engine torque × all the gear ratios ÷ tyre size. More force lifts the front faster, so 1st gear wheelies easily and 6th barely at all.
  - I checked the numbers by simulating each bike. The H2R does 0–60 mph in 2.4 s and tops out at 225 mph (the real one claims about 2.5 s and nearly 250 mph). The Sur-Ron tops out at 54 mph.
  - The HUD has a segmented rev bar across the top (white, then green where you should shift, then red at the limit), and a dash in the corner with a big speed number in mph, the gear, km/h, RPM and miles ridden. The speed turns red when you're more than 10 mph over the speed limit, which comes from the real road data.
  - **Bug I hit:** On the dash, the rev arc covered the speed number. I moved the arc into a shallow strip above the numbers.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Make the numbers on screen come from the same math that moves the bike, and they'll always agree.

### Problem 10: Too much for the graphics card

- **Problem:** The whole map has about 15,900 roads, 104,600 buildings and 74,000 trees, plus brush on the hills. The first full build used about 10 million points of road and sidewalk alone.
- **Cause:** Every neighborhood street had sidewalks on both sides, with a curb face measured every 2 m. That one layer was 6.6 million points.
- **Fix:**
  - The map is cut into 960 m squares, and only the squares near you are drawn. Far squares switch to a simpler version of the ground.
  - Trees and buildings are drawn as **instances** (one model copied many times), grouped into 480 m blocks, so the shadows only redraw the blocks near you.
  - Neighborhood sidewalks no longer have an upright curb face, and curbs are measured every 6 m. Meshes don't store colours or textures they don't use. The total dropped from 10.2 to 6.9 million points.
  - Signs only exist when you're near them. In Laguna Beach at sunset, a frame draws about 0.7 million triangles.
- **Takeaway:** Measure before you cut. The count showed one layer was taking two-thirds of the memory.

### Problem 11: My test browser stopped after 2 seconds

- **Problem:** I checked the game with screenshots from a headless browser (Chrome with no window). The game loaded, but the bike barely moved, and a frame counter I added stopped at 69.
- **Cause:** I used a setting that makes the browser fake the passing of time. With a heavy 3D scene, it stopped running animation frames after about 2 seconds of fake time. There were no errors; the game just wasn't being asked to draw.
- **Fix:** I wrote a small script that controls Chrome through its developer connection (the same one the developer tools use). It lets the game run in real time, then reads numbers from the game (speed, gear, RPM, which road I'm on) and takes screenshots. I also added test settings to the page address:
  - `?at=x,z,heading` starts you at an exact spot,
  - `?hold=ArrowUp,Space` holds down keys,
  - `?debug=1` prints how much the graphics card is drawing.
  - With it I tested a full run: wheelie, then a 17 m hand drag, a loop-out, the crash, the crash card, and "Ride again".
- **Takeaway:** If a test tool can't show the thing you're testing, build a better test tool before trying to fix the game.

### Problem 12: Smaller fixes

- **Wild grass in town.** Where OpenStreetMap has no land-use outline, the ground looked like wild hillside, even next to houses. Now the ground around homes turns into yards, and around shops into paving.
- **Sand between the freeway lanes.** The 405 is drawn as several separate roads, and sand showed between them. The ground next to freeways is now concrete.
- **The camera jumped at crash time.** Reading the code, I noticed the crash camera aimed at the middle of the map for one frame, because the crash spot wasn't set yet. It now starts where the bike is.
- **The dash kept showing power during a crash.** The engine now winds down while you tumble.
- **Too many glitchy leafy trees.** My first trees were dark and blocky. I made the leaf clumps rounder and lighter, and used a painted leaf texture.

---

## v0.11 (2026-11-07): A motocross helmet

### Problem: The rider wore a trail helmet, and I wanted a motocross one

- **Problem:** I wanted my rider in a gloss-black motocross helmet: full face, a long peak, and a chin bar that sticks out in a point. The old helmet was an open-face MTB dome.
- **Cause:** A motocross helmet isn't a ball. It has a hole for your eyes and a chin bar that pushes forward, and three.js has no shape like that built in.
- **Fix:** I made the new helmet out of a sphere and changed it in three steps:
  - **Cut the eyeport.** I removed the triangles between the brow and the chin. I cut along the sphere's own grid lines, because my first cut went through the middle of grid squares and left saw-tooth edges.
  - **Sculpt the chin bar.** I moved the points on the lower front of the sphere forward and down. Points nearer the middle move further, so the chin bar comes to a point.
  - **Add the details:** a long flat peak angled down over the eyeport, bolts at each side, two vent slots in the chin bar, and dark padding inside. It's all gloss black.
- **Bug I hit:** A tiny hole showed up on top of the helmet. At the very top point, rounding error made a number a hair bigger than 1. `Math.acos` gives `NaN` (not a number) for that, and those triangles disappeared. Capping the number at 1 fixed it.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** You don't need a 3D modelling program for every new shape. Start with a simple one and move its points with a rule. Also, if part of a model disappears, look for `NaN`.

---

## v0.10 (2026-11-07): A new rider, a real Sur-Ron and a real Ninja H2R

### Problem 1: The rider was made of sticks

- **Problem:** The rider was a capsule for a body, a plain ball for a helmet, and arms and legs that were single straight tubes. With no elbows or knees, the arms poked straight at the bars like broom handles.
- **Cause:** Each arm and leg was one cylinder stretched from the shoulder or hip to the hand or foot. There was nowhere for it to bend.
- **Fix:** I rebuilt the rider from scratch:
  - **Clothes:** a red jersey with a lime band, white sleeves, dark trousers, knee pads, gloves, shoes and a hydration pack. These are the same colors as the rider on the lobby cartridge.
  - **An MTB trail helmet:** an open-face dome that sits high over the brow and low at the back, with vents, a lime stripe front to back, a lime **peak** (the visor that sticks out over your eyes), chin straps and a fit dial. Under it there's a face with wraparound sunglasses.
  - **Elbows and knees:** every arm and leg is now two parts with a joint in the middle. Each frame, the game knows where the shoulder and the hand need to be. It works out where the elbow has to go so both parts keep their length. This is called **two-bone IK** (inverse kinematics), and it's the same trick big games use to keep feet on stairs. Elbows bend out and down, and knees bend forward.
  - It all still works in a hand drag, in 1st person (you see your gloves on the bars) and in a crash (the arms and legs still flail).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** You don't animate an elbow. You tell the game where the hand goes and let the math find the elbow. That's why the hands stay on the bars on every bike, even though each bike puts the bars somewhere different.

### Problem 2: The Sur-Ron and the Ninja were just the bicycle with boxes stuck on

- **Problem:** The Sur Ron and the Kawasaki didn't look like their real bikes. They had pedals and a bicycle frame. The Sur Ron had two black boxes on it, and the Kawasaki had one green box.
- **Cause:** Every vehicle was built from the same bicycle frame, and the motorbikes only added a box or two on top.
- **Fix:** Each motorbike is now built on its own, from the details that make the real one recognisable:
  - **Sur-Ron Light Bee X** (electric dirt bike): a raw aluminium frame looping round a tall black battery box with SUR-RON on it, the motor slung underneath with a chain on the left, gold upside-down forks, tall motocross bars with a bar pad, a number plate with a round headlight, high white fenders, a long flat seat, a shock with a red spring, knobby tyres on spoked wheels, and footpegs.
  - **Kawasaki Ninja H2R** (track-only supercharged hyperbike): mirror-chrome bodywork, the green trellis frame, a pointed nose with no headlights and an air intake at the tip, carbon winglets on the sides of the fairing, a smoked screen, H2R on the side fairings, clip-on bars, the supercharger on the left, a single-sided swingarm, a short fat exhaust on the right, slick tyres, black 5-split-spoke wheels with a green pinstripe, and twin front discs with gold calipers. The button now says "Kawasaki Ninja H2R".
  - **The rider sits differently on each bike.** A new table, `FITS`, says where the hips, hands and feet go and how far the rider leans forward: upright on the bicycles, the dirt-bike "attack" position on the Sur-Ron, and a full tuck on the H2R with feet up on high pegs.
  - Shiny metal needs something to reflect, or it looks black. I gave the scene a soft sky that only the shiny parts reflect.
  - The crash physics now uses each bike's real hard parts (bar ends, footpegs, winglets, exhaust, fender tips) as the points that scrape the road and throw sparks.
  - My first H2R had a big chrome air duct across the side, a side panel that looked like it was floating, and a front fender as big as a hood. I checked screenshots from the side and from the front corner and fixed all three: the duct is now black and tucked behind a bigger chrome side fairing, and the fender is a short carbon one.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Making something look "real" is about picking the few details people recognise it by, like the H2R's chrome and green frame or the Sur-Ron's battery box and dirt-bike fenders, and getting those right.

### Problem 3: On the Sur-Ron, 1st person couldn't see the bars

- **Problem:** In 1st person on the Sur-Ron, I could see the road and the front fender but not my hands or the bars.
- **Cause:** In the attack position the rider leans forward, so their eyes end up almost straight above the bars, about 68° below straight ahead. The 1st-person view didn't reach down that far.
- **Fix:** Each bike in `FITS` can tilt your head a bit further down in 1st person (`eyeDown`). On the Sur-Ron it's about 10° more, and now the bars and gloves sit along the bottom of the screen. On the H2R you're tucked in, so you look over the nose and screen like a real rider would. I left that one as it is.
- **Takeaway:** A change in one place (the rider leaning forward) can break something somewhere else (the camera). Checking every view after a change catches it.

---

## v0.9 (2026-11-07): Camera views, like the go-kart

### Problem 4: There was only one camera

- **Problem:** The game always watched the bike from the same spot, off to the side and behind. My go-kart game lets you switch between a chase cam, the driver's seat and more, and Wheelie Ride felt flat next to it.
- **Cause:** The camera position was written straight into the render loop, with no idea of "views" at all.
- **Fix:**
  - Three views, picked with a new **CAMERA** switch in the top-right corner of the game, or with <kbd>C</kbd> (the same key as the go-kart):
    - **3rd person** (the new default): behind the bike and a little to the right, looking down the road.
    - **1st person**: from inside the rider's helmet. You see your hands on the bars, and the front wheel rises up in front of you as you pull a wheelie.
    - **Side cam**: the original camera. It's still the easiest view for judging the wheelie angle.
  - In 1st person, the rider's helmet and body are hidden, like the driver in the go-kart's seat view, so the camera isn't stuck inside your own head. The arms and legs stay.
  - Your head follows about half of the wheelie angle, so you look up as the front comes up but can still see the road.
  - Drag on the game to look around in 1st person. Let go and the view eases back to straight ahead.
  - The view gets a touch wider as you speed up, like the go-kart.
  - In a crash, 1st person cuts to the 3rd-person crash camera. A helmet cam tumbling down the road would be too much to watch.
  - The game remembers your last view, and `?view=first` (or `third`, `side`) in the address opens a set view.
  - **Layout changes:**
    - My first version put the CAMERA buttons in the panel under the game, next to the bike buttons. On a phone that panel is below the screen, so you'd have to scroll away mid-ride to switch. I moved the switch onto the game itself, top-right, like the go-kart's in-game menu. On phones it sits under the speed boxes, because those fill the top edge.
    - On phones the lean meter covered the handlebars in 1st person. I slimmed it down: the long "orange = hand drag · red line = crash" key is hidden on small screens (the colors still show it), and on tall, narrow screens the 1st-person view looks a little further down (`PORTRAIT_DOWN`) so the bars sit above the meter.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Moving the camera code into one "Camera views" section made adding views easy. The go-kart already had a pattern I could copy.

### Problem 5: In 1st person I couldn't see the handlebars

- **Problem:** My first 1st-person view showed only the road and a sliver of the stem at the bottom of the screen. No hands, no bars.
- **Cause:** The rider is tall compared to the bike. From the helmet, the bars are about 0.8 m below your eyes and only 0.6 m in front, so they sit about 52° below straight ahead. The camera looked 11° down and showed 26° below that, so the bars were off the bottom.
- **Fix:** The head now looks 20° down (`HEAD_DOWN`) and the 1st-person view is wider (75° instead of 52°). Now your hands and the bars sit along the bottom of the screen.
- **Takeaway:** Working out the angle to the thing I wanted to see told me exactly how far to tilt, instead of guessing.

### Problem 6: In a hand drag the front wheel blocked the view

- **Problem:** During a hand drag in 1st person, the raised front wheel filled the left third of the screen, and I couldn't see the hand on the road at all.
- **Cause:** The camera rides inside the helmet, and in a hand drag the rider slides off the side of the seat and leans out. So the camera moves right next to the front wheel. I measured where the glove was compared to the camera: 1.5 m straight down and slightly behind. To see it, you'd have to look straight down and lose the road.
- **Fix:** In a hand drag your head turns and tilts toward the side the hand is on (`DRAG_HEAD_TURN`, `DRAG_HEAD_TILT`). That moves the front wheel to the edge of the screen and keeps the road ahead in view. I decided not to chase the glove: the HAND DRAG! sign and the meter already tell you it's down.
- **Takeaway:** Measure before tuning. One measurement showed that seeing the glove was never going to work, which saved me from trying angle after angle.

---

## v0.8 (2026-11-07): Crash physics

### Problem 7: Crashing just froze the game

- **Problem:** When the wheelie went past the red line, everything stopped and the "Ride over" card popped up. The bike never actually fell over.
- **Cause:** A crash was only a true/false switch (`crashed = true`). Nothing in the game knew how a falling bike should move.
- **Fix:** When you loop it, the bike and the rider each turn into a **rigid body**: an object with a mass, a speed, a spin and a resistance to spinning (inertia). Every step, the game:
  - pulls them down with gravity and slows them with air drag,
  - checks a set of contact points on each body (around the tyres, the bar ends, the saddle, the pedals, the rider's helmet, hips, hands and feet) to see which ones are touching the road,
  - pushes those points back up with a small bounce, and drags them against the way they're sliding (friction).
  - Each body starts with the speed and wheelie spin it had at the moment of the crash, plus a small random twist, so no two crashes look the same.
  - Tyres barely grip because they roll. Metal parts grip more and throw sparks. The rider's riding gear grips the most, and grass grips harder than asphalt.
  - Heavier bikes now have a `mass` in the bike table, so the 210 kg Ninja tumbles differently from the 65 kg Sur Ron.
  - The rider's arms and legs fling out while they tumble and go limp as they slow down. Hard hits shake the camera.
  - The "Ride over" card now waits until everything has stopped (or 7 seconds have passed) and tells you how far you slid.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Real physics is mostly a few simple rules (gravity, push out of the ground, friction) applied many times a second. Splitting each step into 5 smaller steps stops fast objects from sinking into the road.

### Problem 8: The camera lost the rider

- **Problem:** In my first version, the camera aimed at the point halfway between the bike and the rider. On a street-bike crash they ended up 23 m apart, which put the rider *behind* the camera. On the Ninja they ended up 160 m apart, and both disappeared into the fog.
- **Cause:** The bike and rider slide different distances. The rider's riding gear has more grip than the bike's rolling tyres, so the bike keeps going.
- **Fix:** The camera now follows the rider, because that's you. It also keeps the bike in shot by pulling back and up, but only while the bike is within 12 m (`CAMERA_SPREAD`). After that, the bike slides off into the distance.
- **Takeaway:** I only found this by testing the fastest bike. Always test the extremes.

### Problem 9: My test browser couldn't see the crash

- **Problem:** To check the crash, I ran the game in a "headless" browser (Chrome with no window) and took screenshots. In the screenshots, the bike never moved.
- **Cause:** The game moves forward each time the browser is about to draw a new frame (`requestAnimationFrame`). A headless browser never draws frames, so the game never moved forward.
- **Fix:** In a test copy only, I swapped the frame timer for a regular timer. I also made it freeze the crash at a chosen moment (0.3 s, 0.6 s, 0.9 s and so on) and use the same "random" numbers every run, so I could take screenshots of the same crash step by step. I also printed the positions and speeds of the bike and rider every quarter second to check that they slowed down and came to rest without shaking.
- **Takeaway:** To test something that moves, make it repeatable: the same random numbers and the same moment in time.

---

## v0.7 (2026-11-07): A real button back to the lobby

- The only way back to the lobby was a small grey "← Lobby" text link above the title. It was easy to miss.
- It's now a **← Back to lobby** button with a lime outline, in the same style as the bike buttons.
- The crash screen also has a **Back to lobby** button next to **Ride again**, so you can leave straight from a crash.
- **Why I made this call:** _[your reasoning here]_

---

## v0.6 (2026-11-07): Deeper wheelies and hand drags

### Problem 10: The wheelie couldn't go back far enough for a hand drag

- **Problem:** The wheelie stopped at 62°. Past that, you crashed, so you could never get the front end high enough for a hand drag, where the rider reaches down and drags a glove on the road.
- **Cause:** The crash angle, `LEAN_LIMIT`, was set to 1.08 radians (62°).
- **Fix:**
  - Raised the crash angle to 1.48 radians (about 85°).
  - Added `HAND_DRAG_ANGLE` at 1.15 radians (about 66°). Past it, the rider slides off the left side of the seat, leans out and puts a hand on the road. Sparks fly off the glove.
  - While the hand is down, it works like a kickstand: the front still rises if you hold Space, but at about a third of the speed, so you can hold the drag by tapping Space. The glove also slows the bike a little.
  - New HUD pieces: a "Hand drag" counter for how many metres you dragged this run, a "HAND DRAG!" sign while it's happening, and an orange hand-drag zone on the lean meter. The bar turns orange in the zone and red just before the crash line.
  - If you crash after a hand drag, the crash screen tells you how far you dragged.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** One number (the crash angle) was the only thing standing between the game and a whole new trick.

### Problem 11: My first hand-drag pose hung the rider upside down

- **Problem:** In my first try, the rider slid off the seat and tipped back with the bike, so at 74° the helmet was almost on the road behind the back wheel. It looked like a crash, not a trick.
- **Cause:** Two mistakes:
  - I tipped the rider's body *backward*, the same way as the bike. A real rider in a hand drag leans the other way, toward the handlebars, so their body stays fairly upright while the bike stands up.
  - I bent the rider sideways around the bike's own long axis. When the bike is nearly vertical, that axis points almost straight up, so bending around it just swung the rider in a circle instead of lowering the shoulder toward the road. In 3D, the order of the turns matters: I needed to bend the body sideways first, in its own frame, and then tip it.
- **Fix:** The rider now leans forward against the wheelie by (wheelie angle − 0.4 radians), so the body always ends up leaning back about 23° in the world. The sideways bend happens first, in the rider's own frame. I worked out the pose with a small script that measured how far the shoulder was from the road at different angles, then checked screenshots at 60°, 69° and 81°.
- **Takeaway:** When a 3D pose looks wrong, measure it: shoulder height, arm length. Guessing numbers wasted a round.

### Problem 12: The rider's arm was too short to reach the road

- **Problem:** Even in the best pose, the rider's shoulder was 1.1 to 1.3 metres above the road, but the arm was only 0.8 metres long.
- **Cause:** The rider model is tall compared to the bike, with short arms. Its proportions were made for holding handlebars, not reaching the ground.
- **Fix:** Arms and legs are now separate pieces that get re-aimed every frame, so the hands stay on the bars and the feet stay on the pedals while the body moves. During a hand drag the arms stretch to about 1.2 metres. From the game camera, it reads as a straight, reaching arm.
- **Takeaway:** A model's proportions limit which poses it can do. If I rebuild the rider, I'll give it longer arms.

---

## v0.5: Fixed the link from the lobby

### Problem 13: The lobby's WHEELIE SIM cartridge opened a missing page

- **Problem:** Plugging the WHEELIE SIM cartridge into the lobby console led to a "file not found" page, not the game.
- **Cause:** The cartridge's link was `../../wheelie-ride/index.html`. That was right when the game sat next to the portfolio folder. After I moved the game inside the portfolio (v0.3), the link went up one folder too many and pointed outside the portfolio. Relative paths kept the game's own files working, but a link *into* the game from somewhere else still used the old location. The game also had no way back to the lobby.
- **Fix:** I changed the link to `../wheelie-ride/index.html` and added a "← Lobby" link at the top of the game, like the one in the go-kart race.
- **Takeaway:** After moving a folder, search the whole project for its name to find links pointing in, not just the ones inside it.

---

## v0.4: Wheel clipping fix, roster cleanup

### Problem 14: The rear wheel sank into the ground during a wheelie

- **Problem:** When I held Space to wheelie, the front wheel lifted, but the back wheel dropped through the road.
- **Cause:** In 3D, an object spins around a *pivot point*. The bike's pivot was at the centre of the bike, on the ground between the two wheels. Picture a seesaw: when one end goes up, the other end goes down. Lifting the front wheel pushed the rear wheel underground by the same amount.
  - The Canva version had already tried to fix this. Its code said it rotated "around the rear axle". But the two lines that were meant to move the pivot cancelled each other out: one moved the bike back 0.82, and the next moved it forward 0.82. The comment described the fix, but the code didn't do it.
- **Fix:** I put the bike inside an invisible "pivot" object placed exactly on the rear axle. The wheelie now rotates the pivot, not the bike. A real rider pivots on the back tyre, and now the game does too. The rear tyre stays on the road at every angle.
- **Takeaway:** A comment that says what code does isn't proof that it does it. When a fix "doesn't work", check whether it ran at all before trying something new.

### Problem 15: The Nissan 350Z didn't fit the game

- **Problem:** The roster included a car in a wheelie *bike* game.
- **Cause:** The car needed special cases all through the code: no rider, a different body, its own lights.
- **Fix:** I removed the 350Z. The roster is now Street, Trail, Sprint, Sur Ron and Kawasaki Ninja H2, with Street as the default. The rider code no longer needs an "unless it's the car" check.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Cutting a feature that doesn't fit makes everything else simpler.

---

## v0.3: Moved into my portfolio

### Problem 16: The game lived outside my portfolio

- **Problem:** Wheelie Ride was a separate project, but I wanted it with the rest of my work in my portfolio repo, next to the go-kart race and Hearth.
- **Cause:** I first set it up as its own project with its own version history (a git repo). Putting one git repo inside another causes conflicts, because the outer repo can't see the files inside the inner one.
- **Fix:** I moved the folder into the portfolio and deleted the inner, empty history, so the portfolio's history tracks the game's files. The files only reference each other with relative paths (`src/main.js`), so nothing broke in the move.
- **Takeaway:** Relative paths make a project easy to move.

---

## v0.2: Broke out of Canva

### Problem 17: The game only ran inside Canva

- **Problem:** I built the first version in Canva's code editor. When I copied the code out, it depended on Canva's own scripts (`/_sdk/...`). Those files only exist on Canva's servers, so the page would fail anywhere else.
- **Cause:** Canva injects extra code into every page: tracking, editing tools, auto-resizing, and a list of 300+ fonts. My game code was mixed in with all of it.
- **Fix:** I separated my code from Canva's. I deleted the platform scripts and split the game into three clear files:
  - `index.html`: the page layout
  - `src/styles.css`: how it looks
  - `src/main.js`: how it works
- **Takeaway:** Tools that write code for you also add things you didn't ask for. Know which parts of the code are yours.

### Problem 18: The wrong bike button lit up

- **Problem:** The Nissan was the selected vehicle, but the *Street* button was highlighted in lime.
- **Cause:** Canva wrote colours directly onto each button (inline styles). Inline styles beat stylesheet rules, so my "highlight the active button" rule was overruled. The button colours were frozen and ignored what was selected.
- **Fix:** I removed the inline styles and replaced the Tailwind framework with one plain CSS file. Now the `active` class alone decides which button is lit.
- **Takeaway:** When the screen doesn't match the data, look for two rules fighting over the same thing.

### Problem 19: A hidden control nobody knew about

- **Problem:** Holding E slowed the bike down, but the controls hint never mentioned it.
- **Cause:** The feature was added to the code but never to the instructions.
- **Fix:** I added "E to drag" to the on-screen controls hint.
- **Takeaway:** A feature players can't discover is a feature they don't have.

### Problem 20: Bike stats were scattered as unlabelled numbers

- **Problem:** Tuning the game meant hunting for numbers like `1.08` and `4.65` in the middle of the code.
- **Fix:** I gave them names. `LEAN_LIMIT` is the crash angle, `ROAD_HALF_WIDTH` is how far you can steer, and each bike's top speed, turning and lift rate are in one `MODELS` table.
- **Takeaway:** If a number matters, give it a name.

### Problem 21: No way to test the code on my computer

- **Problem:** I wanted to check the code for mistakes, but Node.js (the usual tool for that) isn't installed on my Mac.
- **Fix:** I used the JavaScript engine built into macOS (`osascript -l JavaScript`) to check that the code had no syntax errors.
- **Takeaway:** There's usually another tool that can do the job.

---

## v0.1: Canva prototype

> These entries are reconstructed from clues left in the code. Check each one against what you remember, and edit or delete any that don't match your experience.

### Problem 22: The bike faced backwards

- **Problem:** The bike was built with its front wheel pointing toward the camera, so it rode backwards.
- **Fix:** I turned the whole model 180° (`rotation.y = Math.PI`) so it faces down the road.

### Problem 23: The bike looked like it was floating

- **Problem:** Without anything under the wheels, the bike didn't look grounded.
- **Fix:** I added soft oval "contact shadows" under each tyre.

### Problem 24: Arrow keys and Space scrolled the page

- **Problem:** Pressing the game controls also scrolled the web page.
- **Fix:** The game now blocks the browser's default action for its control keys (`preventDefault`).

### Problem 25: Controls got stuck "on"

- **Problem:** Switching windows while holding a key, or sliding a finger off a touch button, left the bike accelerating forever.
- **Fix:** The game now releases every key when the window loses focus. Touch buttons now release when the finger leaves the button.

### Problem 26: The speed of the game depended on the computer

- **Problem:** Game physics tied to frame rate run faster on fast screens and slower on slow ones.
- **Fix:** The game updates in fixed steps of 0.02 seconds (50 times a second), no matter how fast the screen draws. There's also a cap, so returning to the tab doesn't make the bike jump.

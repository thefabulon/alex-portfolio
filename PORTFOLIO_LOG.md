# Portfolio Log

Every change I've made across my portfolio projects, newest first. I use it to build portfolio slides and to remember why I made each decision.

Bigger changes follow the same pattern as the Wheelie Ride release log:

- **Problem:** what I saw
- **Cause:** what was really going on
- **Fix:** what I changed
- **Takeaway:** what I'd do differently next time

Small changes just get a line.

Some projects also have their own detailed log. Their changes are summarized here too, so this file shows everything in one place.

- Wheelie Ride: [wheelie-ride/RELEASE_LOG.md](wheelie-ride/RELEASE_LOG.md)
- The Lobby: [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md)

---

## 2026-11-08

### Portfolio slides: Music Production

- **Change:** New slide 18, **Music Production**. The deck is now 19 slides, and Encanto moved to 19.
- **What's on it:** my home studio (MIDI keyboard, laptop, music software), two photos of me mixing on my DJ controller, two photos from DJ mixing at the 2026 OPA's Got Talent show, and the show program with my act circled. The other performers' names on the program are blurred.
- **Photo cleanup:** in the studio photo I removed the exercise bike from the wall, plus the sunglasses, the red tray and the loose cables on the desk, and cropped it above the dog. The printer and the stuff on the right side of the desk are still in it for now.
- **Still to do:** check the line "I've created my own mixes" (my notes said "created models").
- **Why I made this call:** _[your reasoning here]_

### Portfolio slides: The Lobby and Alex & Mr. Fishy

- **Change:** My portfolio deck went from 15 to 18 slides.
- **The Lobby (slide 10):** my concept for showing off my work as a retro gaming system. Every project is a game cartridge you plug into the ALEX-2600 console, and Bit, my robot guide, shows you around. The slide has a big screenshot of the 3D lobby and a 3-step "how it works" strip (pick a cartridge → plug it in → step through the portal). Screenshots are from `lobby/v2.html`.
- **Alex & Mr. Fishy (slides 14–15):** my cartoon series as storyboards. Each episode gets a row of numbered panels from the cartoon, a caption under each panel, and a one-line summary of the story. Slide 14 is Episodes 1–2 (Freak Out, Wake Up); slide 15, "The Big Race", is Episodes 3–4 (Race, Stronger), with the "In loving memory of Rocky Bal Beta" card from Episode 3, because Rocky Bal Beta was our real pet betta fish.
- **Still to do:** add my role in the cartoons (what I drew, animated or voiced, and how old I was), check the panel captions, and add a photo of my lobby concept sketch if I find it.
- **Why I made this call:** _[your reasoning here]_

### Portfolio slides: one deck with all my projects

- **Change:** My Hearth slides became the full portfolio, **Alexander Kim Portfolio** (15 slides): `portfolio-slides/Alexander-Kim-Portfolio.pptx` and `.pdf`, built by `portfolio-slides/build_portfolio.py`.
- **New slides:** Go-Kart Build, Go-Kart World, LEGO Virtual Portfolio, Wheelie Ride (v1 and v2, plus what I learned from my release log), Mercedes SL63, Poppin' Matcha Booth, Poppin' Matcha Ads, and The Fort on its own slide. The birdhouse and glider now have their own slide too.
- **Design:** Every slide shares grid paper, a numbered tab, a big poster title, the same What it is / My role / Why I included it labels, handwritten notes, and the same footer. Each project gets its own color from the project itself (Skyline blue, LEGO orange, matcha green...) and its own layout: taped photos for real builds, screen frames for games, a CAD drawing sheet for the Mercedes, a floor plan for the booth.
- **Screenshots:** New shots of Go-Kart World, the brick-built LEGO circuit and both Wheelie Ride versions, taken straight from the games.
- **Fix:** the letters on my go-kart's nose are **GTR**, for the Skyline GT-R, not a team tag. The note on the Go-Kart Build slide now says "GTR = the car name".
- **Google Slides copy:** `Alexander-Kim-Portfolio-GoogleSlides.pptx` (made with `python build_portfolio.py --google`) uses Google's name for the handwriting font, "Nanum Pen Script", so my notes keep their handwriting look in Google Slides.
- **Still to do:** rewrite every description in my own words, and finish the Go-Kart World sentence that starts "I added a...".
- **Why I made this call:** _[your reasoning here]_

## 2026-11-07

### Go-kart: a real racing-game HUD

- **Problem:** The go-kart screen didn't look like a racing game. A big text menu with the drift controls sat in the top-left corner, and the race info was one plain bar. My test copy (`_drifttest.html`) also had green debug text in the bottom-right corner.
- **Cause:** The menu, the race bar and the drift box were simple boxes I'd added one at a time. The green text came from a test script that drove the kart by itself and printed its numbers on the screen.
- **Fix:** I rebuilt the screen based on real racing games (I used two screenshots as reference):
  - **Top left:** a big race position (5TH /5), the lap and a race clock. In free drive it says FREE DRIVE with a Race the Crew button. Drift points and a live track map are under it, with the crew as colored dots and me as a pink arrow.
  - **Top right:** round buttons for pause, camera, night and reset. The camera name pops up when you switch.
  - **Bottom right:** a round speedometer with a needle, segments that light up from teal to pink, and warning lights for the handbrake, drift and gear (D / N / R).
  - **Bottom centre:** a drift combo meter that fills toward the next multiplier, turns teal when the points are banked, and gets crossed out when you hit a wall.
  - **Start lights:** three red lights come on one by one, then they all go green for GO.
  - **Speech bubbles** pop up over a kart when someone overtakes ("Eat my dust!").
  - **Pause menu** (Esc): all the old menu stuff (camera, driver, look, how to drift, controls) is in here now, and the game stops while it's open.
  - **Phones and tablets:** steering arrows on the left, plus a gas pedal, a brake pedal and a pink DRIFT button on the right.
  - Keyboard hints show in the bottom-left for the first 12 seconds, then fade out.
  - The test copy now matches v2 and doesn't have the debug script anymore.
- **Takeaway:** _[your takeaway here]_
- Why I made this call: _[your reasoning here]_

### Gallery Ground Plans: three more versions that actually look hand-drawn

- **Problem:** Even after the ink redraw, the ground plans page still looked computer-made. Every plan sat in a rounded box, the lines were perfect shapes with a wobble filter on top, and my real hand-drawn plans from my notebook weren't on the page at all.
- **Fix:**
  - Three new versions, each drawn with a different tool:
    - **Notebook** ([gallery-ground-plans-notebook.html](gallery-ground-plans-notebook.html)): ballpoint on graph paper, like my real notebook. My two notebook pages are taped in, with the notes I wrote copied out next to them.
    - **Marker wall** ([gallery-ground-plans-marker.html](gallery-ground-plans-marker.html)): Sharpie and white paint pen on brown kraft paper. My notebook pages are taped up with arrows pointing at each room, notes are on sticky notes, and arrows run from the lobby's cartridges to each game. You click an early idea to circle it.
    - **Watercolor map** ([gallery-ground-plans-watercolor.html](gallery-ground-plans-watercolor.html)): my notebook plan of the whole gallery (go-kart room, Rose, Builds, Lobby, Play, Lego RC room, Entrance) painted in watercolor, with my notes pointing into each room. Then each game is painted the same way.
  - No boxes anywhere: drawings sit right on the paper, and photos are taped, pinned or held in with photo corners.
  - The plans are still traced from the game files. A new script, `gallery-versions/hand.js`, redraws every line by hand: lines wobble and run past the corners, walls get gone over twice, and fills become pen shading, paint marker streaks or watercolor washes.
  - My notebook photo (`ground plans/IMG_0786.HEIC`) is turned upright and cropped into its two pages in `gallery-versions/img/`.
  - The original ink tiles page is unchanged.
- **Takeaway:** _[your takeaway here]_
- **Why I made this call:** _[your reasoning here]_

### Gallery Ground Plans: redrawn from my real games, by hand

- **Problem:** The ground plans page showed ten made-up gallery ideas, not the lobby and games I actually built. It also looked computer-made: hard blue lines, orange highlights, white boxes.
- **Fix:**
  - New plans for the Lobby, Go-Kart, Wheelie Sim and Drift Garage come first. Each one is traced from the game's own code: the den's furniture positions, the real go-kart track points with the stands, sign and Skyline, the wheelie road with its trees and camera spots, and the drift garage with its three courses.
  - Everything is redrawn in a wobbly ink style, based on the doodle samples in `lobby/inspiration/`, on soft rounded tiles with a hand-lettered font.
  - Three colour schemes to choose from at the top of the page: Pencil, Moss and Den. Each has a dark version.
  - The ten early concepts are still there, in a fold-out "Where it started" section, with starring.
- **Takeaway:** _[your takeaway here]_
- Why I made this call: _[your reasoning here]_

### Go-kart: you can read the sign from the stands now

- **Problem:** In the Stands camera (the spectator view), I couldn't see the sign across the track that tells how I built the kart.
- **Cause:** Three things were in the way:
  - The Stands camera started out watching the kart, and the **Read the sign** button was inside the menu. On a phone the menu starts folded away, so you'd never find it.
  - When the camera did turn to the sign, it zoomed so the sign filled the whole screen. The menu covered the left third of it, and the **Lobby** and **Meet the crew** buttons covered the top corner.
  - The sign was painted like everything else, so it was lit by the sun. It looked grey in the day and almost black at night.
- **Fix:**
  - The **Stands** camera now **opens on the sign**. The button next to it says **Watch the kart** to follow your kart like a TV camera, and **Read the sign** takes you back.
  - The camera works out which part of the screen the menu, the corner buttons, the race bar and the VR button leave clear, then fits the whole sign into that space. If you open or close the menu, the sign slides over to stay in the clear part.
  - The sign is **lit from inside** like a scoreboard, so it's bright and readable in the day and at night.
  - The VR controls list now tells you the sign is straight across the track from the stands.
  - Done in [gokart/v2.html](gokart/v2.html) and my test copy `gokart/_drifttest.html`. The older cone track ([gokart/index.html](gokart/index.html)) has no stands or sign, so it didn't need it.
  - I checked it with screenshots: a wide screen with the menu open, a phone-sized screen, and at night. The whole sign showed every time, with nothing covering it.
  - **Lobby (v2.11):** Bit tells you to use the Stands camera to read the sign, in both lobbies. Details in [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Something on screen can be "there" and still be impossible to see. When I add something people need to read, I should check it with the menus open, on a phone and at night.

### Wheelie Ride: a motocross helmet

- **Change:** My rider now wears a gloss-black motocross helmet instead of the MTB trail helmet. It has a full face, an eyeport, a long peak and a pointed chin bar with vents.
- **How:** I started with a sphere, cut the eyeport out along its grid lines, and pushed the lower front forward and down to make the chin bar.
- **Bug:** A tiny hole on top of the helmet came from `Math.acos` getting a number just over 1 and returning `NaN`.
- Details are in the Wheelie Ride release log (v0.11).

### Wheelie Ride + Lobby: a new rider, a real Sur-Ron and a real Ninja H2R

- **Problem:** My rider was a stick figure with a ball for a helmet and straight arms and legs. The Sur Ron and the Kawasaki were just the bicycle with a box or two stuck on.
- **Fix:**
  - I rebuilt the rider: jersey, sleeves, knee pads, gloves, shoes, a hydration pack, sunglasses and an **MTB trail helmet** with vents and a lime peak. Arms and legs now have elbows and knees, and the game works out where they go each frame (two-bone IK), so the hands stay on the bars on every bike.
  - The **Sur-Ron** now has its aluminium frame, black battery box, gold upside-down forks, dirt-bike bars, number-plate headlight, high white fenders, red-spring shock and knobby tyres.
  - The **Kawasaki** is now a **Ninja H2R**: mirror chrome, the green trellis frame, a pointed nose with no headlights, carbon winglets, a single-sided swingarm, the supercharger, slicks and 5-split-spoke wheels.
  - The rider sits differently on each bike: upright on the bicycles, attack position on the Sur-Ron, a full tuck on the H2R.
  - **Lobby (v2.10):** the WHEELIE SIM cartridge rider wears the MTB helmet too, and Bit mentions the Sur-Ron, the H2R and the helmet.
  - Full write-up: v0.10 in [wheelie-ride/RELEASE_LOG.md](wheelie-ride/RELEASE_LOG.md).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** To make a model look like the real thing, pick the few details people recognise it by and get those right.

### Go-kart: the crew drive laps when you're not racing

- **Problem:** Outside a race, the other four characters just sat on the starting grid. Free drive felt empty, with only me on the track.
- **Cause:** The rival drivers only got steering and gas during a race. The rest of the time they got "no input", so they never moved. Once a rival finished a race, they stopped dead on the track too.
- **Fix:**
  - Out of a race, the crew now **cruise laps on their own**, each at their own easy pace (about 60 to 80% of their race speed), so they spread out around the track and I always have someone to chase.
  - If someone is slow or parked in their lane (like me, stopped to look at the Skyline), they swing out and go round, and they ease off if they're right behind.
  - After they cross the finish line in a race, they keep cruising instead of stopping.
  - In a race, nothing changes: they still race at full speed with the same catch-up rules.
  - Pressing <kbd>R</kbd> in free drive now puts only me back at the start. Before, it reset everybody, which would have yanked the crew off the track mid-lap.
  - Done in all three go-kart files: [gokart/v2.html](gokart/v2.html), the older cone-track [gokart/index.html](gokart/index.html) and my test copy `gokart/_drifttest.html`. The "How the race works" menu says so.
  - I tested it by running the game with no one at the wheel. In 40 seconds the crew kept lapping with no stalls, and in a race they finished and kept cruising.
  - **Lobby (v2.9):** the GO-KART TV screen now shows the other four karts cruising behind Jimbob, and Bit tells you about it. Both lobbies. Details in [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Characters that only move when something is "on" make the rest of the game feel empty. Giving them an easy-going default (here, cruising) is a small change that makes the world feel alive.

### Wheelie Ride: 1st and 3rd person camera views

- **Problem:** Wheelie Ride only had one camera, off to the side. My go-kart game lets you switch views, and I wanted the same here.
- **Fix:**
  - Three views, picked with a new **CAMERA** switch in the corner of the game or the <kbd>C</kbd> key (same key as the go-kart): **3rd person** behind the bike (the new default), **1st person** from inside the helmet, and the original **Side cam**.
  - In 1st person you see your hands on the bars and the front wheel rising in front of you. The rider's body is hidden so the camera isn't inside your head. Drag to look around.
  - Two things I had to fix along the way: at first the bars were off the bottom of the screen (the rider is tall, so I worked out the angle and tilted the head down), and in a hand drag the front wheel blocked the view (I turned the head toward the road instead).
  - Crashes in 1st person cut to the 3rd-person crash camera. The game remembers your last view.
  - **Layout:** I moved the camera switch onto the game screen (top-right, or under the speed boxes on a phone) so you don't have to scroll away to use it. I also slimmed the lean meter on phones so it doesn't cover the handlebars in 1st person.
  - **Lobby (v2.8):** Bit tells you about the camera views when you pick up WHEELIE SIM.
  - Details: Wheelie Ride v0.9 in [wheelie-ride/RELEASE_LOG.md](wheelie-ride/RELEASE_LOG.md) and Lobby v2.8 in [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** When one of my games already does something well, I can copy its pattern (here, the go-kart's view buttons and C key) so my games feel like they belong together.

### Wheelie Ride + Lobby: crash physics

- **Problem:** When you looped a wheelie, the game just froze and showed "Ride over". The bike never fell.
- **Fix:**
  - When you crash, the bike and the rider each become a physics object with mass, speed and spin. Gravity pulls them down, every point that hits the road bounces and rubs with friction, and they tumble and slide until they stop.
  - Tyres roll (low grip), metal scrapes (more grip, with sparks), and the rider's riding gear grips most. Grass grabs harder than the road. Each bike has its own weight now.
  - The rider's arms and legs fling out, hard hits shake the camera, and the crash card shows how far you slid.
  - In the lobby (`v2.html`), Bit now warns that crossing the red line flips the bike and sends you tumbling.
- **Hardest part:** The camera aimed between the bike and the rider, but at Ninja speeds they ended up 160 m apart. Now it follows the rider and only keeps the bike in shot while it's close. I also had to trick my test browser into running the game so I could screenshot the crash step by step. Full story in [wheelie-ride/RELEASE_LOG.md](wheelie-ride/RELEASE_LOG.md) (v0.8) and [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md) (v2.7).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Physics is a few simple rules repeated many times a second. Test the fastest bike, not just the default one.

### Go-kart v2: drifting is easier

- **Problem:** Drifting in [gokart/v2.html](gokart/v2.html) was hard to keep going. Even holding Space and the gas, a drift died after about 4 seconds. Bumping a wall ended it, and you had to slide at a big angle before you got any points. It also wasn't clear how to *stop* drifting.
- **Cause:**
  - Holding the handbrake slowed the kart down a lot (on top of the slowdown from sliding), so the kart lost speed until the drift cut out.
  - Even a light touch on the wall counted as a crash.
  - Ending a drift depended on letting go of the gas or steering hard the other way, not on the handbrake you used to start it.
- **Fix:**
  - **Hold Space to drift, let go to straighten up.** While you hold Space, the slide holds. Let go and the kart snaps straight and grips again in about a third of a second.
  - The slide eats less speed. In a test I ran, a held drift used to slow down until it ended at 3.7 seconds. Now it settles at a steady speed and keeps going as long as you hold Space.
  - You can start a drift at a lower speed and with less steering.
  - Brushing a wall no longer ends the drift or loses your combo. Only a hard hit does.
  - Points start at a smaller slide angle. The ×5 multiplier climbs every 1.5 seconds instead of 2. The gap you're allowed between two linked drifts went from 0.9 to 1.5 seconds.
  - I rewrote "How to drift" and the VR controls in the menu to match. (In VR, you click and hold a thumbstick.)
  - Same changes in my older test copy, `gokart/_drifttest.html`.
  - **Lobby (v2.6):** when you pick up GO-KART, Bit now explains the new controls. Both lobbies. Details in [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** If a move is hard to do, check what's working against the player. Here, the handbrake you needed for the drift was also what slowed it down and ended it.

### Wheelie Ride: a Back to lobby button

- I swapped the small "← Lobby" text link in [wheelie-ride/index.html](wheelie-ride/index.html) for a proper **← Back to lobby** button, and added a second one on the crash screen next to **Ride again**.
- In the lobby, Bit now mentions the button when you pick up the WHEELIE SIM cartridge.
- Details: Wheelie Ride v0.7 and Lobby v2.5.

### Go-kart v2: the menu folds away

- **Problem:** The menu in [gokart/v2.html](gokart/v2.html), with the title, controls, buttons and how-to sections, took up a big part of the screen while I was driving. On a phone it covered almost half the screen.
- **Fix:**
  - The menu now has a **Hide** button in its top corner. Click it (or press <kbd>H</kbd>) and the menu folds down to a small bar with just the title, your speed and a **+ Menu** button to open it again.
  - I moved the speed readout up into that bar, so you can still see it with the menu folded.
  - The game remembers whether you left the menu open or folded. On a phone it starts folded.
  - On phones I also moved the menu up a little, because the folded bar was covering the "Enter VR" button at the bottom of the screen.
  - In the lobby, Bit now tells you about the H key when you pick up GO-KART ([lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md), v2.4).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** Instructions only need to be on screen until you learn them. After that they should get out of the way of the game.

### Wheelie Ride + Lobby: deeper wheelies and hand drags

- **Problem:** In Wheelie Ride, you crashed at 62°, so you could never pull the bike back far enough to do a hand drag.
- **Fix:**
  - The crash angle is now about 85°. Past 66°, the rider slides off the side of the seat and drags a glove on the road, with sparks.
  - While the hand is down, it works like a kickstand, so you can hold the drag.
  - New HUD: a hand-drag distance counter, a "HAND DRAG!" sign and an orange zone on the lean meter.
  - In the lobby (`v2.html`), the WHEELIE SIM title screen and cartridge label now show the hand drag, and Bit explains it. I also fixed Bit's line that still offered the Nissan 350Z, which I'd already cut from the game.
- **Hardest part:** My first pose hung the rider upside down. I had tipped the body backward with the bike, and I'd bent it sideways around an axis that was pointing almost straight up. Full story in [wheelie-ride/RELEASE_LOG.md](wheelie-ride/RELEASE_LOG.md) (v0.6) and [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md) (v2.3).
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** When a 3D pose looks wrong, measure it before changing numbers.

### Go-kart v2: Brian's Skyline in the middle of the track

- Put a full-size model of Brian's Nissan Skyline GT-R, the car my kart is based on, in the middle of the infield of the drift track ([gokart/v2.html](gokart/v2.html)). It has silver paint, blue graphics down the sides, round taillights, a rear wing and blue underglow, and it turns slowly on a stand with a blue light ring.
- The stand is 0.7 m tall so you can see the car over the walls while you drive. At night the underglow, headlights and taillights get brighter.
- The game finds the spot in the infield with the most room by itself, so the car stays in the middle if I change the shape of the track.
- Now you can compare the kart with the real car it came from in the same scene.
- The game's description and its "About the kart" panel now mention the car and say to try night mode to see the underglow.
- **Lobby (v2.4):** the GO-KART title screen and cartridge label now show a small Skyline on its stand behind the kart, and Bit tells you it's in the middle of the track. This is in both lobbies. Details in [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md).
- Why I made this call: _[your reasoning here]_

### Lobby: its own release log

- Started [lobby/RELEASE_LOG.md](lobby/RELEASE_LOG.md), with every lobby change from v1.0 to v2.2.
- Updated the lobby README. It still said WHEELIE SIM was outside the portfolio folder and didn't say which go-kart version the cartridge opens.

### Lobby: GO-KART now plays only the drift version

- **Problem:** The GO-KART cartridge in the lobby still opened the first version of my go-kart game. The newer drift version, with a handbrake and a walled drift track, could only be reached from a small link inside v1. The v2 game also had a "← Go-kart v1" button that sent players back to the old version.
- **Cause:** The lobby was built before v2 existed, so the cartridge's link pointed at `gokart/index.html`. When I made v2, I linked v1 and v2 to each other but never updated the lobby.
- **Fix:**
  - The cartridge in both lobbies (`lobby/index.html` and `lobby/v2.html`) now opens `gokart/v2.html`.
  - Bit, the robot guide, now talks about the handbrake and drifting for points, not racing around cones.
  - In the v2 game, I swapped the "← Go-kart v1" button for "← Lobby", so players go back to the lobby, not the old version.
  - v1 is still in the folder, but nothing in the lobby or in v2 links to it.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** When I make a new version, I have to update every page that links to the old one, not just the page itself.

### Lobby v2: two new cartridges

- Made `lobby/v2.html`, a new version of the lobby with three cartridges: GO-KART, WHEELIE SIM and DRIFTING GAME. I left the first lobby as it was.
- Added `fitTitle()` so long game names shrink to fit the cartridge label and the TV.
- Updated Bit's intro line to name all three games.

### Wheelie Ride: out of Canva and into my portfolio

Wheelie Ride got releases v0.2 to v0.5 today. The full details are in [wheelie-ride/RELEASE_LOG.md](wheelie-ride/RELEASE_LOG.md). In short:

- **v0.2:** Took the game out of Canva. I removed Canva's scripts and split my code into three files (page, styles, game logic).
- **v0.3:** Moved the game into this portfolio folder.
- **v0.4:** Fixed the rear wheel sinking into the road during a wheelie, and removed the Nissan 350Z from the vehicles.
- **v0.5:** Fixed the lobby link that opened a missing page, and added a "← Lobby" link in the game.

---

## 2026-11-02

### The Lobby

- Built `lobby/index.html`, a 70s-style game room that holds all my projects. Each project is a game cartridge. You take one from the rack and plug it into the wood-grain ALEX-2600 console, and a portal opens to that project.
- Bit, a little hovering robot, welcomes visitors and explains each cartridge.
- It works in a browser and in a VR headset.
- The first cartridge was GO-KART.

---

> The entries below were reconstructed from file dates and project notes. Check each one against what you remember, and edit or delete anything that doesn't match.

## 2026-10-25

### My crew as 3D characters

- Turned my five pen-drawn characters (Jimbob, Srank, Jimmy, Ember and Bernie) into 3D models in `characters/crew.js`.
- Built the Character Lab (`characters/index.html`) to try them in different looks: Toon, Galaxy, Pirate and Carlo, one for each style I used as a reference.
- The same characters drive the go-kart and can be the keeper in Hearth.

### Go-kart race and the drift version

- The go-kart game (`gokart/index.html`) lets you pick one of my characters to drive my plywood kart and race the rest of the crew.
- Started v2 (`gokart/v2.html`), which adds a handbrake for drifting, a walled drift track, sponsor stickers and drift points.

### The Woven Room (Exhibit 3)

- Built a VR gallery room for Exhibit 3. Gunta Stölzl's 1927/28 Bauhaus tapestry hangs in folds like El Anatsui's metal work, which I saw at The Broad. There are also high-shine sculptures inspired by The Broad.
- Linked it from the Exhibit 3 card in my gallery ground plans.

### Hearth portfolio slides

- Made a slide deck for Hearth (`portfolio-slides/`), with notes for each slide.
- Added a Hearth showcase page with phone and laptop mockups, and let my characters be the keeper.

---

## 2026-10-17

### Portfolio set up

- Put my projects together in one folder with its own version history, with a portfolio home page (`index.html`).
- **Gallery ground plans:** my concept plates for the OCSA Production & Design gallery. Plate 7, "My Street", is the one I'm developing.
- **Grand Prix Circuit:** a drivable 3D model of one gallery plan, in three looks to compare.
- **Hearth:** my daily-ritual app, first made in Canva. Canva's export was cut off, so the shop, the saving and the Brain Break game had to be rebuilt.
- **My Street in 3D:** a 3D point-cloud model of my street, made from a 30-second 360° longboard ride, with fly-throughs.

# The Lobby: Release Log

Every change I've made to the lobby, what caused each problem, and how I fixed it.
Newest release first.

Bigger changes follow this pattern:

- **Problem:** what I saw
- **Cause:** what was really going on
- **Fix:** what I changed
- **Takeaway:** what I'd do differently next time

The changes for all my projects are summarized in [../PORTFOLIO_LOG.md](../PORTFOLIO_LOG.md).

---

## v2.13 (2026-11-08): The lobby is the front door of my website

- **Problem:** When I put my portfolio on Hostinger from GitHub, the website needed to open on the lobby, but the lobby was hidden in `lobby/`. Lots of links were also broken: the projects' "← Lobby" buttons pointed to `lobby/v2.html`, which I'd renamed, the "← Ground plans" buttons pointed to the gallery after I'd moved it into `gallery-versions/`, and the DRIFTING GAME cartridge pointed to a folder outside my repo.
- **Cause:** A website opens the `index.html` at the very top of the project. Links between pages are written as paths from each page's own folder, so moving a page breaks every link to it and from it.
- **Fix:** The lobby moved to the top as `index.html`, so the site opens straight into it, and its cartridge paths were updated. Every "← Lobby" button now goes to `../index.html`, and every "← Ground plans" button goes to `gallery-versions/gallery-ground-plans.html`. The gallery pages' own paths were fixed for their new folder. The drifting game was copied into the repo as `drift-garage/` so its cartridge works online.
- **Takeaway:** Before moving or renaming a page, search for every link to it. A link checker that tests every path finds the ones I'd miss.

## v2.12 (2026-11-07): Bit talks about the new racing HUD

- The go-kart game has a new racing-game screen: position, lap and a track map in the corner, a speedometer, start lights and a pause menu (see the go-kart entry in [../PORTFOLIO_LOG.md](../PORTFOLIO_LOG.md)). The old menu with its Hide button is gone.
- **Bit:** Bit's old tip about pressing H to fold the menu away is replaced with: "It looks like a real racing game now: your place, lap and a track map in the corner, a speedometer, and start lights. Press Esc for the pause menu."
- Changed in both lobbies (`index.html` and `v2.html`).

---

## v2.11 (2026-11-07): Bit points you to the sign in the stands

- In the go-kart game, you couldn't see the sign about how I built the kart from the Stands camera. Now the Stands camera opens on the sign, it's lit up so you can read it day or night, and the menu and buttons never cover it (see the go-kart entry in [../PORTFOLIO_LOG.md](../PORTFOLIO_LOG.md)). The cartridge opens `../gokart/v2.html`, so the lobby gets the fix straight away.
- **Bit:** when you pick up GO-KART, Bit now says: "Switch to the Stands camera to read the big sign across the track. It tells the story of how Alexander built the kart, and it's lit up so you can read it at night too." The quick-play blurb mentions the sign too.
- Changed in both lobbies (`index.html` and `v2.html`).

---

## v2.10 (2026-11-07): WHEELIE SIM's new rider and bikes

- Wheelie Ride has a new rider in an MTB helmet, a real-looking Sur-Ron and a real-looking Kawasaki Ninja H2R (see v0.10 in [../wheelie-ride/RELEASE_LOG.md](../wheelie-ride/RELEASE_LOG.md)). The cartridge opens the game itself, so the new models show up from the lobby straight away.
- **Cartridge art and TV screen:** the rider now wears an MTB helmet too. It's a dark dome with a lime peak over the brow, with a face and sunglasses underneath, drawn by a new `mtbHelmet()` function. Both the riding pose and the hand-drag pose use it.
- **Bit:** when you pick up WHEELIE SIM, Bit now says: "Pick your ride: a street bike, a trail bike, a sprint bike, a Sur Ron electric dirt bike or a Kawasaki Ninja H2R hyperbike. Your rider wears an MTB helmet!"
- Changed in `v2.html` only. `index.html` (v1) has no WHEELIE SIM cartridge.

---

## v2.9 (2026-11-07): The crew cruise on the GO-KART TV

- In the go-kart game, the other four characters now drive laps on their own when you're not racing (see the go-kart entry in [../PORTFOLIO_LOG.md](../PORTFOLIO_LOG.md)).
- **Title screen (on the TV):** four smaller karts cruise across the road behind Jimbob, in Jimmy's, Srank's, Bernie's and Ember's colors, each at their own speed, so some pass you and some get passed. `drawKart()` takes an optional crew color for this: a plain round driver in that color with a matching stripe, like the rival karts in the game. The colors and speeds are in `CREW_KARTS`.
- **Bit:** when you pick up GO-KART, Bit now says: "When you're not racing, the rest of the crew don't just sit on the grid. They drive laps around the track on their own, each at their own speed, so you always have someone to chase." The quick-play blurb mentions it too.
- Changed in both lobbies (`index.html` and `v2.html`).

---

## v2.8 (2026-11-07): Bit explains WHEELIE SIM's camera views

- Wheelie Ride now has camera views like the go-kart: 3rd person, 1st person (from inside the helmet) and the side cam. <kbd>C</kbd> switches between them (see v0.9 in [../wheelie-ride/RELEASE_LOG.md](../wheelie-ride/RELEASE_LOG.md)).
- **Bit:** when you pick up WHEELIE SIM, Bit now says: "Just like GO-KART, you can switch cameras: 3rd person behind the bike, 1st person from inside your helmet, or the side cam. Press C or use the CAMERA switch in the corner of the game." Bit's "welcome back" line and the quick-play blurb mention pressing C too.
- Changed in `v2.html` only. `index.html` (v1) has no WHEELIE SIM cartridge. The lobby README's WHEELIE SIM line mentions the views.

---

## v2.7 (2026-11-07): WHEELIE SIM crashes for real

- Wheelie Ride now has crash physics: loop it and the bike flips over backward while the rider tumbles and slides down the road (see v0.8 in [../wheelie-ride/RELEASE_LOG.md](../wheelie-ride/RELEASE_LOG.md)).
- **Bit:** when you pick up WHEELIE SIM, Bit now says that crossing the red line flips the bike and sends you tumbling down the road. Bit's "welcome back" line for the cartridge and the blurb mention it too.
- Changed in `v2.html` only. `index.html` (v1) has no WHEELIE SIM cartridge.

---

## v2.6 (2026-11-07): Bit explains the easier drifting

- The go-kart game's drifting is easier now. You hold Space to slide and let go to straighten up (see the go-kart entry in [../PORTFOLIO_LOG.md](../PORTFOLIO_LOG.md)).
- **Bit:** when you pick up GO-KART, Bit now says: "Drifting is easier now: hold Space and steer to slide, keep holding it to keep sliding, and let go to straighten up."
- Changed in both lobbies (`index.html` and `v2.html`).

---

## v2.5 (2026-11-07): Bit tells you how to get back from WHEELIE SIM

- Wheelie Ride now has a **Back to lobby** button at the top of the game and on its crash screen (see v0.7 in [../wheelie-ride/RELEASE_LOG.md](../wheelie-ride/RELEASE_LOG.md)).
- **Bit:** when you pick up WHEELIE SIM, Bit now tells you to hit that button when you're done riding. When you come back, Bit says "Welcome back!"
- Changed in `v2.html` only. `index.html` (v1) has no WHEELIE SIM cartridge.

---

## v2.4 (2026-11-07): Bit explains the go-kart's new folding menu

- The go-kart game's menu can now fold down to a small title bar, so it doesn't cover the track (see the go-kart entry in [../PORTFOLIO_LOG.md](../PORTFOLIO_LOG.md)).
- **Bit:** when you pick up GO-KART, Bit now tells you to press H or the Hide button to fold the menu away.
- Changed in both lobbies (`index.html` and `v2.html`). The cartridge still opens `../gokart/v2.html`, so the lobby picks up the new menu with nothing else to change.

---

## v2.4 (2026-11-07): Brian's Skyline joins the GO-KART cartridge

- The go-kart game now has Brian's Nissan Skyline GT-R, the car my kart is based on, on a turning stand in the middle of the track. The cartridge now shows it too.
- **Title screen (on the TV):** a small side view of the Skyline sits on its stand in front of the sunset, behind the kart. It's silver with blue graphics, round taillights, a wing and a blue glow underneath.
- **Cartridge label:** the same car, at the right edge of the picture.
- **Bit:** now says the car that inspired the kart is in the middle of the track. The blurb mentions it too.
- These changes are in both `index.html` and `v2.html`, because both lobbies have the GO-KART cartridge.

### Problem: the kart hid the car on the label

- **Problem:** On the cartridge label, the kart is drawn much bigger than on the TV, and it covered most of the Skyline.
- **Fix:** I moved the car to the right edge of the label and up onto the horizon, and made it a little smaller.
- **Takeaway:** The label and the TV use the same drawings at different sizes, so I have to check both.

---

## v2.3 (2026-11-07): WHEELIE SIM pulls hand drags

- Updated the WHEELIE SIM cartridge to match the game's new deeper wheelie and hand drag.
- **Title screen (on the TV):** the rider now loops through a 7-second routine: pull up, hold a hand drag with sparks flying off the glove, set the front wheel down, ride. "HAND DRAG!" flashes in orange where "STEP INTO THE PORTAL" usually blinks.
- **Cartridge label:** the art now shows the hand drag, not a small wheelie.
- **Bit:** now explains the hand drag and the orange zone on the lean meter.
- These changes are in `v2.html` only. `index.html` (v1) has no WHEELIE SIM cartridge.

### Problem 1: Bit still offered a car that wasn't in the game

- **Problem:** Bit's WHEELIE SIM speech said you could ride "a Nissan 350Z", but I removed the 350Z from Wheelie Ride in v0.4. It also left out the Sprint bike.
- **Cause:** When I cut the car from the game, I didn't check what the lobby said about it.
- **Fix:** Bit now lists the real roster: street, trail, sprint, Sur Ron and Kawasaki Ninja H2.
- **Takeaway:** The same lesson as v2.2: when a game changes, check every place that describes it.

### Problem 2: The hand-drag rider's arms blurred into one line

- **Problem:** In the first version of the drawing, the arm on the bar and the arm on the road lined up into one long white stroke from the road to the handlebar.
- **Fix:** I bent the reaching arm's elbow out, so the two arms read separately.
- **Takeaway:** Small pixel art needs clear shapes. Test it at the size people will see it.

---

## v2.2 (2026-11-07): GO-KART plays only the drift version

### Problem 3: The GO-KART cartridge opened the old game

- **Problem:** Plugging in GO-KART opened the first version of my go-kart game. The newer drift version, with a handbrake and a walled drift track, could only be reached from a small link inside v1. The v2 game also had a "← Go-kart v1" button that sent players back to the old version.
- **Cause:** I built the lobby before v2 existed, so the cartridge's link pointed at `../gokart/index.html`. When I made v2, I linked v1 and v2 to each other but never updated the lobby.
- **Fix:**
  - The cartridge in both lobbies (`index.html` and `v2.html`) now opens `../gokart/v2.html`.
  - Bit now talks about the handbrake and drifting for points, not racing around cones.
  - In the v2 game, I swapped the "← Go-kart v1" button for "← Lobby", so players go back to the lobby, not the old version.
  - v1 is still in the gokart folder, but nothing in the lobby or in v2 links to it.
- **Why I made this call:** _[your reasoning here]_
- **Takeaway:** When I make a new version, I have to update every page that links to the old one, not just the page itself.

---

## v2.1 (2026-11-07): Fixed the WHEELIE SIM link

### Problem 4: The WHEELIE SIM cartridge opened a missing page

- **Problem:** Plugging in WHEELIE SIM led to a "file not found" page, not the game.
- **Cause:** The link was `../../wheelie-ride/index.html`. That was right when the game sat next to my portfolio folder. After I moved the game inside the portfolio, the link went up one folder too many.
- **Fix:** I changed the link to `../wheelie-ride/index.html`. The game also got a "← Lobby" link back to `v2.html`.
- **Takeaway:** After moving a folder, search the whole project for its name to find links pointing in.

---

## v2.0 (2026-11-07): Three cartridges

- Made `v2.html` as a new version of the lobby and left `index.html` as it was, so I can compare them.
- Added two cartridges: **WHEELIE SIM** and **DRIFTING GAME** (`../../drift-garage/index.html`, outside the portfolio folder, so it only works on my computer).
- Updated Bit's intro line to name all three games.

### Problem 5: Long game names didn't fit on the label

- **Problem:** "WHEELIE SIM" and "DRIFTING GAME" are longer than "GO-KART", so they could run off the cartridge label and the TV screen.
- **Fix:** I added `fitTitle()`, which shrinks the text until it fits the space.
- **Takeaway:** Design for the longest name, not the first one.

### Problem 6: The DRIFTING GAME portal led nowhere at first

- **Problem:** When I added the cartridge, the drift-garage folder only held two library files and no game page, so the portal was a dead link.
- **Fix:** I added the cartridge anyway, and the game's `index.html` arrived later.
- **Takeaway:** _[your takeaway here]_

---

## v1.0 (2026-11-02): The first lobby

- Built `index.html`, a 70s-style game room that holds all my projects. Each project is a game cartridge. You take one from the rack and plug it into the wood-grain ALEX-2600 console, and a portal opens to that project.
- Bit, a little hovering robot, welcomes visitors and explains each cartridge.
- The rack has 6 slots. Empty ones show a "Coming soon" cartridge.
- It works in a browser and in a VR headset. In the Meta Quest browser, you can stay in VR when you go through the portal.
- The first and only cartridge was GO-KART.

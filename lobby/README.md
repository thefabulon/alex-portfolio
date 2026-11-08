# The Lobby

A retro game room that holds all of Alexander's projects. Each project is a game cartridge. Take one from the rack, plug it into the wood-grain ALEX-2600 console, and a portal opens to that project. Bit, a little hovering robot, welcomes you and explains each cartridge.

The lobby is the website's front page: it lives at the top of the repo as [`../index.html`](../index.html), so the site opens straight into it. This folder keeps its notes, release log and inspiration screenshots. Open `index.html` directly or from a server. It works in a browser and in a VR headset (Enter VR).

It has two cartridges: GO-KART and WHEELIE SIM. (The old one-cartridge first version was replaced by this one. A DRIFTING GAME cartridge was removed on 2026-11-08.)

- **GO-KART** opens the drift version of the go-kart game, `gokart/v2.html`. The first version (`gokart/index.html`) isn't linked from the lobby. Brian's Skyline, the car the kart is based on, sits on a stand in the middle of that track, so the GO-KART title screen and cartridge label show it behind the kart (`drawSkyline()`), and Bit mentions it. The rest of the crew drive laps on their own when you're not racing, so the TV shows four smaller karts (`CREW_KARTS`) cruising behind yours. Bit also tells you to use the Stands camera to read the sign about how the kart was built.
- **WHEELIE SIM** opens version 2, `wheelie-ride/v2.html`: real Orange County roads, jumps and a pause menu with a Lobby button. Version 1 (`wheelie-ride/index.html`) isn't linked from the lobby. Like GO-KART, it has camera views (3rd person, 1st person, side cam; C switches), and Bit mentions them. The rider on the cartridge and TV wears an MTB helmet with a lime peak (`mtbHelmet()`), like the rider in the game, and Bit mentions the Sur-Ron, the Ninja H2R and the helmet.

Every change to the lobby is written up in [RELEASE_LOG.md](RELEASE_LOG.md).

## Controls

- **Browser:** drag to look around. Walk with WASD or the arrow keys, or click the floor. Click a cartridge to pick it up, then click the console to plug it in. Click the plugged-in cartridge to eject it. Click the portal, walk into it, or press the joystick's red button to go in. `Esc` puts a cartridge back. The "Play" buttons in the panel do the whole thing in one click.
- **Headset:** the trigger or grip grabs a cartridge (point at it or reach for it). Let go over the console to plug it in. The left stick walks, the right stick snap-turns, and pointing at the floor and pulling the trigger jumps you there. Walk into the portal or point at it and pull the trigger.

On the Meta Quest browser, going through the portal can keep you in VR on the next page, because three.js's VR button accepts the handed-over session.

## Adding a cartridge

Add an entry to `PROJECTS` near the top of the script in `../index.html`:

- `title`, `tag`, `href`: the label text and the page the portal opens (paths are from the top of the repo, like `gokart/v2.html`)
- `stripes`, `portal`, `glow`: label stripe colors, the portal swirl colors and the light color
- `pickup`, `again`, `blurb`: what Bit says when you pick it up the first time, later times, and when you use the quick-play button
- `art(ctx, x, y, w, h)`: draws the picture on the label (canvas 2D)
- `screen(ctx, w, h, t)`: draws the TV title screen while it's plugged in (`t` is seconds)

The rack has 6 slots (`RACK_SLOTS`). Slots without a project show a "Coming soon" cartridge. When you add a cartridge, update the line where Bit lists the games ("There are two games so far…" in `../index.html`). Then add an entry to [RELEASE_LOG.md](RELEASE_LOG.md).

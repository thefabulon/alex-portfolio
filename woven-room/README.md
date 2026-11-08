# The Woven Room

Exhibit 3, VR & Virtual. The door frame in the ground plans finally leads somewhere: a white gallery room you can walk through in a headset or a browser. Open `index.html` (it works straight from the file, no server needed).

## The story: solid, but it moves

At The Broad in Los Angeles I stopped at a huge wall piece by El Anatsui, the Ghanaian artist. From across the room it looked like cloth, folded and rippling down the wall. Up close it's metal: flattened bottle caps and aluminum liquor-bottle labels, joined with copper wire. It's completely rigid, but it drapes like fabric.

What got me was how 3D it looked on the wall. It was solid, but it looked fluid. I wanted to bring that into VR, where you can walk right up to it and watch the light move across the folds.

For the pattern I used Gunta Stölzl's *Slit Tapestry Red-Green* (1927/28). She was part of the Bauhaus textile workshop. In the room it's blown up to fill the wall and hung in folds the way El Anatsui hangs his metal. The **Metal** switch turns her thread into something like his bottle caps.

The sculptures come from The Broad too: the high-shine, balloon-like pieces such as Jeff Koons's *Tulips*, which reflect everything around them. Mine are four shapes pulled off the tapestry, in that mirror finish so they reflect the weaving back at you:

| Sculpture | Where it comes from in the tapestry |
| --- | --- |
| Wave | The nested wavy bands near the top |
| Arch | The striped rainbow on the right edge |
| Windows | The red and pink columns with little white squares |
| Diamonds | The harlequin diamonds on the left edge |

## Process

1. **See.** El Anatsui at The Broad: metal that looks like cloth.
2. **Ask.** How do I make something solid feel fluid in VR?
3. **Source.** Photograph Stölzl's tapestry from a book (`inspiration/tapestry.HEIC`), then flatten it square-on so it can hang as a texture. Room and sculpture finish from `inspiration/Broad.png`.
4. **Build.** Hang it at wall size, fold it like El Anatsui's work, add a metal mode, and pull its shapes out as shiny sculptures.
5. **Test.** Walk up to it in the headset. Does it still look like it's moving?

## In the room

| Switch | What it does |
| --- | --- |
| Thread / Metal | Wool, or small tilted metal plates joined by copper wire that catch the light as you move |
| Flat / Folded | The flat book photo, or hung in deep folds |
| Still / Breathing | The folds hold still, or slowly drift |

Desktop: W A S D or arrow keys to walk, drag to look, M / F / B for the switches. The Door, Weave, Shine and Story buttons glide you to a spot.
Headset: left stick walks, right stick turns in steps. A switches thread/metal, B flat/folded, X still/breathing, Y takes you back to the door.

## Files

- `index.html`: the room (three.js + WebXR, same setup as the go-kart).
- `tapestry.js`: the flattened tapestry, inlined as an image so the page needs no server.
- `tools/flatten.py`: makes `tapestry.js` from the photo. Run from the repo root on a Mac with Pillow and numpy installed:
  `python3 woven-room/tools/flatten.py inspiration/tapestry.HEIC woven-room/tapestry.js`

Tapestry: Gunta Stölzl, *Slit Tapestry Red-Green*, 1927/28, from a book photo. Used here for a student portfolio.

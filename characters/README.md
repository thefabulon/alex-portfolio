# Alex's Crew

Five characters Alex drew in pen (`Characters.png`, cropped into `sketches/`), built as 3D models that work in the go-kart world and the Hearth app.

| Character | What it is |
| --- | --- |
| Jimbob | Big ball of slime with curly drips, one eye high and one low |
| Srank | Squishy star with an ω mouth, a cheek swirl and a heart |
| Jimmy | Loaf-shaped cat with a cat mouth and tongue |
| Ember | Drop of fire with two big black eyes |
| Bernie | Stegosaurus in a bowler hat (almost named Sprout) |

Each one comes in three looks, mixing the references in `styles/`:

| Look | id | What it does |
| --- | --- | --- |
| Toon | `toon` | Flat bright color, big round eyes, blush and a thick ink outline |
| Galaxy | `galaxy` | Glossy, glowing edges and sparkles |
| Painted | `carlo` | Googly mismatched eyes, screaming mouths, fuzz, painted hatching, wobbly line, animation on twos like cut-out rigs |

Links and saved Hearth keepers that still ask for the old `pirate` look get Toon instead.

## Where they show up

- `index.html`: the Character Lab. Turn each character next to Alex's sketch, switch looks, try the Hearth hats, see all 15 at once, download a `.glb`.
  Links: `index.html?c=ember&look=carlo`, `&hat=crown`, `&view=all`.
- `../gokart/index.html`: pick a driver and look, then race the other four in their own karts. `?driver=bernie&look=galaxy`, add `&race=1` to start a race straight away. Link to `index.html` itself, not the folder: opened from disk, a folder link shows a file listing instead of the page.
- `../hearth/`: pick a character as your keeper instead of the spark. It wears your Hearth hat and grows into its final form with your streak.

## Using them in code

`crew.js` is a plain script (not a module), so pages still work when opened straight from disk. It needs three.js r160.

```html
<script src="../characters/crew.js"></script>
<script type="module">
  import * as THREE from "three";
  import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
  import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

  const Crew = makeCrew(THREE, { DecalGeometry, mergeVertices });
  const ember = Crew.build("ember", "galaxy", { hat: "crown" });  // pose: "drive" adds arms
  scene.add(ember);
  // every frame:
  ember.userData.tick(dt, time, { speed, steer, hands: [leftWorld, rightWorld] });
</script>
```

Characters are about 1 unit tall, stand on y = 0 and face +Z. `Crew.CHARACTERS`, `Crew.LOOKS` and `Crew.PALETTE` list what's available; `Crew.exportable(group)` strips the outline and glow shells before a `.glb` export.

Faces are drawn on canvases and stuck on with decals, so the models need no image files.

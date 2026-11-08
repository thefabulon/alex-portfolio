# Hearth themes

Four calm color themes for Hearth, each one you can switch to in the app. Hearth is about mental health and gentle daily habits, so every theme aims to lower stimulation, not raise it. That means muted, desaturated colors, soft contrast between surfaces, and no pure black or pure white. Body text still stays easy to read.

Each theme also comes from a place or memory that feels calm to Alex, who designed Hearth.

| Theme | Mood | Where it comes from | Best for | Mode |
| --- | --- | --- | --- | --- |
| **Ember** (default) | Cozy and comforting | The campfire on camping trips with his mom | Feeling at home | Dark |
| **Tidepool** | Serene and connected | Exploring tide pools as a kid | Stressful or anxious days | Dark |
| **Morning Meadow** | Fresh and hopeful | Lying in the grass on quiet mornings | Daytime, bright rooms | Light |
| **Marshy** | Soft and safe | Marshy, his sequined stuffed sheep | Dark nights, winding down | Dark |

## 1. Ember

The original Hearth look: firelight on a dark night.

**Rationale.** Hearth's fireside look comes from camping with Alex's mom. Sitting by the campfire with her is one of the most comforting feelings he knows, and that's where the name Hearth comes from. Warm oranges and golds feel cozy and a little energizing.

## 2. Tidepool

| Role | Color | Hex |
| --- | --- | --- |
| Background | Deep harbor | `#0f1820` |
| Panels | Slate tide | `#1a2a36` |
| Accent (labels, focus) | Sea glass | `#9fd0de` |
| Primary (checks, timeline) | Dusty blue | `#7fb3cf` |
| Buttons | Still water | `#3a7593` |
| Text | Mist | `#eaf2f5` |
| Muted text | Fog | `#a9bcc6` |

**Rationale.** As a kid, Alex explored tide pools, where all the animals seemed relaxed and the whole ecosystem worked as one. To him that is what serenity, unity and good mental health feel like. Blue is also the color most widely linked with calm: soft blues are often tied to slower breathing and lower arousal, which is why so many therapy and meditation apps use them. The blues are dusty and greyed rather than bright, so they read as calm, not clinical. A warm sand color is kept for the game's goal flame, so the "reach the hearth" moment still feels warm.

## 3. Morning Meadow

| Role | Color | Hex |
| --- | --- | --- |
| Background | Oat | `#f6f1e7` |
| Panels | Cream paper | `#fffcf6` |
| Accent (labels, focus) | Soft clay | `#a0553b` |
| Primary (checks, timeline) | Sage | `#6e8f62` |
| Buttons | Deep sage | `#56744b` |
| Text | Forest ink | `#2f3a33` |
| Muted text | Lichen | `#5a675d` |

**Rationale.** This theme comes from mornings: waking up with the hope that every day is a new day, then lying in the grass looking up at a blue sky, with nowhere to be and quiet time to think. It is the only light theme, made for daytime and bright rooms where a dark screen feels heavy. Sage green connects to nature, growth and balance, which fits Hearth's creature that grows over time. Instead of stark white, the background is a warm oat color, which is gentler on the eyes. Soft clay labels add a little warmth that ties back to the hearth. Text uses a deep green-grey instead of black, so the contrast stays readable without feeling harsh.

## 4. Marshy

| Role | Color | Hex |
| --- | --- | --- |
| Background | Midnight | `#121838` |
| Panels | Night wool | `#1e2652` |
| Accent (labels, focus) | Sky | `#a9d4f5` |
| Primary (checks, timeline) | Soft sky | `#9cc8f0` |
| Buttons | Deep night | `#4660b5` |
| Text | Starlight | `#eef3fc` |
| Muted text | Cloud | `#b3bfdc` |

**Rationale.** Named after Marshy, Alex's childhood stuffed animal: a sequined, sheep-like friend in midnight blue and light sky blue that kept him company on the darkest nights, and who later starred in a cartoon Alex made. This theme brings Marshy's colors into Hearth for the hardest evenings. The background is a deep midnight blue and the accents are Marshy's sky blue. The app's grain texture is turned up slightly, like a faint shimmer of sequins. A soft moon gold is the one warm note, used for the creature's glow and the game's goal flame. Everything stays low in brightness so the screen doesn't jolt anyone awake late at night.

## Design rules every theme follows

- **Muted, not saturated.** Bright, saturated colors raise energy. Every main color here is softened with grey.
- **No pure black or white.** Backgrounds and text are always slightly tinted, which feels softer.
- **Readable text.** Every text color passes WCAG AA contrast (4.5:1 or more) on its panels.
- **One warm note.** Each theme keeps a single warm color (firelight, sand, clay or moon gold) so Hearth still feels like a hearth.
- **The creature stays itself.** The keeper's Ember, Golden and Moss colors and its hats look the same in every theme, because those are the user's own choices.

## Files

```
skins.css     the four themes as CSS color tokens (the app loads this file)
preview.html  swatch board: open it in a browser to see all themes side by side
previews/     full-page screenshots of the app in each theme
```

## Using the themes

- In the app, pick a theme with the four round swatches at the top right. Your choice is saved in that browser.
- Add `?skin=ember`, `?skin=tidepool`, `?skin=meadow` or `?skin=marshy` to the URL to open a specific theme. This also works with the demo scenes, for example `index.html?demo=today&skin=meadow`. (The code still calls themes "skins" internally; the older names `sage` and `lavender` still work and open Morning Meadow and Marshy.)
- To add a fifth theme, copy one block in `skins.css`, give it a new `data-skin` name, change the colors, then add it to the list in the head of `index.html` and add a swatch button to the header.

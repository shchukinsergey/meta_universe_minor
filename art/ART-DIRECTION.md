# AERIS / Quiet Islands — art direction for the city

Status: **test-asset brief only**. The renderer and `index.html` remain untouched. Generate and review one museum sprite before any city-wide replacement.

## Visual target

A quiet, welcoming island city with the tactile charm of a carefully handcrafted modern indie pixel-art game. Architecture is historical rather than generic: the gallery/museum is a dignified 19th-century civic museum—pale carved stone, a tall central entrance, paired columns, deep-set arched windows, a broken pediment with a small clock/relief, and a restrained patinated-teal roof. Keep the silhouette readable at play scale; distribute detail in deliberate clusters rather than noise.

The old-world architecture should sit naturally in the existing midnight-blue city and cyan/teal lighting. Avoid photorealism, painterly blur, vector-clean geometry, 3D render look, chibi exaggeration, steampunk clutter, text/signage on the sprite, and high-saturation neon on the building itself.

## Projection and in-game scale (measured from `index.html`)

- Projection: existing dimetric 2:1. `P(u,v)` advances one map tile by 64×32 screen units (`x = 2200 + (u-v)×32`, `y = 1500 + (u+v)×16`). Do not introduce a new projection.
- Gallery footprint: 6×6 map tiles. The existing `World.build()` blocks `u = bu-3…bu+2`, `v = bv-3…bv+2` and places the building entity at `P(bu,bv)`.
- Render density: the main canvas backing store is half the viewport dimensions and uses nearest-neighbor presentation. One game tile therefore occupies 32×16 source pixels in a sprite that is drawn at 2× destination size.
- Museum test canvas: **192×156 px**, transparent RGBA, representing a **384×312 screen-unit** sprite. Initial anchor at `(96,116)` relative to the PNG, corresponding to the existing building entity origin `P(bu,bv)`. Its 6×6 base diamond is 192×96 source pixels; the remaining vertical extent is the building mass.
- Keep the existing 6×6 collision footprint and entity origin. No shadow extending into walkable tiles. Leave the existing door/route marker and venue label as separate game elements.

## Lighting and pixel treatment

- Key light: upper-left; lower-right roof/facade planes are darker. Use small warm window light as a secondary accent, not as a new global light source.
- Modern high-resolution pixel art: deliberate 1–3 px clusters, selective dark contour, stepped diagonals, controlled 3-tone ramps, no blur, no antialiasing, no random speckle texture, no gradients, and no sub-pixel details that disappear at native size.
- Keep exterior pixels fully opaque or fully transparent. Do not add a soft drop shadow; the game already has ground and lighting effects.
- One sprite only for this approval gate. No other city asset is to be replaced until the museum is approved.

## Palette lock (16 colors + transparent)

Use only the colors in `city-palette.json` for the test asset. Request any additions as a palette revision before generation.

| Role | Hex |
|---|---|
| Outline / deepest recess | `#1C202A` |
| Cool deep shade | `#303944` |
| Shadow stone | `#555B62` |
| Stone shade | `#787B78` |
| Stone base | `#9B998D` |
| Lit stone | `#C5BBA3` |
| Carved highlight | `#E6D8BA` |
| Deep wood / door shadow | `#4A3735` |
| Wood base | `#755748` |
| Warm wood light | `#A07A60` |
| Patina shadow | `#274653` |
| Patina base | `#3D6570` |
| Patina light | `#669084` |
| Glass shadow | `#26506A` |
| Glass / teal reflection | `#68A8AD` |
| Window / brass light | `#EFC77F` |

## Review gate

Review the actual PNG at 1× source and at the game's 2× displayed scale, on both dark and light backgrounds. Check the two visible facade planes, roof silhouette, entry, window rhythm, 2:1 footprint, alpha fringe, and readability next to the existing player. Do not integrate the PNG into `index.html` or produce a replacement set until the user approves this one test asset.

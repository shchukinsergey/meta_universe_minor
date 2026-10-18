# Museum sprite — single-asset generation brief

**Do not treat this prompt as an asset.** It is ready for a real image generator; no PNG has been generated yet.

## Generate one image

A single, grand 19th-century civic museum / historical gallery for a quiet, atmospheric isometric pixel-art city. True 2:1 dimetric view from above, showing exactly two visible facade planes and a readable diamond-shaped 6×6-tile footprint. Main entrance is on the right-hand visible facade at the near-right corner, aligned with the current game's gallery doorway. Pale carved limestone, paired tall columns, restrained classical pilasters, deep-set arched windows, a sculpted central pediment with a small clock medallion, and a modest patinated-teal roof/cupola. Elegant, lived-in, handcrafted modern indie game pixel art; asymmetrical but architecturally coherent; deliberate clusters of crisp pixels; strong readable silhouette; rich but disciplined carved detail; upper-left warm key light, cool lower-right shade; use only the 16 colors in `city-palette.json`. Isolated object, transparent background, no ground plane, no cast shadow, no scenery, no text, no signage, no extra buildings. Keep the footprint 2:1, both facade axes consistent, roof and wall lines stepped to the pixel grid. Save the editable source (Aseprite/Pixelorama project) and transparent PNG.

## Negative prompt / reject list

Photorealism, 3D render, painterly blur, smooth gradients, vector illustration, simple box, plain rectangles, flat single-color walls, geometric placeholder, generic house, fantasy castle, steampunk clutter, noisy single-pixel speckles, repeated stamped windows, inconsistent vanishing point, wrong isometric ratio, extra visible sides, warped symmetry, floating roof, clipped tower, detached ornaments, white/gray matte, checkerboard baked into pixels, halo, drop shadow, ground plane, labels, watermark.

## Export target

- Preferred model canvas: 200×200 with the museum silhouette kept within a centered 192×156 content window; alternatively, generate at 384×312 and reduce exactly 50% with nearest-neighbor plus manual pixel cleanup.
- For a 200×200 source, the safe crop is `(x=4,y=22,w=192,h=156)`; the anchor before cropping is `(100,138)` and after cropping is `(96,116)`.
- Final native sprite: 192×156 px transparent RGBA for the current renderer's half-resolution backing store; draw at 384×312 game units.
- Anchor: `(96,116)` in the final PNG, corresponding to `P(bu,bv)` in the current renderer. 6×6 base diamond vertices in final PNG: `(96,60)`, `(192,108)`, `(96,156)`, `(0,108)`.
- Record the source prompt, model, seed, palette, crop, and any manual edits.
- Keep this as a single isolated review asset. No other game art changes until approval.

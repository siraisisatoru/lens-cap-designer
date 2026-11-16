# Lens Cap Designer

A one-page web app that makes bokeh-shape lens caps. You pick the filter thread size and a shape (a preset or your own SVG). It builds a screw-on cap with the matching thread and downloads a 3MF that Bambu Studio opens directly.

Everything runs in the browser, and SVGs are never uploaded anywhere. Built with Vite + React; [manifold-3d](https://github.com/elalish/manifold) (WebAssembly) builds the solids, three.js draws the preview, and fflate writes the 3MF zip.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 with live reload
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
```

## Deploy

It's a static site, so any static host works.
- **Vercel:** import the repo; it detects **Vite** (build `npm run build`, output `dist`). Nothing else to set.
- **Cloudflare Pages / Netlify:** build command `npm run build`, output directory `dist`.

URL parameters preset the designer, so a setup can be shared as a link:
`?size=67&variant=rotating&shape=star&shapeSize=18&view=exploded`. Add `help=pitch` to jump to the pitch explainer.

## Variants

| Variant | Parts | How it works |
|---|---|---|
| **One-piece** | `cap` | A face plate with the shape cut out, plus the male thread. |
| **Rotating dial** | `ring`, `dial` | The ring screws onto the lens and stays put. The dial has a slotted skirt (8 fingers) whose bumps snap into a groove in the ring bore, so it turns freely to aim the shape. There is a notch on the dial edge at the shape's "up". |
| **Slot + cards** | `slot_base`, `slot_cover`, `slot_card` | The cover's two rails form a channel. 4 pegs press into holes in the base. A card slides through the channel. "Card shape sizes" (`100, 70, 45`) puts several sizes on one strip: slide it to change the size. A paper template (SVG, 1:1) can be downloaded as well. |

Every part prints without supports, in the orientation it is placed on the plate:
- Face plates print face-down, so the textured-plate side faces forward.
- Threaded parts print shoulder-down with the thread pointing up.
- Long cards are turned 90° automatically to fit the plate.

## Thread

- Filter threads are ISO-style 60°, right-hand. The pitch is looked up from the size: 0.75 mm for 37–82 mm, 0.5 mm for small sizes, 1.0 mm for 86 mm and up. You can choose 0.5 / 0.75 / 1.0 from the dropdown. A yellow warning appears when the size is under 43 or over 82 mm (lenses of those sizes vary), or when you pick a pitch other than 0.75 for a 43–82 mm size.
- Profile: radial depth 0.541 p, crest flat p/8, root flat p/4.
- The male major diameter is `size − clearance`. Clearance defaults to 0.3 mm on the diameter.
- The thread fades in over the first 0.6 mm as a lead-in, with a short relief at the shoulder.
- The thread is a height-field mesh, not a helical sweep, so it is always watertight.

**Printing tips**
- Use 0.08–0.12 mm layers.
- If it is too tight, raise the clearance to 0.4–0.5. If it wobbles, lower it to 0.2.
- Print in black or another opaque filament. The plate is 2 mm thick by default.

## Optics: which way round is the shape?

Background bokeh shows the mask as seen from the **camera side**. Face plates print face-down, so the camera side is the top of the part on the plate. A heart drawn upright in the SVG is upright in the photo. Foreground bokeh is flipped.

The shape only controls the bokeh when it is smaller than the lens's entrance pupil. Use the lens wide open; 10–20 mm suits a 50 mm f/1.8.

## Files

```
index.html                 Vite entry
src/main.jsx               React root
src/App.jsx                page layout, state, generation, URL presets
src/components/Controls.jsx   steps 1–3 + advanced settings
src/components/Viewer.jsx     three.js preview (print plate / exploded)
src/components/Sections.jsx   variants, pitch explainer, printing, FAQ
src/styles.css             all styles (light + dark)
src/lib/                   framework-free geometry code, also used by the Node tests
  models.js                the three variants (dimensions are named constants at the top)
  thread.js                thread profile + threaded tube mesh
  svg.js                   SVG -> polygons (path/rect/circle/ellipse/polygon, transforms, fill-rule)
  presets.js               built-in shapes
  threemf.js               3MF writer + plate layout
  generate.js              runs a build, returns plain data for the UI
  downloads.js             3MF / per-part / paper card template downloads
  engine.js                loads the WebAssembly engine
  pitchFigures.js          the pitch illustrations (SVG)
test/build_all.mjs         builds every variant for several sizes, checks manifoldness, writes test/out/
test/sections.mjs          assembled cross-sections + interference check
```

```bash
npm test
node test/sections.mjs 52
```

## Not done yet / ideas

- **Adjustable-size variant.** Not started. Two directions:
  - an iris diaphragm (printed blades and a turning ring) gives continuous size, but only a round or polygonal opening;
  - a wheel carrying the SVG shape at several sizes gives stepped sizes but keeps the custom shape.
- Detent clicks for the rotating dial, so it holds its angle.
- Bambu project metadata: per-part plates and a preset profile (layer height, filament).
- Sizes above 82 mm don't fit the slot variant on an A1 mini plate; use "one 3MF per part".

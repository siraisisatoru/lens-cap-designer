// Lens cap variants. Every part is returned already in print orientation:
// z = 0 is the build plate, the part is centred on x = y = 0.
//
// Optical note: for background bokeh the photo shows the mask as seen from the CAMERA side.
// Face plates are printed face-down, so the camera side is +z and the SVG appears upright
// (not mirrored) in the photo when the part is viewed from above in print orientation.

import { threadDims, threadedTube } from './thread.js';
import { svgToShapes } from './svg.js';

export const DEFAULTS = {
  size: 52,            // filter thread nominal diameter (mm)
  pitch: 0.75,
  clearance: 0.3,      // diametral clearance on the male thread
  threadLen: 3.0,      // length of thread that screws into the lens
  wall: 2.0,           // wall between thread root and bore
  shapeSize: 15,       // largest dimension of the bokeh shape (mm)
  shapeRotation: 0,    // degrees
  plate: 2.0,          // face plate thickness (opaque: print in black)
  cardThickness: 0.6,  // slot variant: card / paper stack thickness
  cardScales: [100],   // slot variant: shape sizes (%) on the printed card strip
};

const CIRC = 0.5; // target segment length (mm) for round things

function segs(r) {
  let n = Math.max(32, Math.ceil((2 * Math.PI * r) / CIRC));
  return n + ((4 - (n % 4)) % 4);
}

// ------------------------------------------------------------------ shape
export function shapeCrossSection(wasm, svgText, size, rotationDeg, DOMParserImpl) {
  const { CrossSection } = wasm;
  const shapes = svgToShapes(svgText, DOMParserImpl);
  let cs = null;
  for (const s of shapes) {
    const part = new CrossSection(s.polygons, s.fillRule);
    cs = cs ? cs.add(part) : part;
  }
  cs = cs.mirror([0, 1]); // SVG y is down
  if (cs.isEmpty()) throw new Error('SVG produced an empty shape');
  const b = cs.bounds();
  const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1];
  cs = cs.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]).scale(size / Math.max(w, h));
  if (rotationDeg) cs = cs.rotate(rotationDeg);
  return cs;
}

// ------------------------------------------------------------------ helpers
function knurlDisc(wasm, R, h, { chamferBottom = 0.5, ridgePitch = 2.4, ridgeDepth = 0.45 } = {}) {
  const { CrossSection, Manifold } = wasm;
  const ridges = Math.max(12, Math.round((2 * Math.PI * R) / ridgePitch));
  const n = ridges * 8;
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    const r = R - ridgeDepth * (0.5 - 0.5 * Math.cos(ridges * a));
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  let m = Manifold.extrude(new CrossSection([pts]), h);
  if (chamferBottom > 0) {
    m = m.intersect(Manifold.cylinder(h, R - chamferBottom, R - chamferBottom + h, segs(R)));
  }
  return m;
}

const cyl = (wasm, h, r, z = 0, r2) => wasm.Manifold.cylinder(h, r, r2 ?? r, segs(Math.max(r, r2 ?? r))).translate([0, 0, z]);

// revolve a closed (r, z) profile around the z axis
const revolve = (wasm, rz, r) => wasm.Manifold.revolve(new wasm.CrossSection([rz]), segs(r));

function dims(p) {
  const t = threadDims(p.size, p.pitch, p.clearance);
  const rBore = t.rRoot - p.wall;
  return { ...t, rBore };
}

function threadOn(wasm, p, d, zBase) {
  // thread tube from zBase (shoulder) to zBase + threadLen; bore trimmed later
  return threadedTube(wasm, {
    rRoot: d.rRoot, depth: d.depth, pitch: p.pitch, rInner: d.rBore - 0.4,
    z0: zBase - 0.2, z1: zBase + p.threadLen, fadeLo: 0.25, fadeHi: Math.min(0.6, p.threadLen / 4),
  });
}

function checkShapeFits(cs, rMax, label) {
  const b = cs.bounds();
  const corners = [b.min, b.max, [b.min[0], b.max[1]], [b.max[0], b.min[1]]];
  // exact check using vertices
  let rr = 0;
  for (const poly of cs.toPolygons()) for (const [x, y] of poly) rr = Math.max(rr, Math.hypot(x, y));
  if (rr > rMax) {
    throw new Error(`${label}: shape reaches ${(2 * rr).toFixed(1)} mm across but the clear opening is only ${(2 * rMax).toFixed(1)} mm. Reduce the shape size.`);
  }
  return corners;
}

// ------------------------------------------------------------------ variant 1: one-piece cap
export function buildSolid(wasm, p, shape) {
  const d = dims(p);
  const R = p.size / 2 + 2;
  checkShapeFits(shape, d.rBore - 0.6, 'One-piece cap');
  let m = knurlDisc(wasm, R, p.plate);
  m = m.add(threadOn(wasm, p, d, p.plate));
  m = m.subtract(cyl(wasm, p.threadLen + 2, d.rBore, p.plate));
  m = m.subtract(wasm.Manifold.extrude(shape, p.plate + 2).translate([0, 0, -1]));
  return [{ name: 'cap', manifold: m, asm: [0, 0, 0], explode: 0, note: 'Print face-down as placed. Black/opaque filament.' }];
}

// ------------------------------------------------------------------ variant 2: rotating (ring + dial)
// Ring: flange + thread, stays screwed to the lens. Dial: face plate with the shape and a
// slotted skirt whose bumps snap into a groove in the ring bore, so the dial turns freely.
export const ROT = {
  flange: 4.0,        // ring flange height (grip for screwing in)
  grooveZ: 2.8,       // groove centre, measured from the dial-side face of the ring
  grooveDepth: 0.6,
  grooveHalf: 0.8,    // half width at the bore surface
  gap: 0.2,           // axial gap between dial plate and ring
  radialClr: 0.2,     // skirt to bore clearance
  skirt: 0.85,        // skirt thickness (2 perimeters)
  bump: 0.4,          // bump height (snap interference = bump - radialClr)
  fingers: 8,
  slotW: 1.0,
};

export function buildRotating(wasm, p, shape) {
  const { Manifold } = wasm;
  const d = dims(p);
  const R = p.size / 2 + 2.5;
  const k = ROT;

  // ---- ring (printed with the dial-side face down, thread up)
  let ring = knurlDisc(wasm, R, k.flange);
  ring = ring.add(threadOn(wasm, p, d, k.flange));
  ring = ring.subtract(cyl(wasm, k.flange + p.threadLen + 2, d.rBore, -1));
  // entry chamfer on the bore at z = 0
  ring = ring.subtract(cyl(wasm, 0.6, d.rBore + 0.6, 0, d.rBore).translate([0, 0, -0.001]));
  ring = ring.subtract(cyl(wasm, 0.5, d.rBore + 0.6, -0.5));
  // snap groove
  const gz = k.grooveZ, gd = k.grooveDepth, gh = k.grooveHalf;
  ring = ring.subtract(revolve(wasm, [
    [d.rBore - 0.2, gz - gh - 0.2], [d.rBore, gz - gh], [d.rBore + gd, gz - gh + gd],
    [d.rBore + gd, gz + gh - gd], [d.rBore, gz + gh], [d.rBore - 0.2, gz + gh + 0.2],
  ], d.rBore));

  // ---- dial (printed face-down, skirt up)
  const rs = d.rBore - k.radialClr;       // skirt outer radius
  const ri = rs - k.skirt;
  const zc = p.plate + k.gap + gz;        // bump centre in dial coordinates
  const top = zc + 0.9;
  checkShapeFits(shape, ri - 0.5, 'Rotating cap');
  let dial = knurlDisc(wasm, R, p.plate);
  // orientation mark: notch at +y (the shape's "up")
  dial = dial.subtract(Manifold.cube([1.2, 2, p.plate + 2], true).rotate([0, 0, 0]).translate([0, R, p.plate / 2]));
  let skirt = cyl(wasm, top - p.plate + 0.1, rs, p.plate - 0.1).subtract(cyl(wasm, top + 2, ri, -1));
  const b = k.bump;
  skirt = skirt.add(revolve(wasm, [
    [rs - 0.1, zc - 0.6], [rs + b, zc - 0.15], [rs + b, zc + 0.15], [rs - 0.1, zc + 0.5],
  ], rs));
  // finger slots (from 0.4 mm above the plate to the tip)
  const slotH = top - p.plate;
  for (let i = 0; i < k.fingers; i++) {
    const slot = Manifold.cube([k.skirt + b + 2, k.slotW, slotH], false)
      .translate([ri - 1, -k.slotW / 2, p.plate + 0.4])
      .rotate([0, 0, (360 * i) / k.fingers + 360 / k.fingers / 2]);
    skirt = skirt.subtract(slot);
  }
  dial = dial.add(skirt);
  dial = dial.subtract(Manifold.extrude(shape, p.plate + 2).translate([0, 0, -1]));

  return [
    { name: 'ring', manifold: ring, asm: [0, 0, 0], explode: 0, note: 'Print flat face down (thread up).' },
    { name: 'dial', manifold: dial, asm: [0, 0, -(p.plate + k.gap)], explode: -12, note: 'Print face-down. Push into the ring until it clicks; it then turns freely.' },
  ];
}

// ------------------------------------------------------------------ variant 3: slot for cards
// Base: threaded ring with a wide flange. Cover: face plate with two rails that form a
// channel; pegs on the rails press into holes in the base flange. A card (printed or paper)
// with the shape slides through the channel.
export const SLOT = {
  baseFlange: 2.4,
  railW: 3.5,
  sideClr: 0.3,       // card to rail clearance each side
  heightClr: 0.3,     // channel height above card thickness
  peg: 2.0,
  pegHole: 2.15,
  pegLen: 1.8,
  margin: 6,          // flange extends this far past the rails
};

export function slotGeometry(p) {
  const d = dims(p);
  const k = SLOT;
  const aperture = d.rBore;
  const Wc = 2 * aperture + 4;           // channel width
  const xOut = Wc / 2 + k.railW;
  const R = Math.max(p.size / 2 + 2, xOut + k.margin);
  const halfChord = Math.sqrt(R * R - xOut * xOut);
  const yPeg = halfChord * 0.5;
  const xPeg = Wc / 2 + k.railW / 2;
  const chH = p.cardThickness + k.heightClr;
  const cardW = Wc - 2 * k.sideClr;
  const spacing = 2 * aperture + 4;
  return { d, aperture, Wc, xOut, R, yPeg, xPeg, chH, cardW, spacing };
}

export function buildSlot(wasm, p, shape, shapeAt) {
  const { Manifold, CrossSection } = wasm;
  const g = slotGeometry(p);
  const k = SLOT;
  const { d } = g;

  // ---- base (flange down, thread up)
  let base = knurlDisc(wasm, g.R, k.baseFlange);
  base = base.add(threadOn(wasm, p, d, k.baseFlange));
  base = base.subtract(cyl(wasm, k.baseFlange + p.threadLen + 2, d.rBore, -1));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    base = base.subtract(cyl(wasm, k.baseFlange + 2, k.pegHole / 2, -1).translate([sx * g.xPeg, sy * g.yPeg, 0]));
  }

  // ---- cover (face-down, rails and pegs up)
  let cover = knurlDisc(wasm, g.R, p.plate);
  cover = cover.subtract(cyl(wasm, p.plate + 2, g.aperture, -1));
  for (const sx of [-1, 1]) {
    const rail = Manifold.cube([k.railW, 2 * g.R + 2, g.chH + 0.01], false)
      .translate([sx > 0 ? g.Wc / 2 : -g.xOut, -g.R - 1, p.plate - 0.01]);
    cover = cover.add(rail.intersect(cyl(wasm, g.chH + 1, g.R - 0.3, p.plate - 0.5)));
    for (const sy of [-1, 1]) {
      cover = cover.add(cyl(wasm, k.pegLen, k.peg / 2, p.plate + g.chH, k.peg / 2 - 0.25).translate([sx * g.xPeg, sy * g.yPeg, 0]));
    }
  }
  // orientation mark at +y so you know which way the channel runs
  cover = cover.subtract(Manifold.cube([1.2, 2, p.plate + 2], true).translate([0, g.R, p.plate / 2]));

  // ---- card strip
  const scales = (p.cardScales && p.cardScales.length ? p.cardScales : [100]).map((s) => s / 100);
  const n = scales.length;
  const tab = 25;
  const y0 = -g.R;                                // card end inside the cap
  const y1 = (n - 1) * g.spacing + g.R + tab;     // grab tab end
  let card = Manifold.cube([g.cardW, y1 - y0, p.cardThickness], false).translate([-g.cardW / 2, y0, 0]);
  const cards2d = [];
  scales.forEach((s, i) => {
    const cs = shape.scale(s).translate([0, i * g.spacing]);
    checkShapeFits(shape.scale(s), g.aperture - 0.5, 'Slot card');
    cards2d.push(cs);
    card = card.subtract(Manifold.extrude(cs, p.cardThickness + 2).translate([0, 0, -1]));
  });
  // grip lines on the tab
  for (let j = 0; j < 4; j++) {
    card = card.subtract(Manifold.cube([g.cardW - 8, 0.8, 0.3], false).translate([-(g.cardW - 8) / 2, y1 - 6 - j * 3, p.cardThickness - 0.3]));
  }
  const cardLen = y1 - y0;
  // centre the card on the origin so layout is simple
  card = card.translate([0, -(y0 + y1) / 2, 0]);

  return {
    parts: [
      { name: 'slot_base', manifold: base, asm: [0, 0, p.plate + g.chH], explode: 14, note: 'Print flange down (thread up).' },
      { name: 'slot_cover', manifold: cover, asm: [0, 0, 0], explode: 0, note: 'Print face-down. Press the 4 pegs into the base holes (drop of glue optional).' },
      { name: 'slot_card', manifold: card, asm: [0, (y0 + y1) / 2 - g.spacing * 0, p.plate + 0.15], explode: 7, note: `Card ${g.cardW.toFixed(1)} × ${cardLen.toFixed(1)} × ${p.cardThickness} mm.` },
    ],
    card: { width: g.cardW, length: cardLen, y0, y1, shapes: cards2d, spacing: g.spacing },
  };
}

// ------------------------------------------------------------------ entry point
export function build(wasm, params, svgText, DOMParserImpl) {
  const p = { ...DEFAULTS, ...params };
  const shape = shapeCrossSection(wasm, svgText, p.shapeSize, p.shapeRotation, DOMParserImpl);
  const d = dims(p);
  if (d.rBore < 5) throw new Error('Filter size too small for these wall settings');
  const out = { params: p, dims: d, variants: {} };
  out.variants.solid = { parts: buildSolid(wasm, p, shape) };
  out.variants.rotating = { parts: buildRotating(wasm, p, shape) };
  out.variants.slot = buildSlot(wasm, p, shape);
  return out;
}

export function buildVariant(wasm, variant, params, svgText, DOMParserImpl) {
  const p = { ...DEFAULTS, ...params };
  const shape = shapeCrossSection(wasm, svgText, p.shapeSize, p.shapeRotation, DOMParserImpl);
  if (variant === 'solid') return { parts: buildSolid(wasm, p, shape) };
  if (variant === 'rotating') return { parts: buildRotating(wasm, p, shape) };
  if (variant === 'slot') return buildSlot(wasm, p, shape);
  throw new Error('unknown variant ' + variant);
}

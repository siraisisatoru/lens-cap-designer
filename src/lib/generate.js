// Runs a build and turns the result into plain data the UI can keep: meshes, plate positions,
// assembly offsets, notes and the card outline for the paper template.
import { buildVariant, DEFAULTS } from './models.js';
import { layout } from './threemf.js';

export function generate(wasm, { variant, params, svg, bed }) {
  const t0 = performance.now();
  const res = buildVariant(wasm, variant, params, svg);
  const { placed, fits } = layout(res.parts, bed);
  const parts = placed.map((p) => {
    const b = p.manifold.boundingBox();
    return {
      name: p.name,
      note: p.note,
      mesh: p.manifold.getMesh(),
      center: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2],
      x: p.x,
      y: p.y,
      rot90: p.rot90,
      asm: p.asm,
      explode: p.explode,
    };
  });
  let card = null;
  if (res.card) {
    const c = res.card;
    card = { width: c.width, length: c.length, y1: c.y1, polygons: c.shapes.flatMap((cs) => cs.toPolygons()) };
  }
  return {
    parts,
    fits,
    card,
    variant,
    params: { ...DEFAULTS, ...params },
    ms: Math.round(performance.now() - t0),
  };
}

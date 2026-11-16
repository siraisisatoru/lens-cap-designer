// Write x-z cross sections (plane y=0) of the assembled variants to JSON for plotting,
// and report interference volumes between mating parts.
import Module from 'manifold-3d/manifold.js';
import { DOMParser } from '@xmldom/xmldom';
import { writeFileSync } from 'node:fs';
import { buildVariant } from '../src/lib/models.js';
import { PRESETS } from '../src/lib/presets.js';
const wasm = await Module(); wasm.setup();
const size = +(process.argv[2] || 52);
const out = {};
for (const v of ['solid', 'rotating', 'slot']) {
  const r = buildVariant(wasm, v, { size }, PRESETS.heart, DOMParser);
  const placed = r.parts.map((p) => ({ name: p.name, m: p.manifold.translate(p.asm) }));
  out[v] = placed.map((p) => ({ name: p.name, polys: p.m.rotate([90, 0, 0]).slice(0).toPolygons() }));
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const vol = placed[i].m.intersect(placed[j].m).volume();
    console.log(`${v}: ${placed[i].name} ∩ ${placed[j].name} = ${vol.toFixed(4)} mm3`);
  }
}
writeFileSync(new URL('./out/sections.json', import.meta.url), JSON.stringify(out));

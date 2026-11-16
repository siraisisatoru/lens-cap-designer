// Build every variant for several filter sizes and presets, check the meshes, write outputs.
//   node test/build_all.mjs            -> test/out/*.3mf + *.stl
import Module from 'manifold-3d/manifold.js';
import { DOMParser } from '@xmldom/xmldom';
import { writeFileSync, mkdirSync } from 'node:fs';
import { build } from '../src/lib/models.js';
import { PRESETS } from '../src/lib/presets.js';
import { defaultPitch } from '../src/lib/filters.js';
import { make3MF, layout } from '../src/lib/threemf.js';

const wasm = await Module();
wasm.setup();
const OUT = new URL('./out/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function stl(mesh) {
  const { vertProperties: v, triVerts: t, numProp: np } = mesh;
  const n = t.length / 3;
  const buf = Buffer.alloc(84 + n * 50);
  buf.writeUInt32LE(n, 80);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) buf.writeFloatLE(v[t[3 * i + k] * np + c], o + k * 12 + c * 4);
  }
  return buf;
}

let ok = true;
const cases = [
  { size: 52, preset: 'heart' },
  { size: 37, preset: 'star', shapeSize: 12 },
  { size: 82, preset: 'moon', shapeSize: 22 },
  { size: 67, preset: 'flower', cardScales: [100, 70] },
];
for (const c of cases) {
  for (const name of Object.keys(PRESETS)) {
    // quick parse check for every preset
    if (c !== cases[0]) break;
    try { build(wasm, { size: 52, pitch: 0.75 }, PRESETS[name], DOMParser); } catch (e) { ok = false; console.log('PRESET FAIL', name, e.message); }
  }
  const t0 = performance.now();
  const res = build(wasm, { size: c.size, pitch: defaultPitch(c.size), shapeSize: c.shapeSize ?? 15, cardScales: c.cardScales }, PRESETS[c.preset], DOMParser);
  const ms = (performance.now() - t0).toFixed(0);
  console.log(`\n== ${c.size} mm  pitch ${res.params.pitch}  ${c.preset}  (${ms} ms)  major Ø${(2 * res.dims.rMajor).toFixed(2)} root Ø${(2 * res.dims.rRoot).toFixed(2)} bore Ø${(2 * res.dims.rBore).toFixed(2)}`);
  for (const [vname, v] of Object.entries(res.variants)) {
    for (const part of v.parts) {
      const m = part.manifold;
      const st = m.status();
      const b = m.boundingBox();
      const good = st === 'NoError' && m.volume() > 0 && b.min[2] > -1e-3;
      ok &&= good;
      console.log(`  ${good ? 'ok ' : 'BAD'} ${vname.padEnd(9)} ${part.name.padEnd(11)} vol ${(m.volume() / 1000).toFixed(2)} cm3  genus ${m.genus()}  ` +
        `${(b.max[0] - b.min[0]).toFixed(1)} x ${(b.max[1] - b.min[1]).toFixed(1)} x ${(b.max[2] - b.min[2]).toFixed(2)}  tris ${m.numTri()}  ${st}`);
      writeFileSync(new URL(`${c.size}_${vname}_${part.name}.stl`, OUT), stl(m.getMesh()));
    }
    const { placed, fits } = layout(v.parts, [180, 180]);
    if (!fits) console.log(`  !! ${vname} does not fit a 180 mm bed`);
    const zip = make3MF(placed.map((p) => ({ name: p.name, mesh: p.manifold.getMesh(), x: p.x, y: p.y, rot90: p.rot90 })));
    writeFileSync(new URL(`${c.size}_${vname}.3mf`, OUT), zip);
  }
}
console.log(ok ? '\nALL OK' : '\nFAILURES');
process.exit(ok ? 0 : 1);

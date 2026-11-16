// Minimal 3MF writer (core spec). Bambu Studio / Orca import each <object> as a separate
// part and keep the names and the plate positions given in <build>.
import { zipSync, strToU8 } from 'fflate';

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/** items: [{ name, mesh: {vertProperties, triVerts, numProp}, x, y, rot90? }] (mm, plate coords) */
export function make3MF(items, { title = 'lens cap' } = {}) {
  const objs = [];
  const build = [];
  items.forEach((it, idx) => {
    const id = idx + 1;
    const { vertProperties: vp, triVerts: tv, numProp } = it.mesh;
    const nv = vp.length / numProp;
    const v = new Array(nv);
    for (let i = 0; i < nv; i++) {
      const k = i * numProp;
      v[i] = `<vertex x="${+vp[k].toFixed(4)}" y="${+vp[k + 1].toFixed(4)}" z="${+vp[k + 2].toFixed(4)}"/>`;
    }
    const t = new Array(tv.length / 3);
    for (let i = 0; i < t.length; i++) t[i] = `<triangle v1="${tv[3 * i]}" v2="${tv[3 * i + 1]}" v3="${tv[3 * i + 2]}"/>`;
    objs.push(`<object id="${id}" name="${esc(it.name)}" type="model"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`);
    // 3MF uses row vectors: [x y z 1] * M. rot90 maps (x, y) -> (-y, x).
    const R = it.rot90 ? '0 1 0 -1 0 0 0 0 1' : '1 0 0 0 1 0 0 0 1';
    build.push(`<item objectid="${id}" transform="${R} ${it.x.toFixed(3)} ${it.y.toFixed(3)} 0" printable="1"/>`);
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${esc(title)}</metadata>
<metadata name="Application">lens-cap-designer</metadata>
<resources>${objs.join('\n')}</resources>
<build>${build.join('')}</build>
</model>`;
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`),
    '3D/3dmodel.model': strToU8(model),
  };
  return zipSync(files, { level: 6 });
}

/** Lay parts out in a row (wrapping) centred on the bed. parts: [{name, manifold}] */
export function layout(parts, bed = [180, 180], gap = 6) {
  // long thin parts (cards) are turned 90 deg so they lie along a row
  const boxes = parts.map((p) => {
    const b = p.manifold.boundingBox();
    let w = b.max[0] - b.min[0], h = b.max[1] - b.min[1];
    let cx = (b.max[0] + b.min[0]) / 2, cy = (b.max[1] + b.min[1]) / 2;
    const rot90 = h > 1.3 * w;
    if (rot90) [w, h, cx, cy] = [h, w, -cy, cx];
    return { p, w, h, cx, cy, rot90 };
  });
  boxes.sort((a, b) => b.h - a.h);
  // simple shelf packing
  const rows = [];
  let row = { items: [], w: 0, h: 0 };
  for (const b of boxes) {
    if (row.items.length && row.w + gap + b.w > bed[0]) { rows.push(row); row = { items: [], w: 0, h: 0 }; }
    row.w += (row.items.length ? gap : 0) + b.w;
    row.h = Math.max(row.h, b.h);
    row.items.push(b);
  }
  rows.push(row);
  const totalH = rows.reduce((s, r) => s + r.h, 0) + gap * (rows.length - 1);
  let y = bed[1] / 2 + totalH / 2;
  const placed = [];
  let fits = totalH <= bed[1];
  for (const r of rows) {
    fits = fits && r.w <= bed[0];
    let x = bed[0] / 2 - r.w / 2;
    y -= r.h / 2;
    for (const b of r.items) {
      placed.push({ ...b.p, x: x + b.w / 2 - b.cx, y: y - b.cy, rot90: b.rot90 });
      x += b.w + gap;
    }
    y -= r.h / 2 + gap;
  }
  return { placed, fits };
}

import { make3MF } from './threemf.js';

function save(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const baseName = (result, shapeName) =>
  `lens_cap_${result.params.size}mm_${result.variant}_${shapeName.replace(/[^\w-]+/g, '_')}`;

export function downloadAll(result, shapeName) {
  const name = baseName(result, shapeName);
  const items = result.parts.map((p) => ({ name: p.name, mesh: p.mesh, x: p.x, y: p.y, rot90: p.rot90 }));
  save(make3MF(items, { title: name }), `${name}.3mf`, 'model/3mf');
}

export function downloadEach(result, shapeName, bed) {
  const name = baseName(result, shapeName);
  for (const p of result.parts) {
    const x = bed[0] / 2 - p.center[0], y = bed[1] / 2 - p.center[1];
    save(make3MF([{ name: p.name, mesh: p.mesh, x, y }], { title: p.name }), `${name}_${p.name}.3mf`, 'model/3mf');
  }
}

export function downloadCardTemplate(result, shapeName) {
  const c = result.card;
  if (!c) return;
  const W = c.width, L = c.length;
  const X = (x) => (x + W / 2).toFixed(3), Y = (y) => (c.y1 - y).toFixed(3);
  const d = c.polygons.map((poly) => `M${poly.map(([x, y]) => `${X(x)} ${Y(y)}`).join(' L')} Z`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 20}mm" height="${L + 20}mm" viewBox="-10 -10 ${W + 20} ${L + 20}">
<rect x="0" y="0" width="${W.toFixed(2)}" height="${L.toFixed(2)}" fill="none" stroke="#000" stroke-width="0.2"/>
<path d="${d}" fill="#000" fill-rule="evenodd"/>
<text x="${(W / 2).toFixed(1)}" y="8" font-size="3.5" text-anchor="middle" font-family="sans-serif">grip end · print at 100% · cut out the black shape and the outline</text>
<text x="${(W / 2).toFixed(1)}" y="${(L + 6).toFixed(1)}" font-size="3" text-anchor="middle" font-family="sans-serif">${result.params.size} mm lens cap card · ${W.toFixed(1)} × ${L.toFixed(1)} mm</text>
</svg>`;
  save(svg, `${baseName(result, shapeName)}_card.svg`, 'image/svg+xml');
}

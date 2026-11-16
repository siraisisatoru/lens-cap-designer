// Built-in bokeh shapes as SVG text (so they go through the same path as user uploads).

const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');

function star(points, rOut, rIn) {
  const pts = [];
  for (let k = 0; k < points * 2; k++) {
    const r = k % 2 ? rIn : rOut;
    const a = -Math.PI / 2 + (Math.PI * k) / points;
    pts.push([50 + r * Math.cos(a), 50 + r * Math.sin(a)]);
  }
  return pts;
}

function regular(nSides, r, rot = -Math.PI / 2) {
  return Array.from({ length: nSides }, (_, k) => {
    const a = rot + (2 * Math.PI * k) / nSides;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });
}

function flower(petals, r0, r1) {
  return Array.from({ length: 240 }, (_, k) => {
    const a = (2 * Math.PI * k) / 240;
    const r = r0 + (r1 - r0) * Math.abs(Math.cos((petals * a) / 2));
    return [50 + r * Math.cos(a - Math.PI / 2), 50 + r * Math.sin(a - Math.PI / 2)];
  });
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;

export const PRESETS = {
  heart: wrap('<path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z"/>'),
  star: wrap(`<polygon points="${poly(star(5, 46, 19))}"/>`),
  circle: wrap('<circle cx="50" cy="50" r="45"/>'),
  hexagon: wrap(`<polygon points="${poly(regular(6, 46, 0))}"/>`),
  triangle: wrap(`<polygon points="${poly(regular(3, 48))}"/>`),
  diamond: wrap('<polygon points="50,4 82,50 50,96 18,50"/>'),
  moon: wrap('<path fill-rule="evenodd" d="M62 6 A44 44 0 1 0 94 70 A36 36 0 1 1 62 6 Z"/>'),
  flower: wrap(`<polygon points="${poly(flower(5, 20, 46))}"/>`),
  sparkle: wrap('<path d="M50 2 Q54 46 98 50 Q54 54 50 98 Q46 54 2 50 Q46 46 50 2 Z"/>'),
};

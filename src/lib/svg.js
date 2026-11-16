// Minimal SVG -> filled polygons.
// Supports: path (all commands), polygon, polyline, rect (incl. rx/ry), circle, ellipse,
// nested <g> with transform, fill-rule (attribute or style). Stroke-only shapes are ignored
// (convert strokes to paths in your editor first).
//
// Returns [{ polygons: [[x,y],...][], fillRule: 'NonZero'|'EvenOdd' }] in SVG user units
// (y pointing down, as in the file).

const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'style', 'title', 'desc', 'metadata', 'pattern', 'marker', 'linearGradient', 'radialGradient', 'text']);

// ---------------------------------------------------------------- matrices [a b c d e f]
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseTransform(str) {
  let m = I;
  if (!str) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let t;
  while ((t = re.exec(str))) {
    const v = (t[2].match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []).map(Number);
    let n = I;
    switch (t[1]) {
      case 'matrix': n = v.length === 6 ? v : I; break;
      case 'translate': n = [1, 0, 0, 1, v[0] || 0, v[1] || 0]; break;
      case 'scale': n = [v[0], 0, 0, v[1] ?? v[0], 0, 0]; break;
      case 'rotate': {
        const a = ((v[0] || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        n = [c, s, -s, c, 0, 0];
        if (v.length === 3) n = mul(mul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case 'skewX': n = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': n = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = mul(m, n);
  }
  return m;
}

// ---------------------------------------------------------------- path data
const CURVE_STEPS = 24;

function tokenize(d) {
  const out = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  let t;
  while ((t = re.exec(d))) out.push(t[1] ? t[1] : Number(t[2]));
  return out;
}

// arc flags may be written without separators ("a1 1 0 011 1"): re-split them
function tokenizeArcAware(d) {
  const raw = tokenize(d);
  const out = [];
  let cmd = null, argi = 0;
  for (let k = 0; k < raw.length; k++) {
    const tok = raw[k];
    if (typeof tok === 'string') { cmd = tok; argi = 0; out.push(tok); continue; }
    if (cmd === 'A' || cmd === 'a') {
      const pos = argi % 7;
      if ((pos === 3 || pos === 4) && tok !== 0 && tok !== 1) {
        // the number swallowed flag digits, e.g. "011" -> 0, 1, 1
        const s = String(raw[k]);
        const digits = s.replace(/^[+]/, '');
        out.push(Number(digits[0])); argi++;
        const rest = digits.slice(1);
        if (rest.length) { raw.splice(k + 1, 0, Number(rest)); }
        continue;
      }
    }
    out.push(tok); argi++;
  }
  return out;
}

function arcToPoints(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (fa === fs) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const steps = Math.max(4, Math.ceil((Math.abs(dt) / (2 * Math.PI)) * 64));
  const pts = [];
  for (let k = 1; k <= steps; k++) {
    const t = t1 + (dt * k) / steps;
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push([cp * x - sp * y + cx, sp * x + cp * y + cy]);
  }
  return pts;
}

export function pathToPolys(d) {
  const tk = tokenizeArcAware(d);
  const polys = [];
  let cur = null;
  let x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = '';
  let i = 0, cmd = '';
  const num = () => tk[i++];
  const close = () => { if (cur && cur.length > 2) polys.push(cur); cur = null; };
  const lineTo = (nx, ny) => { if (!cur) cur = [[x, y]]; cur.push([nx, ny]); x = nx; y = ny; };
  while (i < tk.length) {
    if (typeof tk[i] === 'string') cmd = tk[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        close();
        x = ox + num(); y = oy + num(); sx = x; sy = y; cur = [[x, y]];
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': lineTo(ox + num(), oy + num()); break;
      case 'H': lineTo(ox + num(), y); break;
      case 'V': lineTo(x, oy + num()); break;
      case 'C': case 'S': {
        let x1, y1;
        if (C === 'C') { x1 = ox + num(); y1 = oy + num(); }
        else if ('CS'.includes(prev)) { x1 = 2 * x - lcx; y1 = 2 * y - lcy; }
        else { x1 = x; y1 = y; }
        const x2 = ox + num(), y2 = oy + num(), ex = ox + num(), ey = oy + num();
        const x0 = x, y0 = y;
        for (let k = 1; k <= CURVE_STEPS; k++) {
          const t = k / CURVE_STEPS, u = 1 - t;
          lineTo(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex,
            u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey);
        }
        lcx = x2; lcy = y2;
        break;
      }
      case 'Q': case 'T': {
        let x1, y1;
        if (C === 'Q') { x1 = ox + num(); y1 = oy + num(); }
        else if ('QT'.includes(prev)) { x1 = 2 * x - lqx; y1 = 2 * y - lqy; }
        else { x1 = x; y1 = y; }
        const ex = ox + num(), ey = oy + num();
        const x0 = x, y0 = y;
        for (let k = 1; k <= CURVE_STEPS; k++) {
          const t = k / CURVE_STEPS, u = 1 - t;
          lineTo(u * u * x0 + 2 * u * t * x1 + t * t * ex, u * u * y0 + 2 * u * t * y1 + t * t * ey);
        }
        lqx = x1; lqy = y1;
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), fa = num(), fs = num();
        const ex = ox + num(), ey = oy + num();
        for (const p of arcToPoints(x, y, rx, ry, rot, fa, fs, ex, ey)) lineTo(p[0], p[1]);
        break;
      }
      case 'Z': close(); x = sx; y = sy; break;
      default: i++;
    }
    prev = C;
  }
  close();
  return polys;
}

// ---------------------------------------------------------------- elements
function ellipsePoly(cx, cy, rx, ry, n = 96) {
  return Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  });
}

function styleProp(el, name) {
  const st = el.getAttribute('style') || '';
  const m = st.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`));
  if (m) return m[1].trim();
  const a = el.getAttribute(name);
  return a == null || a === '' ? null : a.trim();
}

const n = (el, a, d = 0) => {
  const v = parseFloat(el.getAttribute(a));
  return Number.isFinite(v) ? v : d;
};

function elementPolys(el) {
  const tag = el.localName || el.nodeName;
  switch (tag) {
    case 'path': return pathToPolys(el.getAttribute('d') || '');
    case 'polygon': case 'polyline': {
      const v = (el.getAttribute('points') || '').match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
      const pts = [];
      for (let k = 0; k + 1 < v.length; k += 2) pts.push([+v[k], +v[k + 1]]);
      return pts.length > 2 ? [pts] : [];
    }
    case 'circle': return [ellipsePoly(n(el, 'cx'), n(el, 'cy'), n(el, 'r'), n(el, 'r'))];
    case 'ellipse': return [ellipsePoly(n(el, 'cx'), n(el, 'cy'), n(el, 'rx'), n(el, 'ry'))];
    case 'rect': {
      const x = n(el, 'x'), y = n(el, 'y'), w = n(el, 'width'), h = n(el, 'height');
      let rx = el.hasAttribute('rx') ? n(el, 'rx') : null, ry = el.hasAttribute('ry') ? n(el, 'ry') : null;
      if (rx == null) rx = ry ?? 0; if (ry == null) ry = rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!rx || !ry) return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]];
      const pts = [];
      const corner = (cx, cy, a0) => {
        for (let k = 0; k <= 8; k++) {
          const t = a0 + (Math.PI / 2) * (k / 8);
          pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
        }
      };
      corner(x + w - rx, y + ry, -Math.PI / 2);
      corner(x + w - rx, y + h - ry, 0);
      corner(x + rx, y + h - ry, Math.PI / 2);
      corner(x + rx, y + ry, Math.PI);
      return [pts];
    }
    default: return [];
  }
}

export function svgToShapes(svgText, DOMParserImpl = globalThis.DOMParser) {
  const doc = new DOMParserImpl().parseFromString(svgText, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || (root.localName || root.nodeName) !== 'svg') throw new Error('Not an SVG file');
  const shapes = [];
  const walk = (el, m, inheritedRule, inheritedFill) => {
    const tag = el.localName || el.nodeName;
    if (SKIP.has(tag)) return;
    const mm = mul(m, parseTransform(el.getAttribute && el.getAttribute('transform')));
    const rule = (el.getAttribute && styleProp(el, 'fill-rule')) || inheritedRule;
    const fill = (el.getAttribute && styleProp(el, 'fill')) || inheritedFill;
    const polys = elementPolys(el);
    if (polys.length && fill !== 'none') {
      shapes.push({
        polygons: polys.map((p) => p.map((pt) => apply(mm, pt))),
        fillRule: rule === 'evenodd' ? 'EvenOdd' : 'NonZero',
      });
    }
    for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) walk(c, mm, rule, fill);
  };
  walk(root, I, 'nonzero', null);
  if (!shapes.length) throw new Error('No filled shapes found in SVG (stroke-only artwork must be converted to paths)');
  return shapes;
}

// "What is pitch?" illustrations as SVG strings, generated from the current values.
// Only numbers we compute are interpolated, so the markup is safe to inject.
// Colours come from CSS custom properties so the drawings follow light/dark mode.

const f = (v) => +v.toFixed(1);

// one thread tooth profile per pitch (ISO 60°): half root, flank, crest, flank, half root
function profilePoints(x0, x1, P, yRoot, depth, dir = -1) {
  const pts = [];
  const yc = yRoot + dir * depth;
  for (let x = x0; x + P <= x1 + 1e-6; x += P) {  // whole teeth only
    pts.push([x, yRoot], [x + P / 8, yRoot], [x + P / 8 + 0.3125 * P, yc], [x + P / 8 + 0.4375 * P, yc], [x + 0.875 * P, yRoot], [x + P, yRoot]);
  }
  return pts;
}
const pts2str = (pts) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

const arrowDefs = `
<defs>
  <marker id="ph-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,1 L9,5 L0,9 z" class="ph-dimfill"/>
  </marker>
  <marker id="ph-arr-acc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,1 L9,5 L0,9 z" class="ph-accfill"/>
  </marker>
</defs>`;

// ---------------------------------------------------------------- 1. profile, to scale
function profileSVG(pitch) {
  const P = 80, d = 0.5413 * P, x0 = 20, x1 = 340, yR = 120, yC = yR - d;
  const pts = [...profilePoints(x0, x1, P, yR, d), [x1, 152], [x0, 152]];
  const crest = (k) => x0 + P * k + P / 2;          // crest centres
  const apexX = x0 + P * 2, apexY = yR + (P / 8) * (d / (0.3125 * P)); // flanks of groove 1|2 extended
  const r = 40, a = (deg) => [apexX + r * Math.cos((deg * Math.PI) / 180), apexY + r * Math.sin((deg * Math.PI) / 180)];
  const [lx, ly] = a(240), [rx, ry] = a(300);
  const depthMm = (0.5413 * pitch).toFixed(2);
  return `
<svg viewBox="0 0 440 170" role="img" aria-label="Thread cross-section showing pitch ${pitch} mm, depth ${depthMm} mm and the 60 degree angle">
  ${arrowDefs}
  <polygon points="${pts2str(pts)}" class="ph-solid"/>
  <text x="180" y="143" text-anchor="middle" class="ph-on-solid">cap wall (solid plastic)</text>

  <!-- pitch dimension -->
  <line x1="${crest(1)}" y1="${f(yC - 4)}" x2="${crest(1)}" y2="36" class="ph-ext"/>
  <line x1="${crest(2)}" y1="${f(yC - 4)}" x2="${crest(2)}" y2="36" class="ph-ext"/>
  <line x1="${crest(1) + 2}" y1="42" x2="${crest(2) - 2}" y2="42" class="ph-acc" marker-start="url(#ph-arr-acc)" marker-end="url(#ph-arr-acc)"/>
  <text x="${(crest(1) + crest(2)) / 2}" y="30" text-anchor="middle" class="ph-acc-text">pitch = ${pitch} mm</text>

  <!-- depth dimension -->
  <line x1="${crest(3) + P * 0.07}" y1="${f(yC)}" x2="372" y2="${f(yC)}" class="ph-ext"/>
  <line x1="${x1}" y1="${yR}" x2="372" y2="${yR}" class="ph-ext"/>
  <line x1="366" y1="${f(yC + 2)}" x2="366" y2="${yR - 2}" class="ph-dim" marker-start="url(#ph-arr)" marker-end="url(#ph-arr)"/>
  <text x="376" y="${f((yC + yR) / 2 - 3)}" class="ph-label">depth</text>
  <text x="376" y="${f((yC + yR) / 2 + 11)}" class="ph-label">${depthMm} mm</text>

  <!-- 60 degree angle -->
  <line x1="${f(apexX - P / 8)}" y1="${yR}" x2="${f(apexX)}" y2="${f(apexY)}" class="ph-ext"/>
  <line x1="${f(apexX + P / 8)}" y1="${yR}" x2="${f(apexX)}" y2="${f(apexY)}" class="ph-ext"/>
  <path d="M${f(lx)},${f(ly)} A${r},${r} 0 0 1 ${f(rx)},${f(ry)}" class="ph-dim"/>
  <text x="${apexX}" y="${f(apexY - r - 5)}" text-anchor="middle" class="ph-label">60°</text>

  <!-- names -->
  <text x="${crest(0)}" y="${f(yC - 8)}" text-anchor="middle" class="ph-muted">crest</text>
  <text x="${x0 + P}" y="${yR - 6}" text-anchor="middle" class="ph-muted">root</text>
</svg>`;
}

// ---------------------------------------------------------------- 2. one turn = one pitch
function turnSVG(pitch) {
  const L = 130, R = 290, top = 34, bot = 166, P = 40, half = P / 2;
  const lines = [];
  const teeth = [];
  for (let yl = bot - 6; yl - half > top + 2; yl -= P) {
    lines.push(`<line x1="${L}" y1="${yl}" x2="${R}" y2="${yl - half}" class="ph-ridge"/>`);
    teeth.push(`<polygon points="${L},${yl - 5} ${L - 7},${yl} ${L},${yl + 5}" class="ph-solid"/>`);
    teeth.push(`<polygon points="${R},${yl - half - 5} ${R + 7},${yl - half} ${R},${yl - half + 5}" class="ph-solid"/>`);
  }
  const yA = bot - 6 - P;           // highlighted ridge: starts here on the left...
  const yB = yA - P;                // ...and is back on the left one pitch higher
  const knurl = Array.from({ length: 22 }, (_, i) => `<line x1="${102 + i * 10.3}" y1="${bot + 2}" x2="${102 + i * 10.3}" y2="${bot + 20}" class="ph-knurl"/>`).join('');
  return `
<svg viewBox="0 0 440 210" role="img" aria-label="Side view: after one full turn a thread ridge is one pitch further along. The grip ridges on the flange are separate.">
  ${arrowDefs}
  <rect x="${L}" y="${top}" width="${R - L}" height="${bot - top}" class="ph-body"/>
  ${teeth.join('')}
  ${lines.join('')}
  <!-- highlighted ridge: front, behind (dashed), front again -->
  <line x1="${L}" y1="${yA}" x2="${R}" y2="${yA - half}" class="ph-acc-ridge"/>
  <path d="M${R},${yA - half} C${R + 40},${yA - half - 4} ${R + 40},${yB + 4} ${R},${yB - 2}" class="ph-acc-dash" marker-end="url(#ph-arr-acc)"/>
  <line x1="${L}" y1="${yB}" x2="${R}" y2="${yB - half}" class="ph-acc-ridge"/>
  <circle cx="${L}" cy="${yA}" r="4.5" class="ph-accfill"/>
  <circle cx="${L}" cy="${yB}" r="4.5" class="ph-accfill"/>
  <text x="${R + 40}" y="${yA - P * 0.75 + 4}" class="ph-acc-text">goes round</text>
  <text x="${R + 40}" y="${yA - P * 0.75 + 18}" class="ph-acc-text">the back</text>

  <!-- pitch dimension on the left -->
  <line x1="${L - 8}" y1="${yA}" x2="78" y2="${yA}" class="ph-ext"/>
  <line x1="${L - 8}" y1="${yB}" x2="78" y2="${yB}" class="ph-ext"/>
  <line x1="86" y1="${yA - 2}" x2="86" y2="${yB + 2}" class="ph-acc" marker-start="url(#ph-arr-acc)" marker-end="url(#ph-arr-acc)"/>
  <text x="74" y="${yB + P / 2 - 2}" text-anchor="end" class="ph-acc-text">1 turn =</text>
  <text x="74" y="${yB + P / 2 + 12}" text-anchor="end" class="ph-acc-text">${pitch} mm</text>

  <!-- into the lens -->
  <line x1="${(L + R) / 2}" y1="${top - 4}" x2="${(L + R) / 2}" y2="8" class="ph-dim" marker-end="url(#ph-arr)"/>
  <text x="${(L + R) / 2 + 8}" y="18" class="ph-muted">screws into the lens</text>

  <!-- grip flange -->
  <rect x="100" y="${bot}" width="${440 - 200}" height="24" rx="3" class="ph-solid"/>
  ${knurl}
  <text x="${440 - 92}" y="${bot + 16}" class="ph-muted">grip ridges:</text>
  <text x="${440 - 92}" y="${bot + 30}" class="ph-muted">not the thread</text>
  <text x="14" y="${top + 6}" class="ph-label">THREAD</text>
</svg>`;
}

// ---------------------------------------------------------------- 3. match vs mismatch
function matchPanel(y, capP, lensP, ok, title) {
  const d = 0.5413 * 40, x0 = 14, x1 = 426;
  const capRoot = y + 22, lensRoot = capRoot + d + 2;
  const cap = [...profilePoints(x0, x1, capP, capRoot, d, +1), [x1, capRoot], [x1, y + 6], [x0, y + 6]];
  // lens teeth sit between cap teeth when the pitch matches
  const lens = [...profilePoints(x0 + capP / 2, x1, lensP, lensRoot, d, -1)];
  const lensPoly = [[x0, lensRoot], ...lens, [x1, lensRoot], [x1, lensRoot + 16], [x0, lensRoot + 16]];
  const marks = [];
  if (!ok) {
    // flag lens crests that land on a cap crest
    for (let x = x0 + capP / 2 + lensP / 2; x < x1; x += lensP) {
      const k = Math.round((x - x0 - capP / 2) / capP);
      const dist = Math.abs(x - (x0 + capP / 2 + k * capP));
      if (dist < capP * 0.32) marks.push(`<text x="${f(x)}" y="${f(lensRoot + 13)}" text-anchor="middle" class="ph-bad-mark">✕</text>`);
    }
  }
  return `
  <text x="${x0}" y="${y}" class="${ok ? 'ph-good' : 'ph-bad'}">${title}</text>
  <polygon points="${pts2str(cap)}" class="ph-solid ph-trans"/>
  <polygon points="${pts2str(lensPoly)}" class="ph-lens ph-trans"/>
  ${marks.join('')}`;
}

function matchSVG() {
  return `
<svg viewBox="0 0 440 200" role="img" aria-label="Matching pitch nests cleanly; a different pitch makes ridges collide">
  ${matchPanel(14, 40, 40, true, '✓ Same pitch (0.75 cap, 0.75 lens): ridges drop into the grooves')}
  ${matchPanel(112, 40, 40 * (1.0 / 0.75), false, '✕ Different pitch (0.75 cap, 1.0 lens): ridges hit ridges and jam')}
  <g class="ph-legend">
    <rect x="292" y="182" width="12" height="10" class="ph-solid"/><text x="308" y="191" class="ph-muted">cap</text>
    <rect x="344" y="182" width="12" height="10" class="ph-lens"/><text x="360" y="191" class="ph-muted">lens</text>
  </g>
</svg>`;
}

// ---------------------------------------------------------------- 4. where to look
function lensSVG(size, pitch) {
  const s = Number.isFinite(size) ? size : 52;
  const pt = pitch === 1 ? '1.0' : String(pitch);
  return `
<svg viewBox="0 0 440 170" role="img" aria-label="Front of a lens: the size is printed on the front ring as a diameter symbol followed by the number">
  <defs><path id="ph-ring" d="M85,85 m-62,0 a62,62 0 1,1 124,0 a62,62 0 1,1 -124,0"/></defs>
  <circle cx="85" cy="85" r="76" class="ph-solid"/>
  <circle cx="85" cy="85" r="52" class="ph-glass"/>
  <circle cx="85" cy="85" r="30" class="ph-glass2"/>
  <text class="ph-ring-text"><textPath href="#ph-ring" startOffset="2%">50mm 1:1.8 · <tspan class="ph-ring-hl">⌀${s}</tspan> · LENS</textPath></text>
  <text x="182" y="48" class="ph-label">Look on the front ring or the lens cap:</text>
  <text x="182" y="72" class="ph-acc-text">⌀${s}  →  size = ${s} mm</text>
  <text x="182" y="100" class="ph-label">The pitch is rarely printed on the lens.</text>
  <text x="182" y="118" class="ph-muted">43–82 mm: almost always 0.75</text>
  <text x="182" y="136" class="ph-muted">Filters/specs may say M${s}×${pt}</text>
  <text x="182" y="154" class="ph-muted">(the number after × is the pitch)</text>
</svg>`;
}

export function pitchFigures({ pitch, size }) {
  const p = Number.isFinite(pitch) ? pitch : 0.75;
  return { profile: profileSVG(p), turn: turnSVG(p), match: matchSVG(), lens: lensSVG(size, p) };
}

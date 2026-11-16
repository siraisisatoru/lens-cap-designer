import { useMemo } from 'react';
import { pitchFigures } from '../lib/pitchFigures.js';
import { VARIANTS } from './Controls.jsx';

// ---------------------------------------------------------------- variant schematics (side sections)
const Lens = () => <text x="100" y="12" textAnchor="middle" className="ph-muted">lens side ↑</text>;
const Tube = ({ x, y, h, flip }) => {
  // threaded wall: zig-zag on the outside
  const w = 12, teeth = Math.floor(h / 6);
  const out = flip ? x : x + w;
  const d = flip ? -4 : 4;
  let p = `M${flip ? x + w : x},${y} L${out},${y}`;
  for (let i = 0; i < teeth; i++) p += ` L${out + d},${y + i * 6 + 3} L${out},${y + i * 6 + 6}`;
  p += ` L${out},${y + h} L${flip ? x + w : x},${y + h} Z`;
  return <path d={p} className="ph-solid" />;
};

const SCHEMATICS = {
  solid: (
    <svg viewBox="0 0 200 100" aria-hidden="true">
      <Lens />
      <Tube x={42} y={24} h={42} flip />
      <Tube x={146} y={24} h={42} />
      <rect x="22" y="66" width="68" height="12" rx="2" className="ph-solid" />
      <rect x="110" y="66" width="68" height="12" rx="2" className="ph-solid" />
      <text x="100" y="96" textAnchor="middle" className="ph-acc-text">shape cut-out</text>
      <line x1="100" y1="86" x2="100" y2="74" className="ph-acc" />
    </svg>
  ),
  rotating: (
    <svg viewBox="0 0 200 100" aria-hidden="true">
      <Lens />
      <Tube x={44} y={20} h={30} flip />
      <Tube x={144} y={20} h={30} />
      <rect x="20" y="50" width="36" height="16" rx="2" className="ph-solid" />
      <rect x="144" y="50" width="36" height="16" rx="2" className="ph-solid" />
      <rect x="20" y="70" width="70" height="10" rx="2" className="ph-accfill" />
      <rect x="110" y="70" width="70" height="10" rx="2" className="ph-accfill" />
      <rect x="58" y="52" width="6" height="18" className="ph-accfill" />
      <rect x="136" y="52" width="6" height="18" className="ph-accfill" />
      <path d="M60,92 Q100,104 140,92" className="ph-acc" markerEnd="url(#sch-arr)" />
      <defs><marker id="sch-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L9,5 L0,9 z" className="ph-accfill" /></marker></defs>
    </svg>
  ),
  slot: (
    <svg viewBox="0 0 200 100" aria-hidden="true">
      <Lens />
      <Tube x={44} y={20} h={34} flip />
      <Tube x={144} y={20} h={34} />
      <rect x="14" y="54" width="42" height="10" rx="2" className="ph-solid" />
      <rect x="144" y="54" width="42" height="10" rx="2" className="ph-solid" />
      <rect x="14" y="72" width="80" height="10" rx="2" className="ph-accfill" />
      <rect x="106" y="72" width="80" height="10" rx="2" className="ph-accfill" />
      <rect x="14" y="64" width="10" height="8" className="ph-accfill" />
      <rect x="176" y="64" width="10" height="8" className="ph-accfill" />
      <rect x="30" y="66" width="168" height="4" className="ph-card" />
      <text x="196" y="96" textAnchor="end" className="ph-muted">card slides through</text>
    </svg>
  ),
};

export function VariantsSection({ current, onPick }) {
  const details = {
    solid: ['1 part', 'The simplest and quickest print. Change shape = print another cap.'],
    rotating: ['2 parts', 'Screw the ring on once, then aim the shape by turning the dial. A notch on the dial marks the shape\'s top.'],
    slot: ['3 parts + paper', 'One cap, any number of shapes. Put several sizes on one strip, or download a paper template and cut your own.'],
  };
  return (
    <section id="variants" className="page-section">
      <div className="section-head">
        <h2>Three ways to build it</h2>
        <p>Every variant prints without supports, in the orientation it's placed on the plate.</p>
      </div>
      <div className="cards3">
        {VARIANTS.map((v) => (
          <article key={v.id} className={`vcard ${current === v.id ? 'sel' : ''}`}>
            <div className="vcard-fig">{SCHEMATICS[v.id]}</div>
            <h3>{v.title} <span className="pill">{details[v.id][0]}</span></h3>
            <p>{details[v.id][1]}</p>
            <button type="button" className="btn ghost" onClick={() => onPick(v.id)}>
              {current === v.id ? 'Selected' : 'Use this one'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- pitch explainer
function Figure({ svg, children }) {
  return (
    <figure className="fig">
      <div className="fig-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>{children}</figcaption>
    </figure>
  );
}

export function PitchSection({ pitch, size }) {
  const f = useMemo(() => pitchFigures({ pitch, size }), [pitch, size]);
  const turns = Math.round(3 / pitch);
  return (
    <section id="pitch" className="page-section">
      <div className="section-head">
        <h2>What is pitch?</h2>
        <p>The one number that decides whether the cap screws onto your lens. The drawings follow your current settings.</p>
      </div>
      <div className="figs">
        <Figure svg={f.profile}>
          <b>The distance from one thread ridge to the next.</b> A slice through the cap's thread, drawn to scale. The lens has matching V-grooves inside its front ring.
        </Figure>
        <Figure svg={f.turn}>
          <b>Also how far the cap moves per turn.</b> The thread is one ridge spiralling around, so a 3 mm thread at {pitch} mm takes about {turns} turns. The grip ridges on the outside have nothing to do with pitch.
        </Figure>
        <Figure svg={f.match}>
          <b>It must match the lens exactly.</b> With the wrong pitch the cap jams within a turn. If the pitch is right but the fit is tight or loose, change <i>Thread clearance</i> instead.
        </Figure>
        <Figure svg={f.lens}>
          <b>Pitch goes with size, not brand.</b> Every 52 mm lens takes 0.75, whoever made it. Only sizes under 43 mm and over 82 mm vary, which is why the designer warns you about those.
        </Figure>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- printing
export function PrintingSection() {
  return (
    <section id="printing" className="page-section">
      <div className="section-head">
        <h2>Printing</h2>
        <p>The 3MF opens in Bambu Studio with the parts already placed and named. It also works in Orca Slicer and PrusaSlicer.</p>
      </div>
      <div className="two-col">
        <ul className="ticks">
          <li><b>Filament:</b> black or another opaque colour, matte if you have it. PLA or PETG both work.</li>
          <li><b>Layer height:</b> 0.08–0.12 mm. The thread ridges are only about 0.4 mm tall.</li>
          <li><b>Supports:</b> none. Face plates print face-down; threaded parts print shoulder-down with the thread up.</li>
          <li><b>Assembly:</b> rotating dial: push it into the ring until it clicks. Slot: press the cover's four pegs into the base (a drop of glue is optional).</li>
        </ul>
        <table className="tune">
          <thead><tr><th>If…</th><th>Change</th></tr></thead>
          <tbody>
            <tr><td>The cap won't start or is very tight</td><td>Thread clearance 0.3 → 0.4–0.5</td></tr>
            <tr><td>It wobbles or falls off</td><td>Thread clearance 0.3 → 0.2</td></tr>
            <tr><td>It jams after half a turn</td><td>Wrong pitch: check your lens</td></tr>
            <tr><td>Light glows through the plate</td><td>Plate thickness 2.0 → 2.4, or darker filament</td></tr>
            <tr><td>The thread bottoms out on the lens</td><td>Thread length 3 → 2</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- FAQ
const FAQ = [
  ['Which way round will the shape appear in my photos?', 'For background bokeh the photo shows the shape as seen from the camera side. The designer accounts for that, so a heart drawn upright appears upright. Foreground bokeh is flipped.'],
  ['How big should the shape be?', 'Smaller than the lens\'s open aperture, or the lens\'s own round aperture wins. 10–20 mm suits a 50 mm f/1.8 used wide open. Smaller shapes give a cleaner outline but less light.'],
  ['Will it fit my lens?', 'Look for ⌀ followed by a number on the lens front ring or the lens cap: that is the size. For 43–82 mm the pitch is almost always 0.75. See "What is pitch?" above.'],
  ['Is my SVG uploaded anywhere?', 'No. Everything runs in your browser: the geometry, the preview and the 3MF file. Nothing is sent to a server.'],
  ['What makes a good SVG?', 'A filled shape (not just a stroke) with no very thin parts. Strokes are ignored, so convert them to paths first. Holes such as the middle of a ring are kept.'],
];

export function FaqSection() {
  return (
    <section id="faq" className="page-section">
      <div className="section-head"><h2>Questions</h2></div>
      <div className="faq">
        {FAQ.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </div>
    </section>
  );
}

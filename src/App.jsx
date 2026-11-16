import { useEffect, useMemo, useState } from 'react';
import Controls, { VARIANTS } from './components/Controls.jsx';
import Viewer from './components/Viewer.jsx';
import { VariantsSection, PitchSection, PrintingSection, FaqSection } from './components/Sections.jsx';
import { loadEngine } from './lib/engine.js';
import { generate } from './lib/generate.js';
import { downloadAll, downloadEach, downloadCardTemplate } from './lib/downloads.js';
import { FILTER_SIZES, defaultPitch } from './lib/filters.js';
import { PRESETS } from './lib/presets.js';

const REPO = 'https://github.com/siraisisatoru/lens-cap-designer';

// ---------------------------------------------------------------- initial state (+ URL presets)
// e.g. ?size=67&variant=rotating&shape=star&shapeSize=18&view=exploded
function initialState() {
  const q = new URLSearchParams(window.location.search);
  const s = {
    sizeChoice: '52', customSize: '52', pitch: 0.75,
    shape: { name: 'heart', svg: PRESETS.heart },
    shapeSize: 15, rotation: 0, variant: 'solid',
    clearance: '0.3', threadLen: '3', plate: '2', cardThickness: '0.6', cardScales: '100', bed: '180,180',
    view: 'plate',
  };
  if (q.has('size')) {
    const v = q.get('size');
    if (FILTER_SIZES.some(([x]) => String(x) === v)) s.sizeChoice = v;
    else { s.sizeChoice = 'custom'; s.customSize = v; }
    s.pitch = defaultPitch(parseFloat(v));
  }
  if (q.has('pitch')) s.pitch = parseFloat(q.get('pitch'));
  if (VARIANTS.some((v) => v.id === q.get('variant'))) s.variant = q.get('variant');
  const shape = q.get('shape');
  if (shape && PRESETS[shape]) s.shape = { name: shape, svg: PRESETS[shape] };
  for (const k of ['shapeSize', 'rotation']) if (q.has(k)) s[k] = parseFloat(q.get(k));
  for (const k of ['clearance', 'threadLen', 'plate', 'cardThickness', 'cardScales']) if (q.has(k)) s[k] = q.get(k);
  if (q.get('view') === 'exploded') s.view = 'exploded';
  return s;
}

const NOTES = {
  solid: ['Print face-down as placed, in black or another opaque filament. No supports.', 'Use 0.08–0.12 mm layers: the thread is very fine.'],
  rotating: ['Ring: flange down. Dial: face-down. No supports.', 'Screw the ring onto the lens, push the dial in until it clicks, then turn it to aim the shape.'],
  slot: ['Base: flange down. Cover: face-down. Card: flat. No supports.', 'Press the cover pegs into the base. The ribbed end of the card is the grip; its ribbed face goes toward the lens.'],
};

export default function App() {
  const [s, setS] = useState(initialState);
  const [engine, setEngine] = useState(null);
  const [engineError, setEngineError] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const size = s.sizeChoice === 'custom' ? parseFloat(s.customSize) : parseFloat(s.sizeChoice);
  const bed = useMemo(() => s.bed.split(',').map(Number), [s.bed]);

  // setters: picking a size also picks its usual pitch
  const set = useMemo(() => {
    const field = (k) => (v) => setS((o) => ({ ...o, [k]: v }));
    const out = {};
    for (const k of Object.keys(initialState())) out[k] = field(k);
    out.sizeChoice = (v) => setS((o) => ({ ...o, sizeChoice: v, pitch: defaultPitch(v === 'custom' ? parseFloat(o.customSize) : parseFloat(v)) }));
    out.customSize = (v) => setS((o) => ({ ...o, customSize: v, pitch: defaultPitch(parseFloat(v)) }));
    return out;
  }, []);

  const params = useMemo(() => ({
    size,
    pitch: s.pitch,
    clearance: parseFloat(s.clearance),
    threadLen: parseFloat(s.threadLen),
    plate: parseFloat(s.plate),
    shapeSize: s.shapeSize,
    shapeRotation: s.rotation,
    cardThickness: parseFloat(s.cardThickness),
    cardScales: s.cardScales.split(/[ ,;]+/).map(Number).filter((v) => v > 0 && v <= 300),
  }), [size, s.pitch, s.clearance, s.threadLen, s.plate, s.shapeSize, s.rotation, s.cardThickness, s.cardScales]);

  useEffect(() => {
    loadEngine().then(setEngine).catch((e) => setEngineError(`Couldn't load the geometry engine: ${e.message}`));
    if (new URLSearchParams(window.location.search).get('help') === 'pitch') {
      setTimeout(() => document.getElementById('pitch')?.scrollIntoView(), 300);
    }
  }, []);

  // regenerate (debounced) whenever an input changes
  useEffect(() => {
    if (!engine) return;
    const t = setTimeout(() => {
      try {
        if (!Number.isFinite(params.size) || params.size < 20) throw new Error('Enter a filter size of at least 20 mm');
        setResult(generate(engine, { variant: s.variant, params, svg: s.shape.svg, bed }));
        setError('');
      } catch (e) {
        console.error(e);
        setError(e.message);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [engine, params, s.variant, s.shape, bed]);

  const pickVariant = (v) => {
    set.variant(v);
    document.getElementById('design')?.scrollIntoView({ behavior: 'smooth' });
  };

  const status = engineError || error || (!engine ? 'Loading geometry engine…' : result ? `${result.parts.length} part${result.parts.length > 1 ? 's' : ''} · ${result.ms} ms` : 'Building…');
  const ready = result && !error;

  return (
    <>
      <header className="nav">
        <a className="brand" href="#top" aria-label="Lens Cap Designer, back to top">
          <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" className="brand-ring" /><path d="M16 23.5c-5-3.6-7.6-6.2-7.6-9.3 0-2.3 1.7-4 3.9-4 1.6 0 2.9.9 3.7 2.2.8-1.3 2.1-2.2 3.7-2.2 2.2 0 3.9 1.7 3.9 4 0 3.1-2.6 5.7-7.6 9.3z" className="brand-heart" /></svg>
          Lens Cap Designer
        </a>
        <nav aria-label="Sections">
          <a href="#design">Design</a>
          <a href="#variants">Variants</a>
          <a href="#pitch">Pitch</a>
          <a href="#printing">Printing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="gh" href={REPO} target="_blank" rel="noreferrer">GitHub</a>
      </header>

      <main id="top">
        <section className="intro">
          <h1>Shape your bokeh.</h1>
          <p>Design a screw-on lens cap with a cut-out shape, so out-of-focus lights in your photos turn into hearts, stars or anything you draw. Pick your filter size and a shape, then download a 3MF that's ready to print.</p>
        </section>

        <section id="design" className="designer" aria-label="Designer">
          <aside className="panel">
            <Controls s={s} set={set} size={size} />
          </aside>

          <div className="stage">
            <div className="viewer-card">
              <div className="viewer-bar">
                <div className="seg" role="tablist" aria-label="View">
                  {[['plate', 'Print plate'], ['exploded', 'Exploded']].map(([v, label]) => (
                    <button key={v} type="button" role="tab" aria-selected={s.view === v} className={s.view === v ? 'sel' : ''} onClick={() => set.view(v)}>{label}</button>
                  ))}
                </div>
                <span className={`status ${engineError || error ? 'err' : ''}`} role="status">{status}</span>
              </div>
              <Viewer parts={result?.parts} view={s.view} bed={bed} frameKey={`${size}|${s.variant}`} />
            </div>

            <div className="actions">
              <button type="button" className="btn primary" disabled={!ready} onClick={() => downloadAll(result, s.shape.name)}>Download 3MF</button>
              {ready && result.parts.length > 1 && (
                <button type="button" className="btn ghost" onClick={() => downloadEach(result, s.shape.name, bed)}>One 3MF per part</button>
              )}
              {ready && result.variant === 'slot' && (
                <button type="button" className="btn ghost" onClick={() => downloadCardTemplate(result, s.shape.name)}>Paper card template (SVG)</button>
              )}
            </div>

            {ready && (
              <ul className="notes">
                {!result.fits && <li className="err"><b>These parts don't all fit on one plate.</b> Use "One 3MF per part", or choose a bigger bed under Advanced.</li>}
                {NOTES[result.variant].map((n) => <li key={n}>{n}</li>)}
                {result.parts.map((p) => <li key={p.name}><b>{p.name}</b>: {p.note}</li>)}
              </ul>
            )}
          </div>
        </section>

        <VariantsSection current={s.variant} onPick={pickVariant} />
        <PitchSection pitch={s.pitch} size={size} />
        <PrintingSection />
        <FaqSection />
      </main>

      <footer className="footer">
        <span>Lens Cap Designer · MIT licensed · runs entirely in your browser</span>
        <a href={REPO} target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>
    </>
  );
}

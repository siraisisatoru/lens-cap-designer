import { useRef } from 'react';
import { FILTER_SIZES } from '../lib/filters.js';
import { PRESETS } from '../lib/presets.js';

export const VARIANTS = [
  { id: 'solid', title: 'One-piece cap', blurb: 'Screws on. The shape is fixed.' },
  { id: 'rotating', title: 'Rotating dial', blurb: 'The ring stays on the lens; the dial clicks in and turns to aim the shape.' },
  { id: 'slot', title: 'Slot + cards', blurb: 'Slide a printed or paper card through the cap to change the shape.' },
];

const fmtPitch = (v) => (v === 1 ? '1.0' : String(v));

export function pitchWarning(size, pitch) {
  if (!Number.isFinite(size)) return '';
  if (size < 43) return `Lenses under 43 mm don't all use the same pitch (0.5 and 0.75 both exist). Check the marking on your lens, e.g. M${size}×0.5, before printing.`;
  if (size > 82) return `Lenses over 82 mm are usually 1.0 pitch, but not always. Check the marking on your lens, e.g. M${size}×1.0, before printing.`;
  if (pitch !== 0.75) return `Lenses from 43 to 82 mm are almost always 0.75 pitch. Only use ${fmtPitch(pitch)} if your lens is marked M${size}×${fmtPitch(pitch)}.`;
  return '';
}

function Step({ n, title, children }) {
  return (
    <section className="step">
      <h2><span className="step-n">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

function ThreadStep({ s, set, size }) {
  const warn = pitchWarning(size, s.pitch);
  return (
    <Step n="1" title="Filter thread">
      <div className="field-row">
        <label className="field">
          <span>Size</span>
          <select value={s.sizeChoice} onChange={(e) => set.sizeChoice(e.target.value)}>
            {FILTER_SIZES.map(([v]) => <option key={v} value={String(v)}>{v} mm</option>)}
            <option value="custom">Custom…</option>
          </select>
        </label>
        <label className="field">
          <span>Pitch</span>
          <select value={String(s.pitch)} onChange={(e) => set.pitch(parseFloat(e.target.value))}>
            <option value="0.5">0.5 mm</option>
            <option value="0.75">0.75 mm</option>
            <option value="1">1.0 mm</option>
          </select>
        </label>
      </div>
      {s.sizeChoice === 'custom' && (
        <label className="field">
          <span>Custom size (mm)</span>
          <input type="number" min="20" max="130" step="0.5" value={s.customSize} onChange={(e) => set.customSize(e.target.value)} />
        </label>
      )}
      {warn && <p className="warn" role="status">{warn}</p>}
      <a className="link" href="#pitch">ⓘ What is pitch?</a>
    </Step>
  );
}

function ShapeStep({ s, set }) {
  const fileRef = useRef(null);
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const svg = await f.text();
    // thumbnail via <img> so an uploaded SVG can never run script in the page
    const thumb = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    set.shape({ name: f.name.replace(/\.svg$/i, ''), svg, thumb, uploaded: true });
    e.target.value = '';
  };
  return (
    <Step n="2" title="Shape">
      <div className="shapes" role="radiogroup" aria-label="Shape">
        {Object.entries(PRESETS).map(([name, svg]) => (
          <button
            key={name} type="button" role="radio" aria-checked={s.shape.name === name} title={name}
            className={s.shape.name === name && !s.shape.uploaded ? 'sel' : ''}
            onClick={() => set.shape({ name, svg })}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ))}
        <button type="button" className={`upload ${s.shape.uploaded ? 'sel' : ''}`} onClick={() => fileRef.current.click()} title="Upload your own SVG">
          {s.shape.uploaded ? <img src={s.shape.thumb} alt={s.shape.name} /> : <span>Upload<br />SVG</span>}
        </button>
        <input ref={fileRef} type="file" accept=".svg,image/svg+xml" hidden onChange={onFile} />
      </div>
      <label className="field">
        <span>Shape size <output>{s.shapeSize} mm</output></span>
        <input type="range" min="4" max="60" step="0.5" value={s.shapeSize} onChange={(e) => set.shapeSize(parseFloat(e.target.value))} />
      </label>
      <label className="field">
        <span>Rotation <output>{s.rotation}°</output></span>
        <input type="range" min="-180" max="180" step="5" value={s.rotation} onChange={(e) => set.rotation(parseFloat(e.target.value))} />
      </label>
      <p className="hint">The shape shows in the bokeh when it's smaller than the lens's open aperture: try 10–20 mm on a 50 mm f/1.8, wide open.</p>
    </Step>
  );
}

function VariantStep({ s, set }) {
  return (
    <Step n="3" title="Variant">
      <div className="variants" role="radiogroup" aria-label="Variant">
        {VARIANTS.map((v) => (
          <label key={v.id} className={`variant ${s.variant === v.id ? 'sel' : ''}`}>
            <input type="radio" name="variant" value={v.id} checked={s.variant === v.id} onChange={() => set.variant(v.id)} />
            <span><b>{v.title}</b><small>{v.blurb}</small></span>
          </label>
        ))}
      </div>
    </Step>
  );
}

function Advanced({ s, set }) {
  const num = (k, props) => (
    <input type="number" value={s[k]} onChange={(e) => set[k](e.target.value)} {...props} />
  );
  return (
    <details className="advanced">
      <summary>Advanced settings</summary>
      <div className="adv-grid">
        <label className="field"><span>Thread clearance (mm, on diameter)</span>{num('clearance', { step: 0.05, min: 0, max: 1 })}</label>
        <label className="field"><span>Thread length (mm)</span>{num('threadLen', { step: 0.25, min: 1, max: 6 })}</label>
        <label className="field"><span>Face plate thickness (mm)</span>{num('plate', { step: 0.2, min: 1.2, max: 4 })}</label>
        <label className="field"><span>Card thickness (mm)</span>{num('cardThickness', { step: 0.05, min: 0.1, max: 2 })}</label>
        <label className="field wide">
          <span>Card shape sizes (%)</span>
          <input type="text" value={s.cardScales} onChange={(e) => set.cardScales(e.target.value)} />
          <small className="hint">e.g. <code>100, 70, 45</code> puts three sizes on one strip; slide it to change the size.</small>
        </label>
        <label className="field wide">
          <span>Printer bed</span>
          <select value={s.bed} onChange={(e) => set.bed(e.target.value)}>
            <option value="180,180">A1 mini (180 × 180)</option>
            <option value="256,256">A1 / P1 / X1 (256 × 256)</option>
            <option value="325,320">H2D (325 × 320)</option>
          </select>
        </label>
      </div>
    </details>
  );
}

export default function Controls(props) {
  return (
    <div className="controls">
      <ThreadStep {...props} />
      <ShapeStep {...props} />
      <VariantStep {...props} />
      <Advanced {...props} />
    </div>
  );
}

'use client';

import type { RoofLayout } from '@/lib/types';

/**
 * Visual picker for how the ONE continuous roof plane is oriented over the
 * combined coop+run footprint. Each option is a little 2.5-D diagram so the
 * choice is obvious at a glance instead of a wall of text. Selecting one drives
 * the real geometry, 3D model, cut list, and BOM.
 */

interface Option {
  id: RoofLayout;
  title: string;
  blurb: string;
  pros: string[];
  diagram: React.ReactNode;
}

// ---- Diagrams -------------------------------------------------------------
// Shared oblique look: length (z) runs right, width/depth (x) up-right, y is up.
const ROOF = '#7aa7c7';
const ROOF_EDGE = '#3f6d8c';
const WALL = '#d8c39a';
const WALL_EDGE = '#a97d47';
const GROUND = '#e7dcc4';
const ARROW = '#1f63eb';

/** Slope DOWN THE LENGTH: high over the coop (left), low at the far run (right). */
function LengthDiagram() {
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="Roof slopes down the length">
      {/* ground */}
      <polygon points="18,128 150,128 214,104 82,104" fill={GROUND} />
      {/* coop solid block (left, tall) */}
      <polygon points="18,128 18,74 82,50 82,104" fill={WALL} stroke={WALL_EDGE} strokeWidth="1.5" />
      <polygon points="18,74 40,66 40,120 18,128" fill={WALL} stroke={WALL_EDGE} strokeWidth="1.5" opacity="0.85" />
      {/* run posts (right, getting shorter) */}
      {[110, 140, 170].map((zx, i) => (
        <line key={i} x1={zx} y1={104 - i * 6} x2={zx} y2={128 - i * 8.5} stroke={WALL_EDGE} strokeWidth="2" />
      ))}
      {/* one continuous roof plane, high at left (coop) → low at right (run) */}
      <polygon points="10,66 74,42 220,80 156,104" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="1.6" opacity="0.9" />
      {/* downhill arrow along the length */}
      <line x1="60" y1="60" x2="180" y2="90" stroke={ARROW} strokeWidth="2.4" />
      <polygon points="180,90 170,84 172,93" fill={ARROW} />
      {/* snow sliding off the low end */}
      <path d="M196,92 l6,7 M204,95 l6,7" stroke="#9fb6c9" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Slope ACROSS THE WIDTH: high along the back long edge, low along the front. */
function WidthDiagram() {
  return (
    <svg viewBox="0 0 240 150" className="h-auto w-full" role="img" aria-label="Roof slopes across the width">
      {/* ground */}
      <polygon points="18,128 150,128 214,104 82,104" fill={GROUND} />
      {/* run posts along the low front eave — even height end to end */}
      {[92, 116, 140].map((px, i) => (
        <line key={i} x1={px} y1={92} x2={px} y2={128} stroke={WALL_EDGE} strokeWidth="2" />
      ))}
      {/* coop left end wall — trapezoid cross-section: low at front, high at back */}
      <polygon points="18,128 18,92 82,44 82,104" fill={WALL} stroke={WALL_EDGE} strokeWidth="1.5" />
      {/* coop front wall (faces viewer) for a bit of solidity */}
      <polygon points="18,128 50,128 50,92 18,92" fill={WALL} stroke={WALL_EDGE} strokeWidth="1.5" opacity="0.85" />
      {/* one continuous roof plane — high along the BACK edge, low along the FRONT */}
      <polygon points="12,90 156,90 222,40 78,40" fill={ROOF} stroke={ROOF_EDGE} strokeWidth="1.6" opacity="0.9" />
      {/* downhill arrow across the width (back → front) */}
      <line x1="148" y1="56" x2="118" y2="80" stroke={ARROW} strokeWidth="2.4" />
      <polygon points="118,80 131,76 124,69" fill={ARROW} />
      {/* snow sliding off the low front eave */}
      <path d="M102,92 l-5,9 M122,92 l-5,9 M142,92 l-5,9" stroke="#9fb6c9" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const OPTIONS: Option[] = [
  {
    id: 'length',
    title: 'Slopes down the length',
    blurb: 'One plane, high over the coop, dropping the whole way to the far run wall.',
    pros: ['Tall walk-in coop end', 'Long single slope', 'Far run end is lower / stoop'],
    diagram: <LengthDiagram />,
  },
  {
    id: 'width',
    title: 'Slopes across the width',
    blurb: 'One plane, high along one full-length side, low along the other — even end to end.',
    pros: ['Even walk-in height throughout', 'Steeper pitch (short slope)', 'Snow sheds off one long side'],
    diagram: <WidthDiagram />,
  },
];

export function RoofLayoutPicker({
  value,
  onChange,
}: {
  value: RoofLayout;
  onChange: (v: RoofLayout) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            className={`flex flex-col rounded-xl border-2 p-3 text-left transition ${
              selected
                ? 'border-blueprint-500 bg-blueprint-50 ring-2 ring-blueprint-200'
                : 'border-timber-200 bg-white hover:border-timber-300'
            }`}
          >
            <div className="mb-2 overflow-hidden rounded-lg bg-timber-50">{o.diagram}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-timber-900">{o.title}</span>
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] ${
                  selected ? 'border-blueprint-500 bg-blueprint-500 text-white' : 'border-timber-300 text-transparent'
                }`}
              >
                ✓
              </span>
            </div>
            <p className="mt-1 text-xs text-timber-600">{o.blurb}</p>
            <ul className="mt-2 space-y-0.5">
              {o.pros.map((p) => (
                <li key={p} className="text-[11px] text-timber-500">• {p}</li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

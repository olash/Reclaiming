/**
 * Adire motifs: the Reclaiming pattern language.
 *
 * Adire cloth is made of hand-drawn squares, each with its own motif, dyed in
 * indigo. These are drawn the same way: by "hand", with a seeded wobble so no
 * two lines are perfectly straight, and every render is the same (no
 * hydration mismatch).
 *
 * All motifs draw in currentColor on a 100×100 tile. They are decorative and
 * always aria-hidden.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

/** A wobbly polyline through points, as a smooth path. */
function wobble(points: Array<[number, number]>, r: () => number, amount = 0.9) {
  const p = points.map(([x, y]) => [x + (r() - 0.5) * amount * 2, y + (r() - 0.5) * amount * 2] as [number, number]);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(mx)} ${f(my)}`;
  }
  const last = p[p.length - 1];
  d += `L${f(last[0])} ${f(last[1])}`;
  return d;
}

function ring(cx: number, cy: number, radius: number, r: () => number, wob = 0.8) {
  const pts: Array<[number, number]> = [];
  const start = r() * Math.PI * 2;
  for (let i = 0; i <= 28; i++) {
    const a = start + (i / 28) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  return wobble(pts, r, wob);
}

type Draw = (r: () => number) => React.ReactNode;

const DRAW: Record<string, Draw> = {
  /** Ibadandun dots: market-day rows. */
  dots: (r) => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++)
        out.push(<circle key={`${i}-${j}`} cx={f(10 + j * 20 + (r() - 0.5) * 2.4)} cy={f(10 + i * 20 + (r() - 0.5) * 2.4)} r={f(3.4 + (r() - 0.5) * 1.4)} fill="currentColor" stroke="none" />);
    return out;
  },
  /** Oòrùn: the sun, concentric rings with rays. */
  sun: (r) => (
    <>
      {[9, 18, 27].map((rad) => <path key={rad} d={ring(50, 50, rad, r)} />)}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + (r() - 0.5) * 0.08;
        return <path key={i} d={wobble([[50 + Math.cos(a) * 35, 50 + Math.sin(a) * 35], [50 + Math.cos(a) * 45, 50 + Math.sin(a) * 45]], r, 0.6)} />;
      })}
      <circle cx="50" cy="50" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  /** Olókun: the river. */
  waves: (r) =>
    Array.from({ length: 6 }, (_, i) => {
      const y = 9 + i * 16.5;
      const pts: Array<[number, number]> = [];
      for (let x = -4; x <= 104; x += 6.75) pts.push([x, y + Math.sin((x / 100) * Math.PI * 4 + i * 0.6) * 4.2]);
      return <path key={i} d={wobble(pts, r, 0.7)} />;
    }),
  /** Ewé: leaves on a stem. Growth, family. */
  leaves: (r) => (
    <>
      <path d={wobble([[50, 96], [50, 70], [50, 40], [50, 4]], r, 1)} />
      {Array.from({ length: 5 }, (_, i) => {
        const y = 86 - i * 18;
        return (
          <React.Fragment key={i}>
            <path d={wobble([[50, y], [62, y - 12], [80, y - 15], [68, y - 3], [50, y]], r, 0.8)} />
            <path d={wobble([[50, y - 6], [38, y - 18], [20, y - 21], [32, y - 9], [50, y - 6]], r, 0.8)} />
          </React.Fragment>
        );
      })}
    </>
  ),
  /** Àkàbà: the ladder of zigzags. Steps, one at a time. */
  zigzag: (r) =>
    Array.from({ length: 5 }, (_, i) => {
      const y = 12 + i * 19;
      const pts: Array<[number, number]> = [];
      for (let k = 0; k <= 10; k++) pts.push([k * 10, y + (k % 2 ? -6 : 6)]);
      return <path key={i} d={wobble(pts, r, 0.8)} />;
    }),
  /** Ìgbín: the snail shell. Patience. */
  spiral: (r) => {
    const pts: Array<[number, number]> = [];
    for (let t = 0; t <= Math.PI * 7.2; t += 0.32) pts.push([50 + Math.cos(t) * (2 + t * 1.95), 50 + Math.sin(t) * (2 + t * 1.95)]);
    return <path d={wobble(pts, r, 0.6)} />;
  },
  /** Ìràwọ̀: stars and crosses, like stitched marks. */
  stitch: (r) => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const cx = 12.5 + j * 25;
        const cy = 12.5 + i * 25;
        const s = 6.5;
        out.push(
          <path key={`${i}-${j}`} d={(i + j) % 2 ? `${wobble([[cx - s, cy - s], [cx + s, cy + s]], r, 0.6)}${wobble([[cx + s, cy - s], [cx - s, cy + s]], r, 0.6)}` : `${wobble([[cx - s, cy], [cx + s, cy]], r, 0.6)}${wobble([[cx, cy - s], [cx, cy + s]], r, 0.6)}`} />,
        );
      }
    return out;
  },
  /** Concentric squares: the house, the inheritance. */
  house: (r) =>
    [40, 30, 20, 10].map((s) => (
      <path key={s} d={wobble([[50 - s, 50 - s], [50 + s, 50 - s], [50 + s, 50 + s], [50 - s, 50 + s], [50 - s, 50 - s]], r, 0.9)} />
    )),
};

export type MotifName = keyof typeof DRAW;
export const MOTIFS = Object.keys(DRAW) as MotifName[];

export function Motif({ name, seed = 1, className, strokeWidth = 2.6 }: { name: MotifName; seed?: number; className?: string; strokeWidth?: number }) {
  const r = rng(seed * 9973 + name.length * 31);
  return (
    <svg viewBox="0 0 100 100" className={cn('block', className)} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {DRAW[name](r)}
    </svg>
  );
}

/**
 * A patchwork of adire squares. The signature brand image: used in the
 * landing hero, the auth screens and empty states.
 */
export function AdireQuilt({
  tiles = ['sun', 'waves', 'dots', 'leaves', 'coin', 'zigzag', 'spiral', 'stitch', 'house'],
  cols = 3,
  className,
  tileClassName,
}: {
  tiles?: Array<MotifName | 'coin'>;
  cols?: number;
  className?: string;
  tileClassName?: string;
}) {
  return (
    <div className={cn('grid gap-[3px] bg-indigo-night/90 p-[3px]', className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-hidden="true">
      {tiles.map((t, i) =>
        t === 'coin' ? (
          <div key={i} className={cn('relative aspect-square bg-saffron', tileClassName)}>
            <Motif name="sun" seed={i + 4} className="absolute inset-[14%] text-indigo-night" strokeWidth={3} />
          </div>
        ) : (
          <div key={i} className={cn('aspect-square bg-indigo text-cotton/80', i % 4 === 1 && 'bg-indigo-night', tileClassName)}>
            <Motif name={t} seed={i + 1} className="size-full p-[9%]" />
          </div>
        ),
      )}
    </div>
  );
}

/** A full-bleed tiled motif for backgrounds (e.g. a band behind a heading). */
export function MotifBand({ name = 'waves', className, size = 72 }: { name?: MotifName; className?: string; size?: number }) {
  return (
    <div className={cn('pointer-events-none overflow-hidden', className)} aria-hidden="true">
      <div className="flex flex-wrap" style={{ width: '200%' }}>
        {Array.from({ length: 40 }, (_, i) => (
          <Motif key={i} name={name} seed={i + 3} className="shrink-0" strokeWidth={2.2} />
        )).map((m, i) => (
          <div key={i} style={{ width: size, height: size }}>{m}</div>
        ))}
      </div>
    </div>
  );
}

/** A hand-drawn underline that sits under one or two words in a heading. */
export function Underline({ children, className, color = 'text-saffron' }: { children: React.ReactNode; className?: string; color?: string }) {
  return (
    <span className={cn('relative inline-block whitespace-nowrap', className)}>
      <span className="relative z-10">{children}</span>
      <svg viewBox="0 0 300 24" preserveAspectRatio="none" className={cn('absolute -bottom-[0.12em] left-[-2%] z-0 h-[0.38em] w-[104%]', color)} aria-hidden="true" focusable="false">
        <path d="M4 15C60 7 130 5 196 8c34 1.6 66 4.6 98 9.4" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="animate-draw" />
      </svg>
    </span>
  );
}

/** A loose hand-drawn ring around a word or number. */
export function Circled({ children, className, color = 'text-clay' }: { children: React.ReactNode; className?: string; color?: string }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <span className="relative z-10">{children}</span>
      <svg viewBox="0 0 200 90" preserveAspectRatio="none" className={cn('absolute -inset-x-[14%] -inset-y-[22%] z-0 h-[144%] w-[128%]', color)} aria-hidden="true" focusable="false">
        <path d="M112 8C58 2 10 18 8 46c-2 28 46 40 98 38 52-2 88-18 86-42C190 18 150 6 96 10" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="animate-draw" />
      </svg>
    </span>
  );
}

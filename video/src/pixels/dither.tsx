// The film's signature transition: things appear and dissolve through the globe's own 4×4 Bayer
// dither, cell by cell, with a bright lilac front where the pixels are turning over.

import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { hash } from "../ease.ts";

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export type Sweep = "down" | "up" | "right" | "left" | "none" | { x: number; y: number };

/** When cell (i, j) of a cols × rows grid turns over, 0..1: a sweep, broken up by Bayer order and noise. */
export function cellThreshold(i: number, j: number, cols: number, rows: number, sweep: Sweep, spread = 0.5, seed = 0): number {
  let s: number;
  if (sweep === "down") s = j / Math.max(1, rows - 1);
  else if (sweep === "up") s = 1 - j / Math.max(1, rows - 1);
  else if (sweep === "right") s = i / Math.max(1, cols - 1);
  else if (sweep === "left") s = 1 - i / Math.max(1, cols - 1);
  else if (sweep === "none") s = 0;
  else {
    // Radial from a point given in 0..1 of the box.
    const dx = i / Math.max(1, cols - 1) - sweep.x, dy = (j / Math.max(1, rows - 1) - sweep.y) * (rows / Math.max(1, cols));
    const far = Math.max(Math.hypot(sweep.x, sweep.y * rows / cols), Math.hypot(1 - sweep.x, sweep.y * rows / cols),
      Math.hypot(sweep.x, (1 - sweep.y) * rows / cols), Math.hypot(1 - sweep.x, (1 - sweep.y) * rows / cols));
    s = Math.hypot(dx, dy) / far;
  }
  const b = B4[(j & 3) * 4 + (i & 3)], n = hash(i * 7919 + j * 104729 + seed * 31337);
  const sp = sweep === "none" ? 1 : spread;
  return s * (1 - sp) + (b * 0.55 + n * 0.45) * sp;
}

const cache = new Map<string, string>();

/** A PNG mask, white where cells are showing at progress p. */
function maskURL(w: number, h: number, cell: number, p: number, sweep: Sweep, spread: number, seed: number): string {
  const px = window.devicePixelRatio || 1;
  const key = `${w}|${h}|${cell}|${p.toFixed(4)}|${JSON.stringify(sweep)}|${spread}|${seed}|${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * px); c.height = Math.ceil(h * px);
  const ctx = c.getContext("2d")!;
  ctx.scale(px, px);
  ctx.fillStyle = "#fff";
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (cellThreshold(i, j, cols, rows, sweep, spread, seed) < p) ctx.fillRect(i * cell, j * cell, cell, cell);
  }
  const url = c.toDataURL("image/png");
  if (cache.size > 400) cache.clear();
  cache.set(key, url);
  return url;
}

/**
 * Shows children through a dither at progress p (0 hidden, 1 whole). w and h are the box in its own
 * CSS pixels. The cells turning over glow in `edge`.
 */
export function Dither({ p, w, h, cell = 6, sweep = "down", spread = 0.5, seed = 0, edge = "rgba(196,181,253,1)", band = 0.09,
  style, children }: {
  p: number; w: number; h: number; cell?: number; sweep?: Sweep; spread?: number; seed?: number; edge?: string | null; band?: number;
  style?: CSSProperties; children: ReactNode;
}) {
  const base: CSSProperties = { position: "absolute", width: w, height: h, ...style };
  if (p >= 1) return <div style={base}>{children}</div>;
  if (p <= 0) return <div style={{ ...base, visibility: "hidden" }}>{children}</div>;
  const url = maskURL(w, h, cell, p, sweep, spread, seed);
  const mask: CSSProperties = { WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };
  return (
    <div style={{ ...base, ...mask }}>
      {children}
      {edge && <Front w={w} h={h} cell={cell} p={p} sweep={sweep} spread={spread} seed={seed} edge={edge} band={band} />}
    </div>
  );
}

function Front({ w, h, cell, p, sweep, spread, seed, edge, band }: {
  w: number; h: number; cell: number; p: number; sweep: Sweep; spread: number; seed: number; edge: string; band: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!, px = window.devicePixelRatio || 1;
    if (c.width !== Math.ceil(w * px)) { c.width = Math.ceil(w * px); c.height = Math.ceil(h * px); }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = edge;
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const th = cellThreshold(i, j, cols, rows, sweep, spread, seed);
      const d = p - th;
      if (d < 0 || d > band) continue;
      ctx.globalAlpha = 1 - d / band;
      ctx.fillRect(i * cell, j * cell, cell, cell);
    }
    ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} width={Math.ceil(w)} height={Math.ceil(h)} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, pointerEvents: "none" }} />;
}

/** Points sampled from text drawn with a canvas font, in the text box's own pixels. */
export function useTextPoints(ready: boolean, text: string, font: string, letterSpacing: number, w: number, h: number,
  baseline: number, step: number, align: CanvasTextAlign = "center") {
  return useMemo(() => {
    if (!ready) return [] as { x: number; y: number; a: number }[];
    const c = document.createElement("canvas");
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    const ctx = c.getContext("2d")!;
    ctx.font = font;
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
    ctx.textAlign = align;
    ctx.fillStyle = "#fff";
    ctx.fillText(text, align === "center" ? w / 2 : align === "left" ? 0 : w, baseline);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const pts: { x: number; y: number; a: number }[] = [];
    for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
      const a = d[(y * c.width + x) * 4 + 3] / 255;
      if (a > 0.45) pts.push({ x, y, a });
    }
    return pts;
  }, [ready, text, font, letterSpacing, w, h, baseline, step, align]);
}

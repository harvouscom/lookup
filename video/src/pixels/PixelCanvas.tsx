// A full-frame canvas that a scene paints its moving pixels onto, one frame at a time.

import { useLayoutEffect, useRef } from "react";
import { HEIGHT, WIDTH } from "../timeline.ts";

export type Paint = (ctx: CanvasRenderingContext2D) => void;

export function PixelCanvas({ paint, blend, z }: { paint: Paint; blend?: "screen" | "normal" | "plus-lighter"; z?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!, px = window.devicePixelRatio || 1;
    if (c.width !== WIDTH * px) { c.width = WIDTH * px; c.height = HEIGHT * px; }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(px, 0, 0, px, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    paint(ctx);
  });
  return <canvas ref={ref} width={WIDTH} height={HEIGHT}
    style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, mixBlendMode: blend ?? "normal", zIndex: z, pointerEvents: "none" }} />;
}

/** A crisp square pixel with a soft halo, snapped to whole pixels like the globe's specks. */
export function speck(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number, halo = 0) {
  if (alpha <= 0.002) return;
  const s = Math.max(1, Math.round(size));
  const px = Math.round(x - s / 2), py = Math.round(y - s / 2);
  if (halo > 0) {
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = color;
    const hs = s + halo * 2;
    ctx.fillRect(px - halo, py - halo, hs, hs);
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, s, s);
  ctx.globalAlpha = 1;
}

/** The globe's speck colors, faint violet to near white. */
export function speckColor(k: number) {
  const r = Math.round(150 + 105 * k), g = Math.round(110 + 130 * k), b = Math.round(230 + 25 * k);
  return `rgb(${r},${g},${b})`;
}

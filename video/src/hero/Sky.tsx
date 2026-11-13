// The site's starfield (site/sky.js), stepped by film time, with scripted shooting stars.

import { useLayoutEffect, useRef } from "react";
import { createSkyRenderer } from "../../../site/sky.js";
import { HEIGHT, T, WIDTH } from "../timeline.ts";
import type { Cam } from "../world.ts";

type Renderer = {
  size(w: number, h: number, dpr: number): void;
  draw(o: Record<string, unknown>): void;
};

// Shooting stars at quiet moments, crossing the way the globe turns. Times in ms.
const SHOTS = [
  { t0: 5600, life: 1250, x: 1260, y: 150, vx: -420, vy: 130 },
  { t0: 7600, life: 1100, x: 520, y: 110, vx: -360, vy: 120 },
  { t0: (T.orbitsIn + 3.4) * 1000, life: 1150, x: 760, y: 120, vx: 400, vy: 125 },
  { t0: (T.ctaMove + 4.2) * 1000, life: 1300, x: 1320, y: 140, vx: 380, vy: 140 },
];

export function Sky({ cam, t }: { cam: Cam; t: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const r = useRef<Renderer | null>(null);
  useLayoutEffect(() => {
    if (!r.current) {
      r.current = createSkyRenderer(ref.current!) as unknown as Renderer;
      r.current.size(WIDTH, HEIGHT, window.devicePixelRatio || 1);
    }
    r.current.draw({ t: t * 1000, view: { lat: cam.lat, lng: cam.lng }, skyH: Math.min(HEIGHT, cam.crest + 40), motion: true, shots: SHOTS, alpha: cam.stars });
  });
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT }} />;
}

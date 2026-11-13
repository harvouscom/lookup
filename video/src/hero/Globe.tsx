// The site's particle globe (site/globe.js), stepped one frame at a time from the film's camera.

import { useLayoutEffect, useRef } from "react";
import { createGlobeRenderer } from "../../../site/globe.js";
import globeData from "../../../site/data/globe.json";
import { HEIGHT, WIDTH } from "../timeline.ts";
import { DPR, type Cam } from "../world.ts";

export type Pin = { lat: number; lng: number };

type Renderer = {
  resize(dpr: number): void;
  draw(o: Record<string, unknown>): void;
};

export function Globe({ cam, t, pins = [], selected = null }: { cam: Cam; t: number; pins?: Pin[]; selected?: (Pin & { at: number }) | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const r = useRef<Renderer | null>(null);
  useLayoutEffect(() => {
    const c = ref.current!;
    if (!r.current) {
      // Drawn at the device's pixel ratio, so a 2× (4K) render is sharp, not upscaled.
      const px = window.devicePixelRatio || 1;
      c.width = WIDTH * px; c.height = HEIGHT * px;
      r.current = createGlobeRenderer(c, globeData) as unknown as Renderer;
      r.current.resize(DPR * px);
    }
    r.current.draw({
      lat: cam.lat, lng: cam.lng, scale: cam.scale, top: cam.crest / DPR,
      t: t * 1000, motion: true, reveal: cam.reveal, gain: cam.gain,
      glow: cam.glow, shadeAlpha: cam.shade, limb: cam.limb,
      pins, selected: selected ? { ...selected, at: selected.at * 1000 } : null,
    });
  });
  return (
    <canvas ref={ref} width={WIDTH} height={HEIGHT}
      style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, opacity: cam.alpha }} />
  );
}

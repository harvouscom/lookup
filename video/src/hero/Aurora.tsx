// The site's aurora shader (site/aurora.js) at half resolution, stepped by film time.

import { useLayoutEffect, useRef } from "react";
import { createAuroraRenderer } from "../../../site/aurora.js";
import { HEIGHT, WIDTH } from "../timeline.ts";
import type { Cam } from "../world.ts";

type Renderer = { draw(o: { t: number; shift: number; floorY: number }): void } | null;

export function Aurora({ cam, t }: { cam: Cam; t: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const r = useRef<Renderer | undefined>(undefined);
  useLayoutEffect(() => {
    if (r.current === undefined) r.current = createAuroraRenderer(ref.current!, { preserve: true }) as unknown as Renderer;
    // The site starts its clock at page load; start a little in, where both curtains are up.
    r.current?.draw({ t: 14 + t * 0.85, shift: cam.lng * 0.006, floorY: Math.min(1, Math.max(0.2, (cam.crest + 30) / HEIGHT)) });
  });
  if (cam.aurora <= 0) return <canvas ref={ref} width={WIDTH / 2} height={HEIGHT / 2} style={{ display: "none" }} />;
  return (
    <canvas ref={ref} width={WIDTH / 2} height={HEIGHT / 2}
      style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, opacity: cam.aurora * 0.85 * Math.min(1, Math.max(0, (cam.crest + 60) / 360)), filter: "blur(13px)" }} />
  );
}

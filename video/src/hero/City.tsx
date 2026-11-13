// Dallas up close. The globe draws a few specks per half-degree cell, which thins out at a deep zoom,
// so as the camera dives this layer resolves each nearby cell into one speck per two churches, from
// the same globe.json counts. Every point of light is still real data.

import { useMemo } from "react";
import globeData from "../../../site/data/globe.json";
import { clamp, rng } from "../ease.ts";
import { PixelCanvas, speck, speckColor } from "../pixels/PixelCanvas.tsx";
import { camera, DALLAS, project } from "../world.ts";

type Speck = { lat: number; lng: number; k: number; ph: number; big: boolean; edge: number };

export function City({ t }: { t: number }) {
  const specks = useMemo(() => {
    const d = globeData as { unit: number; data: number[] };
    const r = rng(1999);
    const out: Speck[] = [];
    for (let i = 0; i < d.data.length; i += 3) {
      const la = d.data[i] * d.unit, lo = d.data[i + 1] * d.unit, c = d.data[i + 2];
      if (Math.abs(la - DALLAS.lat) > 4.5 || Math.abs(lo - DALLAS.lng) > 7) continue;
      const n = Math.min(400, Math.round(c / 2.5));
      for (let j = 0; j < n; j++) {
        // Gaussian-ish spread around the cell center, so the half-degree grid never shows.
        const g = () => (r() + r() + r() - 1.5) * 0.36;
        const lat = la + g() * d.unit * 1.6, lng = lo + g() * d.unit * 1.6;
        // Fade toward the rim of the patch, so it never shows an edge.
        const dist = Math.hypot((lat - DALLAS.lat) / 4.5, (lng - DALLAS.lng) / 7);
        const edge = 1 - Math.min(1, Math.max(0, (dist - 0.55) / 0.45)) ** 1.5;
        if (edge > 0) out.push({ lat, lng, k: Math.pow(r(), 1.8), ph: r() * Math.PI * 2, big: r() < 0.12, edge });
      }
    }
    return out;
  }, []);
  const cam = camera(t);
  const a = clamp((cam.scale - 3.4) / 2.4);
  if (a <= 0) return null;
  return (
    <PixelCanvas blend="screen" paint={(ctx) => {
      for (const s of specks) {
        const p = project(s.lat, s.lng, cam);
        if (p.depth <= 0 || p.x < -4 || p.x > 1924 || p.y < -4 || p.y > 1084) continue;
        const tw = 0.85 + 0.15 * Math.sin(t * 1.4 + s.ph);
        speck(ctx, p.x, p.y, s.big ? 3 : 2, speckColor(0.35 + 0.6 * s.k), a * s.edge * (0.45 + 0.55 * s.k) * tw, 0);
      }
    }} />
  );
}

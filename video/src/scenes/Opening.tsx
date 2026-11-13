// Scenes 1–2, and the start of 3: one pixel of light scatters into the globe's dithered shading as
// the planet rises; the headline arrives; the counter lights every church; then the headline breaks
// into pixels that rain down into Dallas.

import { useMemo } from "react";
import { clamp, inCubic, inOutCubic, mix, outCubic, outQuint, prog, quad, rng } from "../ease.ts";
import { MONO, SANS } from "../fonts.ts";
import { cellThreshold, Dither, useTextPoints } from "../pixels/dither.tsx";
import { PixelCanvas, speck, speckColor } from "../pixels/PixelCanvas.tsx";
import { HEIGHT, T, WIDTH } from "../timeline.ts";
import { Words } from "../ui/Words.tsx";
import { camera, DALLAS, project, R0 } from "../world.ts";

const ORIGIN = { x: WIDTH / 2, y: 640 };

/** 1 · The first pixel, then its scatter into the sphere. */
export function FirstLight({ t }: { t: number }) {
  const parts = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 1100 }, () => {
      // A point on the visible cap of the sphere, biased toward the lit upper-left limb.
      const u = (r() * 2 - 1) * 0.92;
      const depth = Math.pow(r(), 1.6) * 0.55;
      return { u, depth, delay: r() * 0.5, dur: 1.4 + r() * 1.3, size: r() < 0.15 ? 3 : 2, k: r(), swirl: (r() - 0.5) * 520 };
    });
  }, []);
  if (t > T.globeUp + 1.2) return null;
  return (
    <PixelCanvas paint={(ctx) => {
      // The pixel breathes before it breaks.
      if (t < T.scatter + 0.08) {
        const a = outCubic(prog(t, T.pixelIn, T.pixelIn + 0.5));
        const breath = 0.5 + 0.5 * Math.sin((t - T.pixelIn) * 5.2 - Math.PI / 2);
        const s = 4 + breath * 1.5 + 6 * clamp((t - T.scatter + 0.25) / 0.25);
        const g = ctx.createRadialGradient(ORIGIN.x, ORIGIN.y, 0, ORIGIN.x, ORIGIN.y, 60 + breath * 30);
        g.addColorStop(0, `rgba(196,181,253,${0.35 * a})`);
        g.addColorStop(1, "rgba(124,58,237,0)");
        ctx.fillStyle = g;
        ctx.fillRect(ORIGIN.x - 120, ORIGIN.y - 120, 240, 240);
        speck(ctx, ORIGIN.x, ORIGIN.y, s, "#EDE9FE", a, 3);
        return;
      }
      const cam = camera(t);
      const R = R0 * cam.scale, cy = cam.crest + R;
      for (const p of parts) {
        const k = clamp((t - T.scatter - p.delay * 0.4) / p.dur);
        if (k <= 0) continue;
        const e = outQuint(k);
        const tx = WIDTH / 2 + p.u * R * 0.55;
        const capY = cy - Math.sqrt(Math.max(0, R * R - (tx - WIDTH / 2) ** 2));
        const ty = capY + 6 + p.depth * 420;
        const c = { x: mix(ORIGIN.x, tx, 0.5) + p.swirl, y: Math.min(ORIGIN.y, ty) - 180 - p.k * 160 };
        const pt = quad(ORIGIN, c, { x: tx, y: ty }, e);
        const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        speck(ctx, pt.x, pt.y, p.size, k < 0.5 ? "#EDE9FE" : speckColor(0.35 + p.k * 0.5), fade * (0.55 + 0.45 * p.k), p.size > 2 ? 2 : 0);
      }
    }} />
  );
}

const HEAD = { text: "Church details, filled in.", size: 104, top: 196, w: 1500, h: 140 };
const HEAD_FONT = `600 ${HEAD.size}px "Google Sans Flex"`;
const HEAD_LS = -0.035 * HEAD.size;
const GRAD = "linear-gradient(180deg, #FFFFFF 30%, #CFC3F5)";
const DISSOLVE = 0.95;

/** 2 · The headline, and 3 · its dissolve into pixels that rain across the globe. */
export function Headline({ t, fonts }: { t: number; fonts: boolean }) {
  const pts = useTextPoints(fonts, HEAD.text, HEAD_FONT, HEAD_LS, HEAD.w, HEAD.h, HEAD.h / 2, 4);
  const seeded = useMemo(() => {
    const r = rng(42);
    const cell = 6, cols = Math.ceil(HEAD.w / cell), rows = Math.ceil(HEAD.h / cell);
    return pts.map((p) => {
      const th = cellThreshold(Math.floor(p.x / cell), Math.floor(p.y / cell), cols, rows, "down", 0.5, 3);
      return { ...p, th, dur: 1.15 + r() * 0.9, jx: (r() - 0.5) * 1.6, jy: (r() - 0.5) * 1.0, lean: (r() - 0.5) * 260, k: r() };
    });
  }, [pts]);
  if (t < T.headline - 0.1 || t > T.dissolve + DISSOLVE + 2.2) return null;
  const left = (WIDTH - HEAD.w) / 2;
  const p = 1 - inOutCubic(prog(t, T.dissolve, T.dissolve + DISSOLVE));
  return (
    <>
      <Dither p={p} w={HEAD.w} h={HEAD.h} cell={6} sweep="down" spread={0.5} seed={3} edge="rgba(237,233,254,1)" band={0.07}
        style={{ left, top: HEAD.top }}>
        <div style={{ width: HEAD.w, height: HEAD.h, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Words text={HEAD.text} t={t} at={T.headline} stagger={0.11} dur={0.9} blur={14} rise={14} gradient={GRAD}
            style={{ fontSize: HEAD.size, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: `${HEAD.h}px`, fontVariationSettings: '"ROND" 100' }} />
        </div>
      </Dither>
      {t > T.dissolve && (
        <PixelCanvas paint={(ctx) => {
          // The headline rains straight down, spreading across the whole globe.
          const cam = camera(t);
          const R = R0 * cam.scale, cy = cam.crest + R;
          for (const q of seeded) {
            const born = T.dissolve + (1 - q.th) * DISSOLVE;
            const k = clamp((t - born) / q.dur);
            if (t < born || k >= 1) continue;
            const from = { x: left + q.x, y: HEAD.top + q.y };
            const tx = WIDTH / 2 + (from.x - WIDTH / 2) * 1.3 + q.lean * 0.4;
            const cap = cy - Math.sqrt(Math.max(0, R * R - (tx - WIDTH / 2) ** 2));
            const to = { x: tx, y: cap + 14 + Math.abs(q.jy) * 420 };
            const ctl = { x: mix(from.x, tx, 0.3), y: from.y + 160 + q.k * 120 };
            const pt = quad(from, ctl, to, inCubic(k) * 0.35 + outCubic(k) * 0.65);
            const fade = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
            speck(ctx, pt.x, pt.y, q.k < 0.2 ? 3 : 2, k < 0.35 ? "#FFFFFF" : speckColor(0.6 + 0.4 * q.k), fade * (0.6 + 0.4 * q.a), 0);
          }
        }} />
      )}
    </>
  );
}

/** A soft bloom over a place on the globe, for where the story is happening. */
export function PlaceGlow({ t, a, size = 340, color = "167,139,250" }: { t: number; a: number; size?: number; color?: string }) {
  if (a <= 0.001) return null;
  const pos = project(DALLAS.lat, DALLAS.lng, camera(t));
  if (pos.y > HEIGHT + size || pos.depth < 0) return null;
  return (
    <div style={{ position: "absolute", left: pos.x - size / 2, top: pos.y - size / 2, width: size, height: size, borderRadius: "50%", mixBlendMode: "screen",
      background: `radial-gradient(closest-side, rgba(${color},${0.55 * a}), rgba(${color},${0.18 * a}) 45%, rgba(${color},0) 100%)` }} />
  );
}

export { SANS };

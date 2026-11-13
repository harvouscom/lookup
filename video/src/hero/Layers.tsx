// The rest of the hero: the night backdrop, the horizon arc, the orbit rings and a fine film grain.

import { useLayoutEffect, useRef } from "react";
import { HEIGHT, WIDTH } from "../timeline.ts";
import { R0, type Cam } from "../world.ts";

/** The header's night: #05020F with violet light pooling at the bottom and a faint wash at the top. */
export function Backdrop({ cam }: { cam: Cam }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#05020F" }}>
      <div style={{
        position: "absolute", inset: 0, opacity: cam.backdrop,
        background: "radial-gradient(1440px 720px at 50% 100%, rgba(124,58,237,.30), transparent 65%), radial-gradient(960px 480px at 50% 0%, rgba(124,58,237,.12), transparent 70%)",
      }} />
    </div>
  );
}

/** The arc across the top of the hero: a circle at the globe's own radius, crest just under where the nav sits. */
export const ARC_CREST = 96;
export function HorizonArc({ cam }: { cam: Cam }) {
  if (cam.arc <= 0 || cam.arcAlpha <= 0) return null;
  const R = R0, cx = WIDTH / 2, cy = ARC_CREST + R;
  const y = (x: number) => cy - Math.sqrt(Math.max(R * R - (x - cx) ** 2, 0));
  const d = `M0 ${y(0).toFixed(1)}A${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${WIDTH} ${y(WIDTH).toFixed(1)}`;
  const dash = { pathLength: 1, strokeDasharray: `${cam.arc} 1` } as const;
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0, opacity: cam.arcAlpha }}>
      <path d={d} fill="none" stroke="rgba(139,92,246,.55)" strokeWidth={12} style={{ filter: "blur(10px)" }} {...dash} />
      <path d={d} fill="none" stroke="rgba(216,205,255,.72)" strokeWidth={1.5} {...dash} />
      {cam.arc < 1 && (() => {
        // A bright head travelling along the rim while it draws.
        const x = cam.arc * WIDTH, hy = y(x);
        return <circle cx={x} cy={hy} r={3} fill="#fff" style={{ filter: "drop-shadow(0 0 8px rgba(196,181,253,.95))" }} />;
      })()}
    </svg>
  );
}

/** The two tilted orbit rings around the globe: o1 behind it, o2 in front (top edge only). */
export const ORBITS = [
  { dy: 230, rx: 1230, ry: 380, rot: -5 },
  { dy: 470, rx: 1080, ry: 340, rot: 4 },
] as const;

/** A point on orbit i at angle a (radians; -π/2 is the top of the ring), for a globe crest. */
export function orbitPoint(i: 0 | 1, a: number, crest: number) {
  const o = ORBITS[i], r = (o.rot * Math.PI) / 180;
  const ex = o.rx * Math.cos(a), ey = o.ry * Math.sin(a);
  return { x: WIDTH / 2 + ex * Math.cos(r) - ey * Math.sin(r), y: crest + o.dy + ex * Math.sin(r) + ey * Math.cos(r) };
}

export function Orbit({ cam, which }: { cam: Cam; which: 0 | 1 }) {
  if (cam.orbits <= 0) return null;
  const o = ORBITS[which];
  const cx = WIDTH / 2, cy = cam.crest + o.dy;
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0, opacity: cam.orbits }}>
      <defs>
        <linearGradient id={`og${which}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgba(196,181,253,0)" />
          <stop offset=".5" stopColor={which ? "rgba(196,181,253,.42)" : "rgba(196,181,253,.2)"} />
          <stop offset="1" stopColor="rgba(196,181,253,0)" />
        </linearGradient>
      </defs>
      {which === 0 ? (
        <ellipse cx={cx} cy={cy} rx={o.rx} ry={o.ry} fill="none" stroke={`url(#og${which})`} strokeWidth={1.25} transform={`rotate(${o.rot} ${cx} ${cy})`} />
      ) : (
        // Front ring: only its top half, which crosses in front of the globe.
        <path d={`M${cx - o.rx} ${cy}A${o.rx} ${o.ry} 0 0 1 ${cx + o.rx} ${cy}`} fill="none" stroke={`url(#og${which})`} strokeWidth={1.25}
          transform={`rotate(${o.rot} ${cx} ${cy})`} />
      )}
    </svg>
  );
}

/** Fine animated grain over the backdrop layers, so the dark violet gradients don't band once encoded. */
export function Grain({ t, alpha = 0.05 }: { t: number; alpha?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!, ctx = c.getContext("2d")!;
    const w = c.width, h = c.height, img = ctx.createImageData(w, h), d = img.data;
    let s = (Math.floor(t * 60) * 2654435761) >>> 0;
    for (let i = 0; i < d.length; i += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const v = (s >>> 0) & 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
  return <canvas ref={ref} width={WIDTH} height={HEIGHT}
    style={{ position: "absolute", inset: 0, width: WIDTH, height: HEIGHT, opacity: alpha, mixBlendMode: "overlay" }} />;
}

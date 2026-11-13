// Scenes 9–10: the shared fix collapses into one bright pixel and arcs home into Dallas. The camera
// pulls back: apps ride the orbit rings, each sending fixes into the directory. Some go live at once,
// some wait in Here's My Church's review queue. Then the whole globe brightens and better data flows
// back out to every app.

import { useMemo } from "react";
import { clamp, inOutCubic, mix, outCubic, outExpo, prog, quad, rng } from "../ease.ts";
import { MONO, SANS } from "../fonts.ts";
import { PixelCanvas, speck } from "../pixels/PixelCanvas.tsx";
import { T } from "../timeline.ts";
import { FIX_ROW } from "../ui/AppWindow.tsx";
import { CHURCH, LOOKS, STR } from "../ui/tokens.ts";
import { HmcMark } from "../ui/Widget.tsx";
import { camera, DALLAS, project } from "../world.ts";
import { orbitPoint } from "../hero/Layers.tsx";
import { toFilm, winPlace } from "./place.ts";

const GREEN = "#86EFAC";
const LILAC = "#C4B5FD";

/** Where the fix row sits on screen when the window falls away. */
function fixRowOnScreen() {
  const pl = winPlace(T.collapse);
  const a = toFilm(FIX_ROW, pl);
  return { x: a.x, y: a.y, w: FIX_ROW.w * pl.s, h: FIX_ROW.h * pl.s, s: pl.s };
}

const COLLAPSE_AT = T.collapse + 0.55;
const ARC_END = T.impact;

/** 9 · The fix row, alone, then folding into a point of light. */
export function FixChip({ t }: { t: number }) {
  if (t < T.collapse || t > COLLAPSE_AT + 0.35) return null;
  const r = fixRowOnScreen();
  const lift = outCubic(prog(t, T.collapse, T.collapse + 0.4));
  const fold = inOutCubic(prog(t, COLLAPSE_AT, COLLAPSE_AT + 0.35));
  const acc = LOOKS.plum.accent;
  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w / r.s, height: r.h / r.s, transformOrigin: "50% 50%",
      transform: `scale(${r.s * (1 + 0.04 * lift) * mix(1, 0.02, fold)}, ${r.s * (1 + 0.04 * lift) * mix(1, 0.04, fold)})`,
      filter: fold > 0 ? `brightness(${1 + fold * 3})` : undefined }}>
      <div style={{ position: "absolute", inset: -6, borderRadius: 12, background: "#fff", boxShadow: `0 0 0 1px rgba(124,58,237,.25), 0 18px 50px -12px rgba(5,2,15,.8), 0 0 ${40 * lift}px -6px rgba(167,139,250,.9)` }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", padding: "2px 4px", fontFamily: SANS, fontSize: 14, color: "#18181b" }}>
        <span style={{ width: 18, height: 18, marginTop: 2, borderRadius: 4, background: acc, display: "grid", placeItems: "center" }}>
          <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
        </span>
        <span style={{ fontWeight: 600 }}>Service times</span>
        <span style={{ gridColumn: 2, display: "flex", gap: 8, color: "#52525b" }}><s style={{ opacity: 0.75 }}>{CHURCH.times}</s><span>→</span><span style={{ color: "#18181b" }}>{CHURCH.fixedTimes}</span></span>
        <span style={{ gridColumn: 2, justifySelf: "start", padding: "1px 8px", borderRadius: 999, fontSize: 12, background: "rgba(22,163,74,0.14)", color: "#15803D",
          display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 6, height: 6, borderRadius: 9, background: "#16A34A" }} />{STR.st.live}</span>
      </div>
    </div>
  );
}

/** The point of light arcing from the form into Dallas, and the ripple where it lands. */
export function Homecoming({ t }: { t: number }) {
  const sparks = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 70 }, () => ({ a: r() * Math.PI * 2, v: 40 + r() * 150, life: 0.5 + r() * 0.7, s: r() < 0.3 ? 3 : 2 }));
  }, []);
  if (t < COLLAPSE_AT + 0.25 || t > T.pullBack + 1.6) return null;
  const r = fixRowOnScreen();
  const from = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  return (
    <PixelCanvas paint={(ctx) => {
      const cam = camera(t);
      const home = project(DALLAS.lat, DALLAS.lng, cam);
      if (t < ARC_END) {
        const k = prog(t, COLLAPSE_AT + 0.3, ARC_END);
        const ctl = { x: mix(from.x, home.x, 0.5) + 320, y: Math.min(from.y, home.y) - 220 };
        for (let i = 12; i >= 0; i--) {
          const kk = k - i * 0.012;
          if (kk < 0) continue;
          const pt = quad(from, ctl, home, inOutCubic(clamp(kk)));
          speck(ctx, pt.x, pt.y, i === 0 ? 7 : 3, i === 0 ? "#FFFFFF" : LILAC, (1 - i / 13) * (i === 0 ? 1 : 0.8), i === 0 ? 10 : 0);
        }
        return;
      }
      // Impact: rings and sparks. Looking straight down, the rings open into near circles.
      const dt = t - ARC_END;
      const flat = clamp(0.42 + ((cam.scale - 2.2) / 5) * 0.55, 0.42, 0.97), big = clamp(cam.scale / 4, 1, 1.8);
      for (let j = 0; j < 3; j++) {
        const k = clamp((dt - j * 0.16) / 1.3);
        if (k <= 0 || k >= 1) continue;
        ctx.beginPath();
        ctx.ellipse(home.x, home.y, (12 + outExpo(k) * 190) * big, (12 + outExpo(k) * 190) * big * flat, 0, 0, Math.PI * 2);
        ctx.strokeStyle = j === 0 ? `rgba(134,239,172,${0.85 * (1 - k)})` : `rgba(196,181,253,${0.6 * (1 - k)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      for (const s of sparks) {
        const k = clamp(dt / s.life);
        if (k >= 1) continue;
        const d = outCubic(k) * s.v;
        speck(ctx, home.x + Math.cos(s.a) * d * big, home.y + Math.sin(s.a) * d * big * flat, s.s, k < 0.4 ? "#FFFFFF" : GREEN, 1 - k, 0);
      }
    }} />
  );
}


/**
 * The church itself, where the fix lands: a pin on Dallas and the listing as Here's My Church now has
 * it, the site's globe card made large. Service times flips from the old value to the shared one.
 */
export function LiveTag({ t }: { t: number }) {
  const a = Math.min(outCubic(prog(t, T.impact + 0.1, T.impact + 0.55)), 1 - inOutCubic(prog(t, T.pullBack + 0.3, T.pullBack + 0.85)));
  if (a <= 0) return null;
  const p = project(DALLAS.lat, DALLAS.lng, camera(t));
  const flip = inOutCubic(prog(t, T.impact + 0.55, T.impact + 0.95));
  const flash = Math.max(0, 1 - Math.abs(t - T.impact - 0.95) / 0.5);
  const chipIn = (i: number) => outCubic(prog(t, T.impact + 0.5 + i * 0.07, T.impact + 0.85 + i * 0.07));
  const chip = { fontFamily: MONO, fontSize: 14, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" as const,
    color: "#DDD6FE", background: "rgba(167,139,250,.14)", border: "1px solid rgba(167,139,250,.22)" };
  return (
    <>
      {/* The pin: a church glyph on the spot, with a stem up to its card. */}
      <div style={{ position: "absolute", left: p.x - 22, top: p.y - 22, width: 44, height: 44, borderRadius: 999, opacity: a, display: "grid", placeItems: "center",
        background: "linear-gradient(135deg, #A78BFA, #6D28D9)", boxShadow: "0 0 0 3px rgba(10,6,24,.9), 0 0 0 5px rgba(134,239,172,.55), 0 0 30px rgba(134,239,172,.6)",
        transform: `scale(${0.6 + 0.4 * a})` }}>
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v5M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4" />
        </svg>
      </div>
      <div style={{ position: "absolute", left: p.x - 0.75, top: p.y - 92, width: 1.5, height: 66, opacity: a,
        background: "linear-gradient(rgba(196,181,253,.15), rgba(196,181,253,.85))" }} />
      <div style={{ position: "absolute", left: p.x, top: p.y - 96, transform: `translate(-50%, -100%) translateY(${(1 - a) * 14}px) scale(${0.94 + 0.06 * a})`,
        transformOrigin: "50% 100%", opacity: a, filter: a < 1 ? `blur(${(1 - a) * 6}px)` : undefined, width: 560, boxSizing: "border-box", padding: "20px 22px 18px",
        borderRadius: 20, fontFamily: SANS, background: "linear-gradient(180deg, rgba(32,24,60,.96), rgba(14,10,28,.96))", border: "1px solid rgba(196,181,253,.3)",
        boxShadow: "0 0 0 1px rgba(0,0,0,.35), 0 30px 60px -16px rgba(0,0,0,.8), 0 0 70px -16px rgba(134,239,172,.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ flex: "none", width: 56, height: 56, borderRadius: 15, display: "grid", placeItems: "center",
            background: "linear-gradient(135deg, #A78BFA, #6D28D9)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3), 0 8px 18px -6px rgba(124,58,237,.9)" }}>
            <svg viewBox="0 0 24 24" width={30} height={30} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v5M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4" />
            </svg>
          </span>
          <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
            <b style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.15, fontVariationSettings: '"ROND" 100' }}>{CHURCH.name}</b>
            <span style={{ fontSize: 16, color: "rgba(237,233,254,.6)" }}>{CHURCH.location}</span>
          </span>
        </div>
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, display: "flex", alignItems: "center", gap: 12,
          background: `rgba(74,222,128,${0.06 + 0.1 * flash})`, border: `1px solid rgba(74,222,128,${0.18 + 0.3 * flash})` }}>
          <span style={{ fontFamily: MONO, fontSize: 14, color: "rgba(237,233,254,.6)" }}>Service times</span>
          <span style={{ position: "relative", fontFamily: MONO, fontSize: 17, color: "#fff", minWidth: 130 }}>
            <s style={{ position: "absolute", left: 0, opacity: 1 - flip, color: "rgba(237,233,254,.55)", transform: `translateY(${-flip * 8}px)` }}>{CHURCH.times}</s>
            <span style={{ opacity: flip, display: "inline-block", transform: `translateY(${(1 - flip) * 8}px)` }}>{CHURCH.fixedTimes}</span>
          </span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, fontFamily: MONO, fontSize: 13, color: GREEN, opacity: flip }}>
            <i style={{ width: 8, height: 8, borderRadius: 9, background: "#4ADE80", boxShadow: "0 0 8px #4ADE80" }} />{STR.st.live}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {[CHURCH.phone, CHURCH.website, "Shared from Kinship"].map((c, i) => (
            <span key={c} style={{ ...chip, opacity: chipIn(i), transform: `translateY(${(1 - chipIn(i)) * 4}px)` }}>{c}</span>
          ))}
        </div>
      </div>
    </>
  );
}

// ── The wide view: apps on the orbits, fixes flowing in, review, and better data flowing out ──

const APPS = [
  { name: "Kinship", color: "#A78BFA", orbit: 0 as const, a: -2.28 },
  { name: "Harvest", color: "#F87171", orbit: 0 as const, a: -1.98 },
  { name: "Steeple", color: "#D2F25C", orbit: 0 as const, a: -0.98 },
  { name: "Youth camp sign-up", color: "#5EEAD4", orbit: 1 as const, a: -2.2 },
  { name: "Parish directory", color: "#FBBF24", orbit: 1 as const, a: -1.48 },
  { name: "Volunteer app", color: "#F9A8D4", orbit: 1 as const, a: -0.9 },
];

function chipPos(i: number, t: number) {
  const app = APPS[i];
  const cam = camera(t);
  return orbitPoint(app.orbit, app.a + (t - T.orbitsIn) * 0.011 * (app.orbit ? -1 : 1), cam.crest);
}

const CITIES = [
  { lat: 41.88, lng: -87.63, field: "Website", church: "Hope Church Uptown" },
  { lat: 33.75, lng: -84.39 },
  { lat: 51.51, lng: -0.13, field: "Address", church: "St. Mark's Parish" },
  { lat: 39.74, lng: -104.99 },
  { lat: 52.52, lng: 13.4, field: "Pastor", church: "Trinity Chapel" },
  { lat: 43.65, lng: -79.38 },
  { lat: 50.06, lng: 19.94 },
  { lat: 44.98, lng: -93.27 },
  { lat: 40.42, lng: -3.7 },
];
const STREAM_AT = (i: number) => T.orbitsIn + 0.6 + i * 0.47;
const STREAM_DUR = 0.9;
const isReview = (i: number) => !!CITIES[i].field;
const reviewSlot = (i: number) => [0, 2, 4].indexOf(i);
/** Here's My Church's review queue: centered in the sky above the globe, large. */
const QUEUE = { s: 1.6, w: 380, x: 960 - (380 * 1.6) / 2, y: 112 };
const queueRowY = (j: number) => QUEUE.y + (58 + j * 46 + 18) * QUEUE.s;

export function Network({ t }: { t: number }) {
  const show = Math.min(outCubic(prog(t, T.orbitsIn + 0.2, T.orbitsIn + 1.2)), 1 - prog(t, T.ctaMove - 1.4, T.ctaMove - 0.2));
  if (show <= 0) return null;
  const outflow = (i: number) => outCubic(prog(t, T.outflow + 0.4 + i * 0.35, T.outflow + 1.0 + i * 0.35));
  return (
    <>
      <NetworkPixels t={t} />
      {APPS.map((app, i) => {
        const p = chipPos(i, t);
        const a = Math.min(show, outCubic(prog(t, T.orbitsIn + 0.3 + i * 0.14, T.orbitsIn + 0.9 + i * 0.14)));
        const pulse = Math.max(0, ...[0, 1].map((n) => clamp(1 - Math.abs(t - (T.outflow + 1.0 + ((i + n * 6) % 6) * 0.35 + n * 1.6)) / 0.35))) * (t > T.outflow ? 1 : 0);
        const got = t > T.outflow ? outflow(i) : 0;
        return (
          <div key={app.name} style={{ position: "absolute", left: p.x, top: p.y, transform: `translate(-50%, -50%) scale(${1.15 + 0.06 * pulse})`, opacity: a }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 11px 6px 8px", borderRadius: 9, whiteSpace: "nowrap",
              fontFamily: MONO, fontSize: 13, color: "#EDE9FE", background: "rgba(17,12,34,.84)",
              border: `1px solid rgba(196,181,253,${0.22 + 0.5 * pulse})`, boxShadow: `0 10px 30px -12px rgba(5,2,15,.9), 0 0 ${24 * pulse}px -4px rgba(167,139,250,.9)` }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: app.color, boxShadow: `0 0 8px ${app.color}` }} />{app.name}
              {got > 0 && <span style={{ marginLeft: 4, color: GREEN, opacity: got, fontSize: 11 }}>synced</span>}
            </span>
          </div>
        );
      })}
      <Queue t={t} />
      <Hud t={t} />
    </>
  );
}

function NetworkPixels({ t }: { t: number }) {
  const seeds = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 18 }, () => Array.from({ length: 26 }, () => ({ o: r() * 0.16, j: (r() - 0.5) * 2, s: r() })));
  }, []);
  return (
    <PixelCanvas paint={(ctx) => {
      const cam = camera(t);
      // Fixes flowing in from the apps.
      CITIES.forEach((c, i) => {
        const at = STREAM_AT(i);
        const chip = i % APPS.length;
        const dest = isReview(i) ? { x: QUEUE.x + 24 * QUEUE.s, y: queueRowY(reviewSlot(i)) } : project(c.lat, c.lng, cam);
        const color = isReview(i) ? LILAC : GREEN;
        for (const s of seeds[i]) {
          const k = clamp((t - at - s.o) / STREAM_DUR);
          if (k <= 0 || k >= 1) continue;
          const from = chipPos(chip, at);
          const ctl = { x: mix(from.x, dest.x, 0.5) + s.j * 60, y: Math.min(from.y, dest.y) - 80 - s.s * 60 };
          const pt = quad(from, ctl, dest, inOutCubic(k));
          speck(ctx, pt.x, pt.y, s.s < 0.35 ? 4 : 3, k < 0.4 ? "#FFFFFF" : color, k > 0.85 ? (1 - k) / 0.15 : 1, s.s < 0.35 ? 3 : 0);
        }
        // Live fixes land with a green ring.
        if (!isReview(i)) {
          const k = clamp((t - at - STREAM_DUR) / 0.9);
          if (k > 0 && k < 1) {
            const p = project(c.lat, c.lng, cam);
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 4 + outExpo(k) * 46, (4 + outExpo(k) * 46) * 0.45, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(134,239,172,${0.9 * (1 - k)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            speck(ctx, p.x, p.y, 4, GREEN, 1 - k, 4);
          }
        }
      });
      // Approved fixes drop from the queue into their places.
      [0, 2, 4].forEach((ci, j) => {
        const at = T.review + 0.45 + j * 0.16;
        const c = CITIES[ci];
        const from = { x: QUEUE.x + 24 * QUEUE.s, y: queueRowY(j) };
        const to = project(c.lat, c.lng, cam);
        for (const s of seeds[9 + j]) {
          const k = clamp((t - at - s.o) / 0.85);
          if (k <= 0 || k >= 1) continue;
          const ctl = { x: mix(from.x, to.x, 0.5) + s.j * 40, y: Math.min(from.y, to.y) - 40 };
          const pt = quad(from, ctl, to, inOutCubic(k));
          speck(ctx, pt.x, pt.y, 2, k < 0.4 ? "#FFFFFF" : GREEN, k > 0.85 ? (1 - k) / 0.15 : 1, 0);
        }
        const land = clamp((t - at - 0.95) / 0.9);
        if (land > 0 && land < 1) {
          ctx.beginPath();
          ctx.ellipse(to.x, to.y, 4 + outExpo(land) * 46, (4 + outExpo(land) * 46) * 0.45, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(134,239,172,${0.9 * (1 - land)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
      // 10 · Better data flows back out to every app.
      if (t > T.outflow) {
        for (let n = 0; n < 12; n++) {
          const at = T.outflow + (n % 6) * 0.35 + Math.floor(n / 6) * 1.6;
          const c = CITIES[(n * 5) % CITIES.length];
          const from = project(c.lat, c.lng, cam);
          const to = chipPos(n % 6, t);
          for (const s of seeds[(n + 3) % 18]) {
            const k = clamp((t - at - s.o) / 1.0);
            if (k <= 0 || k >= 1) continue;
            const ctl = { x: mix(from.x, to.x, 0.5) + s.j * 70, y: Math.min(from.y, to.y) - 90 - s.s * 40 };
            const pt = quad(from, ctl, to, inOutCubic(k));
            speck(ctx, pt.x, pt.y, s.s < 0.3 ? 3 : 2, k < 0.5 ? "#E9D5FF" : "#FFFFFF", (k > 0.85 ? (1 - k) / 0.15 : 1) * 0.95, 0);
          }
        }
      }
    }} />
  );
}

/** Here's My Church's review queue: fixes that wait for a moderator, then go live. */
function Queue({ t }: { t: number }) {
  // Stays up through the approvals, and gives way as "Fixes flow back." arrives.
  const a = Math.min(outCubic(prog(t, T.orbitsIn + 0.6, T.orbitsIn + 1.2)), 1 - inOutCubic(prog(t, T.better1 - 0.55, T.better1 - 0.05)));
  if (a <= 0) return null;
  return (
    <div style={{ position: "absolute", left: QUEUE.x, top: QUEUE.y, width: QUEUE.w, opacity: a, transformOrigin: "0 0",
      transform: `translateY(${(1 - a) * 10}px) scale(${QUEUE.s * (0.97 + 0.03 * a)})`,
      borderRadius: 14, padding: "12px 12px 8px", boxSizing: "border-box", background: "linear-gradient(180deg, rgba(32,24,60,.94), rgba(14,10,28,.94))",
      border: "1px solid rgba(196,181,253,.28)", boxShadow: "0 0 0 1px rgba(0,0,0,.35), 0 18px 40px -12px rgba(0,0,0,.75), 0 0 44px -12px rgba(139,92,246,.6)", fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid rgba(196,181,253,.14)" }}>
        <HmcMark size={22} />
        <b style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>Here's My Church</b>
        <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: "rgba(237,233,254,.55)" }}>moderator review</span>
      </div>
      {[0, 2, 4].map((ci, j) => {
        const c = CITIES[ci];
        const arrive = outCubic(prog(t, STREAM_AT(ci) + STREAM_DUR - 0.1, STREAM_AT(ci) + STREAM_DUR + 0.3));
        const ok = outCubic(prog(t, T.review + j * 0.16, T.review + 0.25 + j * 0.16));
        return (
          <div key={ci} style={{ height: 46, display: "flex", alignItems: "center", gap: 10, opacity: arrive, transform: `translateX(${(1 - arrive) * -10}px)` }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#DDD6FE", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
              {c.field} · <span style={{ color: "rgba(237,233,254,.6)" }}>{c.church}</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap",
              color: ok > 0.5 ? GREEN : "#DDD6FE", background: ok > 0.5 ? "rgba(74,222,128,.12)" : "rgba(167,139,250,.14)",
              border: `1px solid ${ok > 0.5 ? "rgba(74,222,128,.24)" : "rgba(167,139,250,.2)"}` }}>
              {ok > 0.5 ? `✓ ${STR.st.live}` : STR.st.in_review}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The HUD pill over the globe, like the site's: the directory keeps every app in sync. */
function Hud({ t }: { t: number }) {
  const a = Math.min(outCubic(prog(t, T.brighten + 0.6, T.brighten + 1.2)), 1 - prog(t, T.ctaMove - 1.2, T.ctaMove - 0.4));
  if (a <= 0) return null;
  const cam = camera(t);
  const blink = 0.55 + 0.45 * Math.cos(((t - T.brighten) / 2.4) * Math.PI * 2);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: cam.crest - 66, display: "flex", justifyContent: "center", opacity: a }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 14px", borderRadius: 999, background: "rgba(10,6,24,.66)",
        border: "1px solid rgba(196,181,253,.2)", fontFamily: MONO, fontSize: 13, color: "rgba(237,233,254,.85)" }}>
        <i style={{ width: 7, height: 7, borderRadius: 9, background: "#4ADE80", opacity: blink, boxShadow: "0 0 8px #4ADE80" }} />
        Here's My Church → every app · synced every 5 minutes
      </span>
    </div>
  );
}

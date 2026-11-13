// Scenes 3–5: a single church speck lifts off Dallas and becomes the caret of the search box; the
// query types in; results cascade; Enter picks Grace Community Church; the box glides into the app's
// form; and the picked row bursts into pixels that stream into every field.

import { useMemo } from "react";
import { clamp, inOutCubic, inOutSine, mix, outCubic, outQuint, prog, quad, rng } from "../ease.ts";
import { Dither } from "../pixels/dither.tsx";
import { PixelCanvas, speck, speckColor } from "../pixels/PixelCanvas.tsx";
import { FIELDS, fieldAt, QUERY, T, WIDTH } from "../timeline.ts";
import { CHURCH, LOOKS, RESULTS, widgetMix, RESULT_STAGES } from "../ui/tokens.ts";
import { Popover, ResultRow, SearchBox } from "../ui/Widget.tsx";
import { camera, R0 } from "../world.ts";
import { churchFieldOnScreen, fieldOnScreen, HERO_BOX } from "./place.ts";

const MORPH = 1.45;
const VIOLETS = ["#5B21B6", "#6D28D9", "#7C3AED", "#7C3AED", "#8B5CF6", "#A78BFA"];
const morphK = (t: number) => inOutCubic(prog(t, T.windowIn, T.windowIn + MORPH));

/** The search box's screen rect, from the hero position into the app's church field. */
export function boxRect(t: number) {
  const m = morphK(t);
  const f = churchFieldOnScreen(t);
  return { x: mix(HERO_BOX.x, f.x, m), y: mix(HERO_BOX.y, f.y, m), w: mix(HERO_BOX.w, f.w, m), h: mix(HERO_BOX.h, f.h, m), s: mix(HERO_BOX.s, f.s, m), m };
}

const CARET = { x: HERO_BOX.x + 44 * HERO_BOX.s, y: HERO_BOX.y + HERO_BOX.h / 2 };

/** Hands off to the app window's own church field once the morph is done. */
export const BOX_HANDOFF = T.windowIn + MORPH + 0.05;

/** Specks lift off all over the globe and gather into the search box's outline and caret. */
export function Gather({ t }: { t: number }) {
  const parts = useMemo(() => {
    const r = rng(314);
    const B = HERO_BOX, rad = 14 * B.s, per = 2 * (B.w + B.h);
    return Array.from({ length: 640 }, () => {
      // Where it starts: anywhere on the visible face of the globe.
      const u = (r() * 2 - 1) * 0.86, depth = Math.pow(r(), 1.4);
      // Where it lands: most on the box's edge, the rest on the caret.
      let to: { x: number; y: number };
      if (r() < 0.78) {
        let d = r() * per;
        if (d < B.w) to = { x: B.x + d, y: B.y };
        else if ((d -= B.w) < B.h) to = { x: B.x + B.w, y: B.y + d };
        else if ((d -= B.h) < B.w) to = { x: B.x + B.w - d, y: B.y + B.h };
        else to = { x: B.x, y: B.y + B.h - (d - B.w) };
        to = { x: Math.min(B.x + B.w - rad * 0.3, Math.max(B.x + rad * 0.3, to.x)), y: to.y };
      } else to = { x: CARET.x + (r() - 0.5) * 6, y: CARET.y + (r() - 0.5) * 26 };
      return { u, depth, to, start: r() * 0.55, dur: 0.85 + r() * 0.45, arc: 90 + r() * 200, k: r() };
    });
  }, []);
  if (t < T.liftStart || t > T.liftEnd + 0.3) return null;
  return (
    <PixelCanvas paint={(ctx) => {
      const cam = camera(T.liftStart);
      const R = R0 * cam.scale, cy = cam.crest + R;
      for (const p of parts) {
        const k = clamp((t - T.liftStart - p.start) / p.dur);
        if (k <= 0 || k >= 1) continue;
        const fx = WIDTH / 2 + p.u * R * 0.62;
        const cap = cy - Math.sqrt(Math.max(0, R * R - (fx - WIDTH / 2) ** 2));
        const from = { x: fx, y: cap + 16 + p.depth * 400 };
        const ctl = { x: mix(from.x, p.to.x, 0.55), y: Math.min(from.y, p.to.y) - p.arc };
        const pt = quad(from, ctl, p.to, inOutCubic(k));
        const a = k < 0.12 ? k / 0.12 : k > 0.85 ? (1 - k) / 0.15 : 1;
        speck(ctx, pt.x, pt.y, p.k < 0.25 ? 3 : 2, k > 0.55 ? "#FFFFFF" : speckColor(0.55 + 0.45 * p.k), a, p.k < 0.25 ? 2 : 0);
      }
    }} />
  );
}

const STAGE_AT = [T.results, T.placeResults, T.finalResults];

/** Which result set is showing: the search refreshes as the query grows. */
export const stageAt = (t: number) => (t < T.placeResults ? 0 : t < T.finalResults ? 1 : 2);
export const resultsAt = (t: number) => RESULT_STAGES[stageAt(t)];

/** Each row eases in when its stage arrives, unless the same church already held that row. */
function rowsIn(t: number) {
  const st = stageAt(t), at = STAGE_AT[st], rows = RESULT_STAGES[st], prev = st ? RESULT_STAGES[st - 1] : null;
  const k = rows.map((r, i) => (prev && prev[i].name === r.name ? 1
    : outCubic(prog(t, at + 0.04 + i * (st ? 0.035 : 0.06), at + (st ? 0.3 : 0.5) + i * (st ? 0.035 : 0.06)))));
  return [...k, outCubic(prog(t, T.results + 0.4, T.results + 0.8))];
}

export function SearchLayer({ t }: { t: number }) {
  if (t < T.boxIn - 0.1 || t >= BOX_HANDOFF) return null;
  const r = boxRect(t);
  const look = widgetMix(r.m, LOOKS.plum.accent);
  const s = r.s;
  const w = r.w / s, h = r.h / s;

  const typed = t < T.typeStart ? 0 : Math.min(QUERY.length, Math.floor((t - T.typeStart) / T.keyGap + 1e-6) + 1);
  const chosen = t >= T.enter;
  const text = chosen ? CHURCH.name : QUERY.slice(0, typed);
  const blink = (t - T.boxIn) % 1.06 < 0.53 ? 1 : 0;
  const caret = chosen ? 0 : t < T.liftEnd + 0.15 ? 0 : typed > 0 && t < T.typeEnd + 0.4 ? 1 : blink;
  // A short spin before each refresh, as each search goes out.
  const loading = STAGE_AT.some((at) => t > at - 0.24 && t < at + 0.02);
  const spinner = loading && !chosen ? t * 1.45 : null;
  const reveal = inOutCubic(prog(t, T.boxIn, T.boxIn + 0.8));
  const radius = mix(14, LOOKS.plum.radius, r.m);

  const pop = prog(t, T.results, T.results + 0.42);
  const leave = outCubic(prog(t, T.enter, T.enter + 0.4));
  const rowK = rowsIn(t);
  const active = [inOutSine(prog(t, T.arrowDown, T.arrowDown + 0.12))];
  const popW = w;

  // The caret, a single speck stretching into a line as the box forms around it.
  const caretGrow = outCubic(prog(t, T.liftEnd - 0.08, T.liftEnd + 0.2));

  return (
    <>
      {t < T.boxIn + 0.8 && (
        <div style={{ position: "absolute", left: CARET.x - 1, top: CARET.y - 2 - caretGrow * 11, width: 2 + (1 - caretGrow) * 2, height: 4 + caretGrow * 22,
          background: "#fff", boxShadow: "0 0 12px rgba(196,181,253,.9)", opacity: 1 - prog(t, T.boxIn + 0.55, T.boxIn + 0.8) }} />
      )}
      <div style={{ position: "absolute", left: r.x, top: r.y, width: w, height: h, transform: `scale(${s})`, transformOrigin: "0 0" }}>
        <Dither p={reveal} w={w} h={h} cell={4} sweep={{ x: 44 / w, y: 0.5 }} spread={0.35} seed={11} band={0.12}>
          <SearchBox look={look} w={w} h={h} radius={radius} text={text} placeholder={r.m > 0.5 ? "Search by name or city" : "Search for a church"}
            caret={caret} chosen={chosen} spinner={spinner} heroGlow={1 - r.m} fontSize={mix(17, 15, r.m)} />
        </Dither>
        {pop > 0 && leave < 1 && (
          <div style={{ position: "absolute", left: 0, top: h + 8, opacity: 1 - leave }}>
            <Dither p={pop} w={popW} h={440} cell={5} sweep="down" spread={0.45} seed={13} band={0.1}>
              <Popover rows={resultsAt(t)} look={look} w={popW} active={active} rowK={rowK} radius={radius} footK={outCubic(prog(t, T.results + 0.5, T.results + 0.9))} />
            </Dither>
          </div>
        )}
      </div>
    </>
  );
}

/** The picked row, floating under the box after the popover closes, until it bursts. */
function rowRect(t: number) {
  const r = boxRect(t);
  return { x: r.x + 7 * r.s, y: r.y + r.h + 15 * r.s, w: r.w - 14 * r.s, h: 52 * r.s, s: r.s, m: r.m };
}

export function PickedRow({ t }: { t: number }) {
  if (t < T.enter || t > T.burst + 0.5) return null;
  const tt = Math.min(t, BOX_HANDOFF - 0.01);
  const r = rowRect(tt);
  const look = widgetMix(r.m, LOOKS.plum.accent);
  const p = 1 - inOutCubic(prog(t, T.burst, T.burst + 0.4));
  const lift = outCubic(prog(t, T.enter, T.enter + 0.35));
  return (
    <div style={{ position: "absolute", left: r.x, top: r.y, transform: `scale(${r.s})`, transformOrigin: "0 0" }}>
      <Dither p={p} w={r.w / r.s} h={52} cell={4} sweep="none" seed={17} band={0.15} edge="rgba(237,233,254,1)">
        <div style={{ borderRadius: 12, background: look.popover, boxShadow: `0 0 0 1px ${look.border}, 0 18px 40px -16px rgba(5,2,15,${0.7 * lift}), 0 0 40px -14px rgba(139,92,246,${0.7 * lift})` }}>
          <ResultRow row={RESULTS[0]} look={look} w={r.w / r.s} active={1} radius={10} style={{ minHeight: 52 }} />
        </div>
      </Dither>
    </div>
  );
}

/** The burst: the picked row's pixels stream into the seven fields, each landing as its field fills. */
export function FillStream({ t }: { t: number }) {
  const parts = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: 980 }, (_, n) => {
      const field = n % FIELDS;
      // Most pixels come from the row's two lines of text, the rest from its tile and body.
      const zone = r();
      const u = zone < 0.45 ? 0.1 + r() * 0.55 : zone < 0.75 ? 0.1 + r() * 0.42 : r();
      const v = zone < 0.45 ? 0.28 + r() * 0.2 : zone < 0.75 ? 0.62 + r() * 0.16 : r();
      return { field, u, v, start: r() * 0.3, end: r() * 0.22, lx: r(), ly: r(), swing: (r() - 0.5) * 2, k: r() };
    });
  }, []);
  if (t < T.burst || t > fieldAt(FIELDS - 1) + 0.8) return null;
  const row = rowRect(Math.min(T.burst, BOX_HANDOFF - 0.01));
  return (
    <PixelCanvas paint={(ctx) => {
      for (const p of parts) {
        const born = T.burst + p.start;
        const land = fieldAt(p.field) + 0.04 + p.end;
        const k = clamp((t - born) / (land - born));
        if (t < born || k >= 1) continue;
        const from = { x: row.x + p.u * row.w, y: row.y + p.v * row.h };
        const f = fieldOnScreen(p.field, t);
        const to = { x: f.x + 10 + p.lx * (f.w - 20), y: f.y + 6 + p.ly * (f.h - 12) };
        const ctl = { x: mix(from.x, to.x, 0.5) + p.swing * 240, y: Math.min(from.y, to.y) - 60 - p.k * 120 };
        const e = inOutCubic(k);
        const pt = quad(from, ctl, to, e);
        const a = k < 0.1 ? k / 0.1 : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
        // Over the white form, the pixels take the app's violet so they read; the brightest keep a lilac halo.
        speck(ctx, pt.x, pt.y, p.k < 0.3 ? 4 : 3, VIOLETS[Math.floor(p.k * VIOLETS.length)], a, p.k < 0.3 ? 2 : 0);
      }
    }} />
  );
}

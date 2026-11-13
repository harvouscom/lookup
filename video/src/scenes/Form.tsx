// Scenes 5–8: the Kinship window builds out of pixels and fills; it swaps design tokens; Harvest and
// Steeple fan out beside it; it strips to wireframe while the quickstart types out and links each
// tagged field; then someone fixes the service times and shares it.

import type { ReactNode } from "react";
import { clamp, inOutCubic, inOutQuint, mix, outCubic, prog, track } from "../ease.ts";
import { Dither } from "../pixels/dither.tsx";
import { FIELDS, fieldAt, FIX_DELETE, FIX_KEY_GAP, FIX_TYPE, SCENE, T } from "../timeline.ts";
import { AppWindow, fieldBox, FIX_ROW, SHARE_BTN, type PanelState } from "../ui/AppWindow.tsx";
import { ATTR_LINES, attrPoint, CODE_H, CODE_W, CodePanel, TOTAL_CHARS } from "../ui/CodePanel.tsx";
import { HarvestApp, SteepleApp } from "../ui/OtherApps.tsx";
import { CHURCH, FORM_FIELDS, LOOKS, STR, type Look } from "../ui/tokens.ts";
import { BOX_HANDOFF } from "./Search.tsx";
import { appMatrix, codeMatrix, fieldOnScreen, layerTilt, project, toFilm, winPlace, WIPE_DUR, WIPES } from "./place.ts";

/** Service times as typed: backspacing "9:00 am", then "10:30 am". */
function timesValue(t: number) {
  const base = CHURCH.times;
  if (t < T.deleteStart) return base;
  const del = Math.min(FIX_DELETE, Math.floor((t - T.deleteStart) / FIX_KEY_GAP) + 1);
  if (t < T.retypeStart) return base.slice(0, base.length - del);
  const add = Math.min(FIX_TYPE.length, Math.floor((t - T.retypeStart) / FIX_KEY_GAP) + 1);
  return base.slice(0, base.length - FIX_DELETE) + FIX_TYPE.slice(0, add);
}

function panelState(t: number): PanelState | undefined {
  if (t < T.panelIn) return undefined;
  const press = clamp(1 - Math.abs(t - T.shareClick - 0.06) / 0.1);
  return {
    open: outCubic(prog(t, T.panelIn, T.panelIn + 0.6)),
    phase: t < T.shareClick + 0.08 ? 0 : t < T.live ? 1 : 2,
    press,
    live: outCubic(prog(t, T.live, T.live + 0.25)),
  };
}

export const WINDOW_END = T.collapse + 0.9;

function Window({ t, look }: { t: number; look: Look }) {
  const values = FORM_FIELDS.map((f, i) => (i === 6 ? timesValue(t) : f.value));
  const filled = FORM_FIELDS.map((_, i) => outCubic(prog(t, fieldAt(i), fieldAt(i) + 0.4)));
  const editing = t >= T.focusTimes && t < T.panelIn + 0.6;
  const typing = t >= T.deleteStart && t < T.retypeStart + FIX_TYPE.length * FIX_KEY_GAP + 0.2;
  const blink = ((t - T.focusTimes) % 1.06) < 0.53 ? 1 : 0;
  return (
    <AppWindow
      look={look}
      values={values}
      filled={filled}
      status={t >= T.filledNote ? { text: `Autofilled ${FIELDS} of ${FIELDS} fields from Here's My Church`, done: true } : undefined}
      church={{ text: CHURCH.name, chosen: true, show: t >= BOX_HANDOFF }}
      focus={editing ? { i: 6, ring: outCubic(prog(t, T.focusTimes, T.focusTimes + 0.2)), caret: typing ? 1 : blink } : undefined}
      panel={panelState(t)}
      renderValue={(i, node, box) => {
        const p = inOutCubic(prog(t, fieldAt(i), fieldAt(i) + 0.45));
        if (p >= 1) return node;
        return <Dither p={p} w={box.w} h={box.h} cell={3} sweep="right" spread={0.45} seed={20 + i} band={0.18}>{node}</Dither>;
      }}
    />
  );
}

/** The window wearing its look at t, with a dither wipe into the next look when one is under way. */
function Themed({ t }: { t: number }) {
  let base = LOOKS.plum;
  let wipe: { k: number; to: Look; i: number } | null = null;
  WIPES.forEach((w, i) => {
    if (t >= w.at + WIPE_DUR) base = w.to;
    else if (t >= w.at) { base = w.from; wipe = { k: inOutCubic(prog(t, w.at, w.at + WIPE_DUR)), to: w.to, i }; }
  });
  const pl = winPlace(t);
  const w = wipe as { k: number; to: Look; i: number } | null;
  return (
    <>
      <Window t={t} look={base} />
      {w && (
        <Dither p={w.k} w={1000} h={pl.H} cell={7} sweep="right" spread={0.4} seed={40 + w.i} band={0.06} style={{ left: 0, top: 0 }}>
          <Window t={t} look={w.to} />
        </Dither>
      )}
    </>
  );
}

export function FormLayer({ t }: { t: number }) {
  if (t < T.windowIn || t > WINDOW_END) return null;
  const pl = winPlace(t);
  const build = inOutCubic(prog(t, T.windowIn, T.windowIn + 1.5));
  // In scene 9 the window falls away toward the fix row, which travels on alone.
  const gone = inOutCubic(prog(t, T.collapse, T.collapse + 0.8));
  const p = Math.min(build, 1 - gone);
  // Tipped back over its code, the app turns slightly glassy so the layer beneath reads through it.
  const tilt = layerTilt(t);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1000, height: pl.H, transform: appMatrix(t).toString(), transformOrigin: "0 0",
      opacity: 1 - 0.16 * tilt }}>
      <Dither p={p} w={1000} h={pl.H} cell={6} sweep={gone > 0 ? { x: (FIX_ROW.x + 120) / 1000, y: (FIX_ROW.y + 30) / pl.H } : "down"}
        spread={0.55} seed={gone > 0 ? 31 : 30} band={0.08}>
        <Themed t={t} />
      </Dither>
    </div>
  );
}

/** 6 · Two more apps fan out beside Kinship, each with the same church in its own look. */
export function Fan({ t }: { t: number }) {
  if (t < T.fan || t > SCENE.oneTag + 0.6) return null;
  const k = inOutQuint(prog(t, T.fan + 0.1, T.fan + 1.3));
  const show = Math.min(inOutCubic(prog(t, T.fan + 0.25, T.fan + 1.1)), 1 - inOutCubic(prog(t, SCENE.oneTag - 0.25, SCENE.oneTag + 0.45)));
  const drift = (t - T.fan) * 6;
  // Cards centered beside Kinship, turned slightly inward like a hand of cards.
  const card = (side: -1 | 1, node: ReactNode, h: number) => (
    <div style={{ position: "absolute", left: 960 + side * mix(120, 560 + drift, k) - 380, top: 520 - h / 2, width: 760, height: h,
      transform: `perspective(2400px) rotateY(${side * -mix(2, 9, k)}deg) scale(${mix(0.62, 0.78, k)})`, transformOrigin: "50% 50%" }}>
      <Dither p={show} w={760} h={h} cell={6} sweep={side < 0 ? "left" : "right"} spread={0.5} seed={side < 0 ? 51 : 52}>{node}</Dither>
    </div>
  );
  return (
    <>
      {card(-1, <HarvestApp />, 336)}
      {card(1, <SteepleApp />, 330)}
    </>
  );
}

/** Which field each tagged line of the snippet fills: city, website, service times (the form's right column). */
const LINK_FIELDS = [2, 4, 6];

/**
 * 7 · The layer that makes the app: the camera tips the app back, the quickstart types out on a glass
 * layer beneath it, and a beam of light rises from each data-hmc-field to the field it fills.
 */
export function Code({ t, part }: { t: number; part: "layer" | "beams" }) {
  const tilt = layerTilt(t);
  if (t < T.codeIn || t > T.formBack || tilt <= 0.001) return null;
  const p = inOutCubic(prog(t, T.codeIn + 0.2, T.codeIn + 1.0));
  const chars = Math.floor(TOTAL_CHARS * prog(t, T.codeTypeStart, T.codeTypeEnd));
  const fade = 1 - prog(t, T.formBack - 1.2, T.formBack - 0.6);
  const glow = ATTR_LINES.map((_, i) => outCubic(prog(t, T.links + i * 0.28, T.links + i * 0.28 + 0.4)) * fade);
  const cm = codeMatrix(t), am = appMatrix(t), pl = winPlace(t);
  if (part === "layer") return (
      <div style={{ position: "absolute", left: 0, top: 0, width: CODE_W, height: CODE_H, transform: cm.toString(), transformOrigin: "0 0",
        opacity: Math.min(1, tilt * 1.4) * fade }}>
        <Dither p={p} w={CODE_W} h={CODE_H} cell={6} sweep={{ x: 0, y: 0 }} spread={0.45} seed={60}>
          <CodePanel chars={chars} glow={glow} caret={((t - T.codeIn) % 1.06) < 0.53 || (t > T.codeTypeStart && t < T.codeTypeEnd) ? 1 : 0} />
        </Dither>
      </div>
  );
  return (
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        {ATTR_LINES.map((a, i) => {
          const at = T.links + i * 0.28;
          const k = inOutCubic(prog(t, at, at + 0.55));
          if (k <= 0 || fade <= 0) return null;
          const ap = attrPoint(a);
          const from = project(cm, (ap.x0 + ap.x) / 2, ap.y);
          const fb = fieldBox(LINK_FIELDS[i], pl.open);
          const to = project(am, fb.x + fb.w / 2, fb.y + fb.h / 2);
          const head = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
          const arrive = outCubic(prog(t, at + 0.45, at + 0.8));
          // The field's outline, projected onto the tipped app.
          const c = [[fb.x - 3, fb.y - 3], [fb.x + fb.w + 3, fb.y - 3], [fb.x + fb.w + 3, fb.y + fb.h + 3], [fb.x - 3, fb.y + fb.h + 3]]
            .map(([x, y]) => project(am, x, y)).map((q) => `${q.x},${q.y}`).join(" ");
          return (
            <g key={i} opacity={fade}>
              <line x1={from.x} y1={from.y} x2={head.x} y2={head.y} stroke="rgba(139,92,246,.6)" strokeWidth={9} style={{ filter: "blur(6px)" }} />
              <line x1={from.x} y1={from.y} x2={head.x} y2={head.y} stroke="rgba(221,214,254,.95)" strokeWidth={1.6} />
              <circle cx={from.x} cy={from.y} r={4} fill="#C4B5FD" style={{ filter: "drop-shadow(0 0 8px rgba(196,181,253,1))" }} />
              {k < 1 && <circle cx={head.x} cy={head.y} r={3.5} fill="#fff" style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,1))" }} />}
              <polygon points={c} fill={`rgba(167,139,250,${0.12 * arrive})`} stroke={`rgba(196,181,253,${0.9 * arrive})`} strokeWidth={1.6}
                style={{ filter: `drop-shadow(0 0 ${10 * arrive}px rgba(167,139,250,.95))` }} />
            </g>
          );
        })}
      </svg>
  );
}

/** 8 · The pointer that edits service times and presses Share. */
export function Pointer({ t }: { t: number }) {
  if (t < T.formBack + 0.8 || t > T.live + 0.9) return null;
  const f6 = fieldOnScreen(6, t);
  const pl = winPlace(t);
  const btn = toFilm(SHARE_BTN, pl);
  const atField = { x: f6.x + f6.w * 0.62, y: f6.y + f6.h * 0.6 };
  const k1 = inOutCubic(prog(t, T.formBack + 0.9, T.focusTimes - 0.02));
  const k2 = inOutCubic(prog(t, T.panelIn + 0.75, T.shareClick - 0.05));
  const start = { x: 1500, y: 980 };
  const x = k2 > 0 ? mix(atField.x, btn.x, k2) : mix(start.x, atField.x, k1);
  const y = k2 > 0 ? mix(atField.y, btn.y, k2) + Math.sin(k2 * Math.PI) * -30 : mix(start.y, atField.y, k1);
  const a = Math.min(outCubic(prog(t, T.formBack + 0.8, T.formBack + 1.1)), 1 - prog(t, T.live + 0.5, T.live + 0.9));
  const click = Math.max(clamp(1 - Math.abs(t - T.focusTimes) / 0.09), clamp(1 - Math.abs(t - T.shareClick) / 0.09));
  return (
    <svg width={30} height={36} viewBox="0 0 24 28" style={{ position: "absolute", left: x - 4, top: y - 2, opacity: a, transform: `scale(${1.15 - 0.12 * click})`, transformOrigin: "4px 2px",
      filter: "drop-shadow(0 4px 8px rgba(5,2,15,.55))" }}>
      <path d="M3 2 L3 22 L8.2 17.2 L11.6 25 L15 23.5 L11.7 15.9 L18.5 15.6 Z" fill="#fff" stroke="#111014" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  );
}

export const strings = STR;

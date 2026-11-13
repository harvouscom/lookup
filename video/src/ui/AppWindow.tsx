// The homepage's "Kinship" app window (site/index.html .win), laid out absolutely so the film knows
// exactly where every field sits: the streams of pixels and the code links aim at these boxes.

import type { CSSProperties, ReactNode } from "react";
import { MONO, SANS } from "../fonts.ts";
import { LookupMark } from "./Mark.tsx";
import { APP, CHURCH, FORM_FIELDS, mixc, STR, widgetMix, type Look } from "./tokens.ts";
import { SearchBox } from "./Widget.tsx";

// Geometry, in the window's own pixels.
export const WIN_W = 1000;
export const BAR = 42;
const SIDE = 188;
export const MAIN_X = SIDE + 28;
export const MAIN_W = WIN_W - MAIN_X - 28;
export const CHURCH_Y = 174;
export const CHURCH_H = 46;
export const PANEL_Y = CHURCH_Y + CHURCH_H + 14;
export const PANEL_H = 204;
const GRID_Y = PANEL_Y + 2;
const ROW = 46;
const COL_W = (MAIN_W - 20) / 2;
const LABEL_W = 96;
const FOOT_H = 58;

export const gridY = (open: number) => GRID_Y + open * (PANEL_H + 14);

/** The card that holds just the church field and the form fields, for the code scene. */
export const FIELDS_CARD = { x: MAIN_X - 30, y: CHURCH_Y - 30, w: MAIN_W + 60 };
export const fieldsCardH = (open: number) => gridY(open) + 4 * ROW - 10 + 30 - FIELDS_CARD.y;
export const winH = (open: number) => gridY(open) + 4 * ROW - 10 + 20 + FOOT_H;

/** Field i's input box, in window pixels. Field 0 spans the row; the rest pair up. */
export function fieldBox(i: number, open = 0) {
  const r = i === 0 ? 0 : Math.ceil(i / 2);
  const c = i === 0 ? 0 : (i - 1) % 2;
  const x = MAIN_X + c * (COL_W + 20) + LABEL_W + 10;
  const w = i === 0 ? MAIN_W - LABEL_W - 10 : COL_W - LABEL_W - 10;
  return { x, y: gridY(open) + r * ROW, w, h: 36, labelX: MAIN_X + c * (COL_W + 20) };
}

export type PanelState = {
  /** 0..1, how far the panel has opened. */
  open: number;
  /** Button phase: 0 idle, 1 sending, 2 done. */
  phase: 0 | 1 | 2;
  /** Pressed-in amount for the click, 0..1. */
  press: number;
  /** 0..1 badge turning to "Live now". */
  live: number;
};

export type WindowProps = {
  look: Look;
  /** Per-field fill progress 0..1; under 1 the value is masked by the caller. */
  values?: string[];
  filled?: number[];
  status?: { text: string; done: boolean };
  church?: { text: string; chosen: boolean; show: boolean };
  focus?: { i: number; ring: number; caret: number };
  panel?: PanelState;
  /** Render something over a field's value (the dither mask while it fills). */
  renderValue?: (i: number, node: ReactNode, box: { w: number; h: number }) => ReactNode;
  /** 0..1 strips the window down to outlines, for the code scene. */
  wire?: number;
  style?: CSSProperties;
  appName?: string;
};

const Icon = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const NAV = [
  ["Home", "M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z"],
  ["Churches", "M8 1.5v3M6.5 3h3M3.5 14V8L8 5l4.5 3v6M6.5 14v-3a1.5 1.5 0 0 1 3 0v3M2 14h12"],
  ["Events", "M3 3.5h10v10H3zM3 6.5h10M5.5 2v3M10.5 2v3"],
  ["People", "M6 7.5a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5zM2 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4M11 3.2a2.2 2.2 0 0 1 0 4.2M12 9.7c1.2.5 2 1.9 2 3.8"],
  ["Giving", "M8 13.5S2.5 10.3 2.5 6.4A2.9 2.9 0 0 1 8 5a2.9 2.9 0 0 1 5.5 1.4C13.5 10.3 8 13.5 8 13.5z"],
] as const;

export function AppWindow({ look, values, filled = [], status, church, focus, panel, renderValue, wire = 0, style }: WindowProps) {
  const open = panel?.open ?? 0;
  const H = winH(open);
  const acc = look.accent;
  const rad = (cap: number) => Math.min(look.radius, cap);
  const vals = values ?? FORM_FIELDS.map((f) => f.value);
  const fade = 1 - wire;
  const line = mixc(APP.line, "rgba(196,181,253,0.35)", wire);
  return (
    <div style={{
      position: "relative", width: WIN_W, height: H, borderRadius: 14, overflow: "hidden", fontFamily: SANS, color: APP.text,
      // In wireframe the app's frame falls away, leaving a snug card around the fields (FIELDS_CARD).
      background: mixc(APP.panel, "rgba(17,12,34,0)", wire), border: `1px solid ${mixc(APP.line2, "rgba(196,181,253,0)", wire)}`,
      boxShadow: wire < 1 ? `0 1px 2px rgba(17,12,34,${0.06 * fade}), 0 24px 48px -18px rgba(5,2,15,${0.6 * fade}), 0 70px 120px -50px rgba(76,29,149,${0.7 * fade})` : undefined,
      ...style,
    }}>
      {/* Title bar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: BAR, display: "flex", alignItems: "center", gap: 16, padding: "0 14px",
        borderBottom: `1px solid ${line}`, background: wire ? "transparent" : `linear-gradient(${APP.panel}, ${mixc(APP.frame, APP.panel, 0.3)})`, color: APP.muted, opacity: fade }}>
        <span style={{ display: "flex", gap: 8 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <i key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c, boxShadow: "inset 0 0 0 .5px rgba(0,0,0,.2)" }} />)}
        </span>
        <span style={{ display: "flex", gap: 6, color: APP.muted }}><Icon d="M10 4 6 8l4 4" size={14} /><Icon d="M6 4l4 4-4 4" size={14} /></span>
        <span style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ width: 360, height: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 7,
            background: "rgba(17,16,20,.05)", fontSize: 12, color: APP.text2 }}>
            <Icon d="M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z" size={11} />app.kinship.church/churches/new
          </span>
        </span>
        <Icon d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" size={14} />
      </div>

      {/* Sidebar */}
      <div style={{ position: "absolute", left: 0, top: BAR, bottom: 0, width: SIDE, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18,
        padding: "14px 10px 12px", borderRight: `1px solid ${line}`, background: wire ? "transparent" : mixc(APP.frame, APP.panel, 0.45), fontSize: 13, color: APP.text2, opacity: fade }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "2px 6px" }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", color: "#fff",
            background: `linear-gradient(135deg, ${mixc(acc, "#ffffff", 0.3)}, ${acc})` }}>
            <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="6" cy="8" r="3.6" /><circle cx="10" cy="8" r="3.6" /></svg>
          </span>
          <span style={{ flex: 1, display: "grid" }}><b style={{ fontWeight: 600, color: APP.text }}>Kinship</b><small style={{ fontSize: 11, color: APP.muted }}>Westside Network</small></span>
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          {NAV.map(([label, d]) => {
            const on = label === "Churches";
            return (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: rad(7),
                color: on ? acc : APP.text2, fontWeight: on ? 500 : 400, background: on ? mixc("rgba(0,0,0,0)", acc, 0.1) : "transparent" }}>
                <span style={{ color: on ? acc : APP.muted, display: "grid" }}><Icon d={d} /></span>{label}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 9, padding: "10px 6px 0", borderTop: `1px solid ${line}`, color: APP.text }}>
          <span style={{ width: 26, height: 26, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600, color: APP.text2, background: "rgba(17,16,20,.08)" }}>JD</span>
          <span style={{ display: "grid" }}>Jordan Diaz<small style={{ fontSize: 11, color: APP.muted }}>Admin</small></span>
        </div>
      </div>

      {/* Main */}
      <div style={{ opacity: fade }}>
        <p style={{ position: "absolute", left: MAIN_X, top: BAR + 20, margin: 0, fontSize: 12, color: APP.muted }}>Churches<span style={{ margin: "0 6px", opacity: 0.6 }}>/</span>New</p>
        <h2 style={{ position: "absolute", left: MAIN_X, top: BAR + 42, margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>Add a church</h2>
        <p style={{ position: "absolute", left: MAIN_X, top: BAR + 72, margin: 0, fontSize: 13, color: status?.done ? acc : APP.muted }}>
          {status?.text ?? "Pick a church above and Lookup fills this in."}
        </p>
        <label style={{ position: "absolute", left: MAIN_X, top: CHURCH_Y - 24, fontSize: 13, fontWeight: 600, color: APP.text }}>Find the church</label>
      </div>
      {wire > 0 && (
        <div style={{ position: "absolute", left: FIELDS_CARD.x, top: FIELDS_CARD.y, width: FIELDS_CARD.w, height: fieldsCardH(open), boxSizing: "border-box",
          borderRadius: 18, opacity: wire, background: "rgba(17,12,34,.72)", border: "1px solid rgba(196,181,253,.32)",
          boxShadow: "0 30px 80px -30px rgba(5,2,15,.9), 0 0 60px -24px rgba(124,58,237,.45)" }} />
      )}
      {church?.show && (
        <SearchBox look={widgetMix(1, acc)} w={MAIN_W} h={CHURCH_H} radius={rad(10)} text={church.text} chosen={church.chosen}
          placeholder="Search by name or city" fontSize={15} style={{ position: "absolute", left: MAIN_X, top: CHURCH_Y }} />
      )}

      {panel && open > 0 && <SharePanel look={look} panel={panel} />}

      {/* Fields */}
      {FORM_FIELDS.map((f, i) => {
        const b = fieldBox(i, open);
        const k = filled[i] ?? 0;
        const foc = focus && focus.i === i ? focus : null;
        const value = (
          <span style={{ display: "flex", alignItems: "center", height: b.h, padding: "0 12px", fontSize: 14, color: mixc(APP.text, "#EDE9FE", wire), whiteSpace: "pre" }}>
            {vals[i]}
            {foc && foc.caret > 0 && <span style={{ display: "inline-block", width: 1.5, height: 18, marginLeft: 1, background: APP.text, opacity: foc.caret }} />}
          </span>
        );
        return (
          <div key={f.key}>
            <label style={{ position: "absolute", left: b.labelX, top: b.y, height: b.h, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500,
              color: mixc(APP.text2, "rgba(237,233,254,0.85)", wire) }}>{f.label}</label>
            <div style={{
              position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, boxSizing: "border-box", overflow: "hidden",
              borderRadius: rad(18), border: `1px solid ${wire ? `rgba(196,181,253,${0.35 + 0.3 * wire})` : mixc(APP.line2, mixc(APP.line2, acc, 0.45), k)}`,
              background: wire ? "transparent" : mixc(APP.panel, mixc(APP.panel, acc, 0.06), k),
              boxShadow: [`0 1px 2px rgba(17,16,20,${0.04 * fade})`, foc ? `0 0 0 2px ${mixc("rgba(0,0,0,0)", acc, foc.ring)}` : ""].filter(Boolean).join(", "),
            }}>
              <span style={{ position: "absolute", left: 12, top: 0, height: b.h, display: "flex", alignItems: "center", fontSize: 14,
                color: mixc(APP.muted, "rgba(237,233,254,0.6)", wire), opacity: (1 - k) * 0.75 }}>—</span>
              {wire > 0 && (
                <span style={{ position: "absolute", right: 6, top: 6, bottom: 6, display: "flex", alignItems: "center", padding: "0 7px", borderRadius: 6,
                  fontFamily: MONO, fontSize: 11, color: "#DDD6FE", background: "rgba(167,139,250,.16)", border: "1px solid rgba(167,139,250,.28)", opacity: wire }}>{f.key}</span>
              )}
              <div style={{ position: "absolute", inset: 0 }}>
                {renderValue ? renderValue(i, value, { w: b.w, h: b.h }) : k >= 1 ? value : null}
              </div>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{ position: "absolute", left: SIDE, right: 0, bottom: 0, height: FOOT_H, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8,
        padding: "0 28px", borderTop: `1px solid ${line}`, background: wire ? "transparent" : mixc(APP.frame, APP.panel, 0.6), opacity: fade }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: "auto", fontSize: 13, color: APP.muted }}>
          <LookupMark size={16} id="win" />Autofilled by Lookup
        </span>
        <span style={{ minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 16px", boxSizing: "border-box", borderRadius: rad(18), fontSize: 14, fontWeight: 500,
          border: `1px solid ${APP.line2}`, background: APP.panel, color: APP.text }}>Cancel</span>
        <span style={{ minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 16px", boxSizing: "border-box", borderRadius: rad(18), fontSize: 14, fontWeight: 500,
          border: `1px solid ${acc}`, background: acc, color: "#fff" }}>Save church</span>
      </div>
    </div>
  );
}

/** The widget's share-fixes panel (element.ts .cs), with the real strings. */
function SharePanel({ look, panel }: { look: Look; panel: PanelState }) {
  const acc = look.accent;
  const w = widgetMix(1, acc);
  const r = Math.min(look.radius, 10);
  const badgeLive = panel.live;
  const badgeBg = mixc(mixc("rgba(0,0,0,0)", acc, 0.12), "rgba(22,163,74,0.14)", badgeLive);
  const badgeFg = mixc(acc, "#15803D", badgeLive);
  const btn = panel.phase === 0 ? STR.shareN(1) : panel.phase === 1 ? STR.sending : STR.done;
  return (
    <div style={{
      position: "absolute", left: MAIN_X, top: PANEL_Y, width: MAIN_W, height: PANEL_H * panel.open, overflow: "hidden", boxSizing: "border-box",
      border: `1px solid ${w.border}`, borderRadius: r, background: mixc("#ffffff", acc, 0.05), fontSize: 14, color: w.text,
    }}>
      <div style={{ padding: "12px 14px", opacity: Math.min(1, panel.open * 1.6 - 0.4) }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{STR.shareTitle}</h3>
        <p style={{ margin: "4px 0 10px", fontSize: 13, color: w.muted }}>{STR.shareBody}</p>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", padding: "6px 4px", alignItems: "start" }}>
          <span style={{ width: 18, height: 18, marginTop: 2, borderRadius: 4, background: acc, display: "grid", placeItems: "center" }}>
            <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
          </span>
          <span style={{ fontWeight: 600 }}>Service times</span>
          <span style={{ gridColumn: 2, display: "flex", gap: 8, color: w.muted }}>
            <s style={{ opacity: 0.75 }}>{CHURCH.times}</s><span>→</span><span style={{ color: w.text }}>{CHURCH.fixedTimes}</span>
          </span>
          <span style={{ gridColumn: 2, justifySelf: "start", padding: "1px 8px", borderRadius: 999, fontSize: 12, background: badgeBg, color: badgeFg,
            display: "inline-flex", alignItems: "center", gap: 6 }}>
            {badgeLive > 0.5 && <i style={{ width: 6, height: 6, borderRadius: 9, background: "#16A34A" }} />}
            {badgeLive > 0.5 ? STR.st.live : STR.goesLive}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <span style={{ minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: Math.max(2, r - 2), fontWeight: 600, fontSize: 14,
            border: `1px solid ${acc}`, background: acc, color: "#fff", transform: `scale(${1 - 0.04 * panel.press})`, opacity: panel.phase === 1 ? 0.7 : 1 }}>{btn}</span>
          {panel.phase === 0 && (
            <span style={{ minHeight: 36, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: Math.max(2, r - 2), fontWeight: 600, fontSize: 14,
              border: `1px solid ${w.inputBorder}`, color: w.text }}>{STR.notNow}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Where the share panel's fix row sits, in window pixels (for the pixel that carries it home). */
export const FIX_ROW = { x: MAIN_X + 16, y: PANEL_Y + 66, w: 380, h: 66 };
/** The share button's center, in window pixels. */
export const SHARE_BTN = { x: MAIN_X + 14 + 54, y: PANEL_Y + 166 };

export const monoLabel: CSSProperties = { fontFamily: MONO, fontSize: 12 };

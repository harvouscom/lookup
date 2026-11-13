// A display-only copy of the <church-lookup> widget: its input, results popover and footer, drawn
// from the element's own CSS (packages/sdk/src/element.ts) so it looks exactly like the product.

import type { CSSProperties } from "react";
import { SANS } from "../fonts.ts";
import { mixc, STR, type WidgetLook } from "./tokens.ts";

export const SearchIcon = ({ size = 20, color }: { size?: number; color: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

export const ChurchIcon = ({ size = 16, color }: { size?: number; color: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v5M10 4h4M6 21V11l6-4 6 4v10M3 21h18M10 21v-4a2 2 0 0 1 4 0v4" />
  </svg>
);

/** Here's My Church's mark: a lilac cursive "h" on a plum tile. */
export const HmcMark = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} style={{ flex: "none", borderRadius: size / 4 }}>
    <rect width="20" height="20" rx="5" fill="#3B1D6E" />
    <path d="M-1 16C3 14 6 9 7.4 5.2 8.4 2.4 6.3 1.7 5.8 4.6 5.3 8 5.5 13 5.7 21M5.9 15.2C7.1 11.4 9.9 9.4 11.9 10.2 13.8 11 13.3 14.6 13.8 16.8 14.2 18.6 17 18.2 21 15.4"
      fill="none" stroke="#D2B4FB" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClearIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

export function SearchBox({ look, w, h = 52, radius = 10, text, placeholder, caret = 0, chosen = false, spinner = null, ring = 0, heroGlow = 0, fontSize = 17, style }: {
  look: WidgetLook; w: number; h?: number; radius?: number; text: string; placeholder?: string; caret?: number; chosen?: boolean;
  /** Spinner angle in turns while loading, or null. */
  spinner?: number | null;
  /** Focus ring strength 0..1. */
  ring?: number;
  /** The hero's violet halo under the box, 0..1. */
  heroGlow?: number;
  fontSize?: number;
  style?: CSSProperties;
}) {
  const shadow = [
    heroGlow ? `0 0 0 6px rgba(124,58,237,${0.1 * heroGlow}), 0 24px 60px -24px rgba(124,58,237,${0.75 * heroGlow})` : "",
    ring ? `0 0 0 4px ${mixc(look.accent, "rgba(0,0,0,0)", 1 - 0.22 * ring)}` : "",
  ].filter(Boolean).join(", ");
  return (
    <div style={{ position: "relative", width: w, height: h, fontFamily: SANS, ...style }}>
      <div style={{
        position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: radius, background: look.bg,
        border: `1px solid ${ring ? mixc(look.inputBorder, look.accent, ring) : look.inputBorder}`, boxShadow: shadow || undefined,
      }} />
      <div style={{ position: "absolute", left: 14, top: h / 2 - 10, color: look.muted, display: "grid" }}><SearchIcon color={look.muted} /></div>
      <div style={{ position: "absolute", left: 44, right: chosen ? 48 : 16, top: 0, bottom: 0, display: "flex", alignItems: "center",
        fontSize, color: text ? look.text : look.muted, whiteSpace: "pre", overflow: "hidden" }}>
        <span style={{ opacity: text ? 1 : 0.85 }}>{text || placeholder}</span>
        {caret > 0 && (
          <span style={{ display: "inline-block", width: 1.5, height: fontSize * 1.25, marginLeft: text ? 1 : -((placeholder?.length ?? 0) > 0 ? 0 : 0),
            background: look.text, opacity: caret, position: text ? "relative" : "absolute", left: text ? 0 : 0 }} />
        )}
      </div>
      {chosen && (
        <div style={{ position: "absolute", right: 10, top: h / 2 - 16, width: 32, height: 32, display: "grid", placeItems: "center" }}>
          <ClearIcon color={look.muted} />
        </div>
      )}
      {spinner != null && (
        <div style={{ position: "absolute", right: 16, top: h / 2 - 9, width: 14, height: 14, borderRadius: "50%",
          border: `2px solid ${look.border}`, borderTopColor: look.accent, transform: `rotate(${spinner}turn)` }} />
      )}
    </div>
  );
}

export type Row = { name: string; sub: string; d: string };

/** One result row: tinted icon tile, name over location, distance on the right. */
export function ResultRow({ row, look, w, active = 0, radius = 10, style }: { row: Row; look: WidgetLook; w: number; active?: number; radius?: number; style?: CSSProperties }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "28px 1fr auto", alignItems: "center", gap: 10, minHeight: 44, padding: "4px 8px",
      boxSizing: "border-box", width: w, borderRadius: radius, fontFamily: SANS,
      background: active ? mixc("rgba(0,0,0,0)", look.active, active) : "transparent", ...style,
    }}>
      <div style={{ width: 28, height: 28, borderRadius: radius - 3, display: "grid", placeItems: "center",
        background: mixc("rgba(0,0,0,0)", look.accent, 0.12) }}>
        <ChurchIcon color={look.accent} />
      </div>
      <div style={{ display: "grid", minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3, color: look.text, whiteSpace: "nowrap" }}>{row.name}</span>
        <span style={{ fontSize: 13, lineHeight: 1.35, color: look.muted, whiteSpace: "nowrap" }}>{row.sub}</span>
      </div>
      <span style={{ fontSize: 12, color: look.muted, fontVariantNumeric: "tabular-nums" }}>{row.d}</span>
    </div>
  );
}

/** The results popover: rows, "Show more results", and the Here's My Church footer. rowK fades each row in. */
export function Popover({ rows, look, w, active, rowK, radius = 10, footK = 1 }: {
  rows: Row[]; look: WidgetLook; w: number; active: number[]; rowK: number[]; radius?: number; footK?: number;
}) {
  const inner = w - 12;
  return (
    <div style={{
      width: w, boxSizing: "border-box", padding: 6, background: look.popover, border: `1px solid ${look.border}`, borderRadius: radius + 4,
      boxShadow: "0 20px 40px -12px rgba(5,2,15,.55), 0 4px 10px -4px rgba(5,2,15,.3)", fontFamily: SANS,
    }}>
      <div style={{ display: "grid", gap: 1 }}>
        {rows.map((r, i) => (
          <ResultRow key={r.name} row={r} look={look} w={inner} active={active[i] ?? 0} radius={radius}
            style={{ opacity: rowK[i] ?? 1, transform: `translateY(${(1 - (rowK[i] ?? 1)) * 6}px)` }} />
        ))}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 44, fontSize: 14, fontWeight: 600, color: look.accent,
          opacity: rowK[rows.length] ?? 1 }}>{STR.more}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "10px 10px 4px", borderTop: `1px solid ${look.border}`,
        fontSize: 12, color: look.muted, opacity: footK }}>
        <HmcMark />
        <span>{STR.dataFrom} <b style={{ fontWeight: 600, color: look.text }}>Here's My Church</b></span>
        <span style={{ marginLeft: "auto", fontSize: 11 }}>© OpenStreetMap</span>
      </div>
    </div>
  );
}

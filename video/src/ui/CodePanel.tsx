// The quickstart snippet in the site's lookup-dark theme, typed out character by character.
// Tokens come from scripts/highlight.mjs (Shiki), so colors match the docs exactly.

import { MONO } from "../fonts.ts";
import code from "./code-tokens.json";

type Tok = { c: string; f: string };
const LINES = code.lines as Tok[][];

export const CODE_FONT = 17;
export const CODE_LH = 30;
export const CODE_PAD = { x: 28, top: 58 };
/** Geist Mono advances 0.6em per character. */
export const CHAR_W = CODE_FONT * 0.6;
export const CODE_W = 800;
export const CODE_H = CODE_PAD.top + LINES.length * CODE_LH + 26;
export const TOTAL_CHARS = LINES.reduce((n, l) => n + l.reduce((m, t) => m + t.c.length, 0) + 1, 0);

/** Lines holding data-hmc-field, and the column where that attribute starts, for drawing links. */
export const ATTR_LINES = LINES.map((l, i) => {
  const text = l.map((t) => t.c).join("");
  const col = text.indexOf("data-hmc-field");
  return col >= 0 ? { line: i, col, len: text.length - col } : null;
}).filter((x): x is { line: number; col: number; len: number } => !!x);

export function attrPoint(a: { line: number; col: number; len: number }) {
  return { x: CODE_PAD.x + (a.col + a.len) * CHAR_W + 6, y: CODE_PAD.top + a.line * CODE_LH + CODE_LH / 2, x0: CODE_PAD.x + a.col * CHAR_W };
}

export function CodePanel({ chars, glow = [], caret = 1 }: { chars: number; glow?: number[]; caret?: number }) {
  let left = chars;
  let caretAt: { line: number; col: number } | null = null;
  const rows = LINES.map((line, li) => {
    const out: { c: string; f: string }[] = [];
    let col = 0;
    for (const t of line) {
      if (left <= 0) break;
      const take = Math.min(left, t.c.length);
      out.push({ c: t.c.slice(0, take), f: t.f });
      left -= take; col += take;
      if (take < t.c.length) break;
    }
    if (left > 0) left -= 1; // the newline
    else if (!caretAt) caretAt = { line: li, col };
    return out;
  });
  if (!caretAt) caretAt = { line: LINES.length - 1, col: LINES[LINES.length - 1].reduce((n, t) => n + t.c.length, 0) };
  const c = caretAt as { line: number; col: number };
  return (
    <div style={{ position: "relative", width: CODE_W, height: CODE_H, borderRadius: 14, background: code.bg, border: "1px solid rgba(255,255,255,0.09)",
      boxShadow: "0 30px 80px -30px rgba(5,2,15,.9), 0 0 0 1px rgba(0,0,0,.4), 0 0 60px -20px rgba(124,58,237,.35)", fontFamily: MONO, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 18px",
        borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 12, color: "#8A8799" }}>
        <span style={{ color: "#ECEBF2", padding: "4px 10px", borderRadius: 6, background: "rgba(255,255,255,.06)" }}>signup.html</span>
        <span style={{ marginLeft: "auto" }}>HTML</span>
      </div>
      {ATTR_LINES.map((a, i) => {
        const g = glow[i] ?? 0;
        if (g <= 0) return null;
        const p = attrPoint(a);
        return <div key={i} style={{ position: "absolute", left: p.x0 - 4, top: CODE_PAD.top + a.line * CODE_LH + 3, width: p.x - p.x0 - 2, height: CODE_LH - 6,
          borderRadius: 6, background: `rgba(167,139,250,${0.16 * g})`, boxShadow: `inset 0 0 0 1px rgba(196,181,253,${0.35 * g})` }} />;
      })}
      {rows.map((r, i) => (
        <div key={i} style={{ position: "absolute", left: CODE_PAD.x, top: CODE_PAD.top + i * CODE_LH, height: CODE_LH, display: "flex", alignItems: "center",
          fontSize: CODE_FONT, whiteSpace: "pre" }}>
          {r.map((t, j) => <span key={j} style={{ color: t.f }}>{t.c}</span>)}
        </div>
      ))}
      <div style={{ position: "absolute", left: CODE_PAD.x + c.col * CHAR_W, top: CODE_PAD.top + c.line * CODE_LH + 5, width: 2, height: CODE_LH - 10,
        background: "#C4B5FD", opacity: caret }} />
    </div>
  );
}

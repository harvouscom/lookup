// Kinetic type: words arrive one at a time, from a soft blur and a few pixels low, to sharp.

import type { CSSProperties } from "react";
import { clamp, outCubic, prog } from "../ease.ts";
import { SANS } from "../fonts.ts";

export function Words({ text, t, at, out, stagger = 0.06, dur = 0.7, blur = 10, rise = 10, style, wordStyle, gradient }: {
  text: string; t: number; at: number; out?: number; stagger?: number; dur?: number; blur?: number; rise?: number;
  style?: CSSProperties; wordStyle?: CSSProperties; gradient?: string;
}) {
  const words = text.split(" ");
  // Leaving: the whole line softens and lifts away together.
  const leave = out == null ? 0 : outCubic(prog(t, out, out + 0.55));
  return (
    <div style={{ fontFamily: SANS, whiteSpace: "nowrap", ...style, opacity: 1 - leave, filter: leave ? `blur(${leave * 8}px)` : undefined,
      transform: leave ? `translateY(${-leave * 8}px)` : undefined }}>
      {words.map((w, i) => {
        const k = outCubic(clamp((t - at - i * stagger) / dur));
        return (
          <span key={i} style={{
            display: "inline-block", opacity: k, filter: k < 1 ? `blur(${(1 - k) * blur}px)` : undefined,
            transform: `translateY(${(1 - k) * rise}px)`, marginRight: i < words.length - 1 ? "0.26em" : 0,
            ...(gradient ? { backgroundImage: gradient, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", paddingBottom: "0.08em" } : null),
            ...wordStyle,
          }}>{w}</span>
        );
      })}
    </div>
  );
}

/** A caption under the action, in the site's rounded heading face. */
export function Caption({ text, t, at, out, y = 966, size = 36, muted }: { text: string; t: number; at: number; out: number; y?: number; size?: number; muted?: string }) {
  if (t < at - 0.4 || t > out + 0.8) return null;
  // A soft band of night under the caption, so it always has room to breathe above it.
  const band = Math.min(clamp((t - at + 0.4) / 0.5), 1 - clamp((t - out - 0.2) / 0.6));
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: y - 230, height: 1080 - (y - 230), opacity: band, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(5,2,15,0) 0%, rgba(5,2,15,.62) 55%, rgba(5,2,15,.78) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: y - size * 0.6, display: "flex", justifyContent: "center" }}>
        <Words text={text} t={t} at={at} out={out} style={{ fontSize: size, fontWeight: 500, letterSpacing: "-0.02em", color: "#EFEDFD",
          fontVariationSettings: '"ROND" 100' }} />
        {muted && null}
      </div>
    </>
  );
}

// Scene 11 and the captions: the Lookup mark draws itself over the closing globe, the call to action,
// and the fade to night. Captions for the middle of the film live here too, so their timing reads in
// one place.

import { inOutCubic, outCubic, prog } from "../ease.ts";
import { MONO, SANS } from "../fonts.ts";
import { Dither } from "../pixels/dither.tsx";
import { SCENE, SECONDS, T } from "../timeline.ts";
import { LookupMark } from "../ui/Mark.tsx";
import { Caption, Words } from "../ui/Words.tsx";

const GRAD = "linear-gradient(180deg, #FFFFFF 30%, #CFC3F5)";

export function Outro({ t }: { t: number }) {
  if (t < T.mark - 0.2) return null;
  const tile = inOutCubic(prog(t, T.mark - 0.1, T.mark + 0.55));
  const stroke = inOutCubic(prog(t, T.mark + 0.25, T.mark + 1.55));
  const size = 112;
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 236, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
        <div style={{ position: "relative", width: size, height: size, filter: `drop-shadow(0 18px 40px rgba(76,29,149,${0.7 * tile})) drop-shadow(0 0 ${30 * stroke}px rgba(167,139,250,.45))` }}>
          <Dither p={tile} w={size} h={size} cell={4} sweep={{ x: 0.5, y: 0.5 }} spread={0.4} seed={90} band={0.14}>
            <LookupMark size={size} draw={stroke} id="outro" />
          </Dither>
        </div>
        <div style={{ width: outCubic(prog(t, T.wordmark - 0.35, T.wordmark + 0.2)) * 340, overflow: "visible" }}>
          <Words text="Lookup" t={t} at={T.wordmark} dur={0.9} blur={16} rise={12} gradient={GRAD}
            style={{ fontSize: 112, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: "130px", fontVariationSettings: '"ROND" 100' }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 382, display: "flex", justifyContent: "center" }}>
        <Words text="by Here's My Church" t={t} at={T.wordmark + 0.35} stagger={0.07} style={{ fontSize: 28, fontWeight: 500, color: "rgba(239,237,253,.62)", letterSpacing: "-0.01em" }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 478, display: "flex", justifyContent: "center" }}>
        <Words text="Add church lookup to your app" t={t} at={T.url} stagger={0.06} style={{ fontSize: 40, fontWeight: 500, color: "#EFEDFD", letterSpacing: "-0.02em",
          fontVariationSettings: '"ROND" 100' }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 552, display: "flex", justifyContent: "center", opacity: outCubic(prog(t, T.url + 0.45, T.url + 1.0)),
        transform: `translateY(${(1 - outCubic(prog(t, T.url + 0.45, T.url + 1.0))) * 8}px)` }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "11px 20px", borderRadius: 999, fontFamily: MONO, fontSize: 22, color: "#EDE9FE",
          background: "rgba(167,139,250,.14)", border: "1px solid rgba(196,181,253,.3)", boxShadow: "0 0 40px -10px rgba(139,92,246,.7)" }}>
          lookup.heresmychurch.com
          <span style={{ fontFamily: SANS, fontSize: 16, color: "rgba(237,233,254,.6)" }}>· One script tag and no key.</span>
        </span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 628, display: "flex", justifyContent: "center", gap: 14, fontFamily: MONO, fontSize: 20,
        color: "rgba(239,237,253,.6)", opacity: outCubic(prog(t, T.url + 0.8, T.url + 1.3)) }}>
        <span style={{ color: "rgba(239,237,253,.95)", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(587842 * outCubic(prog(t, T.url + 0.8, T.url + 2.2))).toLocaleString("en-US")}
        </span>
        churches<span style={{ opacity: 0.5 }}>·</span><span><span style={{ color: "rgba(239,237,253,.95)" }}>19</span> countries</span>
      </div>
    </>
  );
}

/** Night falls over everything at the very end. */
export function FadeOut({ t }: { t: number }) {
  const a = inOutCubic(prog(t, T.fadeOut, SECONDS));
  if (a <= 0) return null;
  return <div style={{ position: "absolute", inset: 0, background: "#05020F", opacity: a }} />;
}

/** The middle captions and scene 10's three lines in the sky. */
export function Captions({ t }: { t: number }) {
  return (
    <>
      <Caption text="Search as you type." t={t} at={T.results + 0.3} out={T.enter - 0.1} />
      <Caption text="Pick a church. The form fills itself." t={t} at={T.fillCaption} out={T.teal - 0.2} />
      <Caption text="Your app. Your styles." t={t} at={T.stylesCaption} out={SCENE.oneTag - 0.45} />
      <Caption text="One script tag. No key." t={t} at={T.tagCaption} out={SCENE.fix - 0.6} />
      <Caption text="Someone fixes a detail. One checkbox shares it." t={t} at={T.fixCaption} out={SCENE.source - 0.15} />
      <Caption text="Every app that uses Lookup helps keep church data right." t={t} at={T.sourceCaption} out={SCENE.better - 0.5} />
      {t > T.better1 - 0.1 && t < SCENE.outro + 0.4 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "grid", justifyItems: "center", gap: 6, textShadow: "0 2px 30px rgba(5,2,15,.8)" }}>
          {[["Fixes flow back.", T.better1], ["Moderators review.", T.better2], ["Every app gets better data.", T.better3]].map(([s, at]) => (
            <Words key={s as string} text={s as string} t={t} at={at as number} out={SCENE.outro - 0.7} stagger={0.07} dur={0.8}
              style={{ fontSize: 58, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: "70px", fontVariationSettings: '"ROND" 100',
                color: at === T.better3 ? "#FFFFFF" : "rgba(239,237,253,.72)" }} />
          ))}
        </div>
      )}
    </>
  );
}

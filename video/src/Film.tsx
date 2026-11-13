// The Lookup film: the hero world underneath, the story's layers on top, the sound alongside.

import { AbsoluteFill } from "remotion";
import { outCubic, prog, track, useT } from "./ease.ts";
import { useFonts } from "./fonts.ts";
import { City } from "./hero/City.tsx";
import { World } from "./hero/World.tsx";
import { FirstLight, Headline, PlaceGlow } from "./scenes/Opening.tsx";
import { FillStream, Gather, PickedRow, resultsAt, SearchLayer } from "./scenes/Search.tsx";
import { Code, Fan, FormLayer, Pointer } from "./scenes/Form.tsx";
import { depthBlur } from "./scenes/place.ts";
import { FixChip, Homecoming, LiveTag, Network } from "./scenes/Loop.tsx";
import { Captions, FadeOut, Outro } from "./scenes/Outro.tsx";
import { Soundtrack } from "./Soundtrack.tsx";
import { SECONDS, T } from "./timeline.ts";
import { RESULTS } from "./ui/tokens.ts";
import { camera } from "./world.ts";

export function Film() {
  const fonts = useFonts();
  const t = useT();
  const cam = camera(t);
  // Result pins on the globe while the popover is open, and the pick's pulse after Enter.
  const pins = t > T.results && t < T.enter + 1.2 ? resultsAt(t).filter((_, i) => t > T.results + 0.1 + i * 0.06).map(({ lat, lng }) => ({ lat, lng })) : [];
  const selected = t >= T.enter && t < T.burst + 2 ? { ...RESULTS[0], at: T.enter } : null;
  const glow = track(t, [[0, 0], [T.localGlow, 0], [T.localGlow + 0.7, 1, outCubic], [T.enter, 0.45], [T.burst + 0.4, 0.45], [T.burst + 1.6, 0],
    [T.impact - 0.05, 0], [T.impact + 0.12, 1.4, outCubic], [T.impact + 1.6, 0.5], [T.pullBack + 1.2, 0]]);
  // A slow push on the world, so the background never sits still. UI stays at 1:1 so it stays crisp.
  const push = 1 + 0.012 * Math.sin((t / SECONDS) * Math.PI);
  return (
    <AbsoluteFill style={{ background: "#05020F", overflow: "hidden" }}>
      <AbsoluteFill>
        <AbsoluteFill style={{ transform: `scale(${push})`, filter: depthBlur(t) > 0.05 ? `blur(${depthBlur(t).toFixed(2)}px)` : undefined }}>
        <World cam={cam} t={t} pins={pins} selected={selected} overGlobe={<><City t={t} /><PlaceGlow t={t} a={glow} size={340 * Math.min(1.9, Math.max(1, cam.scale / 3.5))} color={t > T.impact - 0.1 && t < T.pullBack + 1.5 ? "134,239,172" : "167,139,250"} /></>} />
        </AbsoluteFill>
        <FirstLight t={t} />
        <Headline t={t} fonts={fonts} />
        <Gather t={t} />
        <Fan t={t} />
        <Code t={t} part="layer" />
        <FormLayer t={t} />
        <SearchLayer t={t} />
        <PickedRow t={t} />
        <FillStream t={t} />
        <Code t={t} part="beams" />
        <Pointer t={t} />
        <FixChip t={t} />
        <Homecoming t={t} />
        <LiveTag t={t} />
        <Network t={t} />
        <Outro t={t} />
        <Captions t={t} />
      </AbsoluteFill>
      <FadeOut t={t} />
      <Soundtrack />
      {/* Fade up from black over the first beat. */}
      <AbsoluteFill style={{ background: "#000", opacity: 1 - outCubic(prog(t, 0, 0.6)), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
}


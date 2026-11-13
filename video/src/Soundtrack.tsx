// The film's sound: the code-made score stems and the effects, placed on their cues. The list comes
// from scripts/score.ts, which writes the stems and this manifest together.

import { Audio, Sequence, staticFile } from "remotion";
import manifest from "./audio-manifest.json";
import { FPS } from "./timeline.ts";

type Clip = { file: string; at: number; gain: number; fadeIn?: number; fadeOut?: number; dur?: number };

export function Soundtrack() {
  const clips = (manifest as { clips: Clip[] }).clips;
  return (
    <>
      {clips.map((c, i) => (
        <Sequence key={i} from={Math.round(c.at * FPS)} layout="none">
          <Audio src={staticFile(c.file)} volume={(f) => {
            const s = f / FPS;
            const fi = c.fadeIn ? Math.min(1, s / c.fadeIn) : 1;
            const fo = c.fadeOut && c.dur ? Math.min(1, Math.max(0, (c.dur - s) / c.fadeOut)) : 1;
            return c.gain * fi * fo;
          }} />
        </Sequence>
      ))}
    </>
  );
}

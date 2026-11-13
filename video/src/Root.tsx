import { Composition } from "remotion";
import { Film } from "./Film.tsx";
import { DURATION, FPS, HEIGHT, WIDTH } from "./timeline.ts";

export function Root() {
  return <Composition id="LookupFilm" component={Film} durationInFrames={DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />;
}

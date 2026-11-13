// The hero world, back to front: night, aurora, stars, arc, rear orbit, globe, front orbit, grain.

import type { ReactNode } from "react";
import { Aurora } from "./Aurora.tsx";
import { Globe, type Pin } from "./Globe.tsx";
import { Backdrop, Grain, HorizonArc, Orbit } from "./Layers.tsx";
import { Sky } from "./Sky.tsx";
import type { Cam } from "../world.ts";

export function World({ cam, t, pins, selected, overGlobe }: {
  cam: Cam; t: number; pins?: Pin[]; selected?: (Pin & { at: number }) | null; overGlobe?: ReactNode;
}) {
  return (
    <>
      <Backdrop cam={cam} />
      <Aurora cam={cam} t={t} />
      <Sky cam={cam} t={t} />
      <HorizonArc cam={cam} />
      <Orbit cam={cam} which={0} />
      <Globe cam={cam} t={t} pins={pins} selected={selected} />
      {overGlobe}
      <Orbit cam={cam} which={1} />
      <Grain t={t} alpha={0.045} />
    </>
  );
}

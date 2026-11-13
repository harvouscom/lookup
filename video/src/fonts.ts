// The site's two typefaces, self-hosted so renders never wait on the network. Both are SIL OFL.
// Google Sans Flex is variable (wght, opsz and the ROND roundness axis the site's headings use).

import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

export const SANS = '"Google Sans Flex", ui-sans-serif, system-ui, sans-serif';
export const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

let ready: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  ready ??= Promise.all([
    loadFont({ family: "Google Sans Flex", url: staticFile("fonts/GoogleSansFlex-latin.woff2"), weight: "400 700",
      unicodeRange: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }),
    loadFont({ family: "Google Sans Flex", url: staticFile("fonts/GoogleSansFlex-latin-ext.woff2"), weight: "400 700",
      unicodeRange: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }),
    loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono-latin.woff2"), weight: "400 600" }),
  ]).then(() => document.fonts.ready).then(() => undefined);
  return ready;
}

/** True once the fonts are in, holding the render until then. Canvas text sampling waits on this. */
export function useFonts(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const h = delayRender("fonts");
    loadFonts().then(() => { setOk(true); continueRender(h); });
  }, []);
  return ok;
}

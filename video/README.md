# Lookup film

An 88-second product film for Lookup, built with [Remotion](https://www.remotion.dev). It uses the visual language of the homepage hero: the particle globe, aurora, starfield and horizon arc. Those are drawn by the site's own renderers (`site/globe.js`, `site/aurora.js`, `site/sky.js`), stepped one frame at a time.

The story: a church search fills a form → the same widget works in any app → it's one script tag → someone fixes a detail → the fix flows back to Here's My Church → every app gets better data.

## Run it

```bash
pnpm install
pnpm video                       # Remotion Studio: scrub the timeline at localhost:3000
pnpm --filter lookup-video stills 9.5 23.2 57.6   # review stills (seconds) → video/out/stills/
pnpm --filter lookup-video score  # re-synthesize the score → public/audio/, src/audio-manifest.json
pnpm video:render                # → video/out/lookup-film.mp4 (1920×1080, 60 fps, −14 LUFS)
SCALE=0.5 pnpm video:render      # quick half-size draft
```

A full render takes about 20 minutes on an M-series Mac. Renders go to `video/out/`, which is gitignored.

## How it's put together

- **`src/timeline.ts`** holds every beat, in seconds. Scenes animate between these times, and `scripts/score.ts` places sounds on the same times. To retime the film, change this file and re-run `score`.
- **`src/world.ts`** is the hero camera: where the globe sits, which way it faces, and how lit each layer is over time. `project()` mirrors globe.js's projection, so pixels can fly to Dallas exactly.
- **`src/hero/`** wraps the site renderers.
- **`src/pixels/`** holds the film's transitions:
  - `Dither`: reveals and dissolves through the globe's 4×4 Bayer dither, with a lilac front where the cells turn over.
  - `PixelCanvas`: particles that morph from one place to another.
- **`src/ui/`** holds display-only copies of the product, built from the real tokens:
  - the `<church-lookup>` widget, from `packages/sdk/src/element.ts`;
  - the Kinship window, from `site/index.html` and `site.css`;
  - the share-fixes panel;
  - the code panel.

  All copy is imported from `packages/sdk/src/strings.ts`, so it matches the widget. The code is highlighted once by `scripts/highlight.mjs` with the site's `lookup-dark` Shiki theme.
- **`src/scenes/`** has one file per act:
  - `Opening` (1–3)
  - `Search` (3–5)
  - `Form` (5–8)
  - `Loop` (9–10)
  - `Outro` (11, plus the captions)

The demo church, Grace Community Church at 1420 Elm St, Dallas, is fictional. It uses a 555 number and matches the site's own mockups.

## Sound

`scripts/score.ts` synthesizes everything from code: a D-major pad that changes chord at each act, and in-key interface sounds (keys, plucks, chimes, glitter). It also writes code-made stand-ins for the larger effects.

To use recorded effects instead, for example the ElevenLabs takes:

1. Save each file under these names in `public/sfx/`:

   | File (`.wav` or `.mp3`) | Plays at |
   |---|---|
   | `swell` | 0:00, the opening |
   | `rim-shimmer` | the horizon rim drawing |
   | `whoosh-fly` | the fly-in to Dallas |
   | `pixel-scatter` | the first pixel scatter, the headline dissolve, the fill burst |
   | `soft-impact` | the fix landing in Dallas |
   | `whoosh-pullback` | the pull-back to the whole globe |
   | `closing-shimmer` | under the Lookup mark |

2. Run `pnpm --filter lookup-video score`. Any effect with a file present drops its stand-in, and the file plays on its cue instead.
3. Re-render.

## Licenses

- Google Sans Flex and Geist Mono (in `public/fonts/`) are SIL Open Font License.
- Remotion is free for individuals and companies of up to three people. Larger teams need a [company license](https://www.remotion.dev/license).

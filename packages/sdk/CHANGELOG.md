# Changelog

All notable changes to `@heresmychurch/lookup`. Versions follow [semver](https://semver.org); while the version is 0.x, a minor release can change behavior, so pin the exact version you test against.

## 0.4.0

- React: `useChurchLookup` ships in `@heresmychurch/lookup/react`, so React apps without shadcn/ui get the headless core as a hook. React is an optional peer dependency, needed only for that entry.
- React 19 types for `<church-lookup>`: `onchurch-select`, `onchurch-fill` and the other event props are typed (React 19 adds them as listeners), the usual HTML props come from React's own types, and the object properties `fieldMap`, `strings` and `lookup` are typed. Breaking, types only: an unknown camelCase prop such as `maxResults` is now a type error instead of passing silently. Use `max-results`.
- Vue: `@church-select` and the other events are typed in templates. Preact and React 18 (global JSX) get typed `on<event>` props too.
- CommonJS build: every entry has a `.cjs` file and `.d.cts` types behind a `require` condition, so Jest and other `require()` setups load the package with no transforms.
- Client `timeout` option: a request with no answer after 15 seconds (by default) fails with a `LookupError` whose `code` is `"timeout"`. A caller's own abort still rejects with `AbortError`.
- Setup hints: on a local development host, the console says once when `client` isn't set, or when a chosen church found no fields to fill. Production consoles stay quiet.
- The headless core's size budget is now 5.5 KB gzipped (it was 5 KB), for the timeout and setup hints.
- Types: `ChurchRecord.fields` is now a typed `ChurchFields`, so `record.fields.city` is `string | null` and `record.fields.languages` is `string[]` with no casts. New exported types: `ChurchFields`, `ChurchField`, `ServiceTimes` and `ServiceSlot`.
- Types resolve under every TypeScript `moduleResolution`, including the older `"node"` (node10) that many existing apps and Jest setups use.
- Pinned script URLs: each release is also served at `https://lookup.heresmychurch.com/sdk/<version>/element.js` (and `lookup.js`, `service-times.js`), cached for a year and never changed. The unversioned URLs keep tracking the latest release.
- Package metadata for npm: repository, homepage, keywords, license file and public access.

## 0.3.0

- "Show more" in the results, with `limit` and `max-results`.
- Inputs named for the church (`church_city`, `churchWebsite`, `autocomplete="section-church tel"`) fill with no tags. `fill="auto"` also fills plain names like `city`; `@heresmychurch/lookup/fields` exposes the matcher.
- New attributes: `density`, `max-results`, `min-chars`, `debounce`, `lat`, `lng`, `semantic="off"`, `show-distance="off"`, `fill`. New `church-error` event.
- Sharing fixes back is checked by default; "Still correct" shows only for stale listings; report closed, duplicate or moved; add a church that isn't listed (`church-add`, `church-added`).
- Type declarations ship compiled, so apps need no special TypeScript settings.

## 0.2.0

- `@heresmychurch/lookup/core`: the headless controller, fill planning and consent rules, with no side effects on import.
- `<church-lookup>` is a real form field: `name` submits the church ID, `value` prefills it, `required` validates, and form reset and restore work.
- Spanish, French, German, Portuguese and Polish text, loaded on demand.
- Types for React, Vue, Preact and Solid.
- The shadcn/ui registry: `ChurchLookup`, `useChurchLookup` and `ChurchConsent`.

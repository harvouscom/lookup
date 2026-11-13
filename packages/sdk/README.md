# @heresmychurch/lookup

Church typeahead and autofill from [Here's My Church](https://heresmychurch.com). MIT, no dependencies.

```bash
npm install @heresmychurch/lookup
```

```js
import "@heresmychurch/lookup/element";
```

Or load the element with no build step:

```html
<church-lookup label="Your church"></church-lookup>
<input data-hmc-field="street" name="street">
<input data-hmc-field="city" name="city">
<script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/element.js"></script>
```

Script URLs under `/sdk/<version>/` never change. Drop the version (`https://lookup.heresmychurch.com/element.js`) to always get the latest release. What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

Selecting a church fills empty fields marked with `data-hmc-field`. Values go through the native setter plus `input` and `change` events, so React controlled inputs update. Add `overwrite` to replace fields that already have values.

Fields: `name, street, city, region, regionName, postalCode, country, countryName, latitude, longitude, phone, email, website, denomination, serviceTimes, languages, ministries, pastorName, id`.

Events: `church-select` (`detail.result`) and `church-fill` (`detail.record`, `detail.changes`) are cancelable. `church-results` (`detail.query`, `detail.results`, `detail.settled`) fires each time results are shown, for hosts that want to show them elsewhere, such as pins on a map.

Theming: on a page styled with [Sensible UI](https://sensibleui.com) by [Cam Pak](https://github.com/cameronapak), or anything else using shadcn/ui-style tokens (`--background`, `--foreground`, `--popover`, `--border`, `--input`, `--ring`, `--accent`, `--muted-foreground`, `--radius`), the element picks up the theme automatically. To set it directly, use `--hmc-text`, `--hmc-bg`, `--hmc-popover`, `--hmc-popover-text`, `--hmc-border`, `--hmc-input-border`, `--hmc-accent`, `--hmc-active-bg`, `--hmc-active-text`, `--hmc-muted`, `--hmc-radius` and `--hmc-z`, or the parts `label`, `input`, `clear`, `popup`, `listbox`, `option`, `option-name`, `option-detail`, `option-distance`, `more`, `corrected`, `note`, `retry`, `footer` and `consent`.

Attributes: `label`, `placeholder`, `name`, `value`, `required`, `disabled`, `region`, `country`, `near`, `lat`, `lng`, `geo="off"`, `limit` (per page), `max-results` (Show more reaches up to 50), `density="comfortable"`, `icons="none"`, `show-distance="off"`, `min-chars`, `debounce`, `semantic="off"`, `form` (id of the form to fill), `fill` (`auto`, `tagged` or `off`), `overwrite`, `fill-on-load`, `lang`, `contribute="off"`, `client`, `base-url`. Events: `church-results`, `church-select`, `church-fill`, `church-clear`, `church-error`, `church-contribute`, `church-confirm`, `church-add`, `church-added`.

Properties: `value` (the chosen church's ID), `selected` (its search result), `fieldMap` (a record field to an element or selector, for fields outside the form, such as `{ website: "#site-url" }`), `strings` (text to change) and `lookup` (your own client, such as one with a custom `fetch`).

Fields: inputs named for the church (`church_city`, `churchWebsite`, `autocomplete="section-church tel"`) fill with no setup; tag others with `data-hmc-field`. The element is about 15 KB gzipped, and safe to import during server rendering (it registers itself only in a browser).

Service times: wrap the field in `<church-service-times>` to edit it as rows of day, time and an optional label, the same way Here's My Church does. The field keeps the canonical string, such as `Sun 9:00 AM (Main Service); Wed 7:00 PM`, and autofill updates the rows. Text it can't read stays visible rather than being dropped.

```html
<church-service-times><textarea name="times" data-hmc-field="serviceTimes"></textarea></church-service-times>
<script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/service-times.js"></script>
```

Client only, at most 2 KB gzipped:

```js
import { createLookup } from "@heresmychurch/lookup";
const lookup = createLookup({ client: "my-tool" });
const { results } = await lookup.search("grace comm");
const church = await lookup.getChurch(results[0].id);
church.fields.city;      // string | null
church.fields.languages; // string[]
```

Every key in `fields` is always present and typed (`ChurchFields`), with `null` or `[]` when the directory has nothing.

Headless core, at most 5.5 KB gzipped, for building your own UI. No side effects on import: nothing is registered. `state.hasMore` says a "Show more" row belongs after the results, and `more()` appends the next page.

```js
import { createLookupController, findTargets, fillTargets } from "@heresmychurch/lookup/core";
import { matchField } from "@heresmychurch/lookup/fields"; // under 1 KB: finds church_city and the like
const ctl = createLookupController({ client: "my-tool", params: { limit: 8 }, onChange: (state) => render(state) });
input.addEventListener("input", () => ctl.input(input.value));
const record = await ctl.choose(0);
fillTargets(record, findTargets(form, (el) => matchField(el)));
```

Types ship as compiled `.d.ts` files and resolve under every TypeScript `moduleResolution`, so no special settings are needed. There's a CommonJS build too, so Jest and other `require()` setups load it without transforms.

Client options: `client` (your app's name), `baseUrl`, `fetch`, and `timeout` (milliseconds before a request fails with a `LookupError` whose `code` is `"timeout"`; 15000 by default, 0 to wait forever).

While you develop on `localhost` (or `*.localhost`, `*.test`), the console says once if `client` isn't set, or if a chosen church found no fields to fill. Production stays quiet.

React 19: `import type {} from "@heresmychurch/lookup/react"` types `<church-lookup>`, including event props, which React 19 adds as listeners:

```tsx
<church-lookup name="church_id" onchurch-select={(e) => setChurchId(e.detail.result.id)} onchurch-clear={() => setChurchId("")} />
```

To build your own picker, `useChurchLookup` from the same entry is the headless core as a hook. Needs React 18 or later:

```tsx
import { useChurchLookup } from "@heresmychurch/lookup/react";
const { results, search, choose, open } = useChurchLookup({ client: "my-app" });
```

Vue: `import type {} from "@heresmychurch/lookup/vue"` types the tag and `@church-select` and the other events in templates.

React and shadcn/ui: add the registry component instead of the element. It copies `ChurchLookup` (Command and Popover), `useChurchLookup` and this core into your app, and works with React Hook Form.

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json
```

Docs: https://lookup.heresmychurch.com/docs/react

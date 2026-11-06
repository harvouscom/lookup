# @heresmychurch/lookup

Church typeahead and autofill from [Here's My Church](https://heresmychurch.com). MIT, no dependencies.

Not published to npm yet. Until it is, load the element from the API:

```html
<church-lookup label="Your church"></church-lookup>
<input data-hmc-field="street" name="street">
<input data-hmc-field="city" name="city">
<script type="module" src="https://lookup.heresmychurch.com/element.js"></script>
```

Selecting a church fills empty fields marked with `data-hmc-field`. Values go through the native setter plus `input` and `change` events, so React controlled inputs update. Add `overwrite` to replace fields that already have values.

Fields: `name, street, city, region, regionName, postalCode, country, countryName, latitude, longitude, phone, email, website, denomination, serviceTimes, languages, ministries, pastorName, id`.

Events: `church-select` (`detail.result`) and `church-fill` (`detail.record`, `detail.changes`) are cancelable. `church-results` (`detail.query`, `detail.results`, `detail.settled`) fires each time results are shown, for hosts that want to show them elsewhere, such as pins on a map.

Theming: on a page styled with [Sensible UI](https://sensibleui.com) by [Cam Pak](https://github.com/cameronapak), or anything else using shadcn/ui-style tokens (`--background`, `--foreground`, `--popover`, `--border`, `--input`, `--ring`, `--accent`, `--muted-foreground`, `--radius`), the element picks up the theme automatically. To set it directly, use `--hmc-text`, `--hmc-bg`, `--hmc-popover`, `--hmc-popover-text`, `--hmc-border`, `--hmc-input-border`, `--hmc-accent`, `--hmc-active-bg`, `--hmc-active-text`, `--hmc-muted`, `--hmc-radius` and `--hmc-z`, or the parts `label`, `input`, `popup`, `listbox`, `option`, `note` and `footer`.

Attributes: `label`, `placeholder`, `region`, `country`, `near`, `limit`, `geo="off"`, `form` (id of the form to fill), `overwrite`, `client`, `base-url`.

Service times: wrap the field in `<church-service-times>` to edit it as rows of day, time and an optional label, the same way Here's My Church does. The field keeps the canonical string, such as `Sun 9:00 AM (Main Service); Wed 7:00 PM`, and autofill updates the rows. Text it can't read stays visible rather than being dropped.

```html
<church-service-times><textarea name="times" data-hmc-field="serviceTimes"></textarea></church-service-times>
<script type="module" src="https://lookup.heresmychurch.com/service-times.js"></script>
```

Client only, at most 2 KB gzipped:

```js
import { createLookup } from "@heresmychurch/lookup";
const lookup = createLookup({ client: "my-tool" });
const { results } = await lookup.search("grace comm");
const church = await lookup.getChurch(results[0].id);
```

Headless core, at most 4 KB gzipped, for building your own UI. No side effects on import: nothing is registered.

```js
import { createLookupController, findTargets, fillTargets } from "@heresmychurch/lookup/core";
const ctl = createLookupController({ client: "my-tool", onChange: (state) => render(state) });
input.addEventListener("input", () => ctl.input(input.value));
const record = await ctl.choose(0);
fillTargets(record, findTargets(form));
```

React and shadcn/ui: add the registry component instead of the element. It copies `ChurchLookup` (Command and Popover), `useChurchLookup` and this core into your app, and works with React Hook Form.

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json
```

Docs: https://lookup.heresmychurch.com/docs/react

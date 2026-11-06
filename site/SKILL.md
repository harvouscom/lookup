---
name: lookup-church-autofill
description: Add a church search field that autofills church details (address, website, phone, service times) from Here's My Church, using the Lookup <church-lookup> web component. Use when an app's form asks for a church.
---

# Lookup: church search and autofill

Lookup by Here's My Church is a church search box for forms. People type a few letters, pick their church from 587,842 churches in 19 countries, and the form's other church fields fill in. No API key. Docs: https://lookup.heresmychurch.com/docs (Markdown: https://lookup.heresmychurch.com/llms-full.txt).

## When to use
- A form asks for someone's church, a partner church, or a church's address, website, phone or service times.
- Don't use it for anything that isn't a church.

## Steps
1. Load the element once, near the end of the page or in the app's root layout:
   `<script type="module" src="https://lookup.heresmychurch.com/element.js"></script>`
   For a service-times editor, also load `https://lookup.heresmychurch.com/service-times.js`.
2. Add the field inside the form, above the fields it fills:
   `<church-lookup name="church_id" label="Church"></church-lookup>`
   - `name`: the chosen church's ID submits with the form. Save it.
   - `required`: block submit until a church is chosen.
   - `value="<saved id>"`: show a saved church on edit screens. Add `fill-on-load` to also fill the fields.
   - `lang`: en, es, fr, de, pt or pl.
   - `form="<id>"`: fill a form the element isn't inside.
3. Tag existing inputs with `data-hmc-field`. Valid names only:
   name, street, city, region, regionName, postalCode, country, countryName, latitude, longitude, phone, email, website, denomination, serviceTimes, languages, ministries, pastorName, id.
   Empty fields fill; typed values are kept unless the element has `overwrite`.
4. Frameworks: it's a standard custom element. In React or Vue, attach `church-select` (detail.result.id) and `church-clear` listeners in an effect. Inputs are filled through the native setter plus `input`/`change` events, so controlled inputs stay in sync. Types: `import type {} from "@heresmychurch/lookup/react"` or `/vue`.
5. While testing, set `client="lookup-demo"`: shared corrections are checked but never sent. In production, set `client` to the app's name.
6. Styling: set `--hmc-accent`, `--hmc-radius`, `--hmc-border`, `--hmc-input-border`, `--hmc-bg`, `--hmc-text` on `church-lookup`, or rely on shadcn-style tokens (`--background`, `--foreground`, `--accent`, `--border`, `--radius`) already on the page.

## React + shadcn/ui apps (Lovable, v0, Vite)
Prefer the registry component over the element:
1. `pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json`
2. In a React Hook Form `FormField` named `church_id`: `render={({ field }) => <ChurchLookup {...field} client="lookup-demo" onFill={setRecord} />}`
3. Tag the inputs to fill with `data-hmc-field` (same names as above).
4. Optional share-fixes panel: add `https://lookup.heresmychurch.com/r/church-consent.json`, then `<ChurchConsent record={record} values={form.watch()} client="lookup-demo" />`.
Docs: https://lookup.heresmychurch.com/docs/react.md

## Rules
- Don't invent attributes or field names beyond the lists above.
- Don't send email or pastor name back to Here's My Church; the widget never offers them.
- Don't block the host form's submit on Lookup.
- Use `contribute="off"` only if the app must never offer to share corrections.

## Check
- Type "grace comm", pick a result: tagged fields fill, and the form submits `church_id`.
- Keyboard: arrows move, Enter picks, Escape closes.

## API (no widget)
`GET https://lookup.heresmychurch.com/v1/search?q=grace%20comm&client=my-app` and `GET /v1/churches/:id`. Open CORS, no key. Full reference: https://lookup.heresmychurch.com/docs/api.md

---
title: React and shadcn/ui
nav: React and shadcn
description: Own the code. Add a ChurchLookup component, a hook and a share-fixes panel to your shadcn app from Lookup's registry.
---

Lookup has two front doors with one engine behind them:

| Path | Best for | How |
|---|---|---|
| Drop it in | Any page or framework, no build step, Sensible UI pages | `<church-lookup>` from one script tag. See [the widget](/docs/widget). |
| Own the code | React apps with shadcn/ui, such as ones built with Lovable or v0 | Add components from the registry below. They're copied into your app, so you can change them. |

Both use the same headless core for search, **Show more**, field matching and sharing fixes back, and take the same options. The React component is yours to edit, so the two can differ once you change it.

:::prompt Add Lookup to my shadcn app
Add a church picker to this React + shadcn/ui app using Lookup by Here's My Church.

1. Run: pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json
   (it adds components/church-lookup.tsx, hooks/use-church-lookup.ts and lib/lookup-core.ts)
2. In the form that asks for a church, render <ChurchLookup /> inside a React Hook Form FormField
   named church_id: render={({ field }) => <ChurchLookup {...field} client="lookup-demo" />}
3. Inputs named for the church (church_city, churchWebsite) fill on their own. Add data-hmc-field to
   any others it should fill (name, street, city, regionName, postalCode, phone, website,
   serviceTimes). Don't rename existing fields.
4. Optional: pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-consent.json and render
   <ChurchConsent record={record} values={form.watch()} client="lookup-demo" /> under the fields,
   with record from ChurchLookup's onFill.
5. Use client="lookup-demo" while testing; set your app's name before shipping.

Check: type "grac", pick a church, the tagged fields fill and handleSubmit receives church_id.
:::

Not on shadcn/ui? Use the element with `onchurch-select` props in React 19 (see [the widget](/docs/widget#in-your-form)), or build your own picker with `useChurchLookup` from `@heresmychurch/lookup/react` once the package is on npm.

## Install

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json
```

That adds three files, plus shadcn's `command` and `popover` if you don't have them. The component is a client component (`"use client"`), so it works in the Next.js app router.

| File | What it is |
|---|---|
| `components/church-lookup.tsx` | `ChurchLookup`, the search box, built from Command and Popover |
| `hooks/use-church-lookup.ts` | `useChurchLookup`, the engine as a hook, for your own UI |
| `lib/lookup-core.ts` | The headless core: search, fill and consent rules. Generated from `@heresmychurch/lookup/core`. |

## With React Hook Form

Spread the field onto `ChurchLookup`. Inputs named for the church, like `church_city`, fill on their own; tag any others with `data-hmc-field` (see [Fields](/docs/widget#fields)). Values are set the way typing sets them, so `register` and `Controller` fields both update.

```tsx
<FormField
  control={form.control}
  name="church_id"
  rules={{ required: "Choose your church from the list." }}
  render={({ field }) => (
    <FormItem>
      <FormLabel>Church</FormLabel>
      <FormControl>
        <ChurchLookup {...field} client="my-app" onFill={(record) => setRecord(record)} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
<Input {...form.register("city")} data-hmc-field="city" />
```

Without a form library, pass `name` and a hidden input submits the church ID, add `required` if a church must be chosen, or use `value` and `onChange` for controlled state. To fill fields yourself, return `false` from `onFill`, or set `fill={false}`.

## Props

| Prop | What it does |
|---|---|
| `value`, `onChange`, `onBlur`, `name` | Form field basics. `value` is the church ID; setting it shows that church. A saved ID that moved calls `onChange` with the new one. |
| `required` | The form won't submit until a church is chosen from the list. |
| `onFill` | Called with the record and what will fill, before it fills. Return `false` to fill fields yourself. |
| `fill` | Which fields to fill: tagged and church-named by default, `"auto"` adds plain names like `city`, `"tagged"` only tags, `false` none. |
| `fillOnLoad` | Also fill from `value` when it's first shown. |
| `form` | The id of the form to fill. Defaults to the enclosing form. |
| `overwrite` | Replace fields that already have values. |
| `onSelect`, `onClear`, `onError` | A church is about to be chosen (return `false` to cancel), the choice was cleared, or something failed to load. |
| `client` | Your app's name. Use `lookup-demo` while testing. |
| `region`, `country`, `near`, `lat`, `lng`, `geo` | Where to search, as on the widget. |
| `limit`, `maxResults` | Results per page, and the most **Show more** reaches (up to 50). |
| `minChars`, `debounce`, `semantic` | When to search: characters first, milliseconds after typing, and `false` to skip the search after a pause. |
| `density`, `icon`, `searchIcon`, `showDistance` | How results look: `"comfortable"` rows, your own icons (`icon={null}` hides it), and distances. |
| `lang`, `strings` | The text's language, and any text to change. |
| `label`, `placeholder` | The accessible name and the hint. |
| `onAdd`, `onAdded`, `addChurch` | The form was filled without picking a church and the person chose to add it (return `false` to stop), it was added (with its new ID), or `addChurch={false}` to never offer it. |

## Other languages

English is built in. For Spanish, French, German, Portuguese and Polish, add the language file once and set `lang`, or let it follow the page's:

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/lookup-strings.json
```

```tsx
import "@/lib/lookup-strings"

<ChurchLookup lang="es" />
```

## Share fixes back

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-consent.json
```

```tsx
<ChurchConsent record={record} values={form.watch()} labels={{ phone: "Phone" }} client="my-app" />
```

It shows only fields Here's My Church accepts for that church's country. Changed fields start checked, `street`, `city` and `postalCode` show as one Address row, each says whether it goes live or waits for a moderator, and nothing is sent until the person chooses Share. A checked `data-hmc-share` checkbox in the submitted form sends them too, without blocking the submit. When nothing changed, it asks "Still correct?" of listings nobody confirmed this year. It also offers **Report a problem** and a link to fix anything else on Here's My Church.

## Your own UI

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/use-church-lookup.json
```

```tsx
const lookup = useChurchLookup({ client: "my-app" })
// lookup.search(text), lookup.results, lookup.active, lookup.move(1), lookup.choose(), lookup.loading
// lookup.hasMore and lookup.more() for the next page, lookup.error and lookup.retry()
```

See it working in [Kinship, built with shadcn/ui](/demo/shadcn/).

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

Both use the same headless core, so search, fill and sharing fixes back behave the same way.

:::prompt Add Lookup to my shadcn app
Add a church picker to this React + shadcn/ui app using Lookup by Here's My Church.

1. Run: pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json
   (it adds components/church-lookup.tsx, hooks/use-church-lookup.ts and lib/lookup-core.ts)
2. In the form that asks for a church, render <ChurchLookup /> inside a React Hook Form FormField
   named church_id: render={({ field }) => <ChurchLookup {...field} client="lookup-demo" />}
3. Add data-hmc-field to the inputs it should fill (name, street, city, regionName, postalCode,
   phone, website, serviceTimes). Don't rename existing fields.
4. Optional: pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-consent.json and render
   <ChurchConsent record={record} values={form.watch()} client="lookup-demo" /> under the fields,
   with record from ChurchLookup's onFill.
5. Use client="lookup-demo" while testing; set your app's name before shipping.

Check: type "grac", pick a church, the tagged fields fill and handleSubmit receives church_id.
:::

## Install

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-lookup.json
```

That adds three files, plus shadcn's `command` and `popover` if you don't have them:

| File | What it is |
|---|---|
| `components/church-lookup.tsx` | `ChurchLookup`, the search box, built from Command and Popover |
| `hooks/use-church-lookup.ts` | `useChurchLookup`, the engine as a hook, for your own UI |
| `lib/lookup-core.ts` | The headless core: search, fill and consent rules. Generated from `@heresmychurch/lookup/core`. |

## With React Hook Form

Spread the field onto `ChurchLookup`. Tag the inputs it should fill with `data-hmc-field`; values are set the way typing sets them, so `register` and `Controller` fields both update.

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

Without a form library, pass `name` and a hidden input submits the church ID, or use `value` and `onChange` for controlled state. To fill fields yourself, set `fill={false}` and read the record in `onFill`.

## Props

| Prop | What it does |
|---|---|
| `value`, `onChange`, `onBlur`, `name` | Form field basics. `value` is the church ID; setting it shows that church. |
| `onFill` | Called with the full record and what was filled. |
| `fill` | Fill `data-hmc-field` inputs in the enclosing form. Defaults to `true`. |
| `overwrite` | Replace fields that already have values. |
| `client` | Your app's name. Use `lookup-demo` while testing. |
| `region`, `country`, `near`, `limit`, `geo` | The same search options as the widget. |
| `label`, `placeholder` | The accessible name and the hint. |

## Share fixes back

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/church-consent.json
```

```tsx
<ChurchConsent record={record} values={form.watch()} labels={{ phone: "Phone" }} client="my-app" />
```

It shows only fields Here's My Church accepts for that church's country. Every change starts unchecked, each says whether it goes live or waits for a moderator, and nothing is sent until the person chooses Share. When nothing changed, it offers "Still correct".

## Your own UI

```bash
pnpm dlx shadcn@latest add https://lookup.heresmychurch.com/r/use-church-lookup.json
```

```tsx
const lookup = useChurchLookup({ client: "my-app" })
// lookup.search(text), lookup.results, lookup.active, lookup.move(1), lookup.choose(), lookup.loading
```

See it working in [Kinship, built with shadcn/ui](/demo/shadcn/).

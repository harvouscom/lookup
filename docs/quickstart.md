---
title: Quickstart
description: Add a church search box that fills in your form. Hand this to your AI agent, or follow three steps yourself.
---

:::prompt Add Lookup to your app
# Add church lookup with Lookup by Here's My Church

Add a church search field to the form in this project where people enter a church (sign-up, profile, partner or settings form). When someone picks their church, its details should fill the other fields.

## Steps
1. Load the widget once on the page:
   <script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/element.js"></script>
   (Service times editor, optional: https://lookup.heresmychurch.com/sdk/0.4.0/service-times.js)
2. Put <church-lookup name="church_id" label="Church"></church-lookup> inside the form, above the fields it fills.
   - `name` submits the chosen church's ID with the form. Store it so you can look the church up again.
   - Add `required` if a church must be chosen.
   - On an edit screen, set `value` to the saved ID.
3. Inputs named for the church (church_city, churchWebsite) fill on their own. Tag the other
   existing inputs with data-hmc-field. Use only these names:
   name, street, city, region, regionName, postalCode, country, countryName, latitude, longitude,
   phone, email, website, denomination, serviceTimes, languages, ministries, pastorName, id
   Don't create new inputs unless I ask. Don't rename existing ones.
4. React or Vue: the element is a custom element. React 19: pass onchurch-select and onchurch-clear props.
   React 18: add `church-select` and `church-clear` listeners with addEventListener in an effect.
   Vue: @church-select and @church-clear. Values are set the way typing sets them, so controlled inputs stay in sync.
   Types: import type {} from "@heresmychurch/lookup/react" (or /vue).
5. While testing, add client="lookup-demo" so corrections people share are checked but never sent.
   Remove it (or set your app's name) before shipping.
6. Match my styles: set --hmc-accent, --hmc-radius, --hmc-border and friends on church-lookup,
   or rely on shadcn-style tokens (--background, --foreground, --accent, --radius) if the app already has them.

## Check
- Type "grace comm", pick a result, confirm the tagged fields fill and the form submits church_id.
- Keyboard: arrow keys move, Enter picks, Escape closes.

Docs: https://lookup.heresmychurch.com/llms-full.txt
:::

Or set it up yourself. There's no key to request.

## 1. Add the script

```html
<script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/element.js"></script>
```

That URL is pinned to version 0.4.0 and never changes, so an update can't change your form until you change the number. To always get the latest release instead, load `https://lookup.heresmychurch.com/element.js`. See the [changelog](https://github.com/harvouscom/lookup/blob/main/packages/sdk/CHANGELOG.md) for what's in each version.

## 2. Put the search box in your form

Fields named for the church, like `church_city`, fill on their own. Tag any others with `data-hmc-field`. Give it a `name` and the chosen church's ID submits with the form.

:::tabs Install method
```html title="script tag"
<form action="/signup" method="post">
  <church-lookup name="church_id" label="Your church"></church-lookup>
  <input name="street"  data-hmc-field="street">
  <input name="city"    data-hmc-field="city">
  <input name="website" data-hmc-field="website">
  <button>Join</button>
</form>
<script type="module" src="https://lookup.heresmychurch.com/sdk/0.4.0/element.js"></script>
```
```javascript title="client only"
import { createLookup } from "https://lookup.heresmychurch.com/sdk/0.4.0/lookup.js";

const lookup = createLookup({ client: "my-app" });
const { results } = await lookup.search("grace comm");
const church = await lookup.getChurch(results[0].id);
```
```bash title="npm"
# Coming soon. The package isn't published yet.
npm install @heresmychurch/lookup
```
:::

## 3. Try it

Values are set the way typing sets them, so React and other frameworks see them.

:::html
<div class="frame"><form class="frame-in demo" id="demo-form" onsubmit="event.preventDefault()">
      <church-lookup label="Church" form="demo-form" placeholder="Search for a church"></church-lookup>
      <div class="grid">
        <div><label for="d-street">Street</label><input id="d-street" data-hmc-field="street" autocomplete="off"></div>
        <div><label for="d-city">City</label><input id="d-city" data-hmc-field="city" autocomplete="off"></div>
        <div><label for="d-site">Website</label><input id="d-site" data-hmc-field="website" autocomplete="off"></div>
        <div><label for="d-phone">Phone</label><input id="d-phone" data-hmc-field="phone" autocomplete="off"></div>
        <div class="wide"><span class="lbl" id="d-times-l">Service times</span><church-service-times label="Service times"><textarea data-hmc-field="serviceTimes" aria-labelledby="d-times-l"></textarea></church-service-times></div>
      </div>
    </form></div>
:::

:::tip Testing
Add `client="lookup-demo"` while you build. Corrections people share are checked the same way, but never sent to Here's My Church.
:::

## Next steps

:::cards
- [The widget](/docs/widget): Attributes, events, icons and the form field, with a live preview.
- [Theming](/docs/theming): Match your design system with a few CSS variables.
- [Example apps](/docs/examples): Three made-up apps built with Lookup.
:::

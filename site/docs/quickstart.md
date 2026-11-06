# Quickstart

> Add a church search box that fills in your form. Hand this to your AI agent, or follow three steps yourself.

Source: https://lookup.heresmychurch.com/docs/quickstart

**Add Lookup to your app**

```text
# Add church lookup with Lookup by Here's My Church

Add a church search field to the form in this project where people enter a church (sign-up, profile, partner or settings form). When someone picks their church, its details should fill the other fields.

## Steps
1. Load the widget once on the page:
   <script type="module" src="https://lookup.heresmychurch.com/element.js"></script>
   (Service times editor, optional: https://lookup.heresmychurch.com/service-times.js)
2. Put <church-lookup name="church_id" label="Church"></church-lookup> inside the form, above the fields it fills.
   - `name` submits the chosen church's ID with the form. Store it so you can look the church up again.
   - Add `required` if a church must be chosen.
   - On an edit screen, set `value` to the saved ID.
3. Tag the existing inputs with data-hmc-field. Use only these names:
   name, street, city, region, regionName, postalCode, country, countryName, latitude, longitude,
   phone, email, website, denomination, serviceTimes, languages, ministries, pastorName, id
   Don't create new inputs unless I ask. Don't rename existing ones.
4. React or Vue: the element is a custom element. Listen for `church-select` and `church-clear` events
   with addEventListener in an effect; values are set the way typing sets them, so controlled inputs stay in sync.
   Types: import type {} from "@heresmychurch/lookup/react" (or /vue).
5. While testing, add client="lookup-demo" so corrections people share are checked but never sent.
   Remove it (or set your app's name) before shipping.
6. Match my styles: set --hmc-accent, --hmc-radius, --hmc-border and friends on church-lookup,
   or rely on shadcn-style tokens (--background, --foreground, --accent, --radius) if the app already has them.

## Check
- Type "grace comm", pick a result, confirm the tagged fields fill and the form submits church_id.
- Keyboard: arrow keys move, Enter picks, Escape closes.

Docs: https://lookup.heresmychurch.com/llms-full.txt
```

Or set it up yourself. There's no key to request.

## 1. Add the script

```html
<script type="module" src="https://lookup.heresmychurch.com/element.js"></script>
```

## 2. Put the search box in your form

Tag the fields it should fill with `data-hmc-field`. Give it a `name` and the chosen church's ID submits with the form.

script tag:

```html
<form action="/signup" method="post">
  <church-lookup name="church_id" label="Your church"></church-lookup>
  <input name="street"  data-hmc-field="street">
  <input name="city"    data-hmc-field="city">
  <input name="website" data-hmc-field="website">
  <button>Join</button>
</form>
<script type="module" src="https://lookup.heresmychurch.com/element.js"></script>
```
client only:

```javascript
import { createLookup } from "https://lookup.heresmychurch.com/lookup.js";

const lookup = createLookup({ client: "my-app" });
const { results } = await lookup.search("grace comm");
const church = await lookup.getChurch(results[0].id);
```
npm:

```bash
# Coming soon. The package isn't published yet.
npm install @heresmychurch/lookup
```

## 3. Try it

Values are set the way typing sets them, so React and other frameworks see them.

> **Testing:** Add `client="lookup-demo"` while you build. Corrections people share are checked the same way, but never sent to Here's My Church.

## Next steps

- [The widget](/docs/widget): Attributes, events, icons and the form field, with a live preview.
- [Theming](/docs/theming): Match your design system with a few CSS variables.
- [Example apps](/docs/examples): Three made-up apps built with Lookup.

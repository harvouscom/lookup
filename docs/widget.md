---
title: The widget
nav: Widget
description: "<church-lookup> is an accessible combobox: it searches as people type and fills your form when they choose."
---

It also asks for smarter results when people pause. Change the options below to see each one live.

:::html
<div class="frame"><div class="frame-in flush wo">
      <div class="wo-stage">
        <span class="ba-tag">preview</span>
        <div class="wo-form" id="wo-host"></div>
      </div>
      <div class="wo-opts" id="wo-opts">
        <div class="wo-sec">
          <span class="ba-l">text</span>
          <label class="wo-f"><code>label</code><input type="text" data-opt="label" placeholder="Church" autocomplete="off"></label>
          <label class="wo-f"><code>placeholder</code><input type="text" data-opt="placeholder" placeholder="Start typing your church&#8217;s name" autocomplete="off"></label>
          <div class="wo-f" role="group" aria-label="lang"><code>lang</code><div class="wo-chips">
            <button type="button" class="ba-chip" data-lang="" aria-pressed="true">en</button><button type="button" class="ba-chip" data-lang="es" aria-pressed="false">es</button><button type="button" class="ba-chip" data-lang="fr" aria-pressed="false">fr</button><button type="button" class="ba-chip" data-lang="de" aria-pressed="false">de</button><button type="button" class="ba-chip" data-lang="pt" aria-pressed="false">pt</button><button type="button" class="ba-chip" data-lang="pl" aria-pressed="false">pl</button>
          </div></div>
        </div>
        <div class="wo-sec">
          <span class="ba-l">results</span>
          <div class="wo-f" role="group" aria-label="near"><code>near</code><div class="wo-chips">
            <button type="button" class="ba-chip" data-near="" aria-pressed="true">visitor</button><button type="button" class="ba-chip" data-near="Dallas" aria-pressed="false">Dallas</button><button type="button" class="ba-chip" data-near="Toronto" aria-pressed="false">Toronto</button><button type="button" class="ba-chip" data-near="London" aria-pressed="false">London</button>
          </div></div>
          <label class="wo-f"><code>limit</code><span class="wo-range"><input type="range" data-opt="limit" min="1" max="50" value="8"><output id="wo-limit">8</output></span></label>
        </div>
        <div class="wo-sec">
          <span class="ba-l">behavior</span>
          <div class="wo-chips">
            <button type="button" class="ba-chip" data-flag="required" aria-pressed="false">required</button>
            <button type="button" class="ba-chip" data-flag="value" aria-pressed="false">value</button>
            <button type="button" class="ba-chip" data-flag="icons" aria-pressed="false">icons="none"</button>
            <button type="button" class="ba-chip" data-flag="geo" aria-pressed="false">geo="off"</button>
          </div>
          <p class="wo-hint" id="wo-hint">Turn on <code>value</code> to start with a church already chosen, as on an edit screen.</p>
        </div>
      </div>
      <div class="wo-log" aria-hidden="true"><span class="ba-l">events</span><ol id="wo-log"><li class="wo-empty">Search and choose a church to see its events.</li></ol></div>
    </div></div>
    <div class="cb"><div class="cb-bar"><span class="cb-l">html</span><button class="copy cb-copy" type="button">Copy</button></div><pre class="shiki" tabindex="0"><code id="wo-code"></code></pre></div>
:::

## Attributes

| Attribute | What it does |
|---|---|
| `name` | Submit the chosen church's ID with your form under this name, like any input. |
| `required` | The form won't submit until a church is chosen from the list. |
| `value` | A church ID to show, such as one saved earlier on an edit screen. |
| `fill-on-load` | Also fill the form from `value` when the page loads. |
| `label`, `placeholder` | The visible label and the hint inside the box. |
| `lang` | English, Spanish, French, German, Portuguese or Polish. Defaults to the page's language. Set the `strings` property to change any text. |
| `region`, `country` | Limit results, such as `region="TX"` or `country="DE"`. |
| `near` | Rank results near a place, such as `near="Dallas"`. |
| `lat`, `lng` | Rank results near a point, such as the device's location. Set both. |
| `geo="off"` | Don't use the visitor's approximate location. |
| `form` | The id of the form to fill. Defaults to the enclosing form. |
| `fill` | Which fields to fill. See [Fields](#fields). `auto` adds plain names like `city`, `tagged` uses only tags, `off` fills nothing. |
| `overwrite` | Replace fields that already have values. |
| `limit` | Results on the first page and each **Show more**. Defaults to 8. |
| `max-results` | The most results **Show more** can reach, up to 50. Defaults to 50. Set it to `limit` to hide Show more. |
| `density="comfortable"` | Taller rows with larger icons. Rows are compact by default. |
| `icons="none"` | Hide the icon beside each result. |
| `show-distance="off"` | Hide how far away each church is. |
| `min-chars` | Characters typed before searching. Defaults to 2. |
| `debounce` | Milliseconds to wait after typing before searching. Defaults to 150. |
| `semantic="off"` | Skip the slower search after a pause, which can find churches by meaning. |
| `disabled` | Turn the field off, like any input. A disabled `fieldset` does the same. |
| `contribute="off"` | Don't offer to share corrections, report problems or add missing churches. |
| `client` | Your app's name, sent with requests. Use `lookup-demo` while testing. |

## In your form

It's a real form field. Give it a `name` and the chosen church's ID submits with your form, so you can store the ID and look the church up again later. React and Vue get types for the tag and its events.

:::tabs Form example
```html title="html form"
<form action="/signup" method="post">
  <church-lookup name="church_id" required></church-lookup>
  <input name="city" data-hmc-field="city">
  <button>Join</button>
</form>
<!-- Posts church_id=CA-ON-56994145&city=Thorold -->
```
```tsx title="react"
"use client"; // Next.js: load the element in a client component.
import "@heresmychurch/lookup/element";
import type {} from "@heresmychurch/lookup/react";

function ChurchField({ onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const pick = (e) => onChange(e.detail.result.id);
    const clear = () => onChange("");
    el.addEventListener("church-select", pick);
    el.addEventListener("church-clear", clear);
    return () => {
      el.removeEventListener("church-select", pick);
      el.removeEventListener("church-clear", clear);
    };
  }, [onChange]);
  return <church-lookup ref={ref} name="church_id" lang="es" />;
}
```
:::

## Fields

Fields named for the church fill without any setup: `church_city`, `churchWebsite`, `church[phone]`, or `autocomplete="section-church address-level2"`. It reads the field's `name`, `id` and `autocomplete`, and skips address line 2, hidden fields and passwords.

On a form that's only about the church, add `fill="auto"` and plain names fill too: `city`, `state`, `zip`, `phone`, `email`, `website`, or autocomplete tokens like `postal-code` and `tel`. A plain `name` or `id` never fills, since on most forms those are the person's.

To say exactly which field gets what, tag it with `data-hmc-field`. A tag always wins, and `data-hmc-field="none"` leaves a field alone. Use any of these: `name`, `street`, `city`, `region`, `regionName`, `postalCode`, `country`, `countryName`, `latitude`, `longitude`, `phone`, `email`, `website`, `denomination`, `serviceTimes`, `languages`, `ministries`, `pastorName` and `id`.

A `<select>` fills when one of its options matches by value or text, as a code or a name: `TX` or `Texas`, `US` or `United States`. For fields outside the form, set the `fieldMap` property to a field name and an element or selector each:

```js
document.querySelector("church-lookup").fieldMap = { website: "#site-url", phone: phoneInput };
```

## Sharing fixes

After a fill, changing a field Lookup filled shows the changes below the church field, checked, with **Share N fixes**. Street, city and postal code show as one Address row. "Still correct?" appears only for listings nobody confirmed in the last year. See [Data and review](/docs/data#sharing-fixes-back) for what's accepted where.

### Share on submit

To let people share as part of submitting your form, add a checkbox with `data-hmc-share`. If it's checked when the form submits, the checked changes are sent in the background (with `keepalive`, so leaving the page doesn't cut them off). The submit is never delayed or blocked.

```html
<label><input type="checkbox" data-hmc-share checked> Share my fixes with Here's My Church</label>
```

### Missing churches

When nothing matches, the "Add it" link opens Here's My Church's add form with the typed name. If someone fills in your form without picking a church, the widget offers to add it, listing the values it would send from your mapped fields (it needs a name, city and region). Similar listings come first as "Is it one of these?"; picking one selects it. Once added, the widget's value is the new church's ID.

## Icons

Use the icons your design system already has. Put one with `slot="search-icon"` in the box, and one with `slot="result-icon"` to repeat beside every result. It works with SVG sets like Lucide or Heroicons, icon fonts like Tabler or Font Awesome, and icon components like Iconify, because the icons stay in your page and pick up its CSS.

```html
<church-lookup label="Your church">
  <i slot="search-icon" class="ti ti-search"></i>
  <i slot="result-icon" class="ti ti-building-church"></i>
</church-lookup>
```

## Events

| Event | When it fires |
|---|---|
| `church-results` | Results appeared. `detail` has `query`, `results`, `settled`, and `more` when they came from **Show more**. |
| `church-select` | A church was chosen. Cancel it to stop the fill. |
| `church-fill` | Fields are about to fill. Cancel it to fill them yourself from `detail.record`. |
| `church-clear` | The choice was cleared, with the clear button or by editing the name. |
| `church-error` | A search or a church's details failed to load. `detail` has `query` or `id`, plus `status`, `code`, `retryAfter` and the `error`. |
| `church-contribute` | Someone chose Share, reported a problem, or submitted with `data-hmc-share` checked (`detail.onSubmit`). `detail` has `churchId` and `changes`; an address change's `value` is `{ street, city, postalCode }`. Cancel it to send them yourself, or not at all. |
| `church-confirm` | Someone chose Still correct. Cancel it to skip the confirmation. |
| `church-add` | Someone chose to add a church that isn't listed. `detail` has `church` and `confirmAdd`. Cancel it to stop the add. |
| `church-added` | A church was added. `detail` has its new `id` (null with `lookup-demo`), the `church` and `sandbox`. The widget's value is already the new ID. |

## Accessibility

An ARIA 1.2 combobox: arrow keys move through results, Enter chooses and Escape closes. **Show more** is the last option, so the arrow keys reach it too, and pressing down on it loads the next page. Results, added results and fills are announced, targets are 44 pixels, and it respects forced colors and reduced motion.

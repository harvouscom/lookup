# The widget

> <church-lookup> is an accessible combobox: it searches as people type and fills your form when they choose.

Source: https://lookup.heresmychurch.com/docs/widget

It also asks for smarter results when people pause. Change the options below to see each one live.

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
| `geo="off"` | Don't use the visitor's approximate location. |
| `form` | The id of the form to fill. Defaults to the enclosing form. |
| `overwrite` | Replace fields that already have values. |
| `limit` | How many results to show, up to 20. Defaults to 8. |
| `icons="none"` | Hide the icon beside each result. |
| `contribute="off"` | Don't offer to share corrections back to Here's My Church. |
| `client` | Your app's name, sent with requests. Use `lookup-demo` while testing. |

## In your form

It's a real form field. Give it a `name` and the chosen church's ID submits with your form, so you can store the ID and look the church up again later. React and Vue get types for the tag and its events.

html form:

```html
<form action="/signup" method="post">
  <church-lookup name="church_id" required></church-lookup>
  <input name="city" data-hmc-field="city">
  <button>Join</button>
</form>
<!-- Posts church_id=CA-ON-56994145&city=Thorold -->
```
react:

```tsx
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

## Fields

Use any of these in `data-hmc-field`: `name`, `street`, `city`, `region`, `regionName`, `postalCode`, `country`, `countryName`, `latitude`, `longitude`, `phone`, `email`, `website`, `denomination`, `serviceTimes`, `languages`, `ministries`, `pastorName` and `id`.

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
| `church-results` | Results appeared. `detail` has `query`, `results` and `settled`. |
| `church-select` | A church was chosen. Cancel it to stop the fill. |
| `church-fill` | Fields are about to fill. Cancel it to fill them yourself from `detail.record`. |
| `church-clear` | The choice was cleared, with the clear button or by editing the name. |
| `church-contribute` | Someone chose Share. `detail` has `churchId` and `changes`. Cancel it to send them yourself, or not at all. |
| `church-confirm` | Someone chose Still correct. Cancel it to skip the confirmation. |

## Accessibility

An ARIA 1.2 combobox: arrow keys move through results, Enter chooses and Escape closes. Results and fills are announced, targets are 44 pixels, and it respects forced colors and reduced motion.

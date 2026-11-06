---
title: Theming
description: Match your design system with a few CSS variables. On pages with shadcn/ui-style tokens, it matches with no setup.
---

The widget reads its own `--hmc-*` CSS variables. When one isn't set, it falls back to the shadcn/ui token names (`--background`, `--foreground`, `--accent`, `--border`, `--radius` and so on), the same names [Sensible UI](https://sensibleui.com) by [Cam Pak](https://cameronpak.com) uses. So on those pages it matches with no setup. Anywhere else, set a few variables.

Try it below. The right side has no Lookup CSS at all, only the page's tokens. Pick a set, edit any value or paste a theme from [ui.shadcn.com/themes](https://ui.shadcn.com/themes), then drag across to compare it with no tokens.

:::html
<div class="frame"><div class="frame-in flush ba-wrap">
      <div class="ba" id="ba" style="--pos: 50%">
        <div class="ba-layer ba-before" inert>
          <span class="ba-tag">no tokens</span>
          <div class="ba-form"><church-lookup label="Your church" placeholder="Search for a church" geo="off" limit="3"></church-lookup></div>
        </div>
        <div class="ba-layer ba-after" id="ba-after" inert>
          <span class="ba-tag" id="ba-tag">your tokens</span>
          <div class="ba-form"><church-lookup label="Your church" placeholder="Search for a church" geo="off" limit="3"></church-lookup></div>
        </div>
        <div class="ba-line" aria-hidden="true"><span><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg></span></div>
        <input class="ba-range" id="ba-range" type="range" min="0" max="100" value="50" aria-label="Compare the default widget with your tokens">
      </div>
      <div class="ba-controls">
        <div class="ba-group" role="group" aria-labelledby="ba-presets-l">
          <span class="ba-l" id="ba-presets-l">your page's tokens</span>
          <button type="button" class="ba-chip" data-tokens="light" aria-pressed="true">shadcn/ui light</button>
          <button type="button" class="ba-chip" data-tokens="dark" aria-pressed="false">shadcn/ui dark</button>
          <button type="button" class="ba-chip" data-tokens="rose" aria-pressed="false">Rose</button>
          <button type="button" class="ba-chip" data-tokens="ocean" aria-pressed="false">Ocean</button>
        </div>
        <label class="ba-edit" for="ba-tokens"><span class="ba-l">edit them, or paste a shadcn/ui theme</span></label>
        <textarea id="ba-tokens" class="ba-tokens" rows="11" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </div>
    </div></div>
    
:::

## Variables

| Variable | Falls back to | Used for |
|---|---|---|
| `--hmc-bg` | `--background` | The input background |
| `--hmc-text` | `--foreground` | Text |
| `--hmc-popover`, `--hmc-popover-text` | `--popover`, `--popover-foreground` | The results list |
| `--hmc-border` | `--border` | The results list border |
| `--hmc-input-border` | `--input` | The input border |
| `--hmc-accent` | `--ring` | Focus ring and icons |
| `--hmc-active-bg`, `--hmc-active-text` | `--accent`, `--accent-foreground` | The highlighted result |
| `--hmc-muted` | `--muted-foreground` | Secondary text |
| `--hmc-radius` | `--radius` | Corners |
| `--hmc-z` | | The results list's `z-index`. Defaults to 1000. |

The widget also takes your page's font. Rows are compact by default; `density="comfortable"` makes them taller with larger icons.

## Parts

For anything else, style its parts with `::part()`, such as `church-lookup::part(option-name) { font-weight: 500 }`.

| Part | What it is |
|---|---|
| `label`, `input`, `clear` | The label, the search box and its clear button |
| `popup`, `listbox` | The results panel and the list inside it |
| `option` | Each result row |
| `option-name`, `option-detail`, `option-distance` | A result's name, its address line and its distance |
| `more` | The **Show more** row |
| `corrected` | The "Showing results for" line above corrected results |
| `note`, `retry` | The no-results or error message, and its **Try again** button |
| `footer` | The data credit under the results |
| `consent` | The panel that offers to share fixes back |

Want to see it fill a real form? [Open the full theming example](/examples/autofill).

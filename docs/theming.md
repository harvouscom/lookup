---
title: Theming
description: Match your design system with a few CSS variables. On pages with shadcn/ui-style tokens, it matches with no setup.
---

The widget reads its own `--hmc-*` CSS variables. When one isn't set, it falls back to the shadcn/ui token names (`--background`, `--foreground`, `--accent`, `--border`, `--radius` and so on), the same names [Sensible UI](https://sensibleui.com) by [Cam Pak](https://cameronpak.com) uses. So on those pages it matches with no setup. Anywhere else, set a few variables.

Pick a design system church apps are often built on, then drag across to compare it with the default.

:::html
<div class="frame"><div class="frame-in flush ba-wrap">
      <div class="ba" id="ba" style="--pos: 50%">
        <div class="ba-layer ba-before" inert>
          <span class="ba-tag">default</span>
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
          <span class="ba-l" id="ba-presets-l">design system</span>
          <button type="button" class="ba-chip" data-preset="hmc" aria-pressed="true">Here's My Church</button>
          <button type="button" class="ba-chip" data-preset="bootstrap" aria-pressed="false">Bootstrap</button>
          <button type="button" class="ba-chip" data-preset="material" aria-pressed="false">Material</button>
          <button type="button" class="ba-chip" data-preset="apple" aria-pressed="false">Apple</button>
          <button type="button" class="ba-chip" data-preset="tailwind" aria-pressed="false">Tailwind</button>
        </div>
      </div>
    </div></div>
    <div class="cb"><div class="cb-bar"><span class="cb-l">html · your tokens</span><button class="copy cb-copy" type="button">Copy</button></div><pre class="shiki" tabindex="0"><code id="ba-css"></code></pre></div>
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

The widget also takes your page's font. For anything else, style its parts with `::part(label)`, `::part(input)` and `::part(popup)`.

Want to see it fill a real form? [Open the full theming example](/examples/autofill).

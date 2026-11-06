# Theming

> Match your design system with a few CSS variables. On pages with shadcn/ui-style tokens, it matches with no setup.

Source: https://lookup.heresmychurch.com/docs/theming

The widget reads its own `--hmc-*` CSS variables. When one isn't set, it falls back to the shadcn/ui token names (`--background`, `--foreground`, `--accent`, `--border`, `--radius` and so on), the same names [Sensible UI](https://sensibleui.com) by [Cam Pak](https://cameronpak.com) uses. So on those pages it matches with no setup. Anywhere else, set a few variables.

Try it below. The right side has no Lookup CSS at all, only the page's tokens. Pick a set, edit any value or paste a theme from [ui.shadcn.com/themes](https://ui.shadcn.com/themes), then drag across to compare it with no tokens.

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

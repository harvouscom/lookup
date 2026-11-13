// Highlights the quickstart snippet with Shiki and the site's own lookup-dark theme, once, into
// tokens the film's code panel types out. Run: pnpm --filter lookup-video highlight
import { readFileSync, writeFileSync } from "node:fs";
import { createHighlighter } from "shiki";

// docs/quickstart.md's form, with the script tag split so it fits the panel.
export const CODE = `<script type="module"
  src="https://lookup.heresmychurch.com/element.js"></script>

<form action="/signup" method="post">
  <church-lookup name="church_id" label="Your church"></church-lookup>
  <input name="city"    data-hmc-field="city">
  <input name="website" data-hmc-field="website">
  <input name="times"   data-hmc-field="serviceTimes">
  <button>Join</button>
</form>`;

const themes = JSON.parse(readFileSync(new URL("../../scripts/shiki-lookup.json", import.meta.url), "utf8"));
const hl = await createHighlighter({ themes: [themes.dark], langs: ["html"] });
const lines = hl.codeToTokensBase(CODE, { lang: "html", theme: themes.dark.name })
  .map((line) => line.map((t) => ({ c: t.content, f: t.color })));
writeFileSync(new URL("../src/ui/code-tokens.json", import.meta.url), JSON.stringify({ bg: themes.dark.colors["editor.background"], lines }, null, 0) + "\n");
console.log(`highlighted ${lines.length} lines`);

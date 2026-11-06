// Build the shadcn registry served at lookup.heresmychurch.com/r/.
// 1. registry/lib/lookup-core.ts: the SDK's headless core (client, fill, consent, strings) as one
//    file, so `shadcn add` gives people the code itself. Generated; edit packages/sdk/src instead.
// 2. site/r/*.json: `shadcn build` over registry.json.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const src = (f) => readFileSync(`packages/sdk/src/${f}`, "utf8");
const strip = (code) =>
  code
    // Imports and re-exports between these files: they're all in one file now.
    .replace(/^import [^;]+ from "\.\/[a-z-]+\.ts";\n/gm, "")
    .replace(/^export \* from "\.\/[a-z-]+\.ts";\n/gm, "")
    .replace(/^export \{[^}]*\} from "\.\/[a-z-]+\.ts";\n/gm, "")
    .replace(/^export \{ setNativeValue, type FieldTarget \};\n/gm, "");
const version = JSON.parse(src("../package.json")).version;
const out = `// Lookup by Here's My Church, headless core v${version}. Generated from @heresmychurch/lookup
// (packages/sdk/src) by scripts/build-registry.mjs. MIT. https://lookup.heresmychurch.com/docs
/* eslint-disable */
${["client.ts", "dom.ts", "strings.ts", "core.ts"].map((f) => `\n// ── ${f} ──\n${strip(src(f))}`).join("")}`;
writeFileSync("registry/lib/lookup-core.ts", out);

execFileSync("npx", ["--yes", "shadcn@3.5.0", "build", "registry.json", "--output", "site/r"], { stdio: "inherit" });
console.log("registry built");

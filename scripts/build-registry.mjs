// Build the shadcn registry served at lookup.heresmychurch.com/r/.
// 1. registry/lib/lookup-core.ts: the SDK's headless core (client, fill, fields, consent, strings) as
//    one file, so `shadcn add` gives people the code itself. Generated; edit packages/sdk/src instead.
//    registry/lib/lookup-strings.ts: the other languages, registered when imported.
//    registry/hooks/use-church-lookup.ts: the SDK's useChurchLookup (packages/sdk/src/use-church-lookup.ts),
//    importing the core above. Generated too.
// 2. examples/shadcn-demo/src: verbatim copies of the registry files, so the demo runs what ships.
// 3. site/r/*.json: `shadcn build` over registry.json.
//
//   node scripts/build-registry.mjs           all three
//   node scripts/build-registry.mjs --lib     1 and 2 only, no network
//   node scripts/build-registry.mjs --check   exit 1 if 1 or 2 are out of date (run by `pnpm test`)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const src = (f) => readFileSync(`packages/sdk/src/${f}`, "utf8");
const strip = (code) =>
  code
    // Imports and re-exports between these files: they're all in one file now.
    .replace(/^import [^;]+ from "\.\/[a-z-]+\.ts";\n/gm, "")
    .replace(/^export \* from "\.\/[a-z-]+\.ts";\n/gm, "")
    .replace(/^export \{[^}]*\} from "\.\/[a-z-]+\.ts";\n/gm, "")
    .replace(/^export \{ setNativeValue, type FieldTarget \};\n/gm, "");

function libSource() {
  const version = JSON.parse(src("../package.json")).version;
  return `// Lookup by Here's My Church, headless core v${version}. Generated from @heresmychurch/lookup
// (packages/sdk/src) by scripts/build-registry.mjs. MIT. https://lookup.heresmychurch.com/docs
/* eslint-disable */
${["dev.ts", "client.ts", "dom.ts", "strings.ts", "fields.ts", "core.ts"].map((f) => `\n// ── ${f} ──\n${strip(src(f))}`).join("")}`;
}

/** Every language file, each in its own block so their helpers don't collide. */
function stringsSource() {
  const langs = ["es", "fr", "de", "pt", "pl"];
  const body = langs.map((l) => {
    const code = strip(src(`strings-${l}.ts`)).replace(/^\/\/.*\n/gm, "").replace(/^export default strings;\n/m, "").trim();
    return `\n// ── ${l} ──\n{\n${code.replace(/^(?=.)/gm, "  ")}\n}\n`;
  }).join("");
  return `// Lookup by Here's My Church: Spanish, French, German, Portuguese and Polish text for ChurchLookup and
// ChurchConsent. Import this file once and set lang (or the page's lang). Generated from
// packages/sdk/src/strings-*.ts by scripts/build-registry.mjs. MIT.
/* eslint-disable */
import { registerStrings, type Strings } from "@/lib/lookup-core"
${body}`;
}

/** The hook, pointed at the registry's copy of the core. */
function hookSource() {
  const code = src("use-church-lookup.ts");
  const out = code
    .replace('from "./core.ts"', 'from "@/lib/lookup-core"')
    .replace("// the headless core, the same engine", "// @/lib/lookup-core, the same engine")
    .replace(/^(\/\/ useChurchLookup:)/m, "// Generated from packages/sdk/src/use-church-lookup.ts by scripts/build-registry.mjs. MIT.\n$1");
  if (out.includes("./core.ts")) throw new Error("use-church-lookup.ts: core import not rewritten");
  return out;
}

/** Each generated file and what it should hold. The demo gets the registry files as they are. */
function outputs() {
  const lib = libSource();
  const strings = stringsSource();
  const hook = hookSource();
  const files = new Map([["registry/lib/lookup-core.ts", lib], ["registry/lib/lookup-strings.ts", strings], ["registry/hooks/use-church-lookup.ts", hook]]);
  for (const f of ["components/church-lookup.tsx", "components/church-consent.tsx"]) {
    files.set(`examples/shadcn-demo/src/${f}`, readFileSync(`registry/${f}`, "utf8"));
  }
  files.set("examples/shadcn-demo/src/hooks/use-church-lookup.ts", hook);
  files.set("examples/shadcn-demo/src/lib/lookup-core.ts", lib);
  files.set("examples/shadcn-demo/src/lib/lookup-strings.ts", strings);
  return files;
}

const flag = process.argv[2];
if (flag === "--check") {
  const stale = [...outputs()].filter(([path, want]) => !existsSync(path) || readFileSync(path, "utf8") !== want).map(([p]) => p);
  if (stale.length) {
    console.error(`Out of date: ${stale.join(", ")}\nRun: node scripts/build-registry.mjs --lib`);
    process.exit(1);
  }
  console.log("registry files are up to date");
} else {
  for (const [path, content] of outputs()) writeFileSync(path, content);
  if (flag !== "--lib") {
    execFileSync("npx", ["--yes", "shadcn@3.5.0", "build", "registry.json", "--output", "site/r"], { stdio: "inherit" });
  }
  console.log(flag === "--lib" ? "registry lib and demo copies written" : "registry built");
}

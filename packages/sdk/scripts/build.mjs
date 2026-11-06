// Bundle and minify the client and the element, emit type declarations, then report gzipped sizes.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";

rmSync("dist", { recursive: true, force: true });
const common = { bundle: true, minify: true, format: "esm", target: "es2020", legalComments: "none" };
await build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.js" });
await build({ ...common, entryPoints: ["src/core.ts"], outfile: "dist/core.js" });
await build({ ...common, entryPoints: ["src/element.ts"], outfile: "dist/element.js" });
await build({ ...common, entryPoints: ["src/service-times.ts"], outfile: "dist/service-times.js" });
for (const l of ["es", "fr", "de", "pt", "pl"]) await build({ ...common, entryPoints: [`src/strings-${l}.ts`], outfile: `dist/strings-${l}.js` });

// Declarations. tsc keeps the source's ".ts" import specifiers, which consumers can't resolve without
// allowImportingTsExtensions, so point them at the ".js" files next to each .d.ts.
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { stdio: "inherit" });
for (const f of ["jsx.d.ts", "react.d.ts", "vue.d.ts"]) copyFileSync(`src/${f}`, `dist/${f}`);
for (const f of readdirSync("dist").filter((f) => f.endsWith(".d.ts"))) {
  const src = readFileSync(`dist/${f}`, "utf8");
  writeFileSync(`dist/${f}`, src.replace(/((?:from|import\()\s*["']\.\/[\w-]+?)(?:\.d)?\.ts(["'])/g, "$1.js$2").replace('path="../src/', 'path="./'));
}

for (const f of ["dist/index.js", "dist/core.js", "dist/element.js", "dist/service-times.js"]) console.log(f, gzipSync(readFileSync(f)).length, "bytes gzipped");

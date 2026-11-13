// Bundle and minify each entry as ES modules and as CommonJS (for Jest and other require() setups),
// emit type declarations for both, then report gzipped sizes.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";

rmSync("dist", { recursive: true, force: true });
// Assignment semantics for class fields: uninitialized fields emit nothing instead of a defineProperty each.
const common = { bundle: true, minify: true, target: "es2020", legalComments: "none", logLevel: "error", tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } } };
const entries = ["index", "core", "fields", "element", "service-times", "react", ...["es", "fr", "de", "pt", "pl"].map((l) => `strings-${l}`)];
for (const name of entries) {
  // The React entry uses the app's React, and is a client module for the Next.js app router.
  const extra = name === "react" ? { external: ["react"], banner: { js: '"use client";' } } : {};
  await build({ ...common, ...extra, entryPoints: [`src/${name}.ts`], format: "esm", outfile: `dist/${name}.js` });
  await build({ ...common, ...extra, entryPoints: [`src/${name}.ts`], format: "cjs", outfile: `dist/${name}.cjs` });
}

// Declarations. tsc keeps the source's ".ts" import specifiers, which consumers can't resolve without
// allowImportingTsExtensions, so point them at the ".js" files next to each .d.ts.
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], { stdio: "inherit" });
for (const f of ["jsx.d.ts", "vue.d.ts"]) copyFileSync(`src/${f}`, `dist/${f}`);
for (const f of readdirSync("dist").filter((f) => f.endsWith(".d.ts"))) {
  const src = readFileSync(`dist/${f}`, "utf8");
  const out = src.replace(/((?:from|import\()\s*["']\.\/[\w-]+?)(?:\.d)?\.ts(["'])/g, "$1.js$2").replace('path="../src/', 'path="./');
  writeFileSync(`dist/${f}`, out);
  // The same types for require(), pointing at the .cjs side. jsx.d.ts is global and shared by both.
  if (f !== "jsx.d.ts" && f !== "vue.d.ts") writeFileSync(`dist/${f.replace(/\.d\.ts$/, ".d.cts")}`, out.replace(/((?:from|import\()\s*["']\.\/(?!jsx\.)[\w-]+)\.js(["'])/g, "$1.cjs$2"));
}

for (const f of ["index", "core", "fields", "element", "service-times", "react"]) console.log(`dist/${f}.js`, gzipSync(readFileSync(`dist/${f}.js`)).length, "bytes gzipped");

// Bundle and minify the client and the element, then report gzipped sizes.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const common = { bundle: true, minify: true, format: "esm", target: "es2020", legalComments: "none" };
await build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.js" });
await build({ ...common, entryPoints: ["src/core.ts"], outfile: "dist/core.js" });
await build({ ...common, entryPoints: ["src/element.ts"], outfile: "dist/element.js" });
await build({ ...common, entryPoints: ["src/service-times.ts"], outfile: "dist/service-times.js" });
for (const l of ["es", "fr", "de", "pt", "pl"]) await build({ ...common, entryPoints: [`src/strings-${l}.ts`], outfile: `dist/strings-${l}.js` });
for (const f of ["dist/index.js", "dist/core.js", "dist/element.js", "dist/service-times.js"]) console.log(f, gzipSync(readFileSync(f)).length, "bytes gzipped");

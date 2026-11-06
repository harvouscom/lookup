// Copy the built SDK into the Worker's static assets, so /element.js, /lookup.js, /service-times.js and
// the language files next to element.js serve the current build.
import { copyFileSync } from "node:fs";
copyFileSync("packages/sdk/dist/element.js", "site/element.js");
copyFileSync("packages/sdk/dist/index.js", "site/lookup.js");
copyFileSync("packages/sdk/dist/service-times.js", "site/service-times.js");
for (const l of ["es", "fr", "de", "pt", "pl"]) copyFileSync(`packages/sdk/dist/strings-${l}.js`, `site/strings-${l}.js`);

// Copy the built SDK into the Worker's static assets, so /element.js, /lookup.js and /service-times.js serve the current build.
import { copyFileSync } from "node:fs";
copyFileSync("packages/sdk/dist/element.js", "worker/public/element.js");
copyFileSync("packages/sdk/dist/index.js", "worker/public/lookup.js");
copyFileSync("packages/sdk/dist/service-times.js", "worker/public/service-times.js");

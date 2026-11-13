// Copy the built SDK into the Worker's static assets, so /element.js, /lookup.js, /service-times.js and
// the language files next to element.js serve the current build.
//
// Each release is also kept at /sdk/<version>/ for sites that pin a version. Those files are served as
// immutable, so they're written once and never replaced: commit site/sdk/<version>/ with the release,
// since a deploy only serves what's in site/. Changing the SDK without bumping its version leaves the
// pinned copy as it was and says so.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("packages/sdk/package.json", "utf8"));
const files = [
  ["element.js", "element.js"],
  ["index.js", "lookup.js"],
  ["service-times.js", "service-times.js"],
  ...["es", "fr", "de", "pt", "pl"].map((l) => [`strings-${l}.js`, `strings-${l}.js`]),
];

for (const [from, to] of files) copyFileSync(`packages/sdk/dist/${from}`, `site/${to}`);

const pinned = `site/sdk/${version}`;
if (!existsSync(pinned)) {
  mkdirSync(pinned, { recursive: true });
  for (const [from, to] of files) copyFileSync(`packages/sdk/dist/${from}`, `${pinned}/${to}`);
  console.log(`${pinned}/ written. Commit it: pinned versions must stay deployed.`);
} else {
  const changed = files.filter(([from, to]) => !readFileSync(`packages/sdk/dist/${from}`).equals(readFileSync(`${pinned}/${to}`))).map(([, to]) => to);
  if (changed.length) console.warn(`${pinned}/ kept as released; the build differs in ${changed.join(", ")}. Bump packages/sdk's version to pin this build.`);
}

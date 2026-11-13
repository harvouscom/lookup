// Pinned script URLs (/sdk/<version>/element.js) in the docs and README must name the package's
// version, so a release can't leave the docs pointing at an older one.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const { version } = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
const docs = [
  `${root}/README.md`,
  ...readdirSync(`${root}/../../docs`).filter((f) => f.endsWith(".md")).map((f) => `${root}/../../docs/${f}`),
];

describe("pinned script URLs", () => {
  it.each(docs.map((f) => [f.replace(/^.*\/(packages\/sdk|docs)\//, "$1/"), f]))("%s names the current version", (_, file) => {
    const text = readFileSync(file, "utf8");
    for (const [, v] of text.matchAll(/heresmychurch\.com\/sdk\/(\d+\.\d+\.\d+[^/]*)\//g)) expect(v).toBe(version);
    for (const [, v] of text.matchAll(/pinned to version (\d+\.\d+\.\d+)/g)) expect(v).toBe(version);
  });
});

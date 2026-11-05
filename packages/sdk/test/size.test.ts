import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// Run after `node scripts/build.mjs`, which `pnpm test` does.
const gz = (f: string) => gzipSync(readFileSync(`${process.cwd()}/dist/${f}`)).length;

describe("bundle size", () => {
  it("core client is at most 2 KB gzipped", () => expect(gz("index.js")).toBeLessThanOrEqual(2048));
  it("element is at most 10 KB gzipped", () => expect(gz("element.js")).toBeLessThanOrEqual(10240));
  it("service-times editor is at most 6 KB gzipped", () => expect(gz("service-times.js")).toBeLessThanOrEqual(6144));
  it("has no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8"));
    expect(pkg.dependencies ?? {}).toEqual({});
  });
});

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

// Run after `node scripts/build.mjs`, which `pnpm test` does.
const gz = (f: string) => gzipSync(readFileSync(`${process.cwd()}/dist/${f}`)).length;

describe("bundle size", () => {
  it("core client is at most 2 KB gzipped", () => expect(gz("index.js")).toBeLessThanOrEqual(2048));
  it("headless core is at most 5 KB gzipped", () => expect(gz("core.js")).toBeLessThanOrEqual(5120));
  it("field matching is at most 1 KB gzipped", () => expect(gz("fields.js")).toBeLessThanOrEqual(1024));
  it("element is at most 15 KB gzipped", () => expect(gz("element.js")).toBeLessThanOrEqual(15360));
  it("service-times editor is at most 6 KB gzipped", () => expect(gz("service-times.js")).toBeLessThanOrEqual(6144));
  it("has no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8"));
    expect(pkg.dependencies ?? {}).toEqual({});
  });
});

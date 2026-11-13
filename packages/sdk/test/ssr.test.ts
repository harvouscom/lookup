// @vitest-environment node
// Run after `node scripts/build.mjs`, which `pnpm test` does. Server rendering (Next.js, Nuxt, Astro)
// imports these files with no DOM; they must load without throwing and register nothing.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

describe("importing without a DOM", () => {
  it("has no HTMLElement here", () => expect(typeof HTMLElement).toBe("undefined"));
  it.each(["index", "core", "fields", "element", "service-times", "react", "strings-es"])("loads dist/%s.js", async (f) => {
    await expect(import(`../dist/${f}.js`)).resolves.toBeTruthy();
  });
  // The CommonJS build, for Jest and other require() setups.
  it.each(["index", "core", "fields", "element", "service-times", "react", "strings-es"])("requires dist/%s.cjs", (f) => {
    expect(require(`../dist/${f}.cjs`)).toBeTruthy();
  });
  it("exports the same names from both builds", async () => {
    for (const f of ["index", "core", "fields", "element", "react"]) {
      expect(Object.keys(require(`../dist/${f}.cjs`)).sort(), f).toEqual(Object.keys(await import(`../dist/${f}.js`)).filter((k) => k !== "default").sort());
    }
  });
});

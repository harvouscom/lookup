// @vitest-environment node
// Run after `node scripts/build.mjs`, which `pnpm test` does. Server rendering (Next.js, Nuxt, Astro)
// imports these files with no DOM; they must load without throwing and register nothing.
import { describe, expect, it } from "vitest";

describe("importing without a DOM", () => {
  it("has no HTMLElement here", () => expect(typeof HTMLElement).toBe("undefined"));
  it.each(["index", "core", "fields", "element", "service-times", "strings-es"])("loads dist/%s.js", async (f) => {
    await expect(import(`../dist/${f}.js`)).resolves.toBeTruthy();
  });
});

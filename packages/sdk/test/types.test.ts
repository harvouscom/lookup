// Run after `node scripts/build.mjs`, which `pnpm test` does. Checks the published types work for an
// app: every export has a declaration, and none import ".ts" files an app can't resolve.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));

describe("published types", () => {
  it("has a declaration file for every export", () => {
    for (const [path, entry] of Object.entries<{ types: string }>(pkg.exports)) {
      const file = entry.types.replace("*", "es");
      expect(existsSync(`${root}/${file}`), `${path} -> ${file}`).toBe(true);
      expect(file.startsWith("./dist/"), path).toBe(true);
    }
  });
  it("imports .js files, never .ts", () => {
    for (const f of readdirSync(`${root}/dist`).filter((f) => f.endsWith(".d.ts"))) {
      expect(readFileSync(`${root}/dist/${f}`, "utf8"), f).not.toMatch(/(from|import\()\s*["']\.\/[^"']*\.ts["']/);
    }
  });
  it("type-checks in an app without allowImportingTsExtensions", () => {
    const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
    expect(() => execFileSync(process.execPath, [tsc, "-p", "test/types/tsconfig.json"], { cwd: root, stdio: "pipe" })).not.toThrow();
  }, 60_000);
});

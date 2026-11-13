// Run after `node scripts/build.mjs`, which `pnpm test` does. Checks the published types work for an
// app: every export has a declaration, none import ".ts" files an app can't resolve, and an app finds
// them under each moduleResolution TypeScript offers, including the older "node" (node10).
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");

// A throwaway app with the package in node_modules the way an install puts it: package.json and dist.
const app = mkdtempSync(join(tmpdir(), "lookup-types-"));
const installed = join(app, "node_modules/@heresmychurch/lookup");
mkdirSync(installed, { recursive: true });
copyFileSync(`${root}/package.json`, join(installed, "package.json"));
cpSync(`${root}/dist`, join(installed, "dist"), { recursive: true });
copyFileSync(`${root}/test/types/consumer.ts`, join(app, "consumer.ts"));
copyFileSync(`${root}/test/types/consumer-react.tsx`, join(app, "consumer-react.tsx"));
copyFileSync(`${root}/test/types/consumer-vue.ts`, join(app, "consumer-vue.ts"));
// React from this package's dev dependencies, as an app would have its own.
mkdirSync(join(app, "node_modules/@types"), { recursive: true });
symlinkSync(`${root}/node_modules/react`, join(app, "node_modules/react"), "dir");
symlinkSync(`${root}/node_modules/@types/react`, join(app, "node_modules/@types/react"), "dir");
// A stand-in for Vue's types: just what vue.d.ts augments.
mkdirSync(join(app, "node_modules/vue"), { recursive: true });
writeFileSync(join(app, "node_modules/vue/package.json"), JSON.stringify({ name: "vue", types: "index.d.ts" }));
writeFileSync(join(app, "node_modules/vue/index.d.ts"), "export type DefineComponent<P> = { new (): { $props: P } };\nexport interface GlobalComponents {}\n");
afterAll(() => rmSync(app, { recursive: true, force: true }));

function typecheck(moduleResolution: string, module: string, type: "module" | "commonjs", files = ["consumer.ts"]) {
  writeFileSync(join(app, "package.json"), JSON.stringify({ type }));
  const compilerOptions = { target: "ES2022", module, moduleResolution, lib: ["ES2022", "DOM", "DOM.Iterable"], types: [], strict: true, noEmit: true, skipLibCheck: false, jsx: "react-jsx" };
  writeFileSync(join(app, "tsconfig.json"), JSON.stringify({ compilerOptions, files }));
  try { execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], { cwd: app, stdio: "pipe" }); return ""; }
  catch (e) { return String((e as { stdout?: Buffer }).stdout ?? e); }
}

describe("published types", () => {
  it("has a declaration file for every export", () => {
    type Entry = { types: string; default?: string };
    for (const [path, entry] of Object.entries<Entry | { import: Entry; require: Entry }>(pkg.exports)) {
      for (const e of "import" in entry ? [entry.import, entry.require] : [entry]) {
        for (const file of [e.types, e.default].filter(Boolean).map((f) => f!.replace("*", "es"))) {
          expect(existsSync(`${root}/${file}`), `${path} -> ${file}`).toBe(true);
          expect(file.startsWith("./dist/"), path).toBe(true);
        }
      }
    }
  });
  it("maps every export for node10 through typesVersions", () => {
    const mapped = Object.keys(pkg.typesVersions["*"]).map((k) => `./${k}`);
    expect(mapped.sort()).toEqual(Object.keys(pkg.exports).filter((k) => k !== ".").sort());
    expect(existsSync(`${root}/${pkg.types}`)).toBe(true);
  });
  it("imports .js files, never .ts", () => {
    for (const f of readdirSync(`${root}/dist`).filter((f) => f.endsWith(".d.ts"))) {
      expect(readFileSync(`${root}/dist/${f}`, "utf8"), f).not.toMatch(/(from|import\()\s*["']\.\/[^"']*\.ts["']/);
    }
  });
  it("type-checks in an app with the original settings (self-reference)", () => {
    expect(() => execFileSync(process.execPath, [tsc, "-p", "test/types/tsconfig.json"], { cwd: root, stdio: "pipe" })).not.toThrow();
  }, 60_000);
  it.each([
    ["bundler", "esnext", "module"],
    ["node16", "node16", "module"],
    ["nodenext", "nodenext", "module"],
    ["node10", "commonjs", "commonjs"],
  ] as const)("type-checks in an app with moduleResolution %s", (mr, m, type) => {
    expect(typecheck(mr, m, type)).toBe("");
  }, 60_000);
  it("types React 19 props, events and the hook", () => {
    expect(typecheck("bundler", "esnext", "module", ["consumer-react.tsx"])).toBe("");
  }, 60_000);
  it("types Vue template events", () => {
    expect(typecheck("bundler", "esnext", "module", ["consumer-vue.ts"])).toBe("");
  }, 60_000);
});

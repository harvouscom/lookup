import { fileURLToPath } from "node:url";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["worker/test/**/*.test.ts"],
    poolOptions: {
      workers: {
        main: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
        miniflare: {
          compatibilityDate: "2026-10-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
        },
      },
    },
  },
});

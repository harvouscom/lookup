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
          // The Cache API is a no-op here. The Worker writes to it in waitUntil, and that write can
          // outlive a test and break isolated storage's cleanup (seen on Linux CI as a stray
          // .sqlite-shm file). No test depends on a cache hit.
          cache: false,
        },
      },
    },
  },
});

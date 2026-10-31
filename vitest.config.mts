import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src(""),
      "server-only": src("test/server-only-stub.ts"),
    },
  },
  // PGlite migrates on first use, which can take a while on a cold machine.
  test: { include: ["src/**/*.test.ts"], hookTimeout: 30_000 },
});

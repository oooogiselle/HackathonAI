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
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Playwright run use its own build folder next to `pnpm dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // cacheComponents is intentionally off: pages can read the Supabase session
  // anywhere without extra <Suspense> boundaries. Opt in later if you want it.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

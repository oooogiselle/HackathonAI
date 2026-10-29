import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations use the session pooler (port 5432), which supports the
    // prepared statements / DDL that drizzle-kit needs. The app itself uses
    // DATABASE_URL (transaction pooler) — see src/db/index.ts.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});

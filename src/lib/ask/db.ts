// The database behind Ask. Two modes, same schema, same SQL:
// - ASK_DB=postgres → the shared Supabase Postgres (DATABASE_URL). Needed on
//   Vercel so every instance sees the same cards. Apply migrations first
//   (`pnpm db:migrate`, a human step).
// - otherwise → an in-process PGlite database (Postgres compiled to WASM),
//   migrated and seeded on first use. Resets when the server restarts.
//   Only correct on a single server process.
import "server-only";

import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import * as schema from "@/db/schema";

import { seedAskData } from "./seed";

export type AskDb = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as typeof globalThis & { __askDb?: Promise<AskDb> };

export function usingSharedPostgres() {
  return process.env.ASK_DB === "postgres";
}

async function open(): Promise<AskDb> {
  if (usingSharedPostgres()) {
    const { db } = await import("@/db");
    const shared = db as unknown as AskDb;
    // Idempotent: seed users and demo cards (fictional people, Dartmouth campus).
    await seedAskData(shared);
    return shared;
  }
  const local = drizzlePglite(new PGlite({ extensions: { vector } }), { schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const db = local as unknown as AskDb;
  await seedAskData(db);
  return db;
}

/** The Ask database, opened (and for local mode, migrated + seeded) once per process. */
export function getAskDb(): Promise<AskDb> {
  g.__askDb ??= open().catch((error) => {
    g.__askDb = undefined;
    throw error;
  });
  return g.__askDb;
}

/** Tests only: a fresh local database. */
export async function openTestDb(): Promise<AskDb> {
  const local = drizzlePglite(new PGlite({ extensions: { vector } }), { schema });
  await migrate(local, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const db = local as unknown as AskDb;
  await seedAskData(db);
  g.__askDb = Promise.resolve(db);
  return db;
}

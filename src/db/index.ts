import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// DATABASE_URL is Supabase's *transaction* pooler (port 6543), which is the
// right choice for serverless. It doesn't support prepared statements, hence
// `prepare: false`. postgres-js connects lazily, so importing this module
// without a DATABASE_URL (e.g. during `next build`) is fine.
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle(client, { schema });

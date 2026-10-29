// EXAMPLE (items): a minimal user-owned resource. Copy this pattern for your
// own tables, then rename or delete it (see README → "Removing the examples").
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Supabase auth user id (auth.users.id). Not a hard FK, to keep migrations
  // independent of Supabase's `auth` schema.
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS(); // RLS on + no policies = not reachable via Supabase's public API. Drizzle bypasses it.

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

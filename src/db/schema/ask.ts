// Ask: users, asks (board cards), claims, private requests, group shares,
// messages, inbox notifications, mocked payments, blocks and the group rate limit.
//
// Every state change is a guarded `UPDATE … WHERE <expected state> RETURNING`
// (see src/lib/ask/board-store.ts). No ratings, reviews or points, by design.
// RLS on + no policies = not reachable via Supabase's public API; the server
// talks to Postgres directly.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { BusySlot, Interest } from "@/lib/ask/types";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Sign-up is mocked tonight: nothing is verified, the *_verified_at columns are
// set by the mock (TODO(auth)). Seeded helpers live here too.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    firstName: text("first_name").notNull(),
    // Never shown to other members.
    email: text("email").notNull().unique(),
    phone: text("phone"),
    emailVerifiedAt: ts("email_verified_at"),
    phoneVerifiedAt: ts("phone_verified_at"),
    classYear: text("class_year"),
    showClassYear: boolean("show_class_year").notNull().default(true),
    blurb: text("blurb"),
    // Helper profile, used by matching.
    interests: text("interests")
      .array()
      .$type<Interest[]>()
      .notNull()
      .default(sql`'{}'`),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'`),
    // Seeded weekly free/busy only, never event titles.
    busy: jsonb("busy").$type<BusySlot[]>().notNull().default([]),
    weeklyLimit: integer("weekly_limit").notNull().default(3),
    // null = not answered yet. F-1 students and anyone who opts out: false.
    canAcceptPayment: boolean("can_accept_payment"),
    // Mocked payout account (TODO(stripe): Stripe Connect).
    payoutMethod: text("payout_method"),
    payoutHandle: text("payout_handle"),
    emailNotifications: boolean("email_notifications").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("users_weekly_limit", sql`${t.weeklyLimit} between 0 and 20`),
    check("users_payout_method", sql`${t.payoutMethod} in ('venmo', 'bank')`),
  ],
).enableRLS();

// Mock sign-in: the cookie holds the session id only.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
).enableRLS();

// One ask = one card, on the board, in a GroupMe link, or sent privately.
// open → held → confirmed → done; cancelled from any state before done.
// "expired" is never written: open/held asks past expires_at read as expired.
export const asks = pgTable(
  "asks",
  {
    token: text("token").primaryKey(),
    askerId: text("asker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // "What done looks like": where, when, details.
    details: text("details").notNull(),
    category: text("category").notNull().default("other"),
    payType: text("pay_type").notNull().default("free"),
    // Whole dollars. 0 = a favor.
    price: integer("price").notNull().default(0),
    minutes: integer("minutes").notNull(),
    anonymous: boolean("anonymous").notNull().default(true),
    // Private asks go only to picked helpers: never the board, never a group.
    private: boolean("private").notNull().default(false),
    status: text("status").notNull().default("open"),
    startsAt: ts("starts_at"),
    neededBy: ts("needed_by"),
    expiresAt: ts("expires_at").notNull(),
    meetingSpot: text("meeting_spot"),
    thanks: text("thanks"),
    createdAt: ts("created_at").notNull().defaultNow(),
    cancelledAt: ts("cancelled_at"),
    // The helper tapped "Done". If the asker doesn't confirm (or report a
    // problem) within 48 h, it auto-confirms and a held payment is released.
    helperDoneAt: ts("helper_done_at"),
    // The asker tapped "Report a problem": stops the auto-confirm (TODO: team review).
    problemReportedAt: ts("problem_reported_at"),
    problemNote: text("problem_note"),
  },
  (t) => [
    check("asks_status", sql`${t.status} in ('open', 'held', 'confirmed', 'done', 'cancelled')`),
    check("asks_category", sql`${t.category} in ('writing', 'coding', 'lab', 'errands', 'other')`),
    check("asks_pay_type", sql`${t.payType} in ('pay', 'fund', 'trade', 'free')`),
    check("asks_price", sql`${t.price} between 0 and 500`),
    // Only paid asks carry a price.
    check("asks_price_pay_type", sql`${t.price} = 0 or ${t.payType} in ('pay', 'fund')`),
    check("asks_minutes", sql`${t.minutes} between 5 and 480`),
    check("asks_title_len", sql`char_length(${t.title}) between 1 and 120`),
    check("asks_details_len", sql`char_length(${t.details}) between 1 and 1000`),
    // The board: open public asks, newest first.
    index("asks_board_idx")
      .on(t.createdAt.desc())
      .where(sql`${t.status} = 'open' and ${t.private} = false`),
    index("asks_asker_idx").on(t.askerId, t.createdAt.desc()),
    // Asks waiting to auto-confirm 48 h after the helper's "Done".
    index("asks_auto_confirm_idx")
      .on(t.helperDoneAt)
      .where(sql`${t.status} = 'confirmed' and ${t.helperDoneAt} is not null`),
  ],
).enableRLS();

// Who holds an ask. One row per ask, so a second claim can't exist.
export const claims = pgTable(
  "claims",
  {
    askToken: text("ask_token")
      .primaryKey()
      .references(() => asks.token, { onDelete: "cascade" }),
    helperId: text("helper_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    heldAt: ts("held_at").notNull().defaultNow(),
  },
  (t) => [index("claims_helper_idx").on(t.helperId, t.heldAt.desc())],
).enableRLS();

// Private route: the 2–3 helpers an asker picked. "Not this time" needs no reason.
export const askRecipients = pgTable(
  "ask_recipients",
  {
    askToken: text("ask_token")
      .notNull()
      .references(() => asks.token, { onDelete: "cascade" }),
    helperId: text("helper_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: ts("sent_at").notNull().defaultNow(),
    response: text("response"),
    respondedAt: ts("responded_at"),
  },
  (t) => [
    primaryKey({ columns: [t.askToken, t.helperId] }),
    check("ask_recipients_response", sql`${t.response} in ('yes', 'no')`),
    index("ask_recipients_helper_idx").on(t.helperId, t.sentAt.desc()),
  ],
).enableRLS();

// The bot shared this ask to a group. Saved before posting, removed if the post fails.
export const askShares = pgTable(
  "ask_shares",
  {
    askToken: text("ask_token")
      .notNull()
      .references(() => asks.token, { onDelete: "cascade" }),
    groupId: text("group_id").notNull(),
    postedAt: ts("posted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.askToken, t.groupId] })],
).enableRLS();

// Short thread between the asker and the helper holding the ask.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    askToken: text("ask_token")
      .notNull()
      .references(() => asks.token, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("messages_body_len", sql`char_length(${t.body}) between 1 and 1000`),
    index("messages_ask_idx").on(t.askToken, t.createdAt),
  ],
).enableRLS();

// Inbox. kind: "action" needs a tap, "update" is info only.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    askToken: text("ask_token").references(() => asks.token, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    topic: text("topic").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    readAt: ts("read_at"),
  },
  (t) => [
    check("notifications_kind", sql`${t.kind} in ('action', 'update')`),
    check("notifications_topic", sql`${t.topic} in ('tasks', 'groups', 'payments')`),
    index("notifications_user_idx").on(t.userId, t.createdAt.desc()),
  ],
).enableRLS();

// Mocked payment: no money moves, no payment API (TODO(stripe): Stripe Connect).
// held when the asker taps "Pay $X and hold" after confirming a helper; released
// when the asker confirms it's done (or 48 h after the helper's "Done");
// refunded if the ask is cancelled before then.
export const payments = pgTable(
  "payments",
  {
    askToken: text("ask_token")
      .primaryKey()
      .references(() => asks.token, { onDelete: "cascade" }),
    payerId: text("payer_id")
      .notNull()
      .references(() => users.id),
    payeeId: text("payee_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    processingFeeCents: integer("processing_fee_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    method: text("method").notNull(),
    status: text("status").notNull().default("held"),
    heldAt: ts("held_at").notNull().defaultNow(),
    releasedAt: ts("released_at"),
    refundedAt: ts("refunded_at"),
  },
  (t) => [
    check("payments_method", sql`${t.method} in ('venmo', 'card')`),
    check("payments_status", sql`${t.status} in ('held', 'released', 'refunded')`),
    check("payments_amount", sql`${t.amountCents} > 0`),
    check(
      "payments_total",
      sql`${t.totalCents} = ${t.amountCents} + ${t.platformFeeCents} + ${t.processingFeeCents}`,
    ),
    index("payments_payee_idx").on(t.payeeId),
    index("payments_payer_idx").on(t.payerId),
  ],
).enableRLS();

// Blocked people: hides asks both ways and stops claims, requests and messages.
// viaAskToken lets the blocker see "the asker of <title>" without learning who it was.
export const blocks = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viaAskToken: text("via_ask_token").references(() => asks.token, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check("blocks_not_self", sql`${t.blockerId} <> ${t.blockedId}`),
    index("blocks_blocked_idx").on(t.blockedId),
  ],
).enableRLS();

// Bot rate limit: 3 posts per group per day (UTC day).
export const groupPostCounts = pgTable(
  "group_post_counts",
  {
    groupId: text("group_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    n: integer("n").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.day] }),
    check("group_post_counts_n", sql`${t.n} between 0 and 3`),
  ],
).enableRLS();

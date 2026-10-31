CREATE TABLE "ask_recipients" (
	"ask_token" text NOT NULL,
	"helper_id" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response" text,
	"responded_at" timestamp with time zone,
	CONSTRAINT "ask_recipients_ask_token_helper_id_pk" PRIMARY KEY("ask_token","helper_id"),
	CONSTRAINT "ask_recipients_response" CHECK ("ask_recipients"."response" in ('yes', 'no'))
);
--> statement-breakpoint
ALTER TABLE "ask_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ask_shares" (
	"ask_token" text NOT NULL,
	"group_id" text NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_shares_ask_token_group_id_pk" PRIMARY KEY("ask_token","group_id")
);
--> statement-breakpoint
ALTER TABLE "ask_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asks" (
	"token" text PRIMARY KEY NOT NULL,
	"asker_id" text NOT NULL,
	"title" text NOT NULL,
	"details" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"pay_type" text DEFAULT 'free' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"minutes" integer NOT NULL,
	"anonymous" boolean DEFAULT true NOT NULL,
	"private" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"starts_at" timestamp with time zone,
	"needed_by" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"meeting_spot" text,
	"thanks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "asks_status" CHECK ("asks"."status" in ('open', 'held', 'confirmed', 'done', 'cancelled')),
	CONSTRAINT "asks_category" CHECK ("asks"."category" in ('writing', 'coding', 'lab', 'errands', 'other')),
	CONSTRAINT "asks_pay_type" CHECK ("asks"."pay_type" in ('pay', 'fund', 'trade', 'free')),
	CONSTRAINT "asks_price" CHECK ("asks"."price" between 0 and 500),
	CONSTRAINT "asks_price_pay_type" CHECK ("asks"."price" = 0 or "asks"."pay_type" in ('pay', 'fund')),
	CONSTRAINT "asks_minutes" CHECK ("asks"."minutes" between 5 and 480),
	CONSTRAINT "asks_title_len" CHECK (char_length("asks"."title") between 1 and 120),
	CONSTRAINT "asks_details_len" CHECK (char_length("asks"."details") between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "asks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"via_ask_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "blocks_not_self" CHECK ("blocks"."blocker_id" <> "blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "claims" (
	"ask_token" text PRIMARY KEY NOT NULL,
	"helper_id" text NOT NULL,
	"held_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_post_counts" (
	"group_id" text NOT NULL,
	"day" date NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "group_post_counts_group_id_day_pk" PRIMARY KEY("group_id","day"),
	CONSTRAINT "group_post_counts_n" CHECK ("group_post_counts"."n" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "group_post_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_token" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_len" CHECK (char_length("messages"."body") between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ask_token" text,
	"kind" text NOT NULL,
	"topic" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_kind" CHECK ("notifications"."kind" in ('action', 'update')),
	CONSTRAINT "notifications_topic" CHECK ("notifications"."topic" in ('tasks', 'groups', 'payments'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"ask_token" text PRIMARY KEY NOT NULL,
	"payer_id" text NOT NULL,
	"payee_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"processing_fee_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"held_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	CONSTRAINT "payments_method" CHECK ("payments"."method" in ('venmo', 'card')),
	CONSTRAINT "payments_status" CHECK ("payments"."status" in ('held', 'released', 'refunded')),
	CONSTRAINT "payments_amount" CHECK ("payments"."amount_cents" > 0),
	CONSTRAINT "payments_total" CHECK ("payments"."total_cents" = "payments"."amount_cents" + "payments"."platform_fee_cents" + "payments"."processing_fee_cents")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"email_verified_at" timestamp with time zone,
	"phone_verified_at" timestamp with time zone,
	"class_year" text,
	"show_class_year" boolean DEFAULT true NOT NULL,
	"blurb" text,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"busy" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weekly_limit" integer DEFAULT 3 NOT NULL,
	"can_accept_payment" boolean,
	"payout_method" text,
	"payout_handle" text,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_weekly_limit" CHECK ("users"."weekly_limit" between 0 and 20),
	CONSTRAINT "users_payout_method" CHECK ("users"."payout_method" in ('venmo', 'bank'))
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ask_recipients" ADD CONSTRAINT "ask_recipients_ask_token_asks_token_fk" FOREIGN KEY ("ask_token") REFERENCES "public"."asks"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_recipients" ADD CONSTRAINT "ask_recipients_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_shares" ADD CONSTRAINT "ask_shares_ask_token_asks_token_fk" FOREIGN KEY ("ask_token") REFERENCES "public"."asks"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_asker_id_users_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_via_ask_token_asks_token_fk" FOREIGN KEY ("via_ask_token") REFERENCES "public"."asks"("token") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_ask_token_asks_token_fk" FOREIGN KEY ("ask_token") REFERENCES "public"."asks"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_ask_token_asks_token_fk" FOREIGN KEY ("ask_token") REFERENCES "public"."asks"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ask_token_asks_token_fk" FOREIGN KEY ("ask_token") REFERENCES "public"."asks"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_ask_token_asks_token_fk" FOREIGN KEY ("ask_token") REFERENCES "public"."asks"("token") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_users_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_recipients_helper_idx" ON "ask_recipients" USING btree ("helper_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "asks_board_idx" ON "asks" USING btree ("created_at" DESC NULLS LAST) WHERE "asks"."status" = 'open' and "asks"."private" = false;--> statement-breakpoint
CREATE INDEX "asks_asker_idx" ON "asks" USING btree ("asker_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "blocks_blocked_idx" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "claims_helper_idx" ON "claims" USING btree ("helper_id","held_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_ask_idx" ON "messages" USING btree ("ask_token","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payments_payee_idx" ON "payments" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "payments_payer_idx" ON "payments" USING btree ("payer_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
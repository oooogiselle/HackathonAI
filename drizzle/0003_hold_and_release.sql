ALTER TABLE "asks" ADD COLUMN "helper_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asks" ADD COLUMN "problem_reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asks" ADD COLUMN "problem_note" text;--> statement-breakpoint
CREATE INDEX "asks_auto_confirm_idx" ON "asks" USING btree ("helper_done_at") WHERE "asks"."status" = 'confirmed' and "asks"."helper_done_at" is not null;
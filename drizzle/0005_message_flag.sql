ALTER TABLE "messages" ADD COLUMN "flag" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_flag" CHECK ("messages"."flag" in ('off-platform-payment', 'id-number'));
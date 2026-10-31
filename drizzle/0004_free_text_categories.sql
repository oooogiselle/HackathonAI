ALTER TABLE "asks" DROP CONSTRAINT "asks_category";--> statement-breakpoint
ALTER TABLE "asks" ALTER COLUMN "category" SET DEFAULT 'Other';--> statement-breakpoint
-- Categories are free text now, stored as their display label ("errands" -> "Errands").
UPDATE "asks" SET "category" = initcap("category") WHERE "category" in ('writing', 'coding', 'lab', 'errands', 'other');--> statement-breakpoint
ALTER TABLE "asks" ADD CONSTRAINT "asks_category_len" CHECK (char_length("asks"."category") between 1 and 24);

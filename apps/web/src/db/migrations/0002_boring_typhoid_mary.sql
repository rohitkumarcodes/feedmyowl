ALTER TABLE "feeds" DROP CONSTRAINT "feeds_folder_id_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_html" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extraction_status" varchar(50);--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "extraction_source" varchar(80);--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_fetch_status" varchar(50);--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_fetch_error_code" varchar(80);--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_fetch_error_message" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_fetch_error_at" timestamp;--> statement-breakpoint
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feeds_user_id_url_unique" ON "feeds" USING btree ("user_id","url");
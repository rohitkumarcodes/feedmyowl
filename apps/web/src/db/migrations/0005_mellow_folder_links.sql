CREATE TABLE "feed_folder_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feed_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_folder_memberships" ADD CONSTRAINT "feed_folder_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feed_folder_memberships" ADD CONSTRAINT "feed_folder_memberships_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feed_folder_memberships" ADD CONSTRAINT "feed_folder_memberships_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "feed_folder_memberships_user_feed_folder_unique" ON "feed_folder_memberships" USING btree ("user_id","feed_id","folder_id");
--> statement-breakpoint
INSERT INTO "feed_folder_memberships" ("user_id", "feed_id", "folder_id", "created_at", "updated_at")
SELECT "user_id", "id", "folder_id", "created_at", "updated_at"
FROM "feeds"
WHERE "folder_id" IS NOT NULL
ON CONFLICT ("user_id", "feed_id", "folder_id") DO NOTHING;

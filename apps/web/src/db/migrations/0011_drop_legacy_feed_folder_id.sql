INSERT INTO "feed_folder_memberships" ("user_id", "feed_id", "folder_id", "created_at", "updated_at")
SELECT "user_id", "id", "folder_id", "created_at", "updated_at"
FROM "feeds"
WHERE "folder_id" IS NOT NULL
ON CONFLICT ("user_id", "feed_id", "folder_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "feeds" DROP CONSTRAINT IF EXISTS "feeds_folder_id_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "feeds" DROP COLUMN IF EXISTS "folder_id";

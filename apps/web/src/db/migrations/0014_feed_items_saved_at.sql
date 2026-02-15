ALTER TABLE "feed_items" ADD COLUMN "saved_at" timestamp;

CREATE INDEX "feed_items_feed_id_saved_at_id_idx"
ON "feed_items" USING btree (
  "feed_id",
  "saved_at" DESC,
  "id" DESC
)
WHERE "saved_at" IS NOT NULL;


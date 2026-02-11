CREATE INDEX "feed_items_feed_id_effective_published_id_idx"
ON "feed_items" USING btree (
  "feed_id",
  COALESCE("published_at", "created_at") DESC,
  "id" DESC
);


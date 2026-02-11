CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "http_etag" text;
--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "http_last_modified" text;
--> statement-breakpoint
ALTER TABLE "feed_items" ADD COLUMN "content_fingerprint" text;
--> statement-breakpoint
UPDATE "feed_items"
SET "content_fingerprint" = encode(
  digest(
    concat_ws(
      '|',
      lower(trim(coalesce("link", ''))),
      lower(trim(coalesce("title", ''))),
      lower(
        trim(
          regexp_replace(
            regexp_replace(coalesce("content", ''), '<[^>]+>', ' ', 'g'),
            '\s+',
            ' ',
            'g'
          )
        )
      ),
      lower(trim(coalesce("author", ''))),
      coalesce(to_char("published_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '')
    ),
    'sha256'
  ),
  'hex'
)
WHERE "guid" IS NULL AND "content_fingerprint" IS NULL;
--> statement-breakpoint
DELETE FROM "feed_items"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "feed_id", "guid"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS "rank"
    FROM "feed_items"
    WHERE "guid" IS NOT NULL
  ) AS "ranked"
  WHERE "rank" > 1
);
--> statement-breakpoint
DELETE FROM "feed_items"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "feed_id", "content_fingerprint"
        ORDER BY "created_at" ASC, "id" ASC
      ) AS "rank"
    FROM "feed_items"
    WHERE "guid" IS NULL AND "content_fingerprint" IS NOT NULL
  ) AS "ranked"
  WHERE "rank" > 1
);
--> statement-breakpoint
CREATE UNIQUE INDEX "feed_items_feed_id_guid_unique"
ON "feed_items" USING btree ("feed_id", "guid")
WHERE "guid" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "feed_items_feed_id_content_fingerprint_unique"
ON "feed_items" USING btree ("feed_id", "content_fingerprint")
WHERE "guid" IS NULL AND "content_fingerprint" IS NOT NULL;

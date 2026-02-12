CREATE UNIQUE INDEX IF NOT EXISTS "folders_user_id_lower_name_unique" ON "folders" ("user_id", lower("name"));

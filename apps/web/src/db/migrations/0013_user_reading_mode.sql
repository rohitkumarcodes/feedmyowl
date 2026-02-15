-- Add reading_mode column to users table.
-- "reader" = calm mode (no unread indicators), "checker" = traditional RSS mode.
-- Defaults to "reader" for new users; existing users also get "reader".
ALTER TABLE "users"
  ADD COLUMN "reading_mode" varchar(20) NOT NULL DEFAULT 'reader';

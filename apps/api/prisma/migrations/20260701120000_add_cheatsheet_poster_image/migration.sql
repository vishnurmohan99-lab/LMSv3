-- Optional manually-uploaded full poster image (R2 key) for a cheat sheet,
-- shown uncropped. Additive nullable column — safe on the live table.
ALTER TABLE "CheatSheet" ADD COLUMN "posterImageKey" TEXT;

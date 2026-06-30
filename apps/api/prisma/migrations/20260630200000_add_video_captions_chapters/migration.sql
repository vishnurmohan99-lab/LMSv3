-- Captions (WebVTT, converted from an uploaded .srt) and YouTube-style chapter
-- markers for VIDEO lessons. Both nullable/additive — safe on the live table.
ALTER TABLE "Lesson" ADD COLUMN "captionsVtt" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "videoChapters" TEXT;

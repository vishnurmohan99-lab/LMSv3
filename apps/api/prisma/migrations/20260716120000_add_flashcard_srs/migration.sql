-- Spaced repetition for flashcards: SM-2 style scheduling on FlashcardProgress.
-- Purely additive — every column is defaulted (or nullable), so existing rows keep
-- their status and simply start unscheduled until their next review.
ALTER TABLE "FlashcardProgress"
    ADD COLUMN "intervalDays" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    ADD COLUMN "reps" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "dueAt" TIMESTAMP(3);

-- Cards already marked KNOWN shouldn't resurface immediately: give them a sensible
-- starting interval anchored to when they were last reviewed.
UPDATE "FlashcardProgress"
SET "intervalDays" = 4,
    "reps" = 1,
    "dueAt" = COALESCE("lastReviewedAt", NOW()) + INTERVAL '4 days'
WHERE "status" = 'KNOWN';

UPDATE "FlashcardProgress"
SET "intervalDays" = 1,
    "reps" = 1,
    "dueAt" = COALESCE("lastReviewedAt", NOW()) + INTERVAL '1 day'
WHERE "status" = 'LEARNING';

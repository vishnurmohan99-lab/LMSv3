-- Additive, nullable — backward compatible.
ALTER TABLE "Course" ADD COLUMN "priceCents" INTEGER;
ALTER TABLE "Course" ADD COLUMN "durationMinutes" INTEGER;

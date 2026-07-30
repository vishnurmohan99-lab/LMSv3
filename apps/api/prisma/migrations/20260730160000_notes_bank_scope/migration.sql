-- Faculty Notes v2: move targeting from the individual file up to the notes bank, so a bank
-- can address every student (GENERAL), a course, a set of batches, or one lesson.

CREATE TYPE "NoteScope" AS ENUM ('GENERAL', 'COURSE', 'BATCH', 'LESSON');

ALTER TABLE "NotesBank"
  ADD COLUMN "scope"       "NoteScope" NOT NULL DEFAULT 'BATCH',
  ADD COLUMN "sessionDate" TIMESTAMP(3),
  ADD COLUMN "courseId"    TEXT,
  ADD COLUMN "lessonId"    TEXT;

ALTER TABLE "NotesBank"
  ADD CONSTRAINT "NotesBank_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NotesBank_lessonId_fkey" FOREIGN KEY ("lessonId")
    REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "NotesBank_scope_idx"       ON "NotesBank"("scope");
CREATE INDEX "NotesBank_courseId_idx"    ON "NotesBank"("courseId");
CREATE INDEX "NotesBank_lessonId_idx"    ON "NotesBank"("lessonId");
CREATE INDEX "NotesBank_sessionDate_idx" ON "NotesBank"("sessionDate");
CREATE INDEX "NotesBank_title_idx"       ON "NotesBank"("title");

-- Every existing bank was batch-shared, which is the new BATCH scope — the DEFAULT above
-- already covers that. Carry the course up from the bank's files so the new courseId is
-- populated for display and filtering. Banks whose files disagree on course take the
-- earliest file's, which is the one the faculty member started the set with.
UPDATE "NotesBank" b
SET "courseId" = (
  SELECT n."courseId" FROM "Note" n
  WHERE n."notesBankId" = b."id" AND n."courseId" IS NOT NULL
  ORDER BY n."order" ASC, n."createdAt" ASC
  LIMIT 1
);

-- Per-file targeting is superseded. Relax the column rather than dropping it, so the rows
-- stay readable if we need to re-derive anything.
ALTER TABLE "Note" ALTER COLUMN "courseId" DROP NOT NULL;

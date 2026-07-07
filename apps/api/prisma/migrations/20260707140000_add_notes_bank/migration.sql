-- Notes Bank feature (faculty/admin notes shared with batches).
CREATE TABLE "NotesBank" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "NotesBank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotesBankBatch" (
    "notesBankId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    CONSTRAINT "NotesBankBatch_pkey" PRIMARY KEY ("notesBankId","batchId")
);
CREATE INDEX "NotesBankBatch_batchId_idx" ON "NotesBankBatch"("batchId");

CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notesBankId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "chapterId" TEXT,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Note_notesBankId_idx" ON "Note"("notesBankId");
CREATE INDEX "Note_courseId_idx" ON "Note"("courseId");

ALTER TABLE "NotesBank" ADD CONSTRAINT "NotesBank_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotesBankBatch" ADD CONSTRAINT "NotesBankBatch_notesBankId_fkey" FOREIGN KEY ("notesBankId") REFERENCES "NotesBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotesBankBatch" ADD CONSTRAINT "NotesBankBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_notesBankId_fkey" FOREIGN KEY ("notesBankId") REFERENCES "NotesBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

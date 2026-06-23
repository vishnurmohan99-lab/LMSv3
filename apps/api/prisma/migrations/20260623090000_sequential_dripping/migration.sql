-- AlterEnum
ALTER TYPE "DripType" ADD VALUE 'SEQUENTIAL';

-- CreateEnum
CREATE TYPE "CompletionRule" AS ENUM ('MANUAL', 'ALL_LESSONS_VIEWED', 'PASS_TEST');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "completionRule" "CompletionRule" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "ChapterCompletion" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonView" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChapterCompletion_chapterId_studentId_key" ON "ChapterCompletion"("chapterId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonView_lessonId_studentId_key" ON "LessonView"("lessonId", "studentId");

-- AddForeignKey
ALTER TABLE "ChapterCompletion" ADD CONSTRAINT "ChapterCompletion_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCompletion" ADD CONSTRAINT "ChapterCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonView" ADD CONSTRAINT "LessonView_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonView" ADD CONSTRAINT "LessonView_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

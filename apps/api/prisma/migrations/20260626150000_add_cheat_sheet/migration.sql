-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "cheatSheetEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CheatSheet" (
    "id" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "CheatSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheatSheet_lessonId_key" ON "CheatSheet"("lessonId");

-- AddForeignKey
ALTER TABLE "CheatSheet" ADD CONSTRAINT "CheatSheet_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

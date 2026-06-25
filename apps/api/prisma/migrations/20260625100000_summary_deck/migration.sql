-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "summaryDeckEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SummaryDeck" (
    "id" TEXT NOT NULL,
    "cards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "SummaryDeck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SummaryDeck_lessonId_key" ON "SummaryDeck"("lessonId");

-- AddForeignKey
ALTER TABLE "SummaryDeck" ADD CONSTRAINT "SummaryDeck_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

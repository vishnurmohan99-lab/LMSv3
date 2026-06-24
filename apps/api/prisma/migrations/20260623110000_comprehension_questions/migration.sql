-- CreateTable
CREATE TABLE "Passage" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "imageUrl" TEXT, ADD COLUMN "passageId" TEXT;

-- AlterTable
ALTER TABLE "TestQuestion" ADD COLUMN "imageUrl" TEXT, ADD COLUMN "passageId" TEXT;

-- CreateIndex
CREATE INDEX "Question_passageId_idx" ON "Question"("passageId");
CREATE INDEX "TestQuestion_passageId_idx" ON "TestQuestion"("passageId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('FREE', 'PAID');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN "type" "TestType" NOT NULL DEFAULT 'FREE',
ADD COLUMN "segmentId" TEXT,
ADD COLUMN "subsegmentId" TEXT;

-- CreateIndex
CREATE INDEX "Test_segmentId_idx" ON "Test"("segmentId");

-- CreateIndex
CREATE INDEX "Test_subsegmentId_idx" ON "Test"("subsegmentId");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_subsegmentId_fkey" FOREIGN KEY ("subsegmentId") REFERENCES "Subsegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

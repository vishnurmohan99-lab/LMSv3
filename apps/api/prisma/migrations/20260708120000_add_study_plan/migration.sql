-- Study Plan: dated plan items owned by a batch (faculty/admin) or a student (personal).
CREATE TYPE "PlanItemType" AS ENUM ('VIDEO', 'NOTES', 'TEST', 'PRACTICE', 'OTHER');

CREATE TABLE "StudyPlanItem" (
    "id" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "type" "PlanItemType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "resourceKind" TEXT,
    "resourceId" TEXT,
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "batchId" TEXT,
    "studentId" TEXT,
    CONSTRAINT "StudyPlanItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudyPlanItem_batchId_idx" ON "StudyPlanItem"("batchId");
CREATE INDEX "StudyPlanItem_studentId_idx" ON "StudyPlanItem"("studentId");
CREATE INDEX "StudyPlanItem_scheduledFor_idx" ON "StudyPlanItem"("scheduledFor");

ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

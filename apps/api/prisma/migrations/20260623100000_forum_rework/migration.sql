-- CreateEnum
CREATE TYPE "ForumScopeType" AS ENUM ('BATCH', 'COURSE', 'GENERAL');
CREATE TYPE "ForumAccessMode" AS ENUM ('ALL', 'SELECTED', 'NONE');
CREATE TYPE "ForumPermissionPurpose" AS ENUM ('AUDIENCE', 'POST', 'COMMENT');

-- CreateTable
CREATE TABLE "ForumCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "ForumScopeType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT,
    "courseId" TEXT,
    "audienceFacultyMode" "ForumAccessMode" NOT NULL DEFAULT 'ALL',
    "audienceStudentMode" "ForumAccessMode" NOT NULL DEFAULT 'ALL',
    "postFacultyMode" "ForumAccessMode" NOT NULL DEFAULT 'ALL',
    "postStudentMode" "ForumAccessMode" NOT NULL DEFAULT 'ALL',
    "commentFacultyMode" "ForumAccessMode" NOT NULL DEFAULT 'ALL',
    "commentStudentMode" "ForumAccessMode" NOT NULL DEFAULT 'ALL',
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumCategoryUser" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ForumPermissionPurpose" NOT NULL,

    CONSTRAINT "ForumCategoryUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForumCategory_batchId_idx" ON "ForumCategory"("batchId");
CREATE INDEX "ForumCategory_courseId_idx" ON "ForumCategory"("courseId");
CREATE UNIQUE INDEX "ForumCategoryUser_categoryId_userId_purpose_key" ON "ForumCategoryUser"("categoryId", "userId", "purpose");

-- AddForeignKey
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ForumCategoryUser" ADD CONSTRAINT "ForumCategoryUser_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumCategoryUser" ADD CONSTRAINT "ForumCategoryUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: replace auto-derived categories with real ForumCategory rows,
-- carrying over any existing threads so no real data is lost.
DO $$
DECLARE
  admin_id TEXT;
BEGIN
  SELECT id INTO admin_id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1;

  INSERT INTO "ForumCategory" ("id", "name", "scopeType", "updatedAt", "courseId", "createdById")
  SELECT gen_random_uuid()::text, c."title", 'COURSE', CURRENT_TIMESTAMP, c."id", admin_id
  FROM "Course" c
  WHERE c."id" IN (SELECT DISTINCT "courseId" FROM "ForumThread" WHERE "courseId" IS NOT NULL);

  IF EXISTS (SELECT 1 FROM "ForumThread" WHERE "courseId" IS NULL) THEN
    INSERT INTO "ForumCategory" ("id", "name", "scopeType", "updatedAt", "createdById")
    VALUES (gen_random_uuid()::text, 'General', 'GENERAL', CURRENT_TIMESTAMP, admin_id);
  END IF;
END $$;

-- AlterTable: ForumThread now points at a ForumCategory instead of a raw courseId
ALTER TABLE "ForumThread" ADD COLUMN "categoryId" TEXT;

UPDATE "ForumThread" t
SET "categoryId" = fc."id"
FROM "ForumCategory" fc
WHERE fc."courseId" = t."courseId" AND t."courseId" IS NOT NULL;

UPDATE "ForumThread" t
SET "categoryId" = fc."id"
FROM "ForumCategory" fc
WHERE t."courseId" IS NULL AND fc."scopeType" = 'GENERAL';

ALTER TABLE "ForumThread" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "ForumThread" DROP CONSTRAINT IF EXISTS "ForumThread_courseId_fkey";
DROP INDEX IF EXISTS "ForumThread_courseId_idx";
ALTER TABLE "ForumThread" DROP COLUMN "courseId";

CREATE INDEX "ForumThread_categoryId_idx" ON "ForumThread"("categoryId");
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

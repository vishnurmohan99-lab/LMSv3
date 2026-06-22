-- CreateEnum
CREATE TYPE "DripType" AS ENUM ('NONE', 'CALENDAR', 'ENROLLMENT_RELATIVE');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "dripType" "DripType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN "unlockAt" TIMESTAMP(3),
ADD COLUMN "unlockAfterDays" INTEGER;

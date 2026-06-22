-- AlterTable: User gains segment/subsegment selection
ALTER TABLE "User" ADD COLUMN "segmentId" TEXT,
ADD COLUMN "subsegmentId" TEXT;

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('FREE', 'PAID', 'PRIVATE');

-- AlterTable: Course gains type
ALTER TABLE "Course" ADD COLUMN "type" "CourseType" NOT NULL DEFAULT 'FREE';

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('SELF', 'BATCH', 'SUBSCRIPTION', 'ADMIN');

-- AlterTable: Enrollment gains source
ALTER TABLE "Enrollment" ADD COLUMN "source" "EnrollmentSource" NOT NULL DEFAULT 'SELF';

-- DropForeignKey: Batch no longer belongs to a single Course
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_courseId_fkey";

-- DropIndex
DROP INDEX "Batch_courseId_name_key";

-- AlterTable: Batch becomes segment/subsegment-scoped
ALTER TABLE "Batch" DROP COLUMN "courseId",
ADD COLUMN "segmentId" TEXT,
ADD COLUMN "subsegmentId" TEXT;

-- CreateIndex
CREATE INDEX "Batch_segmentId_idx" ON "Batch"("segmentId");

-- CreateIndex
CREATE INDEX "Batch_subsegmentId_idx" ON "Batch"("subsegmentId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_subsegmentId_fkey" FOREIGN KEY ("subsegmentId") REFERENCES "Subsegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subsegmentId_fkey" FOREIGN KEY ("subsegmentId") REFERENCES "Subsegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CoursePrivateAccess" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePrivateAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCourse" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "SubscriptionCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionTest" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,

    CONSTRAINT "SubscriptionTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEnrollment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrivateAccess_courseId_studentId_key" ON "CoursePrivateAccess"("courseId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_title_key" ON "Subscription"("title");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCourse_subscriptionId_courseId_key" ON "SubscriptionCourse"("subscriptionId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTest_subscriptionId_testId_key" ON "SubscriptionTest"("subscriptionId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEnrollment_subscriptionId_studentId_key" ON "SubscriptionEnrollment"("subscriptionId", "studentId");

-- AddForeignKey
ALTER TABLE "CoursePrivateAccess" ADD CONSTRAINT "CoursePrivateAccess_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrivateAccess" ADD CONSTRAINT "CoursePrivateAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCourse" ADD CONSTRAINT "SubscriptionCourse_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCourse" ADD CONSTRAINT "SubscriptionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionTest" ADD CONSTRAINT "SubscriptionTest_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionTest" ADD CONSTRAINT "SubscriptionTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEnrollment" ADD CONSTRAINT "SubscriptionEnrollment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEnrollment" ADD CONSTRAINT "SubscriptionEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

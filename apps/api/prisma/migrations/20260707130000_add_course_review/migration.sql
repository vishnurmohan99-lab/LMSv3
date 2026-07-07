-- CourseReview: one rating per student per course.
CREATE TABLE "CourseReview" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseReview_courseId_studentId_key" ON "CourseReview"("courseId", "studentId");
CREATE INDEX "CourseReview_courseId_idx" ON "CourseReview"("courseId");

ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

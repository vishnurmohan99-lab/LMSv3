-- Supports the admin segment report. The existing unique index leads with lessonId,
-- so it cannot serve a GROUP BY on (studentId, courseId); viewedAt lets a ranged
-- report look at only the students active in the window.
CREATE INDEX "LessonView_studentId_idx" ON "LessonView"("studentId");
CREATE INDEX "LessonView_viewedAt_idx" ON "LessonView"("viewedAt");

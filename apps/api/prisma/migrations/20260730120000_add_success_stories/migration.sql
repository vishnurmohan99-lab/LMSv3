-- Success Stories: short testimonial clips shown as a rail on the student dashboard.
-- Design: Design System/Student - Stories.dc.html
--
-- Story carries the author-entered result ("AIR 214") because the design requires a number
-- on every card. Video/poster are private R2 keys presigned on read — there is no
-- transcoding pipeline, so the poster is uploaded rather than extracted server-side.

CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "StoryOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');

CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "avatarInitials" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "resultChip" TEXT NOT NULL,
    "videoKey" TEXT NOT NULL,
    "posterKey" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "orientation" "StoryOrientation" NOT NULL DEFAULT 'PORTRAIT',
    "captionsVtt" TEXT,
    "quote" TEXT NOT NULL,
    "body" TEXT,
    "stats" JSONB NOT NULL DEFAULT '[]',
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "allSegments" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorySegment" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    CONSTRAINT "StorySegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryReaction" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryReaction_pkey" PRIMARY KEY ("id")
);

-- The feed filters on status + publish window, then joins segments.
CREATE INDEX "Story_status_publishAt_idx" ON "Story"("status", "publishAt");
CREATE INDEX "Story_courseId_idx" ON "Story"("courseId");
CREATE UNIQUE INDEX "StorySegment_storyId_segmentId_key" ON "StorySegment"("storyId", "segmentId");
CREATE INDEX "StorySegment_segmentId_idx" ON "StorySegment"("segmentId");
CREATE UNIQUE INDEX "StoryView_storyId_studentId_key" ON "StoryView"("storyId", "studentId");
CREATE INDEX "StoryView_studentId_idx" ON "StoryView"("studentId");
CREATE UNIQUE INDEX "StoryReaction_storyId_studentId_key" ON "StoryReaction"("storyId", "studentId");

ALTER TABLE "Story" ADD CONSTRAINT "Story_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Story" ADD CONSTRAINT "Story_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Story" ADD CONSTRAINT "Story_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StorySegment" ADD CONSTRAINT "StorySegment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorySegment" ADD CONSTRAINT "StorySegment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryReaction" ADD CONSTRAINT "StoryReaction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryReaction" ADD CONSTRAINT "StoryReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

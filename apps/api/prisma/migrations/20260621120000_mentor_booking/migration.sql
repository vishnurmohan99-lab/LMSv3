-- AlterTable
ALTER TABLE "User" ADD COLUMN "isMentor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mentorSpecialty" TEXT;

-- CreateTable
CREATE TABLE "MentorAvailability" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mentorId" TEXT NOT NULL,

    CONSTRAINT "MentorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorBooking" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "availabilityId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "MentorBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorAvailability_mentorId_dayOfWeek_time_key" ON "MentorAvailability"("mentorId", "dayOfWeek", "time");

-- CreateIndex
CREATE UNIQUE INDEX "MentorBooking_availabilityId_date_key" ON "MentorBooking"("availabilityId", "date");

-- CreateIndex
CREATE INDEX "MentorBooking_studentId_idx" ON "MentorBooking"("studentId");

-- CreateIndex
CREATE INDEX "MentorBooking_mentorId_idx" ON "MentorBooking"("mentorId");

-- AddForeignKey
ALTER TABLE "MentorAvailability" ADD CONSTRAINT "MentorAvailability_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorBooking" ADD CONSTRAINT "MentorBooking_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "MentorAvailability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorBooking" ADD CONSTRAINT "MentorBooking_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorBooking" ADD CONSTRAINT "MentorBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "wentWell" TEXT,
    "toImprove" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reflection_date_idx" ON "Reflection"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Reflection_studentId_date_key" ON "Reflection"("studentId", "date");

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

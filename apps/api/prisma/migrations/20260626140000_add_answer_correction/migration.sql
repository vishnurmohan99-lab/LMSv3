-- CreateEnum
CREATE TYPE "ForbiddenPointPenaltyType" AS ENUM ('NUMERIC', 'FLAG_HARD');

-- CreateEnum
CREATE TYPE "AnswerSubmissionStatus" AS ENUM ('PROCESSING', 'GRADED', 'FAILED');

-- CreateTable
CREATE TABLE "AnswerQuestionType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "facultyId" TEXT NOT NULL,

    CONSTRAINT "AnswerQuestionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerQuestionTypePart" (
    "id" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "defaultWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "typeId" TEXT NOT NULL,

    CONSTRAINT "AnswerQuestionTypePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "directive" TEXT,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "modelAnswer" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "facultyId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,

    CONSTRAINT "AnswerQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerQuestionPart" (
    "id" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "marks" DOUBLE PRECISION NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "AnswerQuestionPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerQuestionPoint" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "partId" TEXT,
    "groupId" TEXT,

    CONSTRAINT "AnswerQuestionPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerQuestionPointGroup" (
    "id" TEXT NOT NULL,
    "minRequired" INTEGER NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "partId" TEXT NOT NULL,

    CONSTRAINT "AnswerQuestionPointGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerQuestionForbiddenPoint" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "penaltyType" "ForbiddenPointPenaltyType" NOT NULL DEFAULT 'NUMERIC',
    "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "AnswerQuestionForbiddenPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerSubmission" (
    "id" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "AnswerSubmissionStatus" NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "AnswerSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerEvaluation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT NOT NULL,
    "transcript" JSONB NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,
    "marksMax" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "forbiddenFound" JSONB NOT NULL,
    "bonusPoints" JSONB NOT NULL,
    "modelAnswerRef" TEXT NOT NULL,
    "upgradedAnswer" TEXT NOT NULL,
    "rawModelOutput" JSONB,
    "manualMarksAwarded" DOUBLE PRECISION,
    "manualComment" TEXT,
    "manualGradedById" TEXT,
    "manualGradedAt" TIMESTAMP(3),

    CONSTRAINT "AnswerEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnswerQuestionType_name_key" ON "AnswerQuestionType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerQuestionTypePart_typeId_partKey_key" ON "AnswerQuestionTypePart"("typeId", "partKey");

-- CreateIndex
CREATE INDEX "AnswerQuestion_typeId_idx" ON "AnswerQuestion"("typeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerQuestionPart_questionId_partKey_key" ON "AnswerQuestionPart"("questionId", "partKey");

-- CreateIndex
CREATE INDEX "AnswerQuestionPoint_partId_idx" ON "AnswerQuestionPoint"("partId");

-- CreateIndex
CREATE INDEX "AnswerQuestionPoint_groupId_idx" ON "AnswerQuestionPoint"("groupId");

-- CreateIndex
CREATE INDEX "AnswerSubmission_questionId_idx" ON "AnswerSubmission"("questionId");

-- CreateIndex
CREATE INDEX "AnswerSubmission_studentId_idx" ON "AnswerSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AnswerEvaluation_submissionId_key" ON "AnswerEvaluation"("submissionId");

-- AddForeignKey
ALTER TABLE "AnswerQuestionType" ADD CONSTRAINT "AnswerQuestionType_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestionTypePart" ADD CONSTRAINT "AnswerQuestionTypePart_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AnswerQuestionType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestion" ADD CONSTRAINT "AnswerQuestion_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestion" ADD CONSTRAINT "AnswerQuestion_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AnswerQuestionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestionPart" ADD CONSTRAINT "AnswerQuestionPart_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnswerQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestionPoint" ADD CONSTRAINT "AnswerQuestionPoint_partId_fkey" FOREIGN KEY ("partId") REFERENCES "AnswerQuestionPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestionPoint" ADD CONSTRAINT "AnswerQuestionPoint_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AnswerQuestionPointGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestionPointGroup" ADD CONSTRAINT "AnswerQuestionPointGroup_partId_fkey" FOREIGN KEY ("partId") REFERENCES "AnswerQuestionPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerQuestionForbiddenPoint" ADD CONSTRAINT "AnswerQuestionForbiddenPoint_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnswerQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerSubmission" ADD CONSTRAINT "AnswerSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AnswerQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerSubmission" ADD CONSTRAINT "AnswerSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerEvaluation" ADD CONSTRAINT "AnswerEvaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AnswerSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerEvaluation" ADD CONSTRAINT "AnswerEvaluation_manualGradedById_fkey" FOREIGN KEY ("manualGradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

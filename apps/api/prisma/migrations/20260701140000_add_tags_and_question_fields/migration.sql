-- Global reusable tags + richer per-question fields (difficulty, marks, negative marks,
-- answer time) on both Question and TestQuestion. All new columns have defaults matching the
-- previous behaviour (marks=1, negativeMarks=0), so existing tests score exactly as before.

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- AlterTable Question
ALTER TABLE "Question"
    ADD COLUMN "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN "marks" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "answerTimeSeconds" INTEGER;

-- AlterTable TestQuestion
ALTER TABLE "TestQuestion"
    ADD COLUMN "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    ADD COLUMN "marks" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "answerTimeSeconds" INTEGER;

-- CreateTable join: Question <-> Tag (implicit m2m; A=Question, B=Tag)
CREATE TABLE "_QuestionToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_QuestionToTag_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_QuestionToTag_B_index" ON "_QuestionToTag"("B");
ALTER TABLE "_QuestionToTag" ADD CONSTRAINT "_QuestionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_QuestionToTag" ADD CONSTRAINT "_QuestionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable join: Tag <-> TestQuestion (implicit m2m; A=Tag, B=TestQuestion)
CREATE TABLE "_TagToTestQuestion" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TagToTestQuestion_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_TagToTestQuestion_B_index" ON "_TagToTestQuestion"("B");
ALTER TABLE "_TagToTestQuestion" ADD CONSTRAINT "_TagToTestQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TagToTestQuestion" ADD CONSTRAINT "_TagToTestQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "TestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

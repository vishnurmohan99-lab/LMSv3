-- AlterTable
ALTER TABLE "Course" ADD CONSTRAINT "Course_title_key" UNIQUE ("title");

-- AlterTable
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_title_key" UNIQUE ("title");

-- AlterTable
ALTER TABLE "Test" ADD CONSTRAINT "Test_title_key" UNIQUE ("title");

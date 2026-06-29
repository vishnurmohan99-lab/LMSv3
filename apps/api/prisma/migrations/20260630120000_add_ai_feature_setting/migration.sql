-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('FLASHCARDS', 'NOTES', 'SUMMARY_DECK', 'CHEAT_SHEET_TEXT', 'CHEAT_SHEET_IMAGE', 'CHAT', 'ANSWER_GRADING');

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('OPENROUTER', 'OPENAI');

-- CreateTable
CREATE TABLE "AiFeatureSetting" (
    "feature" "AiFeature" NOT NULL,
    "provider" "AiProvider" NOT NULL DEFAULT 'OPENROUTER',
    "model" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFeatureSetting_pkey" PRIMARY KEY ("feature")
);

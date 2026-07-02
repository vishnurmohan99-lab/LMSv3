-- Per-test pass threshold (percentage). Default 50 preserves the previously hardcoded
-- 50% PASS_TEST completion behaviour for every existing test.
ALTER TABLE "Test" ADD COLUMN "passPercent" INTEGER NOT NULL DEFAULT 50;

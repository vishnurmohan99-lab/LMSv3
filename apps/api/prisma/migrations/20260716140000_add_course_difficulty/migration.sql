-- Real course difficulty, replacing the student catalog's pseudoLevel() id-hash.
-- Nullable on purpose: existing courses are "not rated" rather than being given a
-- difficulty nobody chose. The catalog hides the badge and excludes unrated courses
-- from level filtering until an admin sets one.
CREATE TYPE "CourseDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

ALTER TABLE "Course" ADD COLUMN "difficulty" "CourseDifficulty";

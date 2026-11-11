-- Match MySQL: a referenced catalog identity must not be rewritten implicitly.
-- Existing migrations and provenance snapshots remain unchanged.
BEGIN;
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_catalog_exercise_id_fkey";
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_catalog_exercise_id_fkey"
  FOREIGN KEY ("catalog_exercise_id") REFERENCES "exercicios" ("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
COMMIT;

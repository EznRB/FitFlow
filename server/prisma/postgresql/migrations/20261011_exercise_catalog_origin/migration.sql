ALTER TABLE "exercises"
  ADD COLUMN "catalog_exercise_id" INTEGER,
  ADD COLUMN "catalog_snapshot" JSONB,
  ADD CONSTRAINT "exercises_catalog_origin_pair_check" CHECK (
    ("catalog_exercise_id" IS NULL AND "catalog_snapshot" IS NULL) OR
    ("catalog_exercise_id" IS NOT NULL AND "catalog_snapshot" IS NOT NULL AND jsonb_typeof("catalog_snapshot") = 'object')
  );
CREATE INDEX "exercises_catalog_exercise_id_idx" ON "exercises" ("catalog_exercise_id");
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_catalog_exercise_id_fkey"
  FOREIGN KEY ("catalog_exercise_id") REFERENCES "exercicios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

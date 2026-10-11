ALTER TABLE `exercises`
  ADD COLUMN `catalog_exercise_id` INTEGER NULL,
  ADD COLUMN `catalog_snapshot` JSON NULL,
  ADD CONSTRAINT `exercises_catalog_origin_pair_check` CHECK (
    (`catalog_exercise_id` IS NULL AND `catalog_snapshot` IS NULL) OR
    (`catalog_exercise_id` IS NOT NULL AND `catalog_snapshot` IS NOT NULL AND JSON_TYPE(`catalog_snapshot`) = 'OBJECT')
  );
CREATE INDEX `exercises_catalog_exercise_id_idx` ON `exercises` (`catalog_exercise_id`);
ALTER TABLE `exercises` ADD CONSTRAINT `exercises_catalog_exercise_id_fkey`
  FOREIGN KEY (`catalog_exercise_id`) REFERENCES `exercicios` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

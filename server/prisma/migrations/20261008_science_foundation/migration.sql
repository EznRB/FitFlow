-- AlterTable
ALTER TABLE `checkins` ADD COLUMN `cancel_reason` VARCHAR(255) NULL,
    ADD COLUMN `cancelled_at` DATETIME(3) NULL,
    ADD COLUMN `cancelled_by` INTEGER NULL,
    ADD COLUMN `registered_by` INTEGER NULL,
    ADD COLUMN `status` ENUM('present', 'cancelled') NOT NULL DEFAULT 'present';

-- CreateTable
CREATE TABLE `exercicios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `grupo_muscular` VARCHAR(50) NOT NULL,
    `instrucoes` TEXT NULL,
    `imagem_url` VARCHAR(255) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'local',
    `external_id` VARCHAR(50) NULL,
    `locale` VARCHAR(10) NOT NULL DEFAULT 'pt',
    `curated` BOOLEAN NOT NULL DEFAULT true,
    `source_metadata` JSON NULL,

    INDEX `exercicios_grupo_muscular_idx`(`grupo_muscular`),
    INDEX `exercicios_ativo_idx`(`ativo`),
    UNIQUE INDEX `exercicios_source_external_id_key`(`source`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workout_sessions` (
    `id` CHAR(36) NOT NULL,
    `student_id` INTEGER NOT NULL,
    `workout_id` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `plan_snapshot` JSON NOT NULL,
    `start_request` JSON NOT NULL,
    `completion_request` JSON NULL,
    `client_started_at` DATETIME(3) NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `workout_sessions_student_id_started_at_idx`(`student_id`, `started_at`),
    INDEX `workout_sessions_workout_id_idx`(`workout_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workout_sets` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `exercise_id` INTEGER NOT NULL,
    `exercise_name` VARCHAR(100) NOT NULL,
    `muscle_group` VARCHAR(50) NULL,
    `weight_kg` DECIMAL(8, 2) NOT NULL,
    `reps` INTEGER NOT NULL,
    `rir` DOUBLE NULL,
    `kind` VARCHAR(20) NOT NULL,
    `notes` TEXT NULL,
    `performed_at` DATETIME(3) NOT NULL,
    `payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workout_sets_session_id_performed_at_idx`(`session_id`, `performed_at`),
    INDEX `workout_sets_performed_at_idx`(`performed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `checkins_status_idx` ON `checkins`(`status`);

-- AddForeignKey
ALTER TABLE `workout_sessions` ADD CONSTRAINT `workout_sessions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workout_sessions` ADD CONSTRAINT `workout_sessions_workout_id_fkey` FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workout_sets` ADD CONSTRAINT `workout_sets_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridade aplicada também fora da API.
ALTER TABLE `workout_sessions` ADD CONSTRAINT `workout_sessions_status_check` CHECK (`status` IN ('active', 'completed'));
ALTER TABLE `workout_sets` ADD CONSTRAINT `workout_sets_kind_check` CHECK (`kind` IN ('working', 'warmup')),
 ADD CONSTRAINT `workout_sets_weight_check` CHECK (`weight_kg` >= 0 AND `weight_kg` <= 2000),
 ADD CONSTRAINT `workout_sets_reps_check` CHECK (`reps` >= 1 AND `reps` <= 1000),
 ADD CONSTRAINT `workout_sets_rir_check` CHECK (`rir` IS NULL OR (`rir` >= 0 AND `rir` <= 10));

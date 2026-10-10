-- CreateTable
-- Apenas parâmetros explicitamente salvos pelo usuário, sem confirmação clínica persistida.
CREATE TABLE `nutrition_scenarios` (
    `user_id` INTEGER NOT NULL,
    `inputs` JSON NOT NULL,
    `formula_version` VARCHAR(50) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_intents` (
    `id` VARCHAR(36) NOT NULL,
    `student_id` INTEGER NOT NULL,
    `plan_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `duration_days` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'BRL',
    `state` VARCHAR(24) NOT NULL DEFAULT 'created',
    `idempotency_key` VARCHAR(64) NOT NULL,
    `preference_id` VARCHAR(100) NULL,
    `checkout_url` TEXT NULL,
    `provider_payment_id` VARCHAR(100) NULL,
    `payment_id` INTEGER NULL,
    `last_provider_status` VARCHAR(40) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `settled_at` DATETIME(3) NULL,

    UNIQUE INDEX `payment_intents_preference_id_key`(`preference_id`),
    UNIQUE INDEX `payment_intents_provider_payment_id_key`(`provider_payment_id`),
    UNIQUE INDEX `payment_intents_payment_id_key`(`payment_id`),
    INDEX `payment_intents_student_id_state_idx`(`student_id`, `state`),
    UNIQUE INDEX `payment_intents_student_id_idempotency_key_key`(`student_id`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `nutrition_scenarios` ADD CONSTRAINT `nutrition_scenarios_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_intents` ADD CONSTRAINT `payment_intents_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_intents` ADD CONSTRAINT `payment_intents_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_intents` ADD CONSTRAINT `payment_intents_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

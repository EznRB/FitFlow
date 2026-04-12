-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'instructor', 'student') NOT NULL DEFAULT 'student',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `duration_days` INTEGER NOT NULL DEFAULT 30,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `phone` VARCHAR(20) NULL,
    `birth_date` DATE NULL,
    `address` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `status` ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
    `plan_id` INTEGER NULL,
    `plan_start_date` DATE NULL,
    `plan_end_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `students_user_id_key`(`user_id`),
    UNIQUE INDEX `students_cpf_key`(`cpf`),
    INDEX `students_plan_id_idx`(`plan_id`),
    INDEX `students_status_idx`(`status`),
    INDEX `students_plan_end_date_idx`(`plan_end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workouts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `instructor_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `workouts_student_id_idx`(`student_id`),
    INDEX `workouts_instructor_id_idx`(`instructor_id`),
    INDEX `workouts_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exercises` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workout_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `muscle_group` VARCHAR(50) NULL,
    `sets` INTEGER NOT NULL DEFAULT 3,
    `reps` VARCHAR(50) NOT NULL DEFAULT '12',
    `rest_seconds` INTEGER NULL DEFAULT 60,
    `suggested_load` VARCHAR(50) NULL,
    `notes` TEXT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `exercises_workout_id_idx`(`workout_id`),
    INDEX `exercises_workout_id_order_index_idx`(`workout_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workout_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `exercise_id` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,
    `reps_completed` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workout_logs_student_id_idx`(`student_id`),
    INDEX `workout_logs_exercise_id_idx`(`exercise_id`),
    INDEX `workout_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `plan_id` INTEGER NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `payment_method` VARCHAR(50) NULL,
    `payment_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `status` ENUM('paid', 'pending', 'overdue') NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `registered_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payments_student_id_idx`(`student_id`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_due_date_idx`(`due_date`),
    INDEX `payments_payment_date_idx`(`payment_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `checkin_date` DATE NOT NULL,
    `checkin_time` TIME(0) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `checkins_checkin_date_idx`(`checkin_date`),
    INDEX `checkins_student_id_idx`(`student_id`),
    UNIQUE INDEX `checkins_student_id_checkin_date_key`(`student_id`, `checkin_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workouts` ADD CONSTRAINT `workouts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workouts` ADD CONSTRAINT `workouts_instructor_id_fkey` FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercises` ADD CONSTRAINT `exercises_workout_id_fkey` FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workout_logs` ADD CONSTRAINT `workout_logs_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workout_logs` ADD CONSTRAINT `workout_logs_exercise_id_fkey` FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

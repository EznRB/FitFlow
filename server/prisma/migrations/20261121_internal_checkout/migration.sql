ALTER TABLE `payment_intents` ADD COLUMN `flow` VARCHAR(16) NOT NULL DEFAULT 'legacy';
CREATE TABLE `payment_attempts` (
  `id` VARCHAR(36) NOT NULL,
  `intent_id` VARCHAR(36) NOT NULL,
  `request_key` VARCHAR(64) NOT NULL,
  `sequence` INTEGER NOT NULL,
  `state` VARCHAR(24) NOT NULL DEFAULT 'processing',
  `provider_payment_id` VARCHAR(100) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `payment_attempts_provider_payment_id_key` (`provider_payment_id`),
  UNIQUE INDEX `payment_attempts_intent_id_request_key_key` (`intent_id`, `request_key`),
  UNIQUE INDEX `payment_attempts_intent_id_sequence_key` (`intent_id`, `sequence`),
  INDEX `payment_attempts_intent_id_created_at_idx` (`intent_id`, `created_at`),
  CONSTRAINT `payment_attempts_intent_id_fkey` FOREIGN KEY (`intent_id`) REFERENCES `payment_intents` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

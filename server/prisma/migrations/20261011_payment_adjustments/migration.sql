ALTER TABLE `students` ADD COLUMN `membership_revision` INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT `students_membership_revision_check` CHECK (`membership_revision` >= 0);
ALTER TABLE `payments` ADD COLUMN `membership_grant` JSON NULL,
  ADD CONSTRAINT `payments_membership_grant_check` CHECK (`membership_grant` IS NULL OR JSON_TYPE(`membership_grant`) = 'OBJECT');
CREATE TABLE `payment_adjustments` (
  `id` CHAR(36) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `payment_id` INTEGER NOT NULL,
  `actor_id` INTEGER NOT NULL,
  `actor_name` VARCHAR(100) NOT NULL,
  `kind` VARCHAR(30) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `effective_date` DATE NOT NULL,
  `membership_effect` VARCHAR(20) NOT NULL,
  `membership_before` JSON NOT NULL,
  `membership_after` JSON NOT NULL,
  `provider_refund_performed` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `payment_adjustments_payment_id_created_at_idx` (`payment_id`, `created_at`),
  INDEX `payment_adjustments_effective_date_idx` (`effective_date`),
  INDEX `payment_adjustments_actor_id_idx` (`actor_id`),
  CONSTRAINT `payment_adjustments_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `payment_adjustments_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `payment_adjustments_amount_check` CHECK (`amount` > 0),
  CONSTRAINT `payment_adjustments_kind_check` CHECK (`kind` IN ('correction','refund_recorded')),
  CONSTRAINT `payment_adjustments_membership_check` CHECK (`membership_effect` IN ('preserve','set_end_date')),
  CONSTRAINT `payment_adjustments_snapshot_check` CHECK (JSON_TYPE(`membership_before`) = 'OBJECT' AND JSON_TYPE(`membership_after`) = 'OBJECT'),
  CONSTRAINT `payment_adjustments_provider_check` CHECK (`provider_refund_performed` = false)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `payments_paid_immutable` BEFORE UPDATE ON `payments`
FOR EACH ROW
BEGIN
  IF OLD.`status` = 'paid' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paid receipt is immutable; record a payment adjustment';
  END IF;
END;

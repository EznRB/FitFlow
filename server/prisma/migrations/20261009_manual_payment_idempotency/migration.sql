-- Additive: existing ledger rows retain NULL keys and all original data.
ALTER TABLE `payments`
  ADD COLUMN `manual_request_id` CHAR(36) NULL,
  ADD COLUMN `manual_request_hash` CHAR(64) NULL,
  ADD UNIQUE INDEX `payments_manual_request_id_key` (`manual_request_id`),
  ADD CONSTRAINT `payments_manual_request_pair_check` CHECK (
    (`manual_request_id` IS NULL AND `manual_request_hash` IS NULL) OR
    (`manual_request_id` IS NOT NULL AND `manual_request_hash` IS NOT NULL AND `registered_by` IS NOT NULL)
  );

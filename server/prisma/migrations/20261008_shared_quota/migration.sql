CREATE TABLE `rate_limit_buckets` (
  `key` CHAR(64) NOT NULL,
  `hits` INTEGER NOT NULL,
  `window_ends_at` DATETIME(3) NOT NULL,
  INDEX `rate_limit_buckets_window_ends_at_idx` (`window_ends_at`),
  PRIMARY KEY (`key`),
  CONSTRAINT `rate_limit_buckets_hits_check` CHECK (`hits` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `payment_intents`
  ADD CONSTRAINT `payment_intents_state_check` CHECK (`state` IN ('created', 'creating', 'pending', 'uncertain', 'paid', 'review')),
  ADD CONSTRAINT `payment_intents_amount_check` CHECK (`amount` > 0),
  ADD CONSTRAINT `payment_intents_duration_check` CHECK (`duration_days` BETWEEN 1 AND 3650),
  ADD CONSTRAINT `payment_intents_currency_check` CHECK (`currency` = 'BRL');

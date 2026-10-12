ALTER TABLE `users` ADD COLUMN `credential_version` INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT `users_credential_version_check` CHECK (`credential_version` >= 0);

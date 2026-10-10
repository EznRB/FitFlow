-- Additive: do not modify or replace the already applied baseline.
ALTER TABLE "payments"
  ADD COLUMN "manual_request_id" CHAR(36),
  ADD COLUMN "manual_request_hash" CHAR(64),
  ADD CONSTRAINT "payments_manual_request_pair_check" CHECK (
    ("manual_request_id" IS NULL AND "manual_request_hash" IS NULL) OR
    ("manual_request_id" IS NOT NULL AND "manual_request_hash" IS NOT NULL AND "registered_by" IS NOT NULL)
  );
CREATE UNIQUE INDEX "payments_manual_request_id_key" ON "payments"("manual_request_id");

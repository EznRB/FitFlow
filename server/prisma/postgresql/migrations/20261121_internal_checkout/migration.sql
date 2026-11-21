ALTER TABLE "payment_intents" ADD COLUMN "flow" VARCHAR(16) NOT NULL DEFAULT 'legacy';
CREATE TABLE "payment_attempts" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "intent_id" VARCHAR(36) NOT NULL,
  "request_key" VARCHAR(64) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "state" VARCHAR(24) NOT NULL DEFAULT 'processing',
  "provider_payment_id" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "payment_attempts_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment_intents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payment_attempts_provider_payment_id_key" ON "payment_attempts" ("provider_payment_id");
CREATE UNIQUE INDEX "payment_attempts_intent_id_request_key_key" ON "payment_attempts" ("intent_id", "request_key");
CREATE UNIQUE INDEX "payment_attempts_intent_id_sequence_key" ON "payment_attempts" ("intent_id", "sequence");
CREATE INDEX "payment_attempts_intent_id_created_at_idx" ON "payment_attempts" ("intent_id", "created_at");

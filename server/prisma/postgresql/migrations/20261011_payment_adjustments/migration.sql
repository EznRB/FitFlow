ALTER TABLE "students" ADD COLUMN "membership_revision" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "students_membership_revision_check" CHECK ("membership_revision" >= 0);
ALTER TABLE "payments" ADD COLUMN "membership_grant" JSONB,
  ADD CONSTRAINT "payments_membership_grant_check" CHECK ("membership_grant" IS NULL OR jsonb_typeof("membership_grant") = 'object');
CREATE TABLE "payment_adjustments" (
  "id" CHAR(36) PRIMARY KEY,
  "request_hash" CHAR(64) NOT NULL,
  "payment_id" INTEGER NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "actor_name" VARCHAR(100) NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "effective_date" DATE NOT NULL,
  "membership_effect" VARCHAR(20) NOT NULL,
  "membership_before" JSONB NOT NULL,
  "membership_after" JSONB NOT NULL,
  "provider_refund_performed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_adjustments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "payment_adjustments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "payment_adjustments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_adjustments_kind_check" CHECK ("kind" IN ('correction','refund_recorded')),
  CONSTRAINT "payment_adjustments_membership_check" CHECK ("membership_effect" IN ('preserve','set_end_date')),
  CONSTRAINT "payment_adjustments_snapshot_check" CHECK (jsonb_typeof("membership_before") = 'object' AND jsonb_typeof("membership_after") = 'object'),
  CONSTRAINT "payment_adjustments_provider_check" CHECK ("provider_refund_performed" = false)
);
CREATE INDEX "payment_adjustments_payment_id_created_at_idx" ON "payment_adjustments" ("payment_id", "created_at");
CREATE INDEX "payment_adjustments_effective_date_idx" ON "payment_adjustments" ("effective_date");
CREATE INDEX "payment_adjustments_actor_id_idx" ON "payment_adjustments" ("actor_id");

CREATE FUNCTION public.fitflow_paid_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'paid' THEN
    RAISE EXCEPTION 'Paid receipt is immutable; record a payment adjustment';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "payments_paid_immutable" BEFORE UPDATE ON "payments"
FOR EACH ROW EXECUTE FUNCTION public.fitflow_paid_receipt_immutable();

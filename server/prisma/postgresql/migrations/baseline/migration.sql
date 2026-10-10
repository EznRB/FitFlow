-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'instructor', 'student');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('active', 'inactive', 'blocked');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'pending', 'overdue');

-- CreateEnum
CREATE TYPE "CheckinStatus" AS ENUM ('present', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cpf" VARCHAR(14),
    "phone" VARCHAR(20),
    "birth_date" DATE,
    "address" VARCHAR(255),
    "notes" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'active',
    "plan_id" INTEGER,
    "plan_start_date" DATE,
    "plan_end_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" SERIAL NOT NULL,
    "workout_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "muscle_group" VARCHAR(50),
    "sets" INTEGER NOT NULL DEFAULT 3,
    "reps" VARCHAR(50) NOT NULL DEFAULT '12',
    "rest_seconds" INTEGER DEFAULT 60,
    "suggested_load" VARCHAR(50),
    "notes" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL,
    "reps_completed" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "plan_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" VARCHAR(50),
    "payment_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "registered_by" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "checkin_date" DATE NOT NULL,
    "checkin_time" TIME(0),
    "registered_by" INTEGER,
    "status" "CheckinStatus" NOT NULL DEFAULT 'present',
    "cancel_reason" VARCHAR(255),
    "cancelled_by" INTEGER,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "grupo_muscular" VARCHAR(50) NOT NULL,
    "instrucoes" TEXT,
    "imagem_url" VARCHAR(255),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'local',
    "external_id" VARCHAR(50),
    "locale" VARCHAR(10) NOT NULL DEFAULT 'pt',
    "curated" BOOLEAN NOT NULL DEFAULT true,
    "source_metadata" JSONB,

    CONSTRAINT "exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" CHAR(36) NOT NULL,
    "student_id" INTEGER NOT NULL,
    "workout_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "plan_snapshot" JSONB NOT NULL,
    "start_request" JSONB NOT NULL,
    "completion_request" JSONB,
    "client_started_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" CHAR(36) NOT NULL,
    "session_id" CHAR(36) NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "exercise_name" VARCHAR(100) NOT NULL,
    "muscle_group" VARCHAR(50),
    "weight_kg" DECIMAL(8,2) NOT NULL,
    "reps" INTEGER NOT NULL,
    "rir" DOUBLE PRECISION,
    "kind" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_scenarios" (
    "user_id" INTEGER NOT NULL,
    "inputs" JSONB NOT NULL,
    "formula_version" VARCHAR(50) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nutrition_scenarios_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" CHAR(64) NOT NULL,
    "hits" INTEGER NOT NULL,
    "window_ends_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" VARCHAR(36) NOT NULL,
    "student_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "state" VARCHAR(24) NOT NULL DEFAULT 'created',
    "idempotency_key" VARCHAR(64) NOT NULL,
    "preference_id" VARCHAR(100),
    "checkout_url" TEXT,
    "provider_payment_id" VARCHAR(100),
    "payment_id" INTEGER,
    "last_provider_status" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "settled_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_cpf_key" ON "students"("cpf");

-- CreateIndex
CREATE INDEX "students_plan_id_idx" ON "students"("plan_id");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE INDEX "students_plan_end_date_idx" ON "students"("plan_end_date");

-- CreateIndex
CREATE INDEX "workouts_student_id_idx" ON "workouts"("student_id");

-- CreateIndex
CREATE INDEX "workouts_instructor_id_idx" ON "workouts"("instructor_id");

-- CreateIndex
CREATE INDEX "workouts_active_idx" ON "workouts"("active");

-- CreateIndex
CREATE INDEX "exercises_workout_id_idx" ON "exercises"("workout_id");

-- CreateIndex
CREATE INDEX "exercises_workout_id_order_index_idx" ON "exercises"("workout_id", "order_index");

-- CreateIndex
CREATE INDEX "workout_logs_student_id_idx" ON "workout_logs"("student_id");

-- CreateIndex
CREATE INDEX "workout_logs_exercise_id_idx" ON "workout_logs"("exercise_id");

-- CreateIndex
CREATE INDEX "workout_logs_created_at_idx" ON "workout_logs"("created_at");

-- CreateIndex
CREATE INDEX "payments_student_id_idx" ON "payments"("student_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_due_date_idx" ON "payments"("due_date");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "checkins_checkin_date_idx" ON "checkins"("checkin_date");

-- CreateIndex
CREATE INDEX "checkins_student_id_idx" ON "checkins"("student_id");

-- CreateIndex
CREATE INDEX "checkins_status_idx" ON "checkins"("status");

-- CreateIndex
CREATE UNIQUE INDEX "checkins_student_id_checkin_date_key" ON "checkins"("student_id", "checkin_date");

-- CreateIndex
CREATE INDEX "exercicios_grupo_muscular_idx" ON "exercicios"("grupo_muscular");

-- CreateIndex
CREATE INDEX "exercicios_ativo_idx" ON "exercicios"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "exercicios_source_external_id_key" ON "exercicios"("source", "external_id");

-- CreateIndex
CREATE INDEX "workout_sessions_student_id_started_at_idx" ON "workout_sessions"("student_id", "started_at");

-- CreateIndex
CREATE INDEX "workout_sessions_workout_id_idx" ON "workout_sessions"("workout_id");

-- CreateIndex
CREATE INDEX "workout_sets_session_id_performed_at_idx" ON "workout_sets"("session_id", "performed_at");

-- CreateIndex
CREATE INDEX "workout_sets_performed_at_idx" ON "workout_sets"("performed_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_window_ends_at_idx" ON "rate_limit_buckets"("window_ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_preference_id_key" ON "payment_intents"("preference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_provider_payment_id_key" ON "payment_intents"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_payment_id_key" ON "payment_intents"("payment_id");

-- CreateIndex
CREATE INDEX "payment_intents_student_id_state_idx" ON "payment_intents"("student_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_student_id_idempotency_key_key" ON "payment_intents"("student_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_scenarios" ADD CONSTRAINT "nutrition_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma schema does not represent CHECK constraints. Preserve the ten rules
-- from the MySQL history explicitly in this independent PostgreSQL baseline.
ALTER TABLE "workout_sessions"
  ADD CONSTRAINT "workout_sessions_status_check" CHECK ("status" IN ('active', 'completed'));

ALTER TABLE "workout_sets"
  ADD CONSTRAINT "workout_sets_kind_check" CHECK ("kind" IN ('working', 'warmup')),
  ADD CONSTRAINT "workout_sets_weight_check" CHECK ("weight_kg" >= 0 AND "weight_kg" <= 2000),
  ADD CONSTRAINT "workout_sets_reps_check" CHECK ("reps" >= 1 AND "reps" <= 1000),
  ADD CONSTRAINT "workout_sets_rir_check" CHECK ("rir" IS NULL OR ("rir" >= 0 AND "rir" <= 10));

ALTER TABLE "rate_limit_buckets"
  ADD CONSTRAINT "rate_limit_buckets_hits_check" CHECK ("hits" >= 0);

ALTER TABLE "payment_intents"
  ADD CONSTRAINT "payment_intents_state_check" CHECK ("state" IN ('created', 'creating', 'pending', 'uncertain', 'paid', 'review')),
  ADD CONSTRAINT "payment_intents_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "payment_intents_duration_check" CHECK ("duration_days" BETWEEN 1 AND 3650),
  ADD CONSTRAINT "payment_intents_currency_check" CHECK ("currency" = 'BRL');


-- Applies only to the SQL-managed fitflow_app role, created for this application.
-- Migrations use fitflow_owner; deployment receives runtime credentials only.
ALTER ROLE fitflow_app NOCREATEDB NOCREATEROLE NOBYPASSRLS;
REVOKE ALL ON SCHEMA public FROM fitflow_app;
GRANT USAGE ON SCHEMA public TO fitflow_app;
GRANT SELECT, INSERT, UPDATE ON
  users, plans, students, workouts, exercises, payments, checkins, exercicios,
  workout_sessions, nutrition_scenarios, rate_limit_buckets, payment_intents
  TO fitflow_app;
GRANT SELECT, INSERT ON workout_logs, workout_sets TO fitflow_app;
GRANT DELETE ON nutrition_scenarios, rate_limit_buckets TO fitflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fitflow_app;
-- Each future migration must review and grant any newly required privileges.

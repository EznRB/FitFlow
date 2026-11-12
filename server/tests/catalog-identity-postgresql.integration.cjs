'use strict';
// Read-only gate against an explicitly managed PostgreSQL verification target.
const assert = require('node:assert/strict');
require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();
const { getPrismaClientClass } = require('../src/config/databaseProvider');
const db = new (getPrismaClientClass())({ log: [] });
async function run() {
  try {
    const rows = await db.$queryRaw`
      SELECT c.confupdtype::text AS update_action, c.confdeltype::text AS delete_action,
             c.convalidated AS validated
      FROM pg_constraint c
      WHERE c.conrelid = 'public.exercises'::regclass
        AND c.confrelid = 'public.exercicios'::regclass
        AND c.conname = 'exercises_catalog_exercise_id_fkey'
        AND c.contype = 'f'`;
    assert.equal(rows.length, 1, 'Catalog provenance must have one foreign key');
    assert.equal(rows[0].update_action, 'r', 'Referenced catalog identity updates must be RESTRICT, matching MySQL');
    assert.equal(rows[0].delete_action, 'r', 'Referenced catalog deletion must remain RESTRICT');
    assert.equal(rows[0].validated, true, 'Existing provenance references must remain validated');
    console.log('PASS PostgreSQL catalog identity: validated UPDATE/DELETE RESTRICT; no rows changed.');
  } finally { await db.$disconnect(); }
}
run().catch(error => { console.error(error.code === 'ERR_ASSERTION' ? error.message : error.code || 'PostgreSQL gate failed'); process.exitCode = 1; });

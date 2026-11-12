'use strict';
// Fresh-install gate: creates and drops only its own random database on the
// managed loopback cluster. Never resets/seeds an existing database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
assert.equal(require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget(), 'native-postgresql');
const source = new URL(process.env.DATABASE_URL);
const database = `fitflow_migrations_${randomBytes(12).toString('hex')}`;
assert.match(database, /^fitflow_migrations_[a-f0-9]{24}$/);
const target = new URL(source.href); target.pathname = `/${database}`;
target.searchParams.delete('schema');
const { PrismaClient, Prisma } = require('../generated/postgresql');
const control = new PrismaClient({ datasources: { db: { url: source.href } }, log: [] });
let fixture, created = false;
const log = path.resolve(__dirname, `../tmp/postgresql-clean-bootstrap-${database}.log`);
async function run() {
  try {
    await control.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    created = true;
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/bootstrap-postgresql.cjs'), '--empty-database'], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, DATABASE_PROVIDER: 'postgresql', DATABASE_URL: target.href, DIRECT_URL: target.href },
    });
    fs.writeFileSync(log, `${result.stdout || ''}\n${result.stderr || ''}\nexit=${result.status}; signal=${result.signal || 'none'}\n`);
    assert.equal(result.status, 0, 'Fresh migrate deploy failed; complete output preserved in tmp log');
    fixture = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
    const tables = await fixture.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const expectedTables = Prisma.dmmf.datamodel.models.map(model => model.dbName || model.name);
    assert.deepEqual(tables.map(row => row.table_name).sort(), [...expectedTables, '_prisma_migrations'].sort());
    const applied = await fixture.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const migrations = fs.readdirSync(path.resolve(__dirname, '../prisma/postgresql/migrations'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
    assert.deepEqual(applied.map(row => row.migration_name).sort(), migrations.sort());
    const constraints = await fixture.$queryRaw`SELECT confupdtype::text AS action, convalidated FROM pg_constraint WHERE conname = 'exercises_catalog_exercise_id_fkey' AND conrelid = 'public.exercises'::regclass`;
    assert.deepEqual(constraints, [{ action: 'r', convalidated: true }]);
    // First-admin semantics require an empty population; never assert a global
    // count against the shared PostgreSQL/Neon verification destination.
    const { createFirstAdmin } = require('../scripts/bootstrap-admin.cjs');
    const password = randomBytes(24).toString('base64url');
    const firstAdmin = await createFirstAdmin(fixture, { name: 'Fresh admin fixture', email: 'first@example.invalid', password });
    const adminRow = await fixture.user.findUnique({ where: { id: firstAdmin.id } });
    assert.equal(adminRow.role, 'admin');
    assert.equal(await require('bcryptjs').compare(password, adminRow.passwordHash), true);
    await assert.rejects(createFirstAdmin(fixture, { name: 'Second admin fixture', email: 'second@example.invalid', password }), /Já existe um administrador/);
    await fixture.user.update({ where: { id: firstAdmin.id }, data: { active: false } });
    await assert.rejects(createFirstAdmin(fixture, { name: 'Second admin fixture', email: 'second@example.invalid', password }), /Já existe um administrador/);
    assert.equal(await fixture.user.count({ where: { role: 'admin' } }), 1);
    const repeated = spawnSync(process.execPath, [path.resolve(__dirname, '../scripts/bootstrap-postgresql.cjs'), '--empty-database'], {
      cwd: path.resolve(__dirname, '..'), windowsHide: true, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, DATABASE_PROVIDER: 'postgresql', DATABASE_URL: target.href, DIRECT_URL: target.href },
    });
    fs.appendFileSync(log, `\nOccupied database refusal:\n${repeated.stdout || ''}\n${repeated.stderr || ''}\nexit=${repeated.status}\n`);
    assert.equal(repeated.status, 1);
    assert.match(repeated.stderr, /Banco não está vazio/);
    assert.deepEqual(await fixture.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`, applied);
    console.log(`PASS clean PostgreSQL install: ${migrations.length} migrations, ${expectedTables.length} application tables, validated catalog restriction.`);
    console.log(`Full CLI log: ${path.basename(log)}`);
  } finally {
    try {
      await fixture?.$disconnect();
      if (created) {
        // Identifier generated above, never taken from env/CLI; control still
        // points to the original guarded test DB, not the fixture being dropped.
        await control.$executeRawUnsafe(`DROP DATABASE "${database}"`);
        const remaining = await control.$queryRaw`SELECT datname FROM pg_database WHERE datname = ${database}`;
        assert.equal(remaining.length, 0);
        console.log('PASS temporary database removed; existing test database preserved.');
      }
    } finally { await control.$disconnect(); }
  }
}
run().catch(error => { console.error(error.code === 'ERR_ASSERTION' ? error.message : error.code || 'Fresh migration gate failed'); process.exitCode = 1; });

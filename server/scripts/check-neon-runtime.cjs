'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const vars = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../.env.remote.runtime.local')));
const target = new URL(vars.DATABASE_URL);
assert.equal(vars.NEON_PROJECT_ID, 'mute-night-99440749');
assert.equal(vars.NEON_BRANCH_ID, 'br-tiny-king-b6carztp');
assert.equal(target.hostname, 'ep-jolly-grass-b6jl6hjo-pooler.c-2.sa-east-1.aws.neon.tech');
assert.equal(target.username, 'fitflow_app');
assert.equal(target.pathname, '/fitflow');
assert.equal(target.searchParams.get('sslaccept'), 'strict');
Object.assign(process.env, vars);
const db = new (require('../src/config/databaseProvider').getPrismaClientClass())({ log: [] });
const rollback = new Error('rollback synthetic fixture');
async function deny(sql) {
  await assert.rejects(db.$transaction(async tx => {
    await tx.$executeRawUnsafe(sql);
    throw rollback;
  }), error => error.code === 'P2010' && error.meta?.code === '42501');
}
(async () => {
  try {
    await db.user.count();
    await assert.rejects(db.$transaction(async tx => {
      const plan = await tx.plan.create({ data: { name: 'Runtime probe ' + randomUUID(), price: '1.00', durationDays: 1 } });
      await tx.plan.update({ where: { id: plan.id }, data: { active: false } });
      throw rollback;
    }), error => error === rollback);
    await deny('CREATE TABLE public.fitflow_runtime_probe (id int)');
    await deny('UPDATE workout_sets SET notes = notes WHERE false');
    await deny('DELETE FROM workout_logs WHERE false');
    await deny('DELETE FROM payments WHERE false');
    await deny('DELETE FROM users WHERE false');
    const [role] = await db.$queryRaw`SELECT rolcreatedb, rolcreaterole, rolbypassrls,
      pg_has_role(current_user,'neon_superuser','member') AS privileged FROM pg_roles WHERE rolname=current_user`;
    assert.ok(role); assert.ok(Object.values(role).every(value => value === false));
    console.log('Runtime TLS pooled: leitura, INSERT/UPDATE confirmados; DDL, edição de séries e exclusão de histórico/financeiro negados. Fixture revertida.');
  } finally { await db.$disconnect(); }
})().catch(error => { console.error('Runtime não validado:', error.code || error.name, String(error.meta?.code || 'none')); process.exitCode=1; });

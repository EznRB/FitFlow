'use strict';
// Only synthetic rows on a managed local/Neon verification destination.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();
const { getPrismaClientClass } = require('../src/config/databaseProvider');
const db = new (getPrismaClientClass())({ log: [] });
const { createAlunosService } = require('../src/services/alunos.service');
const { createAuthService } = require('../src/services/auth.service');
const bcrypt = require('bcryptjs');
const userIds = [], studentIds = [];
async function run() {
  try {
    const suffix = randomUUID(), password = randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 4);
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({ data: { name: 'Email fixture', email: `before-${i}-${suffix}@example.invalid`, passwordHash, role: 'student' } });
      userIds.push(user.id);
      const student = await db.student.create({ data: { userId: user.id } });
      studentIds.push(student.id);
    }
    const service = createAlunosService({ db });
    const email = `edited-${suffix}@example.invalid`;
    await service.atualizar(studentIds[0], { email: ` ${email.toUpperCase()} `, name: '  Nome editado  ' });
    const stored = await db.user.findUnique({ where: { id: userIds[0] } });
    assert.equal(stored.email, email);
    assert.equal(stored.name, 'Nome editado');
    const login = await createAuthService({ db }).login(` ${email.toUpperCase()} `, password);
    assert.equal(login.user.id, userIds[0]);
    await service.atualizar(studentIds[0], { email: email.toUpperCase() });
    await assert.rejects(service.atualizar(studentIds[1], { email: ` ${email.toUpperCase()} ` }), error => error.statusCode === 400);
    await assert.rejects(service.atualizar(studentIds[0], { email: 'invalid' }), error => error.statusCode === 400);
    assert.equal((await db.user.findUnique({ where: { id: userIds[0] } })).email, email);
    console.log('PASS PostgreSQL student email: normalized edit, actual login, own address, other-account collision and invalid edit preserved.');
  } finally {
    try {
      await db.student.deleteMany({ where: { id: { in: studentIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally { await db.$disconnect(); }
  }
}
run().catch(error => { console.error(error.code === 'ERR_ASSERTION' ? error.message : error.code || 'Student email gate failed'); process.exitCode = 1; });

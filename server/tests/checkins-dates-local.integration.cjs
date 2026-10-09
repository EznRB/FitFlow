// Only this test's disposable fixture is written/removed. No remote DB.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1');
assert.equal(process.env.NODE_ENV, 'development');
assert.equal(target.protocol, 'mysql:');
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
assert.equal(target.port, '3308');
assert.equal(target.pathname, '/fitflow_dev');
const db = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createCheckinsRepository } = require('../src/repositories/checkins.repository');
let user; let student;
(async () => {
  try {
    user = await db.user.create({ data: { name: 'Fixture de datas descartável', email: `dates-${randomUUID()}@example.invalid`, passwordHash: randomBytes(48).toString('hex'), role: 'student' } });
    student = await db.student.create({ data: { userId: user.id } });
    let now = new Date('2026-10-01T02:59:59.000Z');
    const repo = createCheckinsRepository({ db, now: () => now });
    const first = await repo.create(student.id, user.id);
    assert.equal(first.checkinDate.toISOString(), '2026-09-30T00:00:00.000Z');
    assert.equal(first.checkinTime.getUTCHours(), 2);
    assert.equal(first.checkinTime.getUTCMinutes(), 59);
    assert.equal(first.createdAt.toISOString(), now.toISOString());
    assert.equal((await repo.hasCheckedInToday(student.id)).id, first.id);
    await assert.rejects(repo.create(student.id, user.id), error => error.statusCode === 409);
    await repo.cancelCheckin(first.id, 'Fixture de cancelamento', user.id);
    // Cancelled daily record still occupies the unique slot.
    assert.equal((await repo.hasCheckedInToday(student.id)).id, first.id);
    await assert.rejects(repo.create(student.id, user.id), error => error.statusCode === 409);
    assert.ok(!(await repo.findToday()).some(row => row.studentId === student.id));
    assert.equal((await repo.findAll({ studentId: student.id, incluirCancelados: 'false' })).length, 0);
    assert.equal((await repo.findAll({ studentId: student.id, incluirCancelados: 'true', startDate: '2026-09-30', endDate: '2026-09-30' })).length, 1);
    now = new Date('2026-10-01T03:00:00.000Z');
    assert.equal(await repo.hasCheckedInToday(student.id), null);
    const second = await repo.create(student.id, user.id);
    assert.equal(second.checkinDate.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.notEqual(second.id, first.id);
    assert.equal((await repo.findByStudentId(student.id, { startDate: '2026-10-01', limit: 1 })).length, 1);
    console.log('PASS local: DATE BRT/UTC, TIME UTC, instante real, duplicidade preservada, cancelamento e virada às 03 UTC.');
  } finally {
    if (student) {
      await db.checkin.deleteMany({ where: { studentId: student.id } });
      await db.student.delete({ where: { id: student.id } });
    }
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
})().catch(() => { console.error('FAIL datas local; detalhes omitidos para preservar credenciais.'); process.exitCode = 1; });

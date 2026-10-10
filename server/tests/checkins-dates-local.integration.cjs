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
const db = new PrismaClient({ log: [] }), secondDb = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createCheckinsRepository } = require('../src/repositories/checkins.repository');
const { createAlunosService } = require('../src/services/alunos.service');
const { createPagamentosService } = require('../src/services/pagamentos.service');
let user; let student; let plan; const administrators = [];
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
    for (let i = 0; i < 2; i++) administrators.push(await db.user.create({ data: { name: 'Administrador fixture descartável',
      email: `dates-admin-${randomUUID()}@example.invalid`, passwordHash: randomBytes(48).toString('hex'), role: 'admin' } }));
    const otherRepo = createCheckinsRepository({ db: secondDb, now: () => now });
    const reasons = ['Cancelamento concorrente fixture A', 'Cancelamento concorrente fixture B'];
    const cancellation = await Promise.allSettled([
      repo.cancelCheckin(first.id, reasons[0], administrators[0].id),
      otherRepo.cancelCheckin(first.id, reasons[1], administrators[1].id),
    ]);
    assert.equal(cancellation.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(cancellation.find(result => result.status === 'rejected').reason.statusCode, 409);
    const winner = cancellation.findIndex(result => result.status === 'fulfilled');
    const cancelled = await db.checkin.findUnique({ where: { id: first.id } });
    assert.equal(cancelled.cancelledBy, administrators[winner].id); assert.equal(cancelled.cancelReason, reasons[winner]);
    assert.ok(cancelled.cancelledAt instanceof Date);
    await assert.rejects(otherRepo.cancelCheckin(first.id, 'Tentativa posterior fixture', administrators[1 - winner].id), error => error.statusCode === 409);
    const afterRetry = await db.checkin.findUnique({ where: { id: first.id } });
    assert.equal(afterRetry.cancelledBy, cancelled.cancelledBy); assert.equal(afterRetry.cancelReason, cancelled.cancelReason);
    assert.equal(afterRetry.cancelledAt.toISOString(), cancelled.cancelledAt.toISOString());
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

    // Hold only the service's initial snapshot; the renewal is a real native
    // transaction. The later partial edit must not rewrite stale omitted fields.
    plan = await db.plan.create({ data: { name: `Dates race plan ${randomUUID()}`, price: '14.39', durationDays: 7 } });
    await db.student.update({ where: { id: student.id }, data: { status: 'blocked', planId: plan.id, planEndDate: new Date('2099-10-01') } });
    let releaseRead, snapshotRead, snapshotFailed;
    const readReady = new Promise((resolve, reject) => { snapshotRead = resolve; snapshotFailed = reject; });
    const heldRead = new Promise(resolve => { releaseRead = resolve; });
    const editingService = createAlunosService({ db: { user: db.user,
      student: { findUnique: async args => { const snapshot = await db.student.findUnique(args); snapshotRead(); await heldRead; return snapshot; }, update: args => db.student.update(args) },
      $transaction: db.$transaction.bind(db) } });
    const editing = editingService.atualizar(student.id, { phone: '11999999999' });
    editing.catch(snapshotFailed);
    await readReady;
    let renewed;
    try {
      renewed = await createPagamentosService({ db: secondDb }).registrar({ studentId: student.id, planId: plan.id, amount: '14.39',
        paymentMethod: 'pix', paymentDate: '2099-10-08', idempotencyKey: randomUUID() }, administrators[0].id);
      await secondDb.user.update({ where: { id: user.id }, data: { name: 'Nome atualizado durante snapshot fixture' } });
    } finally { releaseRead(); }
    await editing;
    const edited = await db.student.findUnique({ where: { id: student.id }, include: { user: true } });
    assert.equal(edited.status, 'active'); assert.equal(edited.phone, '11999999999');
    assert.equal(edited.planEndDate.toISOString(), renewed.dueDate.toISOString());
    assert.equal(edited.planEndDate.toISOString().slice(0, 10), '2099-10-15');
    assert.equal(edited.user.name, 'Nome atualizado durante snapshot fixture');
    console.log('PASS local 127.0.0.1:3308/fitflow_dev: datas civis, cancelamento atômico entre dois clientes, auditoria original e edição parcial real preservando renovação/nome.');
  } finally {
    try {
      if (student) {
        await db.payment.deleteMany({ where: { studentId: student.id } });
        await db.checkin.deleteMany({ where: { studentId: student.id } });
        await db.student.delete({ where: { id: student.id } });
        assert.equal(await db.student.count({ where: { id: student.id } }), 0);
        assert.equal(await db.checkin.count({ where: { studentId: student.id } }), 0);
        assert.equal(await db.payment.count({ where: { studentId: student.id } }), 0);
      }
      if (user) await db.user.delete({ where: { id: user.id } });
      if (administrators.length) await db.user.deleteMany({ where: { id: { in: administrators.map(row => row.id) } } });
      if (plan) await db.plan.delete({ where: { id: plan.id } });
      const fixtureUserIds = [user?.id, ...administrators.map(row => row.id)].filter(Number.isSafeInteger);
      if (fixtureUserIds.length) assert.equal(await db.user.count({ where: { id: { in: fixtureUserIds } } }), 0);
      if (plan) assert.equal(await db.plan.count({ where: { id: plan.id } }), 0);
      console.log('CLEAN local: fixtures UUID próprias removidas; zero usuários/alunos/check-ins/pagamentos/planos desse gate restantes.');
    } finally { await Promise.all([db.$disconnect(), secondDb.$disconnect()]); }
  }
})().catch(() => { console.error('FAIL datas local; detalhes omitidos para preservar credenciais.'); process.exitCode = 1; });

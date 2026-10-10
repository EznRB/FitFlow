'use strict';
// Somente bancos NATIVOS dedicados; não aceita nem a branch remota de verificação.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(target.hostname, '127.0.0.1');
if (target.protocol === 'mysql:') {
  assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1');
  assert.equal(target.port, '3308'); assert.equal(target.pathname, '/fitflow_dev');
} else {
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
  assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-postgresql-test-v1');
  assert.equal(target.port, '5448'); assert.equal(target.pathname, '/fitflow_pg_test');
}
const PrismaClient = require('../src/config/databaseProvider').getPrismaClientClass();
const db = new PrismaClient({ log: [] }), secondDb = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createPagamentosService } = require('../src/services/pagamentos.service');
const users = [], students = []; let plan;
const status = (operation, code) => assert.rejects(operation, error => error.statusCode === code);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
(async () => {
  try {
    const prefix = `Manual fixture ${randomUUID()}`;
    plan = await db.plan.create({ data: { name: prefix, price: '14.39', durationDays: 30 } });
    for (const role of ['admin', 'student']) {
      const user = await db.user.create({ data: { name: prefix, email: `${role}.${randomUUID()}@example.invalid`, passwordHash: randomBytes(48).toString('hex'), role } });
      users.push(user);
      students.push(await db.student.create({ data: { userId: user.id, planId: plan.id, planEndDate: new Date('2099-11-01T00:00:00.000Z') } }));
    }
    const actor = users[0].id, studentId = students[0].id;
    const first = createPagamentosService({ db }), second = createPagamentosService({ db: secondDb });
    const payload = { studentId, planId: plan.id, amount: '14.39', paymentMethod: 'pix', paymentDate: '2099-10-08', idempotencyKey: randomUUID() };
    const originalEnd = students[0].planEndDate;
    await status(first.registrar({ ...payload, expectedActorId: users[1].id }, actor), 403);
    assert.equal(await db.payment.count({ where: { studentId } }), 0);
    const repeats = await Promise.all([first.registrar(payload, actor), second.registrar(payload, actor)]);
    assert.equal(repeats[0].id, repeats[1].id);
    assert.equal(await db.payment.count({ where: { studentId } }), 1);
    assert.equal((await db.student.findUnique({ where: { id: studentId } })).planEndDate.toISOString(), addDays(originalEnd, 30).toISOString());
    assert.match(repeats[0].manualRequestHash, /^[a-f0-9]{64}$/);
    await assert.rejects(db.payment.update({ where: { id: repeats[0].id }, data: { manualRequestHash: null } }), error => /payments_manual_request_pair_check/.test(error.message));
    await Promise.all([first.registrar({ ...payload, idempotencyKey: randomUUID() }, actor), second.registrar({ ...payload, idempotencyKey: randomUUID() }, actor)]);
    assert.equal(await db.payment.count({ where: { studentId } }), 3);
    const finalEnd = addDays(originalEnd, 90);
    assert.equal((await db.student.findUnique({ where: { id: studentId } })).planEndDate.toISOString(), finalEnd.toISOString());
    const originalHash = repeats[0].manualRequestHash;
    await first.atualizar(repeats[0].id, { amount: '13.21', notes: 'Correção sintética' });
    const retried = await second.registrar(payload, actor);
    assert.equal(retried.id, repeats[0].id); assert.equal(Number(retried.amount), 13.21);
    assert.equal(retried.manualRequestHash, originalHash);
    assert.equal((await db.student.findUnique({ where: { id: studentId } })).planEndDate.toISOString(), finalEnd.toISOString());
    await status(first.registrar({ ...payload, amount: '15.00' }, actor), 409);
    await status(first.registrar(payload, users[1].id), 409);
    await status(first.registrar({ ...payload, studentId: students[1].id }, actor), 409);
    assert.equal((await first.buscarPorSolicitacao(payload.idempotencyKey, actor)).id, retried.id);
    await status(first.buscarPorSolicitacao(payload.idempotencyKey, users[1].id), 404);

    const raceKey = randomUUID();
    const beforeRace = await db.student.findMany({ where: { id: { in: students.map(row => row.id) } } });
    const race = await Promise.allSettled([first.registrar({ ...payload, idempotencyKey: raceKey }, actor),
      second.registrar({ ...payload, studentId: students[1].id, idempotencyKey: raceKey }, actor)]);
    assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(race.find(result => result.status === 'rejected').reason.statusCode, 409);
    assert.equal(await db.payment.count({ where: { manualRequestId: raceKey } }), 1);
    const winner = race.find(result => result.status === 'fulfilled').value.studentId;
    for (const before of beforeRace) {
      const after = await db.student.findUnique({ where: { id: before.id } });
      assert.equal(after.planEndDate.toISOString(), (before.id === winner ? addDays(before.planEndDate, 30) : before.planEndDate).toISOString());
    }

    const rollback = new Error('Rollback sintético após criar ledger');
    const failing = createPagamentosService({ db: { payment: db.payment,
      $transaction: callback => db.$transaction(tx => callback({ payment: tx.payment, plan: tx.plan,
        $queryRaw: tx.$queryRaw.bind(tx), student: { findUnique: args => tx.student.findUnique(args), update: async () => { throw rollback; } } })) } });
    const rollbackInput = { ...payload, idempotencyKey: randomUUID() };
    const beforeRollback = (await db.student.findUnique({ where: { id: studentId } })).planEndDate;
    await assert.rejects(failing.registrar(rollbackInput, actor), error => error === rollback);
    assert.equal(await db.payment.count({ where: { manualRequestId: rollbackInput.idempotencyKey } }), 0);
    assert.equal((await db.student.findUnique({ where: { id: studentId } })).planEndDate.toISOString(), beforeRollback.toISOString());
    await first.registrar(rollbackInput, actor);
    assert.equal(await db.payment.count({ where: { manualRequestId: rollbackInput.idempotencyKey } }), 1);
    console.log('PASS manual payment native: UUID dedup entre dois clientes, intenções distintas acumuladas, conflito ator/payload, replay após edição, corrida entre alunos, rollback e lookup privado.');
  } finally {
    try {
      await db.payment.deleteMany({ where: { studentId: { in: students.map(row => row.id) } } });
      await db.student.deleteMany({ where: { id: { in: students.map(row => row.id) } } });
      await db.user.deleteMany({ where: { id: { in: users.map(row => row.id) } } });
      if (plan) await db.plan.delete({ where: { id: plan.id } });
    } finally { await Promise.all([db.$disconnect(), secondDb.$disconnect()]); }
  }
})().catch(error => { console.error('FAIL manual payment native:', error.code || error.name); process.exitCode = 1; });

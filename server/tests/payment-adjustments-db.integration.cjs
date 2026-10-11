'use strict';
// Apenas bancos nativos dedicados ou a branch Neon de verificação existente.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
assert.ok(['test', 'development'].includes(process.env.NODE_ENV));
if (target.protocol === 'mysql:') {
  assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1');
  assert.equal(target.hostname, '127.0.0.1'); assert.equal(target.port, '3308'); assert.equal(target.pathname, '/fitflow_dev');
} else require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();
const PrismaClient = require('../src/config/databaseProvider').getPrismaClientClass();
const db = new PrismaClient({ log: [] }), otherDb = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createPagamentosService } = require('../src/services/pagamentos.service');
const { createPaymentAdjustmentsService } = require('../src/services/payment-adjustments.service');
const { createCheckoutRepository } = require('../src/repositories/checkout.repository');
const { createAlunosService } = require('../src/services/alunos.service');
const { brazilDate } = require('../src/utils/paymentValidation');
const { totalsByPeriod } = require('../src/utils/financialTotals');
const { adjustmentSummary } = require('../src/utils/paymentAdjustment');
const now = new Date(), today = brazilDate(now), day = value => value.toISOString().slice(0, 10);
const users = [], students = [], plans = [], prefix = `Adjustment fixture ${randomUUID()}`;
let stage = 'fixtures';
const failStatus = (promise, status) => assert.rejects(promise, error => error.statusCode === status);

(async () => {
  try {
    for (const [price, durationDays] of [['150.00', 30], ['75.00', 15]])
      plans.push(await db.plan.create({ data: { name: `${prefix} ${durationDays}`, price, durationDays } }));
    for (const role of ['admin', 'student', 'student', 'student']) {
      const user = await db.user.create({ data: { name: prefix, email: `${randomUUID()}@example.invalid`,
        passwordHash: randomBytes(48).toString('hex'), role } }); users.push(user);
      if (role === 'student') students.push(await db.student.create({ data: { userId: user.id, planId: plans[0].id,
        planStartDate: today, planEndDate: today } }));
    }
    const actor = users[0].id, main = students[0].id;
    const payments = createPagamentosService({ db, now: () => now });
    const first = createPaymentAdjustmentsService({ db, now: () => now });
    const second = createPaymentAdjustmentsService({ db: otherDb, now: () => now });
    const receiptInput = { studentId: main, planId: plans[0].id, amount: '150.00', paymentMethod: 'pix',
      paymentDate: day(today), idempotencyKey: randomUUID(), expectedActorId: actor };
    const adjustment = (amount, extra = {}) => ({ idempotencyKey: randomUUID(), expectedActorId: actor,
      kind: 'correction', amount, reason: 'Correção sintética guardada do recebimento.', effectiveDate: day(today), ...extra });

    stage = 'new receipt grant and immutable paid SQL';
    const receipt = await payments.registrar(receiptInput, actor);
    const original = await db.payment.findUnique({ where: { id: receipt.id } });
    assert.equal(original.membershipGrant.durationDays, 30); assert.equal(original.membershipGrant.applied, true);
    assert.equal(original.membershipGrant.before.membershipRevision, 0); assert.equal(original.membershipGrant.after.membershipRevision, 1);
    assert.equal((await db.student.findUnique({ where: { id: main } })).membershipRevision, 1);
    await assert.rejects(db.$executeRaw`UPDATE payments SET amount = 1 WHERE id = ${receipt.id}`,
      error => /Paid receipt is immutable/.test(error.message));

    stage = 'additive database CHECK constraints';
    const snapshot = { planId: plans[0].id, planStartDate: day(today), planEndDate: day(today), status: 'active', membershipRevision: 1, userActive: true };
    const validEvent = { requestHash: '0'.repeat(64), paymentId: receipt.id, actorId: actor, actorName: prefix,
      kind: 'correction', amount: '0.01', reason: 'Synthetic direct CHECK probe', effectiveDate: today,
      membershipEffect: 'preserve', membershipBefore: snapshot, membershipAfter: snapshot };
    for (const [constraint, change] of [
      ['payment_adjustments_amount_check', { amount: '0.00' }],
      ['payment_adjustments_kind_check', { kind: 'invalid' }],
      ['payment_adjustments_membership_check', { membershipEffect: 'invalid' }],
      ['payment_adjustments_snapshot_check', { membershipBefore: [] }],
      ['payment_adjustments_provider_check', { providerRefundPerformed: true }]
    ]) await assert.rejects(db.paymentAdjustment.create({ data: { ...validEvent, id: randomUUID(), ...change } }), error => String(error.message).includes(constraint));
    await assert.rejects(db.student.update({ where: { id: main }, data: { membershipRevision: -1 } }), error => String(error.message).includes('students_membership_revision_check'));
    await assert.rejects(db.payment.create({ data: { studentId: main, amount: '1.00', paymentDate: today, dueDate: today, status: 'paid', membershipGrant: [] } }),
      error => String(error.message).includes('payments_membership_grant_check'));

    stage = 'partial, UUID concurrency and remaining balance race';
    await first.registrar(receipt.id, adjustment('0.01'), actor);
    const same = adjustment('50.00');
    const [event, replay] = await Promise.all([first.registrar(receipt.id, same, actor), second.registrar(receipt.id, same, actor)]);
    assert.equal(event.id, replay.id);
    assert.equal(await db.paymentAdjustment.count({ where: { paymentId: receipt.id } }), 2);
    const competition = await Promise.allSettled([first.registrar(receipt.id, adjustment('99.99'), actor),
      second.registrar(receipt.id, adjustment('99.99', { kind: 'refund_recorded' }), actor)]);
    assert.equal(competition.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(competition.find(item => item.status === 'rejected').reason.statusCode, 409);
    assert.equal(adjustmentSummary(original, await first.listar(receipt.id, actor)).remainingAmount, 0);
    assert.equal((await first.registrar(receipt.id, same, actor)).id, event.id);
    await failStatus(first.registrar(receipt.id, adjustment('0.01'), actor), 409);
    assert.deepEqual(await db.payment.findUnique({ where: { id: receipt.id } }), original);
    await assert.rejects(db.user.delete({ where: { id: actor } }), error => error.code === 'P2003');

    stage = 'legacy null, explicit CAS and renewal conflict';
    const legacy = await db.payment.create({ data: { studentId: main, planId: plans[0].id, amount: '20.00',
      paymentMethod: 'dinheiro', paymentDate: today, dueDate: today, status: 'paid', registeredBy: actor } });
    assert.equal(legacy.membershipGrant, null);
    const beforeLegacy = await db.student.findUnique({ where: { id: main } });
    await first.registrar(legacy.id, adjustment('1.00'), actor);
    assert.deepEqual(await db.student.findUnique({ where: { id: main } }), beforeLegacy);
    await payments.registrar({ ...receiptInput, idempotencyKey: randomUUID() }, actor);
    const renewed = await db.student.findUnique({ where: { id: main } });
    assert.equal(renewed.membershipRevision, beforeLegacy.membershipRevision + 1);
    const obsolete = adjustment('1.00', { membershipEffect: 'set_end_date', expectedMembershipRevision: beforeLegacy.membershipRevision,
      newPlanEndDate: day(renewed.planEndDate) });
    await failStatus(first.registrar(legacy.id, obsolete, actor), 409);
    assert.deepEqual(await db.student.findUnique({ where: { id: main } }), renewed);
    const explicit = adjustment('1.00', { membershipEffect: 'set_end_date', expectedMembershipRevision: renewed.membershipRevision,
      newPlanEndDate: day(new Date(renewed.planEndDate.getTime() - 86400000)) });
    const changed = await first.registrar(legacy.id, explicit, actor);
    assert.equal(changed.membershipAfter.membershipRevision, renewed.membershipRevision + 1);
    assert.equal(changed.membershipAfter.planStartDate, changed.membershipBefore.planStartDate);
    assert.equal(changed.membershipAfter.status, changed.membershipBefore.status);
    assert.equal((await first.registrar(legacy.id, explicit, actor)).id, changed.id);

    stage = 'atomic rollback';
    const atRollback = await db.student.findUnique({ where: { id: main } }), failed = adjustment('1.00', {
      membershipEffect: 'set_end_date', expectedMembershipRevision: atRollback.membershipRevision, newPlanEndDate: day(atRollback.planEndDate) });
    const synthetic = new Error('Synthetic guarded rollback');
    const failingDb = { payment: db.payment, user: db.user, paymentAdjustment: db.paymentAdjustment,
      $transaction: run => db.$transaction(tx => run({ $queryRaw: tx.$queryRaw.bind(tx), user: tx.user, payment: tx.payment,
        paymentAdjustment: tx.paymentAdjustment, student: { findUnique: args => tx.student.findUnique(args), update: async () => { throw synthetic; } } })) };
    await assert.rejects(createPaymentAdjustmentsService({ db: failingDb, now: () => now }).registrar(legacy.id, failed, actor), error => {
      if (error !== synthetic) console.log(JSON.stringify({ stage: 'rollback diagnosis', type: error.name, code: error.code, status: error.statusCode }));
      return error === synthetic;
    });
    assert.equal(await db.paymentAdjustment.count({ where: { id: failed.idempotencyKey } }), 0);
    assert.deepEqual(await db.student.findUnique({ where: { id: main } }), atRollback);

    stage = 'AlunosService locks, revisions and stale edits';
    const aluno = createAlunosService({ db, now: () => now });
    const edited = await aluno.atualizar(main, { planId: plans[1].id, expectedMembershipRevision: atRollback.membershipRevision });
    assert.equal(edited.membershipRevision, atRollback.membershipRevision + 1); assert.equal(edited.planId, plans[1].id);
    assert.equal(day(edited.planStartDate), day(today));
    await failStatus(first.registrar(legacy.id, { ...failed, idempotencyKey: randomUUID() }, actor), 409);
    const stopped = await aluno.desativar(main);
    assert.equal(stopped.membershipRevision, edited.membershipRevision + 1); assert.equal(stopped.status, 'inactive');
    assert.equal((await db.user.findUnique({ where: { id: stopped.userId } })).active, false);
    await failStatus(first.registrar(legacy.id, adjustment('1.00', { membershipEffect: 'set_end_date',
      expectedMembershipRevision: stopped.membershipRevision, newPlanEndDate: day(stopped.planEndDate) }), actor), 409);
    await first.registrar(legacy.id, adjustment('1.00'), actor);
    assert.deepEqual(await db.student.findUnique({ where: { id: main } }), stopped);

    stage = 'checkout ledger and internally recorded refund';
    const checkoutStudent = students[1], checkout = createCheckoutRepository(db);
    const { intent } = await checkout.createOrGet(checkoutStudent.userId, { planId: plans[0].id, idempotencyKey: randomUUID() });
    const approved = { id: `fixture-${randomUUID()}`, date_approved: now.toISOString() };
    const settled = await checkout.settle(intent.id, approved, 'pix');
    const checkoutBefore = await db.paymentIntent.findUnique({ where: { id: intent.id } });
    const providerReceipt = await db.payment.findUnique({ where: { id: settled.paymentId } });
    assert.equal(providerReceipt.membershipGrant.applied, true);
    assert.equal(providerReceipt.membershipGrant.after.membershipRevision, 1);
    await failStatus(first.registrar(providerReceipt.id, adjustment('1.00'), actor), 400);
    const reported = await first.registrar(providerReceipt.id, adjustment('1.00', { kind: 'refund_recorded' }), actor);
    assert.equal(reported.providerRefundPerformed, false);
    assert.deepEqual(await db.paymentIntent.findUnique({ where: { id: intent.id } }), checkoutBefore);
    assert.deepEqual(await db.payment.findUnique({ where: { id: providerReceipt.id } }), providerReceipt);
    assert.equal((await checkout.settle(intent.id, approved, 'pix')).paymentId, settled.paymentId);
    assert.equal((await db.student.findUnique({ where: { id: checkoutStudent.id } })).membershipRevision, 1);

    stage = 'previous-month receipt, current-month adjustment report';
    const reportStudent = students[2];
    const previousMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15));
    const oldReceipt = await payments.registrar({ ...receiptInput, studentId: reportStudent.id, paymentDate: day(previousMonth),
      idempotencyKey: randomUUID() }, actor);
    await first.registrar(oldReceipt.id, adjustment('10.00'), actor);
    const scoped = {
      payment: { aggregate: args => db.payment.aggregate({ ...args, where: { ...args.where, studentId: reportStudent.id } }) },
      paymentAdjustment: { groupBy: args => db.paymentAdjustment.groupBy({ ...args, where: { ...args.where, payment: { studentId: reportStudent.id } } }) },
    };
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    const current = await totalsByPeriod(scoped, { gte: monthStart, lt: nextMonth });
    assert.equal(current.grossAmount, 0); assert.equal(current.correctionAmount, 10); assert.equal(current.netAmount, -10);
    const prior = await totalsByPeriod(scoped, { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)), lt: monthStart });
    assert.equal(prior.grossAmount, 150); assert.equal(prior.adjustedAmount, 0); assert.equal(prior.netAmount, 150);
    console.log('Payment adjustment DB PASS: immutable receipt, exact balance/races/replay, legacy/CAS/rollback, locked membership writers, PSP distinction and cross-month reports.');
  } finally {
    const studentIds = students.map(row => row.id), actorIds = users.filter(row => row.role === 'admin').map(row => row.id);
    if (studentIds.length) {
      await db.paymentAdjustment.deleteMany({ where: { actorId: { in: actorIds }, payment: { studentId: { in: studentIds } } } });
      await db.paymentIntent.deleteMany({ where: { studentId: { in: studentIds } } });
      await db.payment.deleteMany({ where: { studentId: { in: studentIds } } });
      await db.student.deleteMany({ where: { id: { in: studentIds }, user: { name: prefix } } });
    }
    if (users.length) await db.user.deleteMany({ where: { id: { in: users.map(row => row.id) }, name: prefix } });
    if (plans.length) await db.plan.deleteMany({ where: { id: { in: plans.map(row => row.id) }, name: { startsWith: prefix } } });
    console.log('Only this run’s UUID fixtures removed.');
  }
})().catch(error => { console.error(`Payment adjustment DB gate failed at ${stage}: ${error.code || error.name}`);
  if (error.code === 'ERR_ASSERTION') console.error(JSON.stringify({ operator: error.operator,
    actualType: typeof error.actual, expectedType: typeof error.expected,
    ...(typeof error.actual === 'number' ? { actual: error.actual, expected: error.expected } : {}) }));
  process.exitCode = 1; })
  .finally(async () => { await otherDb.$disconnect(); await db.$disconnect(); });

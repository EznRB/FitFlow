// Somente fixtures descartáveis no banco local gerenciado. Não faz chamadas ao Mercado Pago.
// node scripts/with-local-env.cjs node tests/checkout-local.integration.cjs
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1', 'Exige ambiente local gerenciado');
assert.equal(target.protocol, 'mysql:');
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
assert.equal(target.port, '3308');
assert.equal(target.pathname, '/fitflow_dev');
const db = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createPagamentosService } = require('../src/services/pagamentos.service');
const { createCheckoutRepository } = require('../src/repositories/checkout.repository');
const { createCheckoutService } = require('../src/services/checkout.service');
let user; let student; let plan;
(async () => {
  try {
    plan = await db.plan.create({ data: { name: `Fixture sandbox ${randomUUID()}`, price: '150.00', durationDays: 30 } });
    user = await db.user.create({ data: { name: 'Fixture local descartável', email: `checkout-${randomUUID()}@example.invalid`,
      passwordHash: randomBytes(48).toString('hex'), role: 'student' } });
    student = await db.student.create({ data: { userId: user.id, planId: plan.id, planEndDate: new Date('2026-11-01') } });
    const manual = createPagamentosService({ db });
    const payload = { studentId: student.id, planId: plan.id, amount: '150.00', paymentDate: '2026-10-08', paymentMethod: 'pix' };
    await Promise.all([manual.registrar({ ...payload, idempotencyKey: randomUUID() }, user.id), manual.registrar({ ...payload, idempotencyKey: randomUUID() }, user.id)]);
    let current = await db.student.findUnique({ where: { id: student.id } });
    assert.equal(current.planEndDate.toISOString().slice(0, 10), '2026-12-31');
    assert.equal(await db.payment.count({ where: { studentId: student.id } }), 2);
    const repository = createCheckoutRepository(db);
    const input = { planId: plan.id, idempotencyKey: randomUUID() };
    const [first, repeated] = await Promise.all([repository.createOrGet(user.id, input), repository.createOrGet(user.id, input)]);
    assert.equal(first.intent.id, repeated.intent.id);
    await assert.rejects(repository.getOwned(first.intent.id, user.id + 1000000), error => error.statusCode === 404);
    const payment = { id: String(Date.now()), live_mode: false, collector_id: '123', currency_id: 'BRL', status: 'approved',
      transaction_amount: '150.00', transaction_amount_refunded: 0, external_reference: first.intent.id,
      metadata: { fitflow_intent_id: first.intent.id }, payment_method_id: 'pix', payment_type_id: 'bank_transfer', date_approved: new Date().toISOString() };
    const service = createCheckoutService({ repository, provider: { enabled: true, sellerId: '123', findPayment: async () => payment, getPayment: async () => payment } });
    const results = await Promise.all(Array.from({ length: 4 }, () => service.get(user.id, first.intent.id)));
    assert.ok(results.every(result => result.state === 'paid' && result.settled));
    current = await db.student.findUnique({ where: { id: student.id } });
    assert.equal(current.planEndDate.toISOString().slice(0, 10), '2027-01-30');
    assert.equal(await db.payment.count({ where: { studentId: student.id } }), 3);
    const settled = await repository.findById(first.intent.id);
    await repository.recordStatus(first.intent.id, { ...payment, status: 'pending' });
    assert.equal((await repository.findById(first.intent.id)).state, 'paid');
    await assert.rejects(manual.atualizar(settled.paymentId, { amount: '1.00' }), error => error.statusCode === 409);
    payment.status = 'refunded';
    assert.equal((await service.get(user.id, first.intent.id)).state, 'review');
    assert.equal(await db.payment.count({ where: { studentId: student.id } }), 3);
    const second = await repository.createOrGet(user.id, { ...input, idempotencyKey: randomUUID() });
    await db.user.update({ where: { id: user.id }, data: { active: false } });
    const inactivePayment = { ...payment, id: String(Date.now() + 1), status: 'approved', external_reference: second.intent.id,
      metadata: { fitflow_intent_id: second.intent.id } };
    const reviewed = await repository.settle(second.intent.id, inactivePayment, 'pix');
    assert.equal(reviewed.state, 'review');
    assert.equal((await db.student.findUnique({ where: { id: student.id } })).planEndDate.toISOString().slice(0, 10), '2027-01-30');
    console.log('PASS local: renovação concorrente, intent único, conciliação 4x/1 ledger, ownership, estorno, conta inativa e audit protegido.');
  } finally {
    // Remove somente registros criados por este teste; nunca altera fixture demo ou histórico existente.
    if (student) await db.$transaction([
      db.paymentIntent.deleteMany({ where: { studentId: student.id } }),
      db.payment.deleteMany({ where: { studentId: student.id } }),
      db.student.delete({ where: { id: student.id } }),
    ]);
    if (user) await db.user.delete({ where: { id: user.id } });
    if (plan) await db.plan.delete({ where: { id: plan.id } });
    await db.$disconnect();
  }
})().catch(() => { console.error('FAIL checkout local; detalhes não exibidos para preservar credenciais.'); process.exitCode = 1; });

// Opt-in: fixtures descartáveis em banco local gerenciado; nenhuma cobrança externa.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
if (target.protocol === 'mysql:') {
  assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1');
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.port, '3308'); assert.equal(target.pathname, '/fitflow_dev');
} else require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();
const PrismaClient = require('../src/config/databaseProvider').getPrismaClientClass();
const { createCheckoutPurchaseRepository } = require('../src/repositories/checkout-purchase.repository');
const db = new PrismaClient({ log: [] });
let plan, user, student;
(async () => {
  try {
    plan = await db.plan.create({ data: { name: `Fixture Brick ${randomUUID()}`, price: '150.00', durationDays: 30 } });
    user = await db.user.create({ data: { name: 'Fixture Brick descartável', email: `brick-${randomUUID()}@example.invalid`, passwordHash: randomBytes(48).toString('hex'), role: 'student' } });
    student = await db.student.create({ data: { userId: user.id, planId: plan.id } });
    const repository = createCheckoutPurchaseRepository(db);
    const prepared = await Promise.all([repository.preparePurchase(user.id, plan.id), repository.preparePurchase(user.id, plan.id)]);
    assert.equal(prepared[0].id, prepared[1].id, 'preparação concorrente recupera a mesma intenção');
    const intent = prepared[0];
    const claims = await Promise.all([repository.claimPaymentAttempt(user.id, intent.id, randomUUID()), repository.claimPaymentAttempt(user.id, intent.id, randomUUID())]);
    assert.equal(claims.filter(c => c.claimed).length, 1, 'somente um envio pode alcançar o provedor');
    assert.equal(claims[0].attempt.id, claims[1].attempt.id);
    const attempt = claims[0].attempt;
    await repository.markPaymentAttemptUncertain(attempt.id);
    assert.equal((await repository.claimPaymentAttempt(user.id, intent.id, randomUUID())).claimed, false);
    await repository.recordPaymentAttempt(attempt.id, { id: '123456' });
    await repository.finishPaymentAttempt(attempt.id, { id: '123456', status: 'rejected' });
    const retry = await repository.claimPaymentAttempt(user.id, intent.id, randomUUID());
    assert.equal(retry.claimed, true); assert.equal(retry.attempt.sequence, 2);
    await db.paymentIntent.create({ data: { id: randomUUID(), studentId: student.id, planId: plan.id, amount: '150.00', durationDays: 30, idempotencyKey: randomUUID(), flow: 'legacy', state: 'pending' } });
    await assert.rejects(repository.claimPaymentAttempt(user.id, intent.id, randomUUID()), e => e.statusCode === 409);
    console.log('PASS: preparação e envio concorrentes, recuperação incerta, recusa/nova tentativa e bloqueio legado.');
  } finally {
    if (student) {
      await db.paymentAttempt.deleteMany({ where: { intent: { studentId: student.id } } });
      await db.paymentIntent.deleteMany({ where: { studentId: student.id } });
      await db.student.delete({ where: { id: student.id } });
    }
    if (user) await db.user.delete({ where: { id: user.id } });
    if (plan) await db.plan.delete({ where: { id: plan.id } });
    await db.$disconnect();
  }
})().catch(error => { console.error('Integração Brick local falhou:', error.code || error.message); process.exitCode = 1; });

const { randomUUID } = require('node:crypto');
const AppError = require('../utils/AppError');
const { lockStudent, renewalDates } = require('../utils/membershipRenewal');
const { moneyCents, brazilDate } = require('../utils/paymentValidation');
const details = { plan: { select: { name: true } }, attempts: { orderBy: { sequence: 'desc' }, take: 1 } };
const open = studentId => ({ studentId, state: { notIn: ['paid', 'cancelled'] } });
function createCheckoutPurchaseRepository(db) {
  async function locked(userId, work) {
    const owner = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!owner) throw new AppError('Perfil de aluno indisponível.', 403);
    return db.$transaction(async tx => {
      await lockStudent(tx, owner.id);
      const student = await tx.student.findUnique({ where: { id: owner.id }, include: { user: { select: { active: true } } } });
      if (!student?.user.active || student.status === 'inactive') throw new AppError('Perfil de aluno indisponível.', 403);
      return work(tx, student);
    });
  }
  async function attemptTransaction(attemptId, work) {
    const attempt = await db.paymentAttempt.findUnique({ where: { id: attemptId }, include: { intent: { select: { studentId: true } } } });
    if (!attempt) throw new AppError('Tentativa de pagamento não encontrada.', 404);
    return db.$transaction(async tx => { await lockStudent(tx, attempt.intent.studentId); return work(tx, attempt); });
  }
  return {
    get internalReady() { return Boolean(db.paymentIntent && db.paymentAttempt); },
    async preparePurchase(userId, planId) {
      return locked(userId, async (tx, student) => {
        const active = await tx.paymentIntent.findFirst({ where: open(student.id), orderBy: { createdAt: 'asc' }, include: details });
        if (active) return active;
        const plan = await tx.plan.findUnique({ where: { id: planId } });
        if (!plan?.active) throw new AppError('Plano não disponível.', 400);
        renewalDates(null, brazilDate(), plan.durationDays);
        const amount = moneyCents(String(plan.price)) / 100;
        return tx.paymentIntent.create({ data: { id: randomUUID(), studentId: student.id, planId, amount, durationDays: plan.durationDays,
          currency: 'BRL', flow: 'brick', state: 'created', idempotencyKey: randomUUID() }, include: details });
      });
    },
    async getPurchase(id, userId) {
      const intent = await db.paymentIntent.findFirst({ where: { id, student: { userId } }, include: details });
      if (!intent) throw new AppError('Checkout não encontrado.', 404);
      return intent;
    },
    async claimPaymentAttempt(userId, intentId, requestKey) {
      return locked(userId, async (tx, student) => {
        const intent = await tx.paymentIntent.findFirst({ where: { id: intentId, studentId: student.id }, include: details });
        if (!intent) throw new AppError('Checkout não encontrado.', 404);
        if (intent.flow !== 'brick' || intent.state === 'review' || intent.state === 'cancelled') throw new AppError('Compra indisponível para nova cobrança.', 409);
        if (intent.paymentId) return { intent, attempt: intent.attempts[0], claimed: false };
        const other = await tx.paymentIntent.findFirst({ where: { ...open(student.id), id: { not: intent.id } } });
        if (other) throw new AppError('Resolva a compra anterior antes de iniciar outro pagamento.', 409);
        const repeated = await tx.paymentAttempt.findUnique({ where: { intentId_requestKey: { intentId, requestKey } } });
        if (repeated) return { intent, attempt: repeated, claimed: false };
        const active = await tx.paymentAttempt.findFirst({ where: { intentId, state: { notIn: ['rejected', 'cancelled'] } } });
        if (active) return { intent, attempt: active, claimed: false };
        const attempt = await tx.paymentAttempt.create({ data: { id: randomUUID(), intentId, requestKey, sequence: (intent.attempts[0]?.sequence || 0) + 1, state: 'processing' } });
        await tx.paymentIntent.update({ where: { id: intentId }, data: { state: 'creating' } });
        return { intent, attempt, claimed: true };
      });
    },
    async recordPaymentAttempt(attemptId, payment) {
      return attemptTransaction(attemptId, async tx => {
        await tx.paymentAttempt.update({ where: { id: attemptId }, data: { providerPaymentId: String(payment.id), state: 'pending' } });
      });
    },
    async finishPaymentAttempt(attemptId, payment) {
      return attemptTransaction(attemptId, async (tx, attempt) => {
        const current = await tx.paymentAttempt.findUnique({ where: { id: attemptId } });
        if (current.providerPaymentId !== String(payment.id)) throw new AppError('Pagamento não corresponde à tentativa.', 409);
        await tx.paymentAttempt.update({ where: { id: attemptId }, data: { state: payment.status } });
        const intent = await tx.paymentIntent.findUnique({ where: { id: attempt.intentId } });
        if (!intent.paymentId && ['rejected', 'cancelled'].includes(payment.status)) {
          await tx.paymentIntent.update({ where: { id: intent.id }, data: { state: 'created' } });
        }
      });
    },
    async markPaymentAttemptUncertain(attemptId) {
      return attemptTransaction(attemptId, async (tx, attempt) => {
        const changed = await tx.paymentAttempt.updateMany({ where: { id: attemptId, state: 'processing', providerPaymentId: null }, data: { state: 'uncertain' } });
        if (changed.count) await tx.paymentIntent.updateMany({ where: { id: attempt.intentId, paymentId: null, state: 'creating' }, data: { state: 'uncertain' } });
      });
    },
    async rejectPaymentAttempt(attemptId) {
      return attemptTransaction(attemptId, async (tx, attempt) => {
        const changed = await tx.paymentAttempt.updateMany({ where: { id: attemptId, state: 'processing', providerPaymentId: null }, data: { state: 'rejected' } });
        if (changed.count) await tx.paymentIntent.updateMany({ where: { id: attempt.intentId, paymentId: null, state: 'creating' }, data: { state: 'created' } });
      });
    }
  };
}
module.exports = { createCheckoutPurchaseRepository };

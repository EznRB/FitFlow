const { randomUUID } = require('node:crypto');
const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const { moneyCents, brazilDate } = require('../utils/paymentValidation');
const { lockStudent, renewalDates } = require('../utils/membershipRenewal');

function createCheckoutRepository(db = prisma) {
  return {
    get ready() { return Boolean(db.paymentIntent); },
    listPlans: () => db.plan.findMany({ where: { active: true }, select: { id: true, name: true, price: true, durationDays: true }, orderBy: { price: 'asc' } }),
    async createOrGet(userId, { planId, idempotencyKey }) {
      const student = await db.student.findUnique({ where: { userId }, include: { user: { select: { active: true } } } });
      if (!student || !student.user.active || student.status === 'inactive') throw new AppError('Perfil de aluno indisponível.', 403);
      const plan = await db.plan.findUnique({ where: { id: planId } });
      if (!plan?.active) throw new AppError('Plano não disponível.', 400);
      const amount = moneyCents(String(plan.price)) / 100;
      renewalDates(null, brazilDate(), plan.durationDays);
      const where = { studentId_idempotencyKey: { studentId: student.id, idempotencyKey } };
      let intent = await db.paymentIntent.findUnique({ where });
      if (!intent) {
        try { intent = await db.paymentIntent.create({ data: { id: randomUUID(), studentId: student.id, planId, amount, durationDays: plan.durationDays,
          currency: 'BRL', state: 'created', idempotencyKey } }); }
        catch (error) { if (error.code !== 'P2002') throw error; intent = await db.paymentIntent.findUnique({ where }); }
      }
      if (!intent || intent.planId !== planId) throw new AppError('Chave de repetição já usada em outro plano.', 409);
      return { intent, planName: plan.name };
    },
    async getOwned(id, userId) {
      const intent = await db.paymentIntent.findFirst({ where: { id, student: { userId } } });
      if (!intent) throw new AppError('Checkout não encontrado.', 404);
      return intent;
    },
    findById: id => db.paymentIntent.findUnique({ where: { id } }),
    async claimPreference(id) {
      const result = await db.paymentIntent.updateMany({ where: { id, state: 'created' }, data: { state: 'creating' } });
      return result.count === 1;
    },
    savePreference: (id, data) => db.paymentIntent.update({ where: { id }, data: { ...data, state: 'pending' } }),
    markUncertain: id => db.paymentIntent.updateMany({ where: { id, state: 'creating' }, data: { state: 'uncertain' } }),
    async recordStatus(id, payment) {
      const found = await db.paymentIntent.findUnique({ where: { id } });
      if (!found) return null;
      return db.$transaction(async tx => {
        await lockStudent(tx, found.studentId);
        const current = await tx.paymentIntent.findUnique({ where: { id } });
        const review = ['refunded', 'charged_back'].includes(payment.status);
        return tx.paymentIntent.update({ where: { id }, data: { lastProviderStatus: payment.status,
          ...(current.paymentId ? (review ? { state: 'review' } : {}) : { state: review ? 'review' : 'pending', providerPaymentId: String(payment.id) }) } });
      });
    },
    async settle(id, payment, method) {
      const found = await db.paymentIntent.findUnique({ where: { id } });
      if (!found) throw new AppError('Checkout não encontrado.', 404);
      return db.$transaction(async tx => {
        // O primeiro read consistente da transação ocorre DEPOIS do lock,
        // evitando snapshots antigos no REPEATABLE READ do MySQL/MariaDB.
        await lockStudent(tx, found.studentId);
        const intent = await tx.paymentIntent.findUnique({ where: { id } });
        if (intent.paymentId) {
          if (intent.providerPaymentId !== String(payment.id)) throw new AppError('Checkout já possui outro pagamento conciliado. Conferência necessária.', 409);
          return intent;
        }
        const student = await tx.student.findUnique({ where: { id: intent.studentId }, include: { user: { select: { active: true } } } });
        const paidDate = brazilDate(new Date(payment.date_approved));
        const dates = renewalDates(student.planEndDate, paidDate, intent.durationDays);
        const ledger = await tx.payment.create({ data: { studentId: student.id, planId: intent.planId, amount: intent.amount,
          paymentMethod: method, paymentDate: paidDate, dueDate: dates.endDate, status: 'paid', registeredBy: null,
          notes: `[SANDBOX MERCADO PAGO] Compra ${intent.id}; confirmação ${String(payment.id)}.` } });
        if (student.user.active && student.status !== 'inactive') {
          await tx.student.update({ where: { id: student.id }, data: { planId: intent.planId, planStartDate: dates.startDate,
            planEndDate: dates.endDate, ...(student.status === 'blocked' ? { status: 'active' } : {}) } });
        }
        return tx.paymentIntent.update({ where: { id }, data: { state: student.user.active && student.status !== 'inactive' ? 'paid' : 'review',
          providerPaymentId: String(payment.id), paymentId: ledger.id, lastProviderStatus: 'approved', settledAt: new Date() } });
      });
    }
  };
}
module.exports = { createCheckoutRepository };

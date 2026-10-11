'use strict';
const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const { paymentId, moneyCents, brazilDate } = require('../utils/paymentValidation');
const { manualRequestId } = require('../utils/manualPaymentRequest');
const { lockStudent } = require('../utils/membershipRenewal');
const { normalizePaymentAdjustment, adjustmentRequestHash, publicAdjustment, sameAdjustment,
  adjustmentSnapshot } = require('../utils/paymentAdjustment');

function createPaymentAdjustmentsService({ db = prisma, now = () => new Date() } = {}) {
  async function administrator(connection, actorId) {
    const actor = await connection.user.findUnique({ where: { id: paymentId(actorId, 'Responsável') },
      select: { id: true, role: true, active: true, name: true } });
    if (!actor || actor.role !== 'admin' || actor.active !== true) throw new AppError('Apenas administrador ativo pode registrar ou consultar ajustes.', 403);
    return actor;
  }
  return {
    async registrar(paymentValue, input, actorId) {
      const request = normalizePaymentAdjustment(paymentValue, input, actorId, now());
      const requestHash = adjustmentRequestHash(request);
      const target = await db.payment.findUnique({ where: { id: request.paymentId }, select: { studentId: true } });
      if (!target) throw new AppError('Pagamento não encontrado.', 404);
      try {
        return await db.$transaction(async tx => {
          // Primeiro read na transação após o lock: evita snapshot antigo do MariaDB.
          await lockStudent(tx, target.studentId);
          const actor = await administrator(tx, request.actorId);
          const previous = await tx.paymentAdjustment.findUnique({ where: { id: request.id } });
          if (previous) return sameAdjustment(previous, request, requestHash);
          const payment = await tx.payment.findUnique({ where: { id: request.paymentId }, include: { intent: true } });
          if (!payment || payment.studentId !== target.studentId) throw new AppError('Pagamento indisponível para este ajuste.', 409);
          if (payment.status !== 'paid') throw new AppError('Ajustes financeiros exigem recebimento confirmado.', 400);
          if (request.kind === 'correction' && payment.intent)
            throw new AppError('Recebimento de checkout não aceita correção manual. Devoluções devem ser registradas como informadas, sem executar o provedor.', 400);
          if (request.effectiveDate < new Date(payment.paymentDate) || request.effectiveDate > brazilDate(now()))
            throw new AppError('A data do ajuste deve estar entre o recebimento original e a data atual brasileira.', 400);
          const events = await tx.paymentAdjustment.findMany({ where: { paymentId: payment.id }, select: { amount: true } });
          const original = moneyCents(String(payment.amount));
          const adjusted = events.reduce((sum, event) => sum + moneyCents(String(event.amount)), 0);
          if (!Number.isSafeInteger(adjusted) || adjusted + request.amountCents > original)
            throw new AppError('O ajuste ultrapassa o saldo ainda não ajustado deste recebimento.', 409);
          const student = await tx.student.findUnique({ where: { id: target.studentId }, include: { user: { select: { active: true } } } });
          if (!student) throw new AppError('Aluno não encontrado.', 404);
          const before = adjustmentSnapshot(student), after = { ...before };
          if (request.membershipEffect === 'set_end_date') {
            if (!before.userActive || student.status === 'inactive')
              throw new AppError('Não altere a vigência de matrícula ou conta inativa neste fluxo.', 409);
            if (before.membershipRevision !== request.expectedMembershipRevision)
              throw new AppError('A vigência mudou. Recarregue e confira o vencimento antes de registrar o ajuste.', 409);
            if (before.planStartDate && request.newPlanEndDate.toISOString().slice(0, 10) < before.planStartDate)
              throw new AppError('O vencimento não pode ser anterior ao início do plano.', 400);
            after.planEndDate = request.newPlanEndDate.toISOString().slice(0, 10);
            after.membershipRevision++;
            if (!Number.isSafeInteger(after.membershipRevision) || after.membershipRevision > 2147483647)
              throw new AppError('Limite de revisões da vigência atingido.', 409);
          }
          const event = await tx.paymentAdjustment.create({ data: { id: request.id, requestHash, paymentId: payment.id,
            actorId: actor.id, actorName: String(actor.name || `Administrador #${actor.id}`).slice(0, 100),
            kind: request.kind, amount: request.amountCents / 100, reason: request.reason, effectiveDate: request.effectiveDate,
            membershipEffect: request.membershipEffect, membershipBefore: before, membershipAfter: after,
            providerRefundPerformed: false } });
          if (request.membershipEffect === 'set_end_date') await tx.student.update({ where: { id: student.id },
            data: { planEndDate: request.newPlanEndDate, membershipRevision: { increment: 1 } } });
          return publicAdjustment(event);
        });
      } catch (error) {
        // Reconcilia UUID global somente após rollback, sem repetir efeito financeiro.
        if (error.code === 'P2002') {
          await administrator(db, request.actorId);
          const previous = await db.paymentAdjustment.findUnique({ where: { id: request.id } });
          if (previous) return sameAdjustment(previous, request, requestHash);
        }
        throw error;
      }
    },
    async listar(paymentValue, actorId) {
      await administrator(db, actorId);
      const id = paymentId(paymentValue, 'Pagamento');
      if (!await db.payment.findUnique({ where: { id }, select: { id: true } })) throw new AppError('Pagamento não encontrado.', 404);
      return (await db.paymentAdjustment.findMany({ where: { paymentId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(publicAdjustment);
    },
    async buscarPorSolicitacao(requestValue, actorId) {
      await administrator(db, actorId);
      const event = await db.paymentAdjustment.findUnique({ where: { id: manualRequestId(requestValue) } });
      if (!event || event.actorId !== paymentId(actorId, 'Responsável')) throw new AppError('Ajuste não localizado para esta solicitação.', 404);
      return publicAdjustment(event);
    },
  };
}

module.exports = { ...createPaymentAdjustmentsService(), createPaymentAdjustmentsService };

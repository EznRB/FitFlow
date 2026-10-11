'use strict';
const { createHash } = require('node:crypto');
const AppError = require('./AppError');
const { manualRequestId } = require('./manualPaymentRequest');
const { paymentId, moneyCents, paymentDate, brazilDate } = require('./paymentValidation');

function normalizePaymentAdjustment(payment, input, actor, now) {
  const allowed = ['idempotencyKey', 'expectedActorId', 'kind', 'amount', 'reason', 'effectiveDate',
    'membershipEffect', 'expectedMembershipRevision', 'newPlanEndDate'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key)))
    throw new AppError('Dados de ajuste inválidos. Envie somente os campos do formulário.', 400);
  const actorId = paymentId(actor, 'Responsável'), paymentIdValue = paymentId(payment, 'Pagamento');
  const id = manualRequestId(input.idempotencyKey);
  if (input.expectedActorId !== undefined && paymentId(input.expectedActorId, 'Responsável esperado') !== actorId)
    throw new AppError('A sessão mudou. Recarregue a página antes de registrar o ajuste.', 403);
  if (!['correction', 'refund_recorded'].includes(input.kind)) throw new AppError('Tipo de ajuste inválido.', 400);
  const amountCents = moneyCents(input.amount);
  if (typeof input.reason !== 'string' || input.reason.trim().length < 10 || input.reason.length > 1000)
    throw new AppError('Informe o motivo do ajuste, com 10 a 1.000 caracteres.', 400);
  const reason = input.reason.trim(), requestedEffectiveDate = input.effectiveDate === undefined ? null : input.effectiveDate;
  const effectiveDate = requestedEffectiveDate === null ? brazilDate(now) : paymentDate(requestedEffectiveDate);
  const membershipEffect = input.membershipEffect === undefined ? 'preserve' : input.membershipEffect;
  if (!['preserve', 'set_end_date'].includes(membershipEffect)) throw new AppError('Efeito de vigência inválido.', 400);
  let expectedMembershipRevision = null, newPlanEndDate = null;
  if (membershipEffect === 'set_end_date') {
    if (!Number.isSafeInteger(input.expectedMembershipRevision) || input.expectedMembershipRevision < 0)
      throw new AppError('Confira a revisão atual da vigência antes de alterar o vencimento.', 400);
    expectedMembershipRevision = input.expectedMembershipRevision;
    newPlanEndDate = paymentDate(input.newPlanEndDate);
  } else if (Object.hasOwn(input, 'expectedMembershipRevision') || Object.hasOwn(input, 'newPlanEndDate'))
    throw new AppError('Para preservar a vigência, não envie revisão nem novo vencimento.', 400);
  return { id, actorId, paymentId: paymentIdValue, kind: input.kind, amountCents, reason, effectiveDate,
    requestedEffectiveDate, membershipEffect, expectedMembershipRevision, newPlanEndDate };
}

function adjustmentRequestHash(request) {
  // Datas/padrões dinâmicos omitidos permanecem omitidos no fingerprint do replay.
  return createHash('sha256').update(JSON.stringify(['payment-adjustment-v1', request.actorId, request.paymentId,
    request.kind, request.amountCents, request.reason, request.requestedEffectiveDate, request.membershipEffect,
    request.expectedMembershipRevision, request.newPlanEndDate?.toISOString().slice(0, 10) || null])).digest('hex');
}
function publicAdjustment(event) {
  const { requestHash, ...safe } = event;
  return { ...safe, amount: Number(event.amount) };
}
function sameAdjustment(event, request, requestHash) {
  if (event.id !== request.id || event.actorId !== request.actorId || event.requestHash !== requestHash)
    throw new AppError('Esta solicitação já foi utilizada com outros dados ou outro responsável.', 409);
  return publicAdjustment(event);
}
function civil(value) {
  if (value == null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AppError('Estado de vigência inválido. Confira o cadastro do aluno.', 409);
  return date.toISOString().slice(0, 10);
}
function adjustmentSnapshot(student) {
  if (!Number.isSafeInteger(student.membershipRevision) || student.membershipRevision < 0)
    throw new AppError('Revisão de vigência inválida. Confira o cadastro do aluno.', 409);
  return { planId: student.planId ?? null, planStartDate: civil(student.planStartDate), planEndDate: civil(student.planEndDate),
    status: student.status, membershipRevision: student.membershipRevision, userActive: student.user?.active === true };
}
function adjustmentSummary(payment, events = []) {
  const original = moneyCents(String(payment.amount));
  let correction = 0, refund = 0;
  for (const event of events) {
    const amount = moneyCents(String(event.amount));
    if (event.kind === 'correction') correction += amount;
    else if (event.kind === 'refund_recorded') refund += amount;
    else throw new AppError('Histórico de ajustes inválido. Conferência necessária.', 409);
  }
  const adjusted = correction + refund;
  if (!Number.isSafeInteger(adjusted) || adjusted > original) throw new AppError('Ajustes ultrapassam o valor do recebimento. Conferência necessária.', 409);
  return { originalAmount: original / 100, adjustedAmount: adjusted / 100, remainingAmount: (original - adjusted) / 100,
    correctionAmount: correction / 100, refundRecordedAmount: refund / 100 };
}

module.exports = { normalizePaymentAdjustment, adjustmentRequestHash, publicAdjustment, sameAdjustment,
  adjustmentSnapshot, adjustmentSummary };

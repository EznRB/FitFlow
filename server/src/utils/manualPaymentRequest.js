const { createHash } = require('node:crypto');
const AppError = require('./AppError');
function manualRequestId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError('Atualize a página e envie uma chave UUID válida para registrar o recebimento.', 400);
  }
  return value.toLowerCase();
}
function manualRequestHash(input, actorId) {
  return createHash('sha256').update(JSON.stringify(['manual-payment-v1', actorId, input.studentId, input.planId,
    input.amountCents, input.paymentMethod, input.paymentDate, input.notes])).digest('hex');
}
function sameManualRequest(payment, id, hash, actorId) {
  if (payment.manualRequestId !== id || payment.manualRequestHash !== hash || payment.registeredBy !== actorId) {
    throw new AppError('Esta solicitação já foi utilizada com outros dados ou outro responsável.', 409);
  }
  return payment;
}
module.exports = { manualRequestId, manualRequestHash, sameManualRequest };

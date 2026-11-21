const AppError = require('../utils/AppError');
const { paymentId } = require('../utils/paymentValidation');
const { validateBrickSubmission } = require('./mercado-pago-payment');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function purchaseView(intent) {
  const attempt = intent.attempts?.[0];
  return { id: intent.id, flow: intent.flow || 'legacy', state: intent.state, planId: intent.planId,
    planName: intent.plan?.name || '', amount: Number(intent.amount), durationDays: intent.durationDays, currency: intent.currency,
    settled: Boolean(intent.paymentId), requiresReview: intent.state === 'review', sandbox: true,
    paymentId: attempt?.providerPaymentId || intent.providerPaymentId || null, attemptState: attempt?.state || null,
    legacyUrl: intent.flow === 'brick' ? null : intent.checkoutUrl || null };
}
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new AppError('Dados de checkout inválidos.', 400);
}
function createCheckoutPurchaseService({ provider, legacyProvider = provider, repository, reconcile }) {
  function requireReady() {
    if (!provider.publicConfig?.().enabled || !repository.internalReady) throw new AppError('Pagamento interno indisponível. Consulte a administração.', 503);
  }
  function id(value) { if (typeof value !== 'string' || !UUID.test(value)) throw new AppError('ID de checkout inválido.', 400); return value; }
  return {
    async prepare(userId, data) {
      requireReady(); fields(data, ['planId']);
      const planId = paymentId(data.planId, 'ID do plano');
      await provider.ensureSandbox();
      return purchaseView(await repository.preparePurchase(userId, planId));
    },
    async purchase(userId, intentId) {
      requireReady(); await repository.getOwned(id(intentId), userId);
      const intent = await repository.getPurchase(intentId, userId);
      const attempt = intent.attempts?.[0];
      let payment;
      if (attempt?.providerPaymentId) payment = await provider.getPayment(attempt.providerPaymentId);
      else if (attempt && ['uncertain', 'processing'].includes(attempt.state)) payment = await provider.findAttemptPayment(intent.id, attempt.id);
      else if (!attempt && intent.providerPaymentId) payment = await (intent.flow === 'brick' ? provider : legacyProvider).getPayment(intent.providerPaymentId);
      else if (!attempt && intent.flow !== 'brick') payment = await legacyProvider.findPayment(intent.id);
      if (payment) {
        if (attempt && !attempt.providerPaymentId) await repository.recordPaymentAttempt(attempt.id, payment);
        await reconcile(payment);
        if (attempt) await repository.finishPaymentAttempt(attempt.id, payment);
      }
      return purchaseView(await repository.getPurchase(intentId, userId));
    },
    async submit(userId, intentId, data) {
      requireReady(); id(intentId); fields(data, ['attemptKey', 'brick']);
      if (typeof data.attemptKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(data.attemptKey)) throw new AppError('Chave de pagamento inválida.', 400);
      validateBrickSubmission(data.brick);
      const owned = await repository.getOwned(intentId, userId);
      if (owned.flow !== 'brick') throw new AppError('Uma compra anterior precisa ser resolvida antes de iniciar outro pagamento.', 409);
      await provider.ensureSandbox();
      const claim = await repository.claimPaymentAttempt(userId, intentId, data.attemptKey);
      if (!claim.claimed) return purchaseView(await repository.getPurchase(intentId, userId));
      try {
        const payment = await provider.createPayment(claim.intent, data.brick, claim.attempt.id);
        await repository.recordPaymentAttempt(claim.attempt.id, payment);
        await reconcile(payment);
        await repository.finishPaymentAttempt(claim.attempt.id, payment);
        return purchaseView(await repository.getPurchase(intentId, userId));
      } catch (error) {
        if (error.paymentNotCreated === true) await repository.rejectPaymentAttempt(claim.attempt.id);
        else await repository.markPaymentAttemptUncertain(claim.attempt.id);
        throw error;
      }
    }
  };
}
module.exports = { createCheckoutPurchaseService, purchaseView };

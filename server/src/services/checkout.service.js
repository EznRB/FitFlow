const AppError = require('../utils/AppError');
const { paymentId, moneyCents, paymentDate } = require('../utils/paymentValidation');
const { createMercadoPagoAdapter, providerId } = require('./mercado-pago.adapter');
const { createCheckoutRepository } = require('../repositories/checkout.repository');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PROVIDER_STATUSES = ['pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back'];
function checkoutId(id) { if (typeof id !== 'string' || !UUID.test(id)) throw new AppError('ID de checkout inválido.', 400); return id; }
function publicIntent(intent) {
  return { id: intent.id, state: intent.state, planId: intent.planId, amount: Number(intent.amount), currency: intent.currency,
    sandbox: true, checkoutUrl: intent.checkoutUrl || null, settled: Boolean(intent.paymentId), requiresReview: intent.state === 'review' };
}
function createCheckoutService({ provider = createMercadoPagoAdapter(), repository = createCheckoutRepository() } = {}) {
  function requireReady() { if (!provider.enabled || !repository.ready) throw new AppError('Checkout sandbox indisponível. Configure credenciais de teste, webhook e banco.', 503); }
  async function reconcile(payment) {
    if (typeof payment.external_reference !== 'string' || !UUID.test(payment.external_reference)) return { ignored: true };
    const intent = await repository.findById(payment.external_reference);
    if (!intent) return { ignored: true };
    if (payment.live_mode !== false || providerId(payment.collector_id) !== provider.sellerId || payment.currency_id !== 'BRL' ||
      moneyCents(payment.transaction_amount) !== moneyCents(String(intent.amount)) || payment.metadata?.fitflow_intent_id !== intent.id) {
      throw new AppError('Pagamento não corresponde à compra sandbox. Plano não liberado.', 409);
    }
    if (!PROVIDER_STATUSES.includes(payment.status)) throw new AppError('Status do provedor inválido.', 502);
    if (payment.status !== 'approved') return publicIntent(await repository.recordStatus(intent.id, payment));
    const refunded = payment.transaction_amount_refunded;
    const noRefund = refunded === undefined || (typeof refunded === 'number' && refunded === 0) ||
      (typeof refunded === 'string' && /^0(?:\.0{1,2})?$/.test(refunded));
    if (!noRefund || (payment.captured !== undefined && payment.captured !== true)) throw new AppError('Pagamento não está integralmente confirmado.', 409);
    if (typeof payment.date_approved !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(payment.date_approved)) throw new AppError('Confirmação de pagamento inválida.', 502);
    paymentDate(payment.date_approved.slice(0, 10));
    if (!Number.isFinite(new Date(payment.date_approved).getTime()) || new Date(payment.date_approved).getTime() > Date.now() + 300000) throw new AppError('Data da confirmação inválida.', 502);
    const method = payment.payment_method_id === 'pix' ? 'pix' : payment.payment_type_id === 'credit_card' ? 'cartao_credito' : payment.payment_type_id === 'debit_card' ? 'cartao_debito' : null;
    if (!method) throw new AppError('Método do sandbox não suportado para renovação.', 409);
    return publicIntent(await repository.settle(intent.id, payment, method));
  }
  return {
    status: () => ({ enabled: Boolean(provider.enabled && repository.ready), sandbox: true, methods: ['pix', 'card'] }),
    plans: () => { requireReady(); return repository.listPlans(); },
    async start(userId, data) {
      requireReady();
      if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['planId', 'idempotencyKey'].includes(key))) throw new AppError('Dados de checkout inválidos. Envie somente plano e chave de repetição.', 400);
      const planId = paymentId(data.planId, 'ID do plano');
      if (typeof data.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(data.idempotencyKey)) throw new AppError('Chave de repetição inválida.', 400);
      await provider.ensureSandbox();
      const { intent, planName } = await repository.createOrGet(userId, { planId, idempotencyKey: data.idempotencyKey });
      if (intent.checkoutUrl || intent.paymentId) return publicIntent(intent);
      if (!await repository.claimPreference(intent.id)) throw new AppError('Checkout em processamento ou resultado incerto. Consulte o status; nenhuma renovação foi confirmada.', 409);
      try { return publicIntent(await repository.savePreference(intent.id, await provider.createPreference(intent, planName))); }
      catch (error) { await repository.markUncertain(intent.id); throw error; }
    },
    async get(userId, id) {
      requireReady();
      const intent = await repository.getOwned(checkoutId(id), userId);
      const payment = intent.paymentId ? await provider.getPayment(intent.providerPaymentId) : await provider.findPayment(intent.id);
      if (payment) await reconcile(payment);
      return publicIntent(await repository.getOwned(id, userId));
    },
    async webhook({ query, headers, body }) {
      requireReady();
      const id = provider.verifyWebhook({ signature: headers['x-signature'], requestId: headers['x-request-id'], dataId: query['data.id'] });
      if (query.type !== 'payment' || body?.type !== 'payment' || typeof body?.data?.id !== 'string' || body.data.id !== id || body.live_mode !== false) throw new AppError('Notificação sandbox inválida.', 400);
      return reconcile(await provider.getPayment(id));
    }
  };
}
module.exports = { createCheckoutService, checkoutId };

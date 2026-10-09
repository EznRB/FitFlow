const { createHmac, timingSafeEqual } = require('node:crypto');
const AppError = require('../utils/AppError');

const CHECKOUT_HOSTS = new Set(['www.mercadopago.com.br', 'www.mercadopago.com', 'sandbox.mercadopago.com']);
function validCheckoutUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && CHECKOUT_HOSTS.has(url.hostname) && !url.username && !url.password && !url.port; } catch { return false; }
}
function readSandboxConfig(environment = process.env) {
  const config = { requested: environment.MP_SANDBOX_ENABLED === 'true', token: environment.MP_SANDBOX_ACCESS_TOKEN,
    secret: environment.MP_SANDBOX_WEBHOOK_SECRET, sellerId: environment.MP_SANDBOX_SELLER_ID,
    buyerEmail: environment.MP_SANDBOX_BUYER_EMAIL, baseUrl: environment.MP_SANDBOX_PUBLIC_URL };
  let validUrl = false;
  try { const url = new URL(config.baseUrl); validUrl = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash; } catch {}
  config.enabled = config.requested && typeof config.token === 'string' && /^(?:TEST-|APP_USR-)[A-Za-z0-9-]+$/.test(config.token) &&
    typeof config.secret === 'string' && config.secret.length >= 32 && /^[1-9]\d{0,19}$/.test(config.sellerId || '') &&
    /^test_user_[A-Za-z0-9_]+@testuser\.com$/.test(config.buyerEmail || '') && validUrl;
  return config;
}
function verifyWebhook({ signature, requestId, dataId }, secret, now = Date.now()) {
  if (typeof signature !== 'string' || typeof requestId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(requestId) || typeof dataId !== 'string' || !/^[1-9]\d{0,19}$/.test(dataId)) throw new AppError('Notificação inválida.', 401);
  const match = /^ts=(\d{10}|\d{13}),v1=([a-fA-F0-9]{64})$/.exec(signature);
  if (!match) throw new AppError('Assinatura da notificação inválida.', 401);
  const timestamp = Number(match[1]) * (match[1].length === 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) throw new AppError('Notificação expirada.', 401);
  const expected = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${match[1]};`).digest();
  if (!timingSafeEqual(expected, Buffer.from(match[2], 'hex'))) throw new AppError('Assinatura da notificação inválida.', 401);
  return dataId;
}
function providerId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value;
  throw new AppError('Resposta de pagamento inválida.', 502);
}
function createMercadoPagoAdapter({ config = readSandboxConfig(), fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  let sellerVerifiedAt = 0;
  function requireEnabled() { if (!config.enabled) throw new AppError('Checkout sandbox indisponível. Configure as credenciais de teste e o webhook.', 503); }
  async function request(path, options = {}) {
    requireEnabled();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`https://api.mercadopago.com${path}`, { ...options, signal: controller.signal, redirect: 'error',
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', ...options.headers } });
      if (!response.ok) throw new AppError('Mercado Pago indisponível para este teste. Nenhum plano foi liberado.', 502);
      return await response.json();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Falha ao consultar Mercado Pago. A confirmação permanece pendente.', 502);
    } finally { clearTimeout(timer); }
  }
  async function ensureSandbox() {
    requireEnabled();
    if (Date.now() - sellerVerifiedAt < 60000) return;
    const seller = await request('/users/me');
    if (providerId(seller.id) !== config.sellerId || !['BR', 'MLB'].includes(seller.country_id || seller.site_id) ||
      (config.token.startsWith('APP_USR-') && (!Array.isArray(seller.tags) || !seller.tags.includes('test_user')))) {
      throw new AppError('A credencial não pertence ao vendedor de teste configurado. Checkout bloqueado.', 503);
    }
    sellerVerifiedAt = Date.now();
  }
  return {
    enabled: config.enabled,
    sellerId: config.sellerId,
    buyerEmail: config.buyerEmail,
    ensureSandbox,
    verifyWebhook: data => { requireEnabled(); return verifyWebhook(data, config.secret); },
    async createPreference(intent, planName) {
      await ensureSandbox();
      const base = config.baseUrl.replace(/\/$/, '');
      const preference = await request('/checkout/preferences', { method: 'POST', headers: { 'X-Idempotency-Key': intent.id }, body: JSON.stringify({
        items: [{ id: String(intent.planId), title: `FitFlow — ${planName}`, quantity: 1, currency_id: 'BRL', unit_price: Number(intent.amount) }],
        payer: { email: config.buyerEmail }, external_reference: intent.id, metadata: { fitflow_intent_id: intent.id },
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }] },
        notification_url: `${base}/api/checkout/webhook`,
        back_urls: { success: `${base}/?checkout_intent=${intent.id}`, pending: `${base}/?checkout_intent=${intent.id}`, failure: `${base}/?checkout_intent=${intent.id}` },
        auto_return: 'approved'
      }) });
      const checkoutUrl = config.token.startsWith('TEST-') ? preference.sandbox_init_point : preference.init_point;
      if (typeof preference.id !== 'string' || preference.id.length > 100 || !validCheckoutUrl(checkoutUrl) || providerId(preference.collector_id) !== config.sellerId) throw new AppError('Resposta de checkout inválida. Checkout bloqueado.', 502);
      if (config.token.startsWith('TEST-') && new URL(checkoutUrl).hostname !== 'sandbox.mercadopago.com') throw new AppError('URL de teste inválida.', 502);
      return { preferenceId: preference.id, checkoutUrl };
    },
    async getPayment(id) {
      await ensureSandbox();
      const payment = await request(`/v1/payments/${providerId(id)}`);
      if (providerId(payment.id) !== providerId(id) || payment.live_mode !== false || providerId(payment.collector_id) !== config.sellerId) throw new AppError('Pagamento fora do sandbox ou vendedor incorreto. Plano não liberado.', 409);
      return payment;
    },
    async findPayment(intentId) {
      await ensureSandbox();
      const data = await request(`/v1/payments/search?external_reference=${encodeURIComponent(intentId)}&sort=date_created&criteria=desc&limit=20`);
      if (!Array.isArray(data.results)) throw new AppError('Consulta de pagamentos inválida.', 502);
      const result = data.results.find(p => p.external_reference === intentId && p.status === 'approved') || data.results.find(p => p.external_reference === intentId);
      return result ? this.getPayment(result.id) : null;
    }
  };
}
module.exports = { createMercadoPagoAdapter, readSandboxConfig, verifyWebhook, validCheckoutUrl, providerId };

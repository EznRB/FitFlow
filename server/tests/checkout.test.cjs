const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { createMercadoPagoAdapter, readSandboxConfig, verifyWebhook } = require('../src/services/mercado-pago.adapter');
const { createCheckoutService } = require('../src/services/checkout.service');
const { createCheckoutRouter } = require('../src/routes/checkout.routes');
const express = require('express');

const secret = 'only-test-webhook-secret-abcdefghijklmnopqrstuvwxyz';
const id = '11111111-1111-4111-8111-111111111111';
const config = { enabled: true, token: 'APP_USR-only-test-value', secret, sellerId: '123', buyerEmail: 'test_user_buyer@testuser.com', baseUrl: 'https://fitflow.example' };
const response = body => new Response(JSON.stringify(body), { status: 200 });
const signed = (dataId = '999', ts = String(Math.floor(Date.now() / 1000))) => {
  const requestId = 'test-request-1';
  const signature = `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex')}`;
  return { signature, requestId, dataId };
};
const approved = () => ({ id: 999, live_mode: false, collector_id: 123, currency_id: 'BRL', status: 'approved', transaction_amount: '150.00',
  external_reference: id, metadata: { fitflow_intent_id: id }, payment_type_id: 'credit_card', payment_method_id: 'visa', date_approved: new Date().toISOString(), transaction_amount_refunded: 0 });

test('sandbox exige configuração e conta teste; conta real não cria preferência', async () => {
  assert.equal(readSandboxConfig({}).enabled, false);
  let calls = 0;
  const disabled = createMercadoPagoAdapter({ config: readSandboxConfig({}), fetchImpl: async () => { calls++; } });
  await assert.rejects(disabled.createPreference({ id }), e => e.statusCode === 503); assert.equal(calls, 0);
  const real = createMercadoPagoAdapter({ config, fetchImpl: async () => { calls++; return response({ id: 123, country_id: 'BR', tags: ['normal'] }); } });
  await assert.rejects(real.createPreference({ id }), e => e.statusCode === 503); assert.equal(calls, 1);
});
test('adapta Checkout Pro atual com conta APP_USR teste, sem dados de cartão/PII', async () => {
  const requests = [];
  const adapter = createMercadoPagoAdapter({ config, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/users/me')) return response({ id: 123, country_id: 'BR', tags: ['test_user'] });
    return response({ id: 'preference1', collector_id: 123, init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference1' });
  } });
  const result = await adapter.createPreference({ id, planId: 2, amount: 150 }, 'Plano teste');
  assert.match(result.checkoutUrl, /^https:\/\/www.mercadopago/);
  const payload = JSON.parse(requests[1].options.body);
  assert.deepEqual(payload.payer, { email: config.buyerEmail }); assert.equal(payload.external_reference, id);
  assert.equal(payload.metadata.fitflow_intent_id, id); assert.equal(payload.items[0].unit_price, 150);
  assert.equal(payload.card, undefined); assert.equal(payload.token, undefined); assert.equal(payload.userId, undefined);
  assert.equal(requests[1].options.headers.Authorization, `Bearer ${config.token}`);
  const malicious = createMercadoPagoAdapter({ config, fetchImpl: async url => response(url.endsWith('/users/me') ? { id: 123, country_id: 'BR', tags: ['test_user'] } : { id: 'preference1', collector_id: 123, init_point: 'https://evil.example' }) });
  await assert.rejects(malicious.createPreference({ id, planId: 2, amount: 150 }, 'Plano'), e => e.statusCode === 502);
});
test('assinatura valida ID assinado, request ID, timestamp e HMAC sem aceitar replay antigo', () => {
  assert.equal(verifyWebhook(signed(), secret), '999');
  for (const bad of [{ ...signed(), dataId: '998' }, { ...signed(), requestId: 'other-request' }, { ...signed(), dataId: ['999'] }, signed('999', String(Math.floor(Date.now() / 1000) - 1000))]) assert.throws(() => verifyWebhook(bad, secret));
  assert.equal(verifyWebhook(signed('999', String(Date.now())), secret), '999');
});

function workflow() {
  let intent = { id, planId: 2, studentId: 11, amount: 150, durationDays: 30, currency: 'BRL', state: 'created' };
  let preferences = 0; let settled = 0; let fetched = 0;
  const repository = { ready: true, createOrGet: async () => ({ intent, planName: 'Plano' }), claimPreference: async () => { if (intent.state !== 'created') return false; intent.state = 'creating'; return true; },
    savePreference: async (key, data) => intent = { ...intent, ...data, state: 'pending' }, markUncertain: async () => { intent.state = 'uncertain'; },
    getOwned: async (key, userId) => { if (key !== id || userId !== 7) throw Object.assign(new Error('Não encontrado'), { statusCode: 404 }); return intent; }, findById: async key => key === id ? intent : null,
    recordStatus: async (key, payment) => intent = { ...intent, lastProviderStatus: payment.status, state: intent.paymentId ? intent.state : 'pending' },
    settle: async (key, payment) => { if (!intent.paymentId) { settled++; intent = { ...intent, state: 'paid', paymentId: 1, providerPaymentId: String(payment.id) }; } return intent; } };
  const provider = { enabled: true, sellerId: '123', ensureSandbox: async () => {}, createPreference: async () => { preferences++; return { preferenceId: 'pref1', checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref1' }; },
    verifyWebhook: data => verifyWebhook(data, secret), getPayment: async () => { fetched++; return provider.payment; }, findPayment: async () => provider.payment, payment: approved() };
  const service = createCheckoutService({ provider, repository });
  const event = () => { const data = signed(); return { query: { 'data.id': data.dataId, type: 'payment' }, headers: { 'x-signature': data.signature, 'x-request-id': data.requestId }, body: { live_mode: false, type: 'payment', data: { id: '999' }, status: 'approved' } }; };
  return { service, provider, repository, event, get intent() { return intent; }, get preferences() { return preferences; }, get settled() { return settled; }, get fetched() { return fetched; } };
}
test('checkout idempotente nunca confirma por redirect/corpo cliente; owner e payload estritos', async () => {
  const w = workflow(); const data = { planId: 2, idempotencyKey: 'idempotency-test-123' };
  await w.service.start(7, data); await w.service.start(7, data);
  assert.equal(w.preferences, 1); assert.equal(w.settled, 0);
  for (const extra of [{ amount: 1 }, { studentId: 99 }, { status: 'approved' }, { card: 'should-not-store' }]) await assert.rejects(w.service.start(7, { ...data, ...extra }), e => e.statusCode === 400);
  await assert.rejects(w.service.get(8, id), e => e.statusCode === 404); assert.equal(w.settled, 0);
  const event = w.event(); event.body.status = 'approved'; w.provider.payment = { ...approved(), status: 'pending' };
  await w.service.webhook(event); assert.equal(w.settled, 0); assert.equal(w.fetched, 1);
  w.provider.payment = approved(); await w.service.webhook(w.event()); await w.service.webhook(w.event());
  assert.equal(w.settled, 1); assert.equal(w.intent.state, 'paid'); assert.equal(w.fetched, 3);
});
test('conciliação rejeita dinheiro real, valor/moeda/referência/vendedor/metadados e pagamento incompleto', async () => {
  for (const changed of [{ live_mode: true }, { collector_id: 777 }, { transaction_amount: '1.00' }, { currency_id: 'USD' },
    { metadata: {} }, { status: null }, { status: 'unknown' }, { captured: false }, { captured: 'true' },
    { transaction_amount_refunded: 1 }, { transaction_amount_refunded: [] }, { transaction_amount_refunded: false }, { date_approved: '2026-02-30T10:00:00Z' }]) {
    const w = workflow(); w.provider.payment = { ...approved(), ...changed };
    await assert.rejects(w.service.webhook(w.event())); assert.equal(w.settled, 0);
  }
  const w = workflow(); w.provider.payment = { ...approved(), external_reference: '22222222-2222-4222-8222-222222222222' };
  await w.service.webhook(w.event()); assert.equal(w.settled, 0);
  const event = w.event(); event.body.data.id = '998'; await assert.rejects(w.service.webhook(event), e => e.statusCode === 400);
});
test('falha incerta ao criar preferência bloqueia recriação automática com a mesma chave', async () => {
  const w = workflow(); let attempts = 0;
  w.provider.createPreference = async () => { attempts++; throw Object.assign(new Error('Timeout'), { statusCode: 502 }); };
  const data = { planId: 2, idempotencyKey: 'idempotency-test-123' };
  await assert.rejects(w.service.start(7, data)); await assert.rejects(w.service.start(7, data), e => e.statusCode === 409);
  assert.equal(attempts, 1); assert.equal(w.intent.state, 'uncertain'); assert.equal(w.settled, 0);
});
test('HTTP mantém status de configuração, ownership, assinatura e autorização', async t => {
  const w = workflow(); let role = 'student';
  const app = express(); app.use(express.json());
  app.use('/checkout', createCheckoutRouter({ service: w.service, authenticate: (req, res, next) => { if (!req.headers.authorization) return res.sendStatus(401); req.user = { id: 7, role }; next(); } }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/checkout`;
  assert.equal((await fetch(`${url}/status`)).status, 401);
  role = 'admin'; assert.equal((await fetch(`${url}/status`, { headers: { authorization: 'session' } })).status, 403);
  role = 'student'; w.provider.enabled = false;
  assert.equal((await fetch(`${url}/intents`, { method: 'POST', headers: { authorization: 'session', 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 2, idempotencyKey: 'test-idempotency-key' }) })).status, 503);
  w.provider.enabled = true;
  assert.equal((await fetch(`${url}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
});

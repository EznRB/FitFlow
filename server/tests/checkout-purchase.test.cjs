const test = require('node:test');
const assert = require('node:assert/strict');
const { createCheckoutPurchaseService } = require('../src/services/checkout-purchase.service');
const id = '11111111-1111-4111-8111-111111111111';
const brick = () => ({ selectedPaymentMethod: 'bank_transfer', formData: { payment_method_id: 'pix', payer: { identification: { type: 'CPF', number: '12345678909' } } } });
function workflow() {
  let intent = { id, flow: 'brick', state: 'created', studentId: 1, planId: 2, amount: '150.00', durationDays: 30, currency: 'BRL', plan: { name: 'Plano' } };
  let attempt; let calls = 0; let reconciled = 0;
  const repository = {
    internalReady: true, preparePurchase: async () => intent,
    getOwned: async (key, user) => { if (key !== id || user !== 7) throw Object.assign(Error(), { statusCode: 404 }); return intent; },
    claimPaymentAttempt: async (user, key, requestKey) => {
      if (intent.flow !== 'brick') throw Object.assign(Error(), { statusCode: 409 });
      if (attempt) return { attempt, intent, claimed: false };
      attempt = { id: 'attempt-11111111-1111', requestKey, state: 'processing' };
      return { intent, attempt, claimed: true };
    },
    recordPaymentAttempt: async (key, payment) => { attempt.providerPaymentId = String(payment.id); attempt.state = 'pending'; },
    markPaymentAttemptUncertain: async () => { attempt.state = 'uncertain'; },
    rejectPaymentAttempt: async () => { attempt.state = 'rejected'; },
    finishPaymentAttempt: async (key, payment) => { attempt.state = payment.status; },
    getPurchase: async () => ({ ...intent, attempts: attempt ? [attempt] : [] })
  };
  const provider = { publicConfig: () => ({ enabled: true }), ensureSandbox: async () => {}, createPayment: async () => {
    calls++; return { id: 456, status: 'pending' };
  } };
  const service = createCheckoutPurchaseService({ provider, repository, reconcile: async () => { reconciled++; } });
  return { service, provider, repository, get intent() { return intent; }, get attempt() { return attempt; }, get calls() { return calls; }, get reconciled() { return reconciled; } };
}

test('preparação não cria cobrança e recusa preço fornecido pelo cliente', async () => {
  const w = workflow();
  assert.equal((await w.service.prepare(7, { planId: 2 })).amount, 150);
  assert.equal(w.calls, 0);
  await assert.rejects(w.service.prepare(7, { planId: 2, amount: 1 }), e => e.statusCode === 400);
});

test('pendência sobrevive a novas chaves e não cria segunda cobrança', async () => {
  const w = workflow();
  const data = { attemptKey: 'request-key-11111111', brick: brick() };
  const first = await w.service.submit(7, id, data);
  const repeated = await w.service.submit(7, id, { ...data, attemptKey: 'request-key-22222222' });
  assert.equal(w.calls, 1); assert.equal(w.reconciled, 1);
  assert.equal(first.paymentId, '456'); assert.equal(repeated.paymentId, '456');
});

test('timeout fica incerto e nova chave não reenvia pagamento', async () => {
  const w = workflow();
  w.provider.createPayment = async () => { throw Error('timeout'); };
  await assert.rejects(w.service.submit(7, id, { attemptKey: 'request-key-11111111', brick: brick() }));
  assert.equal(w.attempt.state, 'uncertain');
  const result = await w.service.submit(7, id, { attemptKey: 'request-key-22222222', brick: brick() });
  assert.equal(result.attemptState, 'uncertain');
});

test('ownership e preferências legadas impedem envio ao provedor', async () => {
  const w = workflow(); const data = { attemptKey: 'request-key-11111111', brick: brick() };
  await assert.rejects(w.service.submit(8, id, data), e => e.statusCode === 404);
  w.intent.flow = 'legacy';
  await assert.rejects(w.service.submit(7, id, data), e => e.statusCode === 409);
  assert.equal(w.calls, 0);
});

test('consulta recupera pagamento de tentativa incerta sem reenviar token', async () => {
  const w = workflow();
  w.provider.createPayment = async () => { throw Error('timeout'); };
  await assert.rejects(w.service.submit(7, id, { attemptKey: 'request-key-11111111', brick: brick() }));
  let searched = 0;
  w.provider.findAttemptPayment = async (intentId, attemptId) => {
    assert.equal(intentId, id); assert.equal(attemptId, w.attempt.id); searched++; return { id: 456, status: 'pending' };
  };
  const recovered = await w.service.purchase(7, id);
  assert.equal(searched, 1); assert.equal(recovered.paymentId, '456'); assert.equal(w.reconciled, 1);
});

test('consulta legada busca pagamento mesmo sem webhook anterior', async () => {
  const w = workflow(); w.intent.flow = 'legacy';
  let searched = 0; w.provider.findPayment = async key => { assert.equal(key, id); searched++; return { id: 456, status: 'approved' }; };
  await w.service.purchase(7, id);
  assert.equal(searched, 1); assert.equal(w.reconciled, 1);
});

test('rejeição definitiva sem cobrança permite recuperação em vez de estado incerto', async () => {
  const w = workflow(); w.provider.createPayment = async () => { throw Object.assign(Error('token inválido'), { paymentNotCreated: true }); };
  await assert.rejects(w.service.submit(7, id, { attemptKey: 'request-key-11111111', brick: brick() }));
  assert.equal(w.attempt.state, 'rejected');
});

test('rotas do checkout interno usam o aluno autenticado e expõem configuração sem cache', async t => {
  globalThis.prisma ||= {};
  const express = require('express');
  const { createCheckoutRouter } = require('../src/routes/checkout.routes');
  const app = express(); app.use(express.json());
  app.use('/checkout', createCheckoutRouter({ authenticate: (req, res, next) => { req.user = { id: 7, role: 'student' }; next(); }, service: {
    config: () => ({ enabled: true, publicKey: 'TEST-public' }),
    prepare: async (userId, body) => { assert.equal(userId, 7); assert.equal(body.planId, 2); return { id }; },
    purchase: async (userId, key) => { assert.equal(userId, 7); assert.equal(key, id); return { id }; },
    submit: async (userId, key, body) => { assert.equal(userId, 7); assert.equal(key, id); assert.equal(body.attemptKey, 'request-key-11111111'); return { id }; }
  } }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/checkout/`;
  const configResponse = await fetch(base + 'config');
  assert.equal(configResponse.status, 200); assert.match(configResponse.headers.get('cache-control'), /no-store/);
  for (const [route, body] of [['purchases', { planId: 2 }], [`intents/${id}/payments`, { attemptKey: 'request-key-11111111' }]]) {
    assert.equal((await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 201);
  }
  assert.equal((await fetch(base + `purchases/${id}`)).status, 200);
});

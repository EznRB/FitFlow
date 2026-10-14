const test = require('node:test');
const assert = require('node:assert/strict');
const { createMercadoPagoAdapter } = require('../src/services/mercado-pago.adapter');
const { createCheckoutService } = require('../src/services/checkout.service');

const config = { enabled: true, token: 'APP_USR-test-only', secret: 'test-only-secret-abcdefghijklmnopqrstuvwxyz',
  sellerId: '123', buyerEmail: 'test_user_buyer@testuser.com', baseUrl: 'https://fitflow.example' };
const seller = { id: 123, country_id: 'BR', tags: ['test_user'] };
const response = data => ({ ok: true, json: async () => data });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function observeDeadline(operation) {
  let timer;
  try {
    return await Promise.race([
      operation.then(value => ({ state: 'fulfilled', value }), error => ({ state: 'rejected', error })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ state: 'still-running' }), 300); })
    ]);
  } finally { clearTimeout(timer); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('HTTP 200 tardio é recusado mesmo se fetch ignorar abort; vendedor não fica em cache', async t => {
  const lateResponse = deferred(); t.after(() => lateResponse.resolve(response(seller)));
  let accountCalls = 0; let lateBodyReads = 0; let firstSignal;
  const adapter = createMercadoPagoAdapter({ config, timeoutMs: 20, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.mercadopago.com/users/me');
    accountCalls++;
    if (accountCalls === 1) { firstSignal = options.signal; return lateResponse.promise; }
    return response(seller);
  } });
  const outcome = await observeDeadline(adapter.ensureSandbox());
  assert.equal(outcome.state, 'rejected', 'deadline deve encerrar a chamada sem depender do fetch');
  assert.equal(outcome.error.statusCode, 502);
  assert.equal(firstSignal.aborted, true);
  lateResponse.resolve({ ok: true, json: async () => { lateBodyReads++; return seller; } });
  await flush();
  await adapter.ensureSandbox();
  assert.equal(accountCalls, 2, 'resposta tardia não pode verificar/cachear o vendedor');
  assert.equal(lateBodyReads, 0, 'corpo tardio não deve ser consumido');
});

test('corpo JSON que nunca resolve é recusado dentro do mesmo prazo total', async () => {
  const adapter = createMercadoPagoAdapter({ config, timeoutMs: 20, fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }) });
  const outcome = await observeDeadline(adapter.ensureSandbox());
  assert.equal(outcome.state, 'rejected', 'deadline deve incluir a leitura do corpo');
  assert.equal(outcome.error.statusCode, 502);
});

test('preferência com corpo tardio mantém intenção incerta sem salvar checkout nem renovar', async t => {
  const lateBody = deferred();
  const preference = { id: 'preference1', collector_id: 123, init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference1' };
  t.after(() => lateBody.resolve(preference));
  let preferenceCalls = 0; let saved = 0; let settled = 0;
  const provider = createMercadoPagoAdapter({ config, timeoutMs: 20, fetchImpl: async url => {
    if (url.endsWith('/users/me')) return response(seller);
    assert.equal(url, 'https://api.mercadopago.com/checkout/preferences'); preferenceCalls++;
    return { ok: true, json: () => lateBody.promise };
  } });
  const intent = { id: '11111111-1111-4111-8111-111111111111', planId: 2, amount: 150, state: 'created' };
  const repository = { ready: true, createOrGet: async () => ({ intent, planName: 'Plano' }),
    claimPreference: async () => { if (intent.state !== 'created') return false; intent.state = 'creating'; return true; },
    savePreference: async () => { saved++; return intent; }, markUncertain: async () => { intent.state = 'uncertain'; },
    settle: async () => { settled++; } };
  const service = createCheckoutService({ provider, repository });
  const data = { planId: 2, idempotencyKey: 'idempotency-test-123' };
  const outcome = await observeDeadline(service.start(7, data));
  assert.equal(outcome.state, 'rejected'); assert.equal(outcome.error.statusCode, 502);
  assert.equal(intent.state, 'uncertain');
  lateBody.resolve(preference); await flush();
  assert.equal(saved, 0); assert.equal(settled, 0);
  await assert.rejects(service.start(7, data), error => error.statusCode === 409);
  assert.equal(preferenceCalls, 1, 'resultado incerto não deve disparar tentativa automática');
});

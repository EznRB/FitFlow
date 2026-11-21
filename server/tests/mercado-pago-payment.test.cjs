const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBrickSubmission, buildPaymentPayload } = require('../src/services/mercado-pago-payment');
const card = () => ({ selectedPaymentMethod: 'credit_card', formData: { token: 'card-token-fixture',
  transaction_amount: 1, installments: 1, payment_method_id: 'visa', issuer_id: '123',
  payer: { email: 'untrusted@example.invalid', identification: { type: 'CPF', number: '12345678909' } } } });
const intent = { id: 'intent-fixture', amount: '150.00', planId: 2, durationDays: 30 };
const config = { buyerEmail: 'test_user_buyer@testuser.com', baseUrl: 'https://fitflow.example' };
const { createMercadoPagoAdapter } = require('../src/services/mercado-pago.adapter');
const { readSandboxConfig } = require('../src/services/mercado-pago.adapter');

test('cartão usa preço, comprador, referência e notificação confiáveis do servidor', () => {
  const payload = buildPaymentPayload(intent, validateBrickSubmission(card()), config);
  assert.equal(payload.transaction_amount, 150);
  assert.equal(payload.payer.email, config.buyerEmail);
  assert.equal(payload.external_reference, intent.id);
  assert.equal(payload.metadata.fitflow_intent_id, intent.id);
  assert.equal(payload.notification_url, 'https://fitflow.example/api/checkout/webhook');
  assert.equal(payload.token, 'card-token-fixture');
  assert.equal(payload.installments, 1);
  assert.equal(payload.issuer_id, '123');
});

test('Pix não exige nem envia campos exclusivos de cartão', () => {
  const data = { selectedPaymentMethod: 'bank_transfer', formData: { payment_method_id: 'pix',
    payer: { identification: { type: 'CPF', number: '12345678909' } } } };
  const payload = buildPaymentPayload(intent, validateBrickSubmission(data), config);
  assert.equal(payload.payment_method_id, 'pix');
  for (const field of ['token', 'installments', 'issuer_id']) assert.equal(Object.hasOwn(payload, field), false);
});

test('Pix aceita o formulário mínimo oficial com somente e-mail do pagador', () => {
  const submission = validateBrickSubmission({ selectedPaymentMethod: 'bank_transfer', formData: { payment_method_id: 'pix', transaction_amount: 1, payer: { email: 'buyer@example.invalid' } } });
  const payload = buildPaymentPayload(intent, submission, config);
  assert.equal(payload.payer.email, config.buyerEmail);
  assert.equal(Object.hasOwn(payload.payer, 'identification'), false);
});

test('payload adulterado, método não suportado e dados crus são recusados', () => {
  for (const field of ['collector_id', 'external_reference', 'metadata', 'notification_url', 'card_number', 'security_code']) {
    const data = card(); data.formData[field] = 'injected';
    assert.throws(() => validateBrickSubmission(data), e => e.statusCode === 400);
  }
  for (const change of [{ installments: 2 }, { token: '' }, { payment_method_id: 'pix' }, { issuer_id: '../123' }]) {
    const data = card(); Object.assign(data.formData, change);
    assert.throws(() => validateBrickSubmission(data), e => e.statusCode === 400);
  }
  assert.throws(() => validateBrickSubmission({ ...card(), selectedPaymentMethod: 'ticket' }), e => e.statusCode === 400);
  assert.throws(() => validateBrickSubmission(null), e => e.statusCode === 400);
});

test('nomes camelCase do SDK são normalizados sem aceitar aliases conflitantes', () => {
  const data = card();
  data.formData.paymentMethodId = data.formData.payment_method_id; delete data.formData.payment_method_id;
  data.formData.issuerId = data.formData.issuer_id; delete data.formData.issuer_id;
  assert.equal(validateBrickSubmission(data).payment_method_id, 'visa');
  data.formData.payment_method_id = 'master';
  assert.throws(() => validateBrickSubmission(data), e => e.statusCode === 400);
});

test('adaptador cria pagamento com idempotência e valida resposta de teste', async () => {
  let sent;
  const adapter = createMercadoPagoAdapter({ config: { ...config, enabled: true, token: 'APP_USR-fixture', sellerId: '123' }, fetchImpl: async (url, options) => {
    if (url.endsWith('/users/me')) return { ok: true, json: async () => ({ id: 123, country_id: 'BR', tags: ['test_user'] }) };
    assert.equal(url, 'https://api.mercadopago.com/v1/payments');
    sent = { headers: options.headers, payload: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ id: 456, collector_id: 123, live_mode: false, external_reference: intent.id }) };
  } });
  const payment = await adapter.createPayment(intent, card(), 'attempt-key-fixture');
  assert.equal(sent.headers['X-Idempotency-Key'], 'attempt-key-fixture');
  assert.equal(sent.payload.transaction_amount, 150);
  assert.equal(sent.payload.metadata.fitflow_attempt_id, 'attempt-key-fixture');
  assert.equal(payment.id, 456);
});

test('busca incerta só recupera pagamento com identidade da mesma tentativa', async () => {
  let lookup;
  const adapter = createMercadoPagoAdapter({ config: { ...config, enabled: true, token: 'APP_USR-fixture', sellerId: '123' }, fetchImpl: async url => {
    if (url.endsWith('/users/me')) return { ok: true, json: async () => ({ id: 123, country_id: 'BR', tags: ['test_user'] }) };
    if (url.includes('/search?')) return { ok: true, json: async () => ({ results: [
      { id: 111, external_reference: intent.id, metadata: { fitflow_attempt_id: 'old-attempt' } },
      { id: 456, external_reference: intent.id, metadata: { fitflow_attempt_id: 'attempt-key-fixture' } }
    ] }) };
    lookup = url;
    return { ok: true, json: async () => ({ id: 456, collector_id: 123, live_mode: false, external_reference: intent.id, metadata: { fitflow_attempt_id: 'attempt-key-fixture' } }) };
  } });
  assert.equal((await adapter.findAttemptPayment(intent.id, 'attempt-key-fixture')).id, 456);
  assert.equal(lookup, 'https://api.mercadopago.com/v1/payments/456');
});

test('adaptador recusa resposta de cobrança real antes de retorná-la à conciliação', async () => {
  const adapter = createMercadoPagoAdapter({ config: { ...config, enabled: true, token: 'APP_USR-fixture', sellerId: '123' }, fetchImpl: async url => ({ ok: true,
    json: async () => url.endsWith('/users/me') ? { id: 123, country_id: 'BR', tags: ['test_user'] }
      : { id: 456, collector_id: 123, live_mode: true, external_reference: intent.id } }) });
  await assert.rejects(adapter.createPayment(intent, card(), 'attempt-key-fixture'), e => e.statusCode === 409);
});

test('configuração pública exige chave pública e não revela token nem segredo', () => {
  const enabled = { ...config, enabled: true, publicKey: 'APP_USR-public-key-fixture', token: 'APP_USR-private', secret: 'private-webhook' };
  const adapter = createMercadoPagoAdapter({ config: enabled });
  assert.deepEqual(adapter.publicConfig(), { enabled: true, publicKey: enabled.publicKey, buyerEmail: config.buyerEmail, sandbox: true });
  const disabled = createMercadoPagoAdapter({ config: { ...enabled, publicKey: undefined } });
  assert.deepEqual(disabled.publicConfig(), { enabled: false, publicKey: null, buyerEmail: null, sandbox: true });
  assert.equal(readSandboxConfig({ MP_SANDBOX_PUBLIC_KEY: enabled.publicKey }).publicKey, enabled.publicKey);
});

test('somente erros documentados de token sem recurso criado liberam nova tentativa', async () => {
  for (const [code, definitive] of [[2006, true], [3003, true], [2007, false], [2001, false]]) {
    const adapter = createMercadoPagoAdapter({ config: { ...config, enabled: true, token: 'APP_USR-fixture', sellerId: '123' }, fetchImpl: async url => url.endsWith('/users/me')
      ? { ok: true, json: async () => ({ id: 123, country_id: 'BR', tags: ['test_user'] }) }
      : { ok: false, status: 400, json: async () => ({ status: 400, error: 'bad_request', cause: [{ code }] }) } });
    await assert.rejects(adapter.createPayment(intent, card(), 'attempt-key-fixture'), e => Boolean(e.paymentNotCreated) === definitive);
  }
});

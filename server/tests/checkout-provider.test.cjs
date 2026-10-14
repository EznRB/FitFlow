const test = require('node:test');
const assert = require('node:assert/strict');
const { createCheckoutService } = require('../src/services/checkout.service');
const { createMercadoPagoAdapter, readSandboxConfig } = require('../src/services/mercado-pago.adapter');

test('status identifica provedor real e diferencia Pix QR/pendente de liquidação sandbox', () => {
  const provider = createMercadoPagoAdapter({ config: readSandboxConfig({}) });
  const status = createCheckoutService({ provider, repository: { ready: true } }).status();
  assert.equal(status.enabled, false);
  assert.equal(status.provider, 'mercado_pago');
  assert.deepEqual(status.capabilities, { cardSandbox: true, pixQrSandbox: true, pixPendingSandbox: true, pixLiquidatedSandbox: false });
  assert.deepEqual(status.methods, ['pix', 'card']);
  assert.equal(status.sandbox, true);
});

test('factory oferece somente Mercado Pago real, desativado quando configuração está ausente', async () => {
  const { createCheckoutProvider } = require('../src/services/checkout-provider');
  let calls = 0;
  const provider = createCheckoutProvider({ config: readSandboxConfig({}), fetchImpl: async () => { calls++; } });
  assert.equal(provider.id, 'mercado_pago');
  await assert.rejects(provider.ensureSandbox(), error => error.statusCode === 503);
  assert.equal(calls, 0);
});

test('factory recusa provedores indisponíveis sem cair em simulação ou outro gateway', () => {
  const { createCheckoutProvider } = require('../src/services/checkout-provider');
  for (const name of ['mock', 'asaas', 'hyperswitch', '', null]) {
    assert.throws(() => createCheckoutProvider({ name }), error => error.statusCode === 503);
  }
});

test('contrato recusa adaptador incompleto antes de abrir checkout', () => {
  const { assertCheckoutProvider, CHECKOUT_PROVIDER_METHODS } = require('../src/services/checkout-provider');
  const provider = createMercadoPagoAdapter({ config: readSandboxConfig({}) });
  assert.equal(assertCheckoutProvider(provider), provider);
  for (const method of CHECKOUT_PROVIDER_METHODS) {
    assert.throws(() => assertCheckoutProvider({ ...provider, [method]: null }), TypeError);
  }
  assert.throws(() => assertCheckoutProvider(null), TypeError);
  assert.throws(() => assertCheckoutProvider({ ...provider, enabled: 'true' }), TypeError);
});

test('factory conserva bloqueio de pagamento real mesmo com resposta HTTP bem-sucedida', async () => {
  const { createCheckoutProvider } = require('../src/services/checkout-provider');
  const provider = createCheckoutProvider({ config: { enabled: true, token: 'APP_USR-test-only', sellerId: '123' },
    fetchImpl: async url => ({ ok: true, json: async () => url.endsWith('/users/me')
      ? { id: 123, country_id: 'BR', tags: ['test_user'] }
      : { id: 999, collector_id: 123, live_mode: true } }) });
  await assert.rejects(provider.getPayment('999'), error => error.statusCode === 409);
});

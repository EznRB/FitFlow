const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
function harness() {
  const nodes = new Map(); const calls = []; const mounts = []; let unmounted = 0;
  for (const id of ['checkout-container', 'checkout-feedback', 'checkout-plan', 'checkout-begin', 'checkout-back', 'checkout-summary', 'paymentBrick_container', 'statusScreenBrick_container', 'checkout-refresh', 'checkout-retry', 'checkout-legacy']) {
    nodes.set(id, { id, isConnected: true, innerHTML: '', textContent: '', hidden: false, disabled: false, value: '2', dataset: {}, listeners: {}, addEventListener(event, callback) { this.listeners[event] = callback; } });
  }
  const config = { enabled: true, sandbox: true, publicKey: 'TEST-public', buyerEmail: 'test_user_buyer@testuser.com' };
  const purchase = { id: '11111111-1111-4111-8111-111111111111', flow: 'brick', planId: 2, planName: 'Plano', amount: 150, durationDays: 30, currency: 'BRL', state: 'created', settled: false, attemptState: null, paymentId: null };
  const context = vm.createContext({ console, URL, crypto: { randomUUID }, setTimeout: () => 1, clearTimeout() {},
    Auth: { user: { id: 7, role: 'student' }, generation: 1, sessionEpoch: 'a', getSessionEpoch() { return this.sessionEpoch; } },
    App: { currentPage: 'aluno-checkout', navigateTo() {} },
    FitFlowSecurity: { escapeHtml: value => String(value).replaceAll('<', '&lt;') },
    document: { getElementById: id => nodes.get(id) || null },
    window: { addEventListener() {}, MercadoPago: class { bricks() { return { create: async (name, target, settings) => { mounts.push({ name, target, settings }); return { unmount: async () => { unmounted++; } }; } }; } } },
    API: { get: async route => ({ data: route.endsWith('/config') ? config : route.endsWith('/plans') ? [{ id: 2, name: 'Plano', price: 150, durationDays: 30 }] : purchase }),
      post: async (route, body) => { calls.push({ route, body }); return { data: purchase }; } }
  });
  const source = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/views/checkout.js'), 'utf8');
  vm.runInContext(source + '\nthis.view=CheckoutView;', context);
  return { context, view: context.view, nodes, calls, mounts, config, purchase, get unmounted() { return unmounted; } };
}
test('tela prepara compra no servidor e mostra total antes de montar Payment Brick', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container'));
  assert.equal(h.calls.length, 0);
  await h.view.begin();
  assert.equal(h.calls[0].route, '/checkout/purchases'); assert.equal(h.calls[0].body.planId, 2);
  assert.equal(h.mounts[0].name, 'payment'); assert.equal(h.mounts[0].settings.initialization.amount, 150);
  assert.match(h.nodes.get('checkout-summary').textContent, /150/);
});
test('sair durante preparação impede montagem e logout desmonta componente existente', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container'));
  h.context.API.post = async () => { h.view.destroy(); return { data: h.purchase }; };
  await h.view.begin(); assert.equal(h.mounts.length, 0);
  const other = harness(); await other.view.render(other.nodes.get('checkout-container')); await other.view.begin();
  other.view.destroy(); await Promise.resolve(); assert.equal(other.unmounted, 1);
});
test('callback antigo não envia cobrança após troca de sessão', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container')); await h.view.begin();
  h.context.Auth.user = { id: 8, role: 'student' };
  await assert.rejects(h.mounts[0].settings.callbacks.onSubmit({ selectedPaymentMethod: 'bank_transfer', formData: {} }));
  assert.equal(h.calls.length, 1);
});
test('configuração incompleta apresenta orientação e não monta formulário', async () => {
  const h = harness(); h.config.enabled = false;
  await h.view.render(h.nodes.get('checkout-container'));
  assert.match(h.nodes.get('checkout-feedback').textContent, /indisponível/i); assert.equal(h.mounts.length, 0);
});

test('callback aguarda servidor e dois envios simultâneos criam uma só chamada', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container')); await h.view.begin();
  let resolve; const pending = new Promise(done => { resolve = done; }); let sends = 0;
  h.context.API.post = async () => { sends++; return pending; };
  const callback = h.mounts[0].settings.callbacks.onSubmit;
  const one = callback({ selectedPaymentMethod: 'bank_transfer', formData: {} });
  const two = callback({ selectedPaymentMethod: 'bank_transfer', formData: {} });
  assert.equal(sends, 1); let finished = false; one.then(() => { finished = true; }); await Promise.resolve(); assert.equal(finished, false);
  resolve({ data: { ...h.purchase, paymentId: '456', attemptState: 'pending', state: 'pending' } });
  await Promise.all([one, two]); assert.equal(h.mounts[1].name, 'statusScreen'); assert.equal(h.mounts[1].settings.initialization.paymentId, '456');
});

test('formulário novo após recusa não conserva identidade de Status Screen desmontado', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container')); await h.view.begin();
  h.view.session.purchase = { ...h.purchase, paymentId: '456', attemptState: 'rejected' };
  await h.view.result(h.view.session); assert.equal(h.view.session.statusPaymentId, '456');
  await h.view.mountPayment(h.view.session); assert.equal(h.view.session.statusPaymentId, null);
});

test('callback oficial com paymentType envia somente o contrato esperado pelo backend', async () => {
 const h=harness(); await h.view.render(h.nodes.get('checkout-container')); await h.view.begin();
 await h.mounts[0].settings.callbacks.onSubmit({paymentType:'bank_transfer',selectedPaymentMethod:'bank_transfer',formData:{payment_method_id:'pix',payer:{email:'a@example.com'}}});
 assert.deepEqual(Object.keys(h.calls[1].body.brick).sort(),['formData','selectedPaymentMethod']);
});


test('preparação bloqueia seleção até resposta e recupera seleção após falha', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container'));
  let reject; h.context.API.post = () => new Promise((_, fail) => { reject = fail; });
  const preparing = h.view.begin();
  assert.equal(h.nodes.get('checkout-plan').disabled, true);
  reject(new Error('Conexão interrompida')); await preparing;
  assert.equal(h.nodes.get('checkout-plan').disabled, false);
  assert.equal(h.nodes.get('checkout-begin').disabled, false);
});

test('falha do SDK permite montar novamente a mesma compra sem novo POST', async () => {
  const h = harness(); await h.view.render(h.nodes.get('checkout-container'));
  h.nodes.get('checkout-retry').hidden = true;
  const loadSdk = h.view.loadSdk; h.view.loadSdk = async () => { throw new Error('SDK indisponível'); };
  await h.view.begin();
  assert.equal(h.nodes.get('checkout-retry').hidden, false);
  assert.equal(h.nodes.get('checkout-plan').disabled, true);
  h.view.loadSdk = loadSdk;
  await h.view.mountPayment(h.view.session);
  assert.equal(h.calls.length, 1);
  assert.equal(h.mounts[0].settings.initialization.amount, 150);
  assert.equal(h.nodes.get('checkout-retry').hidden, true);
});

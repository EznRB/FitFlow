const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/mercado-pago-checkout.js'), 'utf8');
const security = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/security.js'), 'utf8');
function client(api, search = '') {
  const messages = []; const redirects = []; const modals = []; const listeners = {};
  const context = vm.createContext({ URL, URLSearchParams, crypto: { randomUUID },
    Auth: { user: { id: 7 } }, API: api, document: { getElementById: () => ({ value: '2' }) },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, location: { search, href: `https://fitflow.example/${search}`, assign: url => redirects.push(url) } },
    history: { replaceState() {} },
    Modal: { open: (...args) => modals.push(args), close() {} },
    Toast: Object.fromEntries(['error', 'info', 'warning', 'success'].map(type => [type, message => messages.push({ type, message })])),
    AlunoMensalidadeView: {}, PagamentosView: {}
  });
  vm.runInContext(security, context); vm.runInContext(source + '\nthis.checkout = MercadoPagoCheckout;', context);
  return { context, view: context.checkout, messages, redirects, modals, listeners };
}
test('checkout desativado não exibe cartão nem inicia pagamento; plano é escapado', async () => {
  const disabled = client({ get: async () => ({ data: { enabled: false } }) });
  await disabled.view.abrir(); assert.equal(disabled.modals.length, 1); assert.ok(!disabled.modals[0][1].includes('<input'));
  assert.equal(disabled.redirects.length, 0);
  const evil = '<img src=x onerror=alert(1)>';
  const enabled = client({ get: async url => ({ data: url.endsWith('/status') ? { enabled: true } : [{ id: 2, name: evil, price: 150 }] }) });
  await enabled.view.abrir(); assert.ok(!enabled.modals[0][1].includes(evil)); assert.ok(enabled.modals[0][1].includes('&lt;img'));
  assert.ok(!enabled.modals[0][1].includes('CVV')); assert.equal(enabled.context.PagamentosView.formatarData('2026-10-08T00:00:00.000Z'), '08/10/2026');
});
test('retorno com collection_status=approved continua pendente conforme resposta servidor', async () => {
  const c = client({ get: async () => ({ data: { state: 'pending', settled: false } }) }, '?checkout_intent=11111111-1111-4111-8111-111111111111&collection_status=approved');
  await c.view.verificarRetorno(); assert.equal(c.messages[0].type, 'info'); assert.equal(c.messages.some(message => message.type === 'success'), false);
});

test('conciliação de compra permite nova renovação, mantendo chaves de tentativas pendentes', async () => {
  const bodies = [];
  const c = client({
    get: async () => ({ data: { planId: 2, state: 'paid', settled: true } }),
    post: async (url, body) => { bodies.push(body); return { data: { checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }; }
  }, '?checkout_intent=11111111-1111-4111-8111-111111111111');
  await c.view.iniciar();
  c.view.attempts.set('7:3', 'another-pending-attempt');
  await c.view.verificarRetorno();
  await c.view.iniciar();
  assert.notEqual(bodies[0].idempotencyKey, bodies[1].idempotencyKey);
  assert.equal(c.view.attempts.get('7:3'), 'another-pending-attempt');
});

test('retry de intenção já liquidada não redireciona para cobrança antiga', async () => {
  const c = client({ post: async () => ({ data: { state: 'paid', settled: true, checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }) });
  await c.view.iniciar();
  assert.equal(c.redirects.length, 0);
  assert.equal(c.view.attempts.size, 0);
  assert.equal(c.messages[0].type, 'success');
});
test('retry reutiliza chave e só redireciona à origem Mercado Pago; troca de conta aborta redirect', async () => {
  const bodies = []; let count = 0;
  const c = client({ post: async (url, body) => { bodies.push(body); if (!count++) throw new Error('Rede indisponível'); return { data: { checkoutUrl: 'javascript:alert(1)' } }; } });
  await c.view.iniciar(); await c.view.iniciar(); assert.equal(bodies[0].idempotencyKey, bodies[1].idempotencyKey);
  assert.equal(c.redirects.length, 0); assert.deepEqual(Object.keys(bodies[0]).sort(), ['idempotencyKey', 'planId']);
  const other = client({ post: async () => { other.context.Auth.user = { id: 8 }; return { data: { checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }; } });
  await other.view.iniciar(); assert.equal(other.redirects.length, 0);
  c.listeners['auth:logout']({ detail: { reason: 'expired' } }); assert.equal(c.view.attempts.size, 1);
  c.listeners['auth:logout']({ detail: { reason: 'explicit' } }); assert.equal(c.view.attempts.size, 0);
});

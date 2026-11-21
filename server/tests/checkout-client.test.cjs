const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function harness(api = {}) {
  const listeners = {}, messages = [], navigations = [], replacements = [], nodes = new Map();
  const status = { textContent: '', dataset: {} }, button = { textContent: '', disabled: false };
  const membership = { id: 'aluno-mensalidade-container', isConnected: true, innerHTML: 'Mensalidade e histórico', querySelector: s => s === '[data-checkout-status]' ? status : button };
  nodes.set(membership.id, membership); nodes.set('page-content', { id: 'page-content', isConnected: true });
  const context = vm.createContext({ URL, URLSearchParams, Auth: { user: { id: 7, role: 'student' }, generation: 1, sessionEpoch: 'a', getSessionEpoch() { return this.sessionEpoch; } },
    App: { currentPage: 'aluno-mensalidade', navigateTo: p => navigations.push(p) }, API: api, CheckoutView: {}, document: { getElementById: id => nodes.get(id) || null },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, location: { search: '', href: 'https://fitflow.example/' } }, history: { replaceState: (...args) => replacements.push(args) },
    Toast: Object.fromEntries(['error', 'info', 'success', 'warning'].map(type => [type, message => messages.push({ type, message })])), AlunoMensalidadeView: {}, PagamentosView: {} });
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../../client/js/mercado-pago-checkout.js'), 'utf8') + '\nthis.view=MercadoPagoCheckout;', context);
  return { context, view: context.view, listeners, messages, navigations, replacements, nodes, membership, status, button };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('CTA abre somente a tela interna sem criar preferência nem cobrança', async () => {
  let requests = 0; const h = harness({ get: () => { requests++; }, post: () => { requests++; } });
  await h.view.abrir(); assert.deepEqual(h.navigations, ['aluno-checkout']); assert.equal(requests, 0);
  h.context.Auth.user = { id: 8, role: 'admin' }; await h.view.abrir(); assert.equal(h.navigations.length, 1);
});
test('ausência do módulo interno não restaura fluxo hospedado', async () => {
  const h = harness(); delete h.context.CheckoutView; await h.view.abrir(); assert.equal(h.navigations.length, 0); assert.equal(h.messages[0].type, 'error');
});
test('disponibilidade consulta configuração interna e preserva mensalidade', async () => {
  for (const [data, pattern] of [[{ enabled: true, sandbox: true }, /Sandbox disponível/], [{ enabled: false, sandbox: true }, /Aguardando configuração/], [{ enabled: true, sandbox: false }, /não confirmada/]]) {
    const h = harness({ get: async (route, options) => { assert.equal(route, '/checkout/config'); assert.equal(options.timeoutMs, 15000); return { data }; } });
    await h.view.decorateMembership(h.membership, () => true); assert.match(h.status.textContent, pattern); assert.equal(h.membership.innerHTML, 'Mensalidade e histórico'); assert.equal(h.button.disabled, false);
  }
});
test('disponibilidade tardia não altera sessão ou página novas', async () => {
  for (const change of [h => { h.context.Auth.generation++; }, h => { h.context.Auth.sessionEpoch = 'b'; }, h => { h.context.App.currentPage = 'aluno-painel'; }, h => { h.nodes.set(h.membership.id, {}); }]) {
    const pending = deferred(); const h = harness({ get: () => pending.promise }); const request = h.view.decorateMembership(h.membership, () => true); const before = h.status.textContent;
    change(h); pending.resolve({ data: { enabled: true, sandbox: true } }); await request; assert.equal(h.status.textContent, before);
  }
});
test('retorno legado com approved na URL depende da confirmação do servidor', async () => {
  const h = harness({ get: async () => ({ data: { state: 'pending', settled: false } }) });
  h.context.window.location.search = '?checkout_intent=11111111-1111-4111-8111-111111111111&collection_status=approved';
  await h.view.verificarRetorno(); assert.equal(h.messages[0].type, 'info'); assert.equal(h.messages.some(m => m.type === 'success'), false);
});
test('retorno legado tardio não altera URL nem feedback de nova sessão', async () => {
  const pending = deferred(); const h = harness({ get: () => pending.promise }); h.context.window.location.search = '?checkout_intent=11111111-1111-4111-8111-111111111111';
  const request = h.view.verificarRetorno(); h.context.Auth.generation++; pending.resolve({ data: { state: 'paid', settled: true } }); await request;
  assert.equal(h.messages.length, 0); assert.equal(h.replacements.length, 0);
});
test('data financeira mantém o dia civil brasileiro', () => {
  const h = harness(); assert.equal(h.context.PagamentosView.formatarData('2026-11-21T00:00:00.000Z'), '21/11/2026');
});

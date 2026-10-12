const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/mercado-pago-checkout.js'), 'utf8');
const security = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/security.js'), 'utf8');
function client(api, search = '') {
  const messages = []; const redirects = []; const modals = []; const listeners = {}; const replacements = [];
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, { id, value: '2', textContent: '', innerHTML: '', disabled: false, isConnected: true, dataset: {}, setAttribute() {}, removeAttribute() {}, querySelector(selector) { return nodes.get(selector); } }); return nodes.get(id); };
  const membership = node('aluno-mensalidade-container'); membership.innerHTML = 'Plano atual · Histórico preservado';
  const statusNode = node('[data-checkout-status]'), button = node('[data-action="checkout"]');
  const modal = { revision: 0, opened: false, isOpen() { return this.opened; }, open(...args) { this.revision++; this.opened = true; modals.push(args); nodes.set('mp-checkout-plan', { value: '2', isConnected: true }); }, close() { this.revision++; this.opened = false; nodes.delete('mp-checkout-plan'); } };
  const context = vm.createContext({ URL, URLSearchParams, crypto: { randomUUID },
    Auth: { user: { id: 7, role: 'student' }, generation: 1, sessionEpoch: 'session-a', getSessionEpoch() { return this.sessionEpoch; } }, App: { currentPage: 'aluno-mensalidade' }, API: api, document: { getElementById: id => nodes.get(id) || null },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, location: { search, href: `https://fitflow.example/${search}`, assign: url => redirects.push(url) } },
    history: { replaceState: (...args) => replacements.push(args) }, Modal: modal,
    Toast: Object.fromEntries(['error', 'info', 'warning', 'success'].map(type => [type, message => messages.push({ type, message })])),
    AlunoMensalidadeView: {}, PagamentosView: {}
  });
  vm.runInContext(security, context); vm.runInContext(source + '\nthis.checkout = MercadoPagoCheckout;', context);
  return { context, view: context.checkout, messages, redirects, modals, listeners, nodes, membership, statusNode, button, replacements };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function checkoutApi(api) { return { ...api, get: api.get || (async url => ({ data: url.endsWith('/status') ? { enabled: true, sandbox: true } : [{ id: 2, name: 'Plano teste', price: 150 }] })) }; }
async function open(c) { const get = c.context.API.get; c.context.API.get = checkoutApi({}).get; await c.view.abrir(); c.context.API.get = get; }
test('checkout desativado não exibe cartão nem inicia pagamento; plano é escapado', async () => {
  const disabled = client({ get: async () => ({ data: { enabled: false, sandbox: true } }) });
  await disabled.view.abrir(); assert.equal(disabled.modals.length, 1); assert.ok(!disabled.modals[0][1].includes('<input'));
  assert.equal(disabled.redirects.length, 0);
  const evil = '<img src=x onerror=alert(1)>';
  const enabled = client({ get: async url => ({ data: url.endsWith('/status') ? { enabled: true, sandbox: true } : [{ id: 2, name: evil, price: 150 }] }) });
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
  await open(c); await c.view.iniciar();
  c.view.attempts.set('7:3', 'another-pending-attempt');
  await c.view.verificarRetorno();
  await open(c); await c.view.iniciar();
  assert.notEqual(bodies[0].idempotencyKey, bodies[1].idempotencyKey);
  assert.equal(c.view.attempts.get('7:3'), 'another-pending-attempt');
});

test('retry de intenção já liquidada não redireciona para cobrança antiga', async () => {
  const c = client({ post: async () => ({ data: { state: 'paid', settled: true, checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }) });
  await open(c); await c.view.iniciar();
  assert.equal(c.redirects.length, 0);
  assert.equal(c.view.attempts.size, 0);
  assert.equal(c.messages[0].type, 'success');
});
test('retry reutiliza chave e só redireciona à origem Mercado Pago; troca de conta aborta redirect', async () => {
  const bodies = []; let count = 0;
  const c = client({ post: async (url, body) => { bodies.push(body); if (!count++) throw new Error('Rede indisponível'); return { data: { checkoutUrl: 'javascript:alert(1)' } }; } });
  await open(c); await c.view.iniciar(); await c.view.iniciar(); assert.equal(bodies[0].idempotencyKey, bodies[1].idempotencyKey);
  assert.equal(c.redirects.length, 0); assert.deepEqual(Object.keys(bodies[0]).sort(), ['idempotencyKey', 'planId']);
  const other = client({ post: async () => { other.context.Auth.user = { id: 8 }; return { data: { checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }; } });
  await open(other); await other.view.iniciar(); assert.equal(other.redirects.length, 0);
  c.listeners['auth:logout']({ detail: { reason: 'expired' } }); assert.equal(c.view.attempts.size, 1);
  c.listeners['auth:logout']({ detail: { reason: 'explicit', userId: 7 } }); assert.equal(c.view.attempts.size, 0);
});

test('consulta de disponibilidade não cria intenção nem substitui mensalidade ou histórico; distingue sandbox, configuração e falha', async () => {
  for (const [data, label] of [[{ enabled: false, sandbox: true }, 'Aguardando configuração'], [{ enabled: true, sandbox: true }, 'Sandbox disponível'], [{ enabled: true, sandbox: false }, 'Disponibilidade não confirmada'], [null, 'Disponibilidade não confirmada']]) {
    let posts = 0; const pending = deferred(); const c = client({ get: () => pending.promise, post: () => { posts++; } });
    const query = c.view.decorateMembership(c.membership, () => true);
    assert.match(c.statusNode.textContent, /Consultando/); assert.equal(c.button.disabled, true);
    if (data) pending.resolve({ data }); else pending.reject(new Error('<img>'));
    await query; assert.match(c.statusNode.textContent, new RegExp(label)); assert.equal(posts, 0);
    assert.equal(c.membership.innerHTML, 'Plano atual · Histórico preservado'); assert.equal(c.button.disabled, false); assert.equal(c.messages.length, 0);
  }
});

test('disponibilidade antiga não altera nova mensalidade, identidade, epoch ou consulta mais recente', async () => {
  for (const invalidate of [c => { c.context.Auth.generation++; }, c => { c.context.Auth.sessionEpoch = 'other'; }, c => { c.context.App.currentPage = 'aluno-painel'; }, c => { c.nodes.set(c.membership.id, { isConnected: true }); }]) {
    const pending = deferred(); const c = client({ get: () => pending.promise }); const query = c.view.decorateMembership(c.membership, () => true);
    invalidate(c); const loading = c.statusNode.textContent; pending.resolve({ data: { enabled: true, sandbox: true } }); await query; assert.equal(c.statusNode.textContent, loading);
  }
  const pending = deferred(); let gets = 0; const c = client({ get: () => ++gets === 1 ? pending.promise : Promise.resolve({ data: { enabled: false, sandbox: true } }) });
  const old = c.view.decorateMembership(c.membership, () => true); await c.view.decorateMembership(c.membership, () => true);
  pending.resolve({ data: { enabled: true, sandbox: true } }); await old; assert.match(c.statusNode.textContent, /Aguardando configuração/);
});

test('duplo abrir consulta uma vez e consulta antiga não abre modal depois de navegação, troca de conta ou outro modal', async () => {
  const pending = deferred(); let gets = 0; const c = client({ get: () => { gets++; return pending.promise; } });
  const first = c.view.abrir(); const duplicate = c.view.abrir(); const count = gets;
  pending.resolve({ data: { enabled: false, sandbox: true } }); await Promise.all([first, duplicate]); assert.equal(count, 1); assert.equal(c.modals.length, 1);
  for (const invalidate of [c => { c.context.Auth.generation += 2; }, c => { c.context.Auth.sessionEpoch = 'session-b'; }, c => { c.context.App.currentPage = 'aluno-painel'; }, c => c.context.Modal.open('Outro', '', []), c => c.context.Modal.close()]) {
    const d = deferred(); const h = client({ get: () => d.promise }); const request = h.view.abrir(); invalidate(h); const before = h.modals.length;
    d.resolve({ data: { enabled: false, sandbox: true } }); await request; assert.equal(h.modals.length, before); assert.equal(h.messages.length, 0);
  }
});

test('planos tardios não substituem modal novo; resposta sem sandbox explícito nunca oferece intenção', async () => {
  const pending = deferred(); const c = client({ get: async url => url.endsWith('/status') ? { data: { enabled: true, sandbox: true } } : pending.promise });
  const request = c.view.abrir(); await Promise.resolve(); c.context.Modal.open('Outra tarefa', '', []);
  pending.resolve({ data: [{ id: 2, name: 'Antigo', price: 150 }] }); await request; assert.equal(c.modals.length, 1); assert.equal(c.modals[0][0], 'Outra tarefa');
  const h = client(checkoutApi({ get: async () => ({ data: { enabled: true } }) })); await h.view.abrir();
  assert.equal(h.modals.some(args => args[1].includes('mp-checkout-plan')), false);
});

test('intenção exige plano do modal próprio, captura valor antes do envio e impede duplo submit', async () => {
  const pending = deferred(); const bodies = []; let ready = false; const c = client(checkoutApi({ post: (url, body) => { bodies.push(body); return ready && body.planId === 2 ? pending.promise : Promise.resolve({ data: {} }); } }));
  await c.view.iniciar(); assert.equal(bodies.length, 0); await c.view.abrir(); ready = true;
  c.nodes.get('mp-checkout-plan').value = '99'; await c.view.iniciar(); assert.equal(bodies.length, 0);
  c.nodes.get('mp-checkout-plan').value = '2'; const write = c.view.iniciar(); c.nodes.get('mp-checkout-plan').value = '3'; await c.view.iniciar();
  assert.equal(bodies.length, 1); assert.equal(bodies[0].planId, 2);
  pending.resolve({ data: { checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }); await write; assert.equal(c.redirects.length, 1);
});

test('resultado e erro de intenção antiga não navegam, apagam tentativa nova ou mostram toast depois de mudança de contexto', async () => {
  for (const invalidate of [c => { c.context.Auth.generation++; }, c => { c.context.Auth.getSessionEpoch = () => 'remote'; }, c => { c.context.App.currentPage = 'aluno-painel'; }, c => c.context.Modal.close(), c => c.context.Modal.open('Novo', '', [])]) {
    for (const reject of [false, true]) {
      const pending = deferred(); const c = client(checkoutApi({ post: () => pending.promise })); await c.view.abrir(); const write = c.view.iniciar();
      invalidate(c); c.view.attempts.set('7:2', 'new-attempt');
      if (reject) pending.reject(new Error('Erro antigo')); else pending.resolve({ data: { state: 'paid', settled: true, checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } });
      await write; assert.equal(c.redirects.length, 0); assert.equal(c.messages.length, 0); assert.equal(c.view.attempts.get('7:2'), 'new-attempt');
    }
  }
});

test('retorno antigo não limpa URL ou tentativa de outra sessão; retorno não apaga tentativa criada depois da consulta', async () => {
  const pending = deferred(); const c = client({ get: () => pending.promise }, '?checkout_intent=11111111-1111-4111-8111-111111111111');
  c.view.attempts.set('7:2', 'before'); const query = c.view.verificarRetorno(); c.context.Auth.generation += 2;
  pending.resolve({ data: { state: 'paid', settled: true, planId: 2 } }); await query;
  assert.equal(c.messages.length, 0); assert.equal(c.replacements.length, 0); assert.equal(c.view.attempts.get('7:2'), 'before');
  const another = deferred(); const h = client({ get: () => another.promise }, '?checkout_intent=11111111-1111-4111-8111-111111111111');
  h.view.attempts.set('7:2', 'before'); const second = h.view.verificarRetorno(); h.view.attempts.set('7:2', 'new');
  another.resolve({ data: { state: 'paid', settled: true, planId: 2 } }); await second; assert.equal(h.view.attempts.get('7:2'), 'new');
});

test('logout explícito só remove tentativas do ator informado; expiração conserva retentativa', () => {
  const c = client({}); c.view.attempts.set('7:2', 'a'); c.view.attempts.set('8:2', 'b');
  c.listeners['auth:logout']({ detail: { reason: 'expired', userId: 7 } }); assert.equal(c.view.attempts.size, 2);
  c.listeners['auth:logout']({ detail: { reason: 'explicit', userId: 7 } }); assert.equal(c.view.attempts.get('8:2'), 'b'); assert.equal(c.view.attempts.has('7:2'), false);
});

test('fechar de diálogo antigo não fecha outra tarefa; diálogo de configuração aberto não é duplicado', async () => {
  for (const enabled of [false, true]) {
    let gets = 0; const c = client({ get: async url => { gets++; return { data: url.endsWith('/status') ? { enabled, sandbox: true } : [{ id: 2, name: 'Plano', price: 150 }] }; } });
    await c.view.abrir(); const close = c.modals[0][2][0].action;
    const before = gets; await c.view.abrir(); assert.equal(gets, before);
    c.context.Modal.open('Outro diálogo', '', []); const revision = c.context.Modal.revision;
    close(); assert.equal(c.context.Modal.revision, revision); assert.equal(c.context.Modal.isOpen(), true);
  }
});

test('diálogo aguardando configuração não permite iniciar intenção nem lança erro ao confirmar', async () => {
  let posts = 0; const c = client({ get: async () => ({ data: { enabled: false, sandbox: true } }), post: async () => { posts++; } });
  await c.view.abrir(); await c.view.iniciar(); assert.equal(posts, 0); assert.equal(c.view.attempts.size, 0);
});

test('todas as consultas e criação de intenção pedem explicitamente prazo de 15 segundos', async () => {
  const requests = [];
  const c = client({ get: async (url, options) => { requests.push({ url, options }); return { data: url.endsWith('/status') ? { enabled: true, sandbox: true } : url.endsWith('/plans') ? [{ id: 2, name: 'Plano', price: 150 }] : { state: 'pending', settled: false } }; },
    post: async (url, body, options) => { requests.push({ url, options }); throw Object.assign(new Error('Resultado não confirmado'), { timeout: true, status: 0 }); }
  }, '?checkout_intent=11111111-1111-4111-8111-111111111111');
  await c.view.decorateMembership(c.membership, () => true); await c.view.abrir(); await c.view.iniciar(); await c.view.verificarRetorno();
  assert.equal(requests.length, 5); for (const request of requests) assert.equal(request.options?.timeoutMs, 15000, request.url);
  assert.equal(c.view.attempts.size, 1); assert.equal(c.redirects.length, 0);
});

function deadlineClient(search = '') {
  const c = client({}, search), requests = [], timers = new Map(); let nextTimer = 0;
  c.context.AbortController = AbortController;
  c.context.setTimeout = (callback, delay) => { assert.equal(delay, 15000); const id = ++nextTimer; timers.set(id, callback); return id; };
  c.context.clearTimeout = id => timers.delete(id);
  c.context.fetch = (url, options) => { const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise; };
  c.context.API = vm.runInContext('(function () {' + fs.readFileSync(require('node:path').join(__dirname, '../../client/js/api.js'), 'utf8') + '; return API; })()', c.context);
  return { ...c, requests, timers, expire() { assert.equal(timers.size, 1); [...timers.values()][0](); } };
}

test('prazo real solta consulta de status sem ocultar mensalidade e ignora resposta tardia', async () => {
  const c = deadlineClient(); const query = c.view.decorateMembership(c.membership, () => true);
  assert.equal(c.timers.size, 1); c.expire(); await query;
  assert.match(c.statusNode.textContent, /Disponibilidade não confirmada/); assert.equal(c.button.disabled, false);
  assert.equal(c.membership.innerHTML, 'Plano atual · Histórico preservado'); assert.equal(c.requests.length, 1); assert.equal(c.view.attempts.size, 0);
  c.requests[0].resolve(new Response(JSON.stringify({ data: { enabled: true, sandbox: true } }), { status: 200 })); await Promise.resolve(); await Promise.resolve();
  assert.match(c.statusNode.textContent, /Disponibilidade não confirmada/); assert.equal(c.modals.length, 0); assert.equal(c.timers.size, 0);
});

test('prazo real na intenção preserva UUID; resposta tardia não navega e retry manual incerto não recompra automaticamente', async () => {
  const c = deadlineClient(); await open(c); const first = c.view.iniciar(); assert.equal(c.timers.size, 1);
  const key = c.view.attempts.get('7:2'), body = JSON.parse(c.requests[0].options.body); assert.equal(body.idempotencyKey, key);
  c.expire(); await first; assert.equal(c.requests.length, 1); assert.equal(c.view.attempts.get('7:2'), key); assert.equal(c.view.pending, null);
  assert.equal(c.nodes.get('mp-checkout-plan').disabled, false); assert.equal(c.redirects.length, 0);
  c.requests[0].resolve(new Response(JSON.stringify({ data: { checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect' } }), { status: 200 })); await Promise.resolve(); await Promise.resolve();
  assert.equal(c.redirects.length, 0); const retry = c.view.iniciar(); assert.equal(c.requests.length, 2);
  assert.equal(JSON.parse(c.requests[1].options.body).idempotencyKey, key);
  c.requests[1].resolve(new Response(JSON.stringify({ message: 'Intenção incerta; confira antes de tentar nova compra.' }), { status: 409 })); await retry;
  assert.equal(c.requests.length, 2); assert.equal(c.view.attempts.get('7:2'), key); assert.equal(c.redirects.length, 0); assert.equal(c.timers.size, 0);
});

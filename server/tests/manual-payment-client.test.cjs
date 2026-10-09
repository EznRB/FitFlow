const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
function lockManager() {
  const tails = new Map();
  return { async request(name, options, callback) {
    const before = tails.get(name) || Promise.resolve(); let release;
    tails.set(name, new Promise(resolve => { release = resolve; }));
    await before; try { return await callback(); } finally { release(); }
  } };
}
function harness({ storage = new Map(), post, get, clock, locks = lockManager() } = {}) {
  const nodes = new Map(), events = new Map(), toasts = [], modals = [];
  const values = { 'input-pgto-aluno': '11', 'input-pgto-plano': '2', 'input-pgto-valor': '150.00',
    'input-pgto-data': '2026-10-08', 'input-pgto-metodo': 'pix', 'input-pgto-notas': 'Private fixture note' };
  const button = { disabled: false, innerHTML: '' };
  const node = id => { if (!nodes.has(id)) nodes.set(id, { value: values[id] || '', innerHTML: '' }); return nodes.get(id); };
  const Auth = { user: { id: 7, role: 'admin' }, generation: 1 };
  const context = vm.createContext({ Auth, crypto: webcrypto, TextEncoder, navigator: { locks }, console, setTimeout: () => {},
    ...(clock ? { Date: class extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } } } : {}),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { addEventListener: (name, fn) => events.set(name, fn) },
    document: { getElementById: node, querySelectorAll: () => [button] },
    API: { post: post || (async () => ({ data: { id: 9 } })), get: get || (async () => { throw Object.assign(new Error('not found'), { status: 404 }); }) },
    Modal: { close: () => { context.closes++; }, open: (title, html) => modals.push({ title, html }) },
    Toast: { error: message => toasts.push(['error', message]), success: message => toasts.push(['success', message]) } });
  context.closes = 0; context.reloads = 0;
  for (const file of ['security', 'pagamentos']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../client/js/${file}.js`), 'utf8'), context);
  vm.runInContext('globalThis.view = PagamentosView;', context);
  context.view.carregarLista = () => { context.reloads++; };
  return { context, view: context.view, Auth, node, storage, events, toasts, modals };
}
test('resposta perdida e retry preservam UUID/payload; sucesso permite outro registro intencional', async () => {
  const sent = []; const h = harness({ post: async (url, body) => { sent.push(structuredClone(body)); if (sent.length === 1) throw Object.assign(new Error('offline'), { status: 0 }); return { data: { id: sent.length } }; } });
  await h.view.submeterPagamento(); await h.view.submeterPagamento();
  assert.match(sent[0].idempotencyKey || '', /^[0-9a-f-]{36}$/);
  assert.deepEqual(sent[0], sent[1]); assert.equal(h.context.closes, 1);
  await h.view.abrirModalRegistro(); await h.view.submeterPagamento(); assert.notEqual(sent[2].idempotencyKey, sent[0].idempotencyKey);
});
test('reload preserva somente UUID/fingerprint e reutiliza chave com os mesmos campos', async () => {
  const storage = new Map(), sent = [];
  const h = harness({ storage, post: async (url, body) => { sent.push(structuredClone(body)); throw Object.assign(new Error('gateway'), { status: 502 }); } });
  await h.view.submeterPagamento();
  const saved = [...storage.values()].join('');
  assert.ok(saved); assert.ok(!saved.includes('Private fixture note')); assert.ok(!saved.includes('studentId'));
  const reload = harness({ storage, post: async (url, body) => { sent.push(structuredClone(body)); return { data: { id: 9 } }; } });
  await reload.view.submeterPagamento(); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
});
test('payload alterado após erro incerto não cria outro UUID nem envia outro pagamento', async () => {
  let sends = 0; const h = harness({ post: async () => { sends++; throw Object.assign(new Error('offline'), { status: 0 }); } });
  await h.view.submeterPagamento(); h.node('input-pgto-valor').value = '200.00'; await h.view.submeterPagamento();
  assert.equal(sends, 1); assert.ok(h.toasts.some(([type]) => type === 'error'));
});
test('duplo clique compartilha uma única solicitação e resposta antiga não afeta a conta nova', async () => {
  let finish, sends = 0;
  const h = harness({ post: async () => { sends++; return new Promise(resolve => { finish = resolve; }); } });
  const first = h.view.submeterPagamento(), second = h.view.submeterPagamento();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.equal(sends, 1); h.Auth.user = { id: 8, role: 'admin' }; h.Auth.generation++;
  h.events.get('auth:logout')?.({ detail: { userId: 7, reason: 'explicit' } });
  finish({ data: { id: 9 } }); await Promise.all([first, second]);
  assert.equal(h.context.closes, 0); assert.equal(h.context.reloads, 0);
  assert.ok(!h.toasts.some(([type]) => type === 'success'));
});
test('formulário usa dia civil brasileiro e explica lançamento manual de recebimento', async () => {
  const h = harness({ clock: '2026-10-09T02:30:00Z' }); h.view.alunos = []; h.view.planos = [];
  await h.view.abrirModalRegistro();
  assert.match(h.modals[0].html, /value="2026-10-08"/);
  assert.equal(h.modals[0].title, 'Registrar pagamento recebido');
  assert.match(h.modals[0].html, /já recebido/i);
  assert.equal(h.view.formatarData('2026-10-08T00:00:00.000Z'), '08/10/2026');
});

test('duas abas concorrentes com erro incerto reservam o mesmo UUID e preservam a intenção', async () => {
  const storage = new Map(), locks = lockManager(), sent = [];
  const post = async (url, body) => { sent.push(structuredClone(body)); throw Object.assign(new Error('offline'), { status: 0 }); };
  const first = harness({ storage, locks, post }), second = harness({ storage, locks, post });
  await Promise.all([first.view.submeterPagamento(), second.view.submeterPagamento()]);
  assert.equal(sent.length, 2); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
  const saved = JSON.parse([...storage.values()][0]); assert.equal(saved.id, sent[0].idempotencyKey); assert.equal(saved.rejected, false);
});
test('reabertura deliberada aguarda reserva com digest atrasado e ambas as abas usam o UUID confirmado', async () => {
  const storage = new Map(), locks = lockManager(), sent = [], ledger = new Map();
  const post = async (url, body) => { sent.push(structuredClone(body)); if (!ledger.has(body.idempotencyKey)) ledger.set(body.idempotencyKey, ledger.size + 1); return { data: { id: ledger.get(body.idempotencyKey) } }; };
  const fast = harness({ storage, locks, post }), slow = harness({ storage, locks, post });
  await fast.view.submeterPagamento();
  assert.equal(JSON.parse([...storage.values()][0]).confirmed, true);
  let releaseDigest, started;
  const delay = new Promise(resolve => { releaseDigest = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  slow.context.crypto = { randomUUID: webcrypto.randomUUID.bind(webcrypto), subtle: { digest: async (...args) => { started(); await delay; return webcrypto.subtle.digest(...args); } } };
  const second = slow.view.submeterPagamento(); await entered;
  let opened = false;
  const opening = fast.view.abrirModalRegistro().then(() => { opened = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened, false); assert.equal(JSON.parse([...storage.values()][0]).id, sent[0].idempotencyKey);
  releaseDigest(); await Promise.all([second, opening]);
  assert.equal(sent.length, 2); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey); assert.equal(ledger.size, 1);
  await fast.view.submeterPagamento();
  assert.notEqual(sent[2].idempotencyKey, sent[0].idempotencyKey); assert.equal(ledger.size, 2);
});

test('cliente envia o ator esperado da sessão sem substituir a autoridade do servidor', async () => {
  let payload; const h = harness({ post: async (url, body) => { payload = body; return { data: { id: 9 } }; } });
  await h.view.submeterPagamento(); assert.equal(payload.expectedActorId, 7);
});
test('reserva adquire WebLock antes do digest e impede outra aba de enviar enquanto o primeiro digest está pendente', async () => {
  const storage = new Map(), locks = lockManager(), sent = [];
  const post = async (url, body) => { sent.push(structuredClone(body)); return { data: { id: 9 } }; };
  const slow = harness({ storage, locks, post }), fast = harness({ storage, locks, post });
  let release, started;
  const delay = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  slow.context.crypto = { randomUUID: webcrypto.randomUUID.bind(webcrypto), subtle: { digest: async (...args) => { started(); await delay; return webcrypto.subtle.digest(...args); } } };
  const first = slow.view.submeterPagamento(); await entered;
  const second = fast.view.submeterPagamento();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(sent.length, 0);
  release(); await Promise.all([first, second]);
  assert.equal(sent.length, 2); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey);
});
test('Locks indisponível falha antes de enviar ou reservar uma intenção financeira', async () => {
  let sent = 0; const h = harness({ locks: undefined, post: async () => { sent++; return { data: { id: 9 } }; } });
  h.context.navigator.locks = undefined;
  await h.view.submeterPagamento(); assert.equal(sent, 0); assert.equal(h.storage.size, 0);
  assert.match(h.toasts[0][1], /Nenhum registro foi enviado/);
});
test('lookup tardio não fecha um modal substituído por detalhes ou outra página', async () => {
  const h = harness({ post: async () => { throw Object.assign(new Error('offline'), { status: 0 }); } });
  await h.view.submeterPagamento(); let finish;
  h.context.API.get = async () => new Promise(resolve => { finish = resolve; });
  const checking = h.view.verificarEnvioAnterior();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  h.context.document.getElementById = id => id === 'form-pagamento' ? null : h.node(id);
  finish({ data: { id: 9 } }); await checking;
  assert.equal(h.context.closes, 0); assert.equal(h.context.reloads, 0);
  assert.ok(!h.toasts.some(([type]) => type === 'success'));
});

test('lookup 404 atrasado não inicia nova intenção se outra aba já confirmou e abriu outro registro', async () => {
  const storage = new Map(), locks = lockManager(), sent = [];
  const post = async (url, body) => { sent.push(structuredClone(body)); return { data: { id: 9 } }; };
  const fast = harness({ storage, locks, post }); await fast.view.submeterPagamento();
  let finish; const slow = harness({ storage, locks, post,
    get: async () => new Promise((resolve, reject) => { finish = () => reject(Object.assign(new Error('not found'), { status: 404 })); }) });
  const second = slow.view.submeterPagamento();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await fast.view.abrirModalRegistro(); assert.equal(storage.size, 0);
  finish(); await second;
  assert.equal(sent.length, 1); assert.equal(storage.size, 0);
  assert.ok(slow.toasts.some(([type]) => type === 'error'));
});
test('lookup após reload confirma o recebimento sem outro POST; outra conta usa seu próprio namespace', async () => {
  const storage = new Map(); let sends = 0;
  const first = harness({ storage, post: async () => { sends++; throw Object.assign(new Error('lost'), { status: 0 }); } });
  await first.view.submeterPagamento();
  const restored = harness({ storage, post: async () => { sends++; return { data: { id: 9 } }; }, get: async () => ({ data: { id: 9 } }) });
  await restored.view.verificarEnvioAnterior(); assert.equal(sends, 1); assert.equal(restored.context.closes, 1);
  const other = harness({ storage, post: async () => { sends++; return { data: { id: 10 } }; } }); other.Auth.user = { id: 8, role: 'admin' };
  await other.view.submeterPagamento(); assert.equal(sends, 2); assert.equal(storage.size, 2);
  first.events.get('auth:logout')({ detail: { userId: 7, reason: 'explicit' } });
  assert.ok([...storage.values()].every(raw => !raw.includes('Private fixture note')));
});
test('rejeição explícita 400 permite corrigir o formulário usando a mesma UUID', async () => {
  const sent = []; const h = harness({ post: async (url, body) => { sent.push(structuredClone(body)); if (sent.length === 1) throw Object.assign(new Error('plano inativo'), { status: 400 }); return { data: { id: 9 } }; } });
  await h.view.submeterPagamento(); h.node('input-pgto-plano').value = '3'; await h.view.submeterPagamento();
  assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey); assert.equal(sent[1].planId, 3);
});

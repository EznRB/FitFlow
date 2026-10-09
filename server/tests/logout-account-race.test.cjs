const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness() {
  const listeners = {}, requests = [], events = [], disposed = [], cleared = [];
  const context = vm.createContext({ console, localStorage: { removeItem() {}, setItem() {} },
    API: { post: (endpoint, body) => new Promise(resolve => requests.push({ endpoint, body, resolve })) },
    FitFlowTrainingStore: { createIndexedDbStorage: () => ({ clear: async id => cleared.push(id) }) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    window: { addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
      dispatchEvent(event) { events.push(event); for (const callback of listeners[event.type] || []) callback(event); } },
  });
  for (const name of ['auth', 'sessoes']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../client/js/${name}.js`), 'utf8'), context);
  vm.runInContext('globalThis.refs = { Auth, SessoesView }', context);
  function account(id) {
    context.refs.Auth.user = { id, role: 'student' };
    context.refs.SessoesView.userId = id;
    context.refs.SessoesView.store = { dispose: async options => disposed.push({ userId: id, clear: options.clear }) };
  }
  return { ...context.refs, requests, events, disposed, cleared, account };
}

test('duplo clique sai uma vez; login B espera logout A e não perde sua fila', async () => {
  const h = harness(); h.account(7);
  const first = h.Auth.logout(), second = h.Auth.logout();
  assert.equal(first, second); assert.equal(h.requests.length, 1);
  const login = h.Auth.login('b@example.test', 'dummy-test-only');
  assert.equal(h.requests.length, 1, 'novo cookie só pode ser emitido após a saída anterior');
  h.requests[0].resolve({}); await first; await Promise.resolve();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: { user: { id: 8, role: 'student' } } }); await login; h.account(8);
  assert.equal(h.events.filter(e => e.type === 'auth:logout').length, 1);
  assert.deepEqual(h.disposed, [{ userId: 7, clear: true }]); assert.equal(h.SessoesView.userId, 8);
});

test('evento atrasado limpa somente a conta informada, nunca store da conta B', async () => {
  const h = harness(); h.account(8);
  await h.SessoesView.logout('explicit', 7); await h.SessoesView.logout('explicit', null);
  assert.deepEqual(h.cleared, [7]); assert.deepEqual(h.disposed, []); assert.equal(h.SessoesView.userId, 8);
});

test('expiração preserva a fila; descarte explícito posterior mantém ownerId', async () => {
  const h = harness(); h.account(7);
  const expired = h.Auth.logout({ reason: 'expired' }); h.requests[0].resolve({}); await expired;
  assert.deepEqual(h.disposed, [{ userId: 7, clear: false }]); assert.deepEqual(h.cleared, []);
  assert.equal(h.Auth.expiredUserId, 7);
  const explicit = h.Auth.logout(); h.requests[1].resolve({}); await explicit; await Promise.resolve();
  assert.deepEqual(h.cleared, [7]); assert.equal(h.Auth.expiredUserId, null);
  assert.equal(h.events.at(-1).detail.userId, 7);
});

test('401 tardio de A ou da sessão anterior do mesmo aluno não encerra login novo', async () => {
  for (const newId of [7, 8]) {
    const h = harness(); h.account(7);
    let resolveRequest;
    h.Auth.generation = 1;
    const apiContext = h.Auth;
    // Carrega API no mesmo contexto lexical de Auth por um harness dedicado abaixo.
    const listeners = {}, context = vm.createContext({ console,
      localStorage: { removeItem() {}, setItem() {} },
      fetch: () => new Promise(resolve => { resolveRequest = resolve; }),
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      window: { addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
        dispatchEvent(event) { for (const callback of listeners[event.type] || []) callback(event); } },
    });
    for (const name of ['api', 'auth']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../client/js/${name}.js`), 'utf8'), context);
    vm.runInContext('globalThis.refs = { API, Auth }; Auth.user = {id:7}; Auth.generation = 1;', context);
    const request = context.refs.API.get('/sessoes/mine');
    context.refs.Auth.user = { id: newId }; context.refs.Auth.generation = 3;
    resolveRequest({ status: 401, ok: false, text: async () => '{"message":"expired"}' });
    await assert.rejects(request, error => error.status === 401);
    assert.equal(context.refs.Auth.user.id, newId);
    assert.equal(context.refs.Auth.logoutPending, null);
    assert.equal(context.refs.Auth.generation, 3);
  }
});

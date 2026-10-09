const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { browserAuthLocks } = require('./helpers/browser-auth-locks.cjs');
const source = fs.readFileSync(path.join(__dirname, '../../client/js/auth.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ notify = false, locks = browserAuthLocks() } = {}) {
  const storage = new Map(), tabs = [], requests = [], cookie = { user: { id: 7, role: 'student' } };
  function tab(name) {
    const listeners = {}, events = [], node = { textContent: '', style: {} };
    const context = vm.createContext({ AbortController, setTimeout, clearTimeout, console: { warn() {} }, navigator: { locks },
      localStorage: { getItem: key => storage.get(key) ?? null,
        setItem(key, value) { const oldValue = storage.get(key) ?? null; storage.set(key, value); emit(key, oldValue, value); },
        removeItem(key) { const oldValue = storage.get(key) ?? null; storage.delete(key); emit(key, oldValue, null); } },
      document: { getElementById: () => node },
      CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
      window: { addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        dispatchEvent(event) { events.push(event); for (const fn of listeners[event.type] || []) fn(event); } },
      API: { get: async () => ({ data: { user: cookie.user } }),
        post: (endpoint, payload) => new Promise((resolve, reject) => {
          requests.push({ name, endpoint, payload, reject, resolve(value) {
            if (endpoint === '/auth/logout') cookie.user = null;
            if (endpoint === '/auth/login') cookie.user = value.data.user;
            resolve(value);
          } });
        }) },
    });
    function emit(key, oldValue, newValue) {
      if (!notify || oldValue === newValue) return;
      for (const other of tabs) if (other.context !== context) queueMicrotask(() => {
        for (const fn of other.listeners.storage || []) fn({ key, oldValue, newValue });
      });
    }
    vm.runInContext(source + '\nglobalThis.auth = Auth;', context);
    const result = { context, auth: context.auth, listeners, events, node };
    tabs.push(result); return result;
  }
  return { tab, storage, requests, cookie };
}

test('logout pendente de A impede retry concorrente e login B até a resposta limpar cookie', async () => {
  const f = fixture(), a = f.tab('A'), b = f.tab('B'); a.auth.user = { id: 7, role: 'student' };
  const exiting = a.auth.logout(); await tick();
  const entering = b.auth.login('b@example.invalid', 'fixture'); await tick();
  const requestsBeforeExit = f.requests.map(request => request.endpoint);
  f.requests[0].resolve({}); await tick();
  // Settles the old implementation too, so the assertion reports the race, not a hanging test.
  const duplicate = f.requests.find((request, index) => index > 0 && request.endpoint === '/auth/logout');
  if (duplicate) { duplicate.resolve({}); await tick(); }
  const login = f.requests.find(request => request.endpoint === '/auth/login');
  login.resolve({ data: { user: { id: 8, role: 'student' } } });
  await Promise.all([exiting, entering]);
  assert.deepEqual(requestsBeforeExit, ['/auth/logout']);
  assert.deepEqual(f.requests.map(request => request.endpoint), ['/auth/logout', '/auth/login']);
  assert.equal(f.cookie.user.id, 8); assert.equal(b.auth.user.id, 8);
  assert.equal(f.storage.has('fitflow_logout_pending'), false);
});

test('retry enfileirado relê intenção já confirmada e nunca limpa o cookie do novo login', async () => {
  const f = fixture(), a = f.tab('A'), b = f.tab('B'); a.auth.user = { id: 7, role: 'student' };
  const exiting = a.auth.logout(); await tick();
  const retry = b.auth.finishPendingLogout();
  const entering = b.auth.login('b@example.invalid', 'fixture'); await tick();
  assert.equal(f.requests.length, 1);
  f.requests[0].resolve({}); await exiting; await tick();
  assert.equal(f.requests[1].endpoint, '/auth/login');
  f.requests[1].resolve({ data: { user: { id: 8, role: 'student' } } });
  await Promise.all([retry, entering]); assert.equal(f.requests.length, 2); assert.equal(f.cookie.user.id, 8);
});

test('logout solicitado durante login aguarda cookie emitido e não restaura UI do login interrompido', async () => {
  const f = fixture(), a = f.tab('A');
  const entering = a.auth.login('b@example.invalid', 'fixture');
  const interrupted = assert.rejects(entering, /interrompida/);
  await tick(); assert.equal(f.requests[0].endpoint, '/auth/login');
  const exiting = a.auth.logout(); await tick(); assert.equal(f.requests.length, 1);
  f.requests[0].resolve({ data: { user: { id: 8, role: 'student' } } }); await tick();
  assert.equal(f.requests[1].endpoint, '/auth/logout'); f.requests[1].resolve({});
  await Promise.all([exiting, interrupted]); assert.equal(f.cookie.user, null); assert.equal(a.auth.user, null);
});

test('401 e logout da sessão antiga em outra aba não limpam cookie novo mesmo antes do storage event', async () => {
  const f = fixture(), a = f.tab('A'), b = f.tab('B'); await a.auth.checkAuth();
  const oldIdentity = { userId: a.auth.user.id, generation: a.auth.generation };
  const entering = b.auth.login('b@example.invalid', 'fixture'); await tick();
  f.requests[0].resolve({ data: { user: { id: 8, role: 'student' } } }); await entering;
  for (const fn of a.listeners['auth:unauthorized']) fn({ detail: oldIdentity });
  await tick();
  assert.equal(f.requests.length, 1); assert.equal(f.cookie.user.id, 8); assert.equal(a.auth.user, null);
  assert.equal(f.storage.has('fitflow_logout_pending'), false);
});

test('evento entre abas encerra apenas UI antiga e preserva cookie/fila da nova conta', async () => {
  const f = fixture({ notify: true }), a = f.tab('A'), b = f.tab('B'); await a.auth.checkAuth();
  const entering = b.auth.login('b@example.invalid', 'fixture'); await tick();
  f.requests[0].resolve({ data: { user: { id: 8, role: 'student' } } }); await entering; await tick();
  assert.equal(a.auth.user, null); assert.equal(f.cookie.user.id, 8);
  assert.equal(a.events.at(-1).type, 'auth:logout'); assert.equal(a.events.at(-1).detail.reason, 'expired');
  assert.equal(a.events.at(-1).detail.userId, 7); assert.equal(f.requests.length, 1);
});

test('sem WebLocks login não envia cookie; logout limpa UI e mantém intenção para reconectar', async () => {
  const f = fixture({ locks: null }), a = f.tab('A');
  await assert.rejects(a.auth.login('b@example.invalid', 'fixture'), /navegador/);
  a.auth.user = { id: 7, role: 'student' }; await a.auth.logout();
  assert.equal(f.requests.length, 0); assert.equal(a.auth.user, null);
  assert.ok(f.storage.has('fitflow_logout_pending')); assert.match(a.node.textContent, /ainda não confirmada/);
});

test('startup aguardando mutação em outra aba aborta espera pelo lock em 15s sem enviar leitura antiga', async () => {
  const f = fixture(), a = f.tab('A'), b = f.tab('B');
  const entering = a.auth.login('b@example.invalid', 'fixture'); await tick();
  const timers = new Map(); let reads = 0;
  b.context.setTimeout = (callback, delay) => { assert.equal(delay, 15000); timers.set(1, callback); return 1; };
  b.context.clearTimeout = id => timers.delete(id);
  b.context.API.get = async () => { reads++; return { data: { user: { id: 7 } } }; };
  const checking = b.auth.checkAuth(); await tick();
  assert.equal(reads, 0); assert.equal(timers.size, 1);
  timers.get(1)();
  assert.equal(await checking, false); assert.equal(reads, 0); assert.equal(timers.size, 0);
  assert.equal(b.auth.user, null); assert.match(b.auth.sessionCheckError, /Confira a conexão/);
  f.requests[0].resolve({ data: { user: { id: 8, role: 'student' } } }); await entering;
  await tick(); assert.equal(reads, 0); assert.equal(b.auth.user, null);
});

test('logout explícito de tela obsoleta preserva cookie da nova conta e elimina só a intenção antiga', async () => {
  const f = fixture(), a = f.tab('A'), b = f.tab('B'); await a.auth.checkAuth();
  const entering = b.auth.login('b@example.invalid', 'fixture'); await tick();
  f.requests[0].resolve({ data: { user: { id: 8, role: 'student' } } }); await entering;
  await a.auth.logout();
  assert.equal(f.requests.length, 1); assert.equal(f.cookie.user.id, 8); assert.equal(a.auth.user, null);
  assert.equal(f.storage.has('fitflow_logout_pending'), false);
});

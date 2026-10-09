const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../client/js/auth.js'), 'utf8');
function harness(storage, api) {
  const events = [], listeners = {}, error = { textContent: '', style: {} };
  const context = vm.createContext({ console: { warn() {} }, API: api, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { getElementById: () => error },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    window: { addEventListener: (type, callback) => { listeners[type] = callback; }, dispatchEvent: event => events.push(event) } });
  vm.runInContext(source + '\nglobalThis.auth = Auth;', context);
  return { auth: context.auth, events, listeners, error };
}

test('saída offline persiste intenção e impede restauração do cookie após recarregar', async () => {
  const storage = new Map(); let checks = 0;
  const api = { post: async () => { throw Object.assign(new Error('offline'), { status: 0 }); }, get: async () => { checks++; return { data: { user: { id: 7 } } }; } };
  const first = harness(storage, api); first.auth.user = { id: 7 };
  await first.auth.logout();
  assert.equal(first.events[0].detail.serverConfirmed, false);
  assert.ok(storage.has('fitflow_logout_pending')); assert.match(first.error.textContent, /ainda não confirmada/);
  const reloaded = harness(storage, api);
  assert.equal(await reloaded.auth.checkAuth(), false);
  assert.equal(checks, 0, 'cookie que ainda existe não restaura a conta');
  assert.ok(storage.has('fitflow_logout_pending'));
  await assert.rejects(() => reloaded.auth.login('new@example.test', 'dummy'), /confirmar a saída anterior/);
});

test('retorno online e novo login compartilham limpeza pendente antes de emitir outro cookie', async () => {
  const storage = new Map([['fitflow_logout_pending', 'old-intent']]), requests = [];
  let resolveLogout;
  const api = { post: (path, body) => {
    requests.push(path);
    if (path === '/auth/logout') return new Promise(resolve => { resolveLogout = resolve; });
    return Promise.resolve({ data: { user: { id: 8, role: 'student' } } });
  } };
  const h = harness(storage, api); h.listeners.online();
  const login = h.auth.login('new@example.test', 'dummy');
  await Promise.resolve(); assert.deepEqual(requests, ['/auth/logout']);
  resolveLogout({ status: 'success' }); await login;
  assert.deepEqual(requests, ['/auth/logout', '/auth/login']);
  assert.equal(storage.has('fitflow_logout_pending'), false); assert.equal(h.auth.user.id, 8);
  assert.match(h.error.textContent, /Saída confirmada/);
});

test('limpeza confirmada no reload mantém tela de login e não restaura a sessão anterior', async () => {
  const storage = new Map([['fitflow_logout_pending', 'old-intent']]); let requests = 0;
  const h = harness(storage, { post: async () => { requests++; return {}; }, get: async () => { throw new Error('should not restore'); } });
  assert.equal(await h.auth.checkAuth(), false);
  assert.equal(requests, 1); assert.equal(storage.has('fitflow_logout_pending'), false);
});

test('logout pendente sem resposta libera startup sem restaurar cookie; novo login continua aguardando', async () => {
  const storage = new Map([['fitflow_logout_pending', 'old-intent']]);
  const paths = []; let resolveLogout;
  const h = harness(storage, {
    get: async path => { paths.push(path); throw new Error('não deve restaurar'); },
    post: (path) => {
      paths.push(path);
      if (path === '/auth/logout') return new Promise(resolve => { resolveLogout = resolve; });
      return Promise.resolve({ data: { user: { id: 8, role: 'student' } } });
    },
  });
  assert.equal(await h.auth.checkAuth(), false);
  assert.deepEqual(paths, ['/auth/logout']);
  assert.equal(h.auth.user, null);
  assert.equal(storage.has('fitflow_logout_pending'), true);
  assert.match(h.error.textContent, /ainda não confirmada/);
  let loginFinished = false;
  const login = h.auth.login('new@example.test', 'dummy').then(() => { loginFinished = true; });
  await Promise.resolve();
  assert.equal(loginFinished, false);
  assert.deepEqual(paths, ['/auth/logout']);
  resolveLogout({ status: 'success' });
  await login;
  assert.deepEqual(paths, ['/auth/logout', '/auth/login']);
  assert.equal(storage.has('fitflow_logout_pending'), false);
  assert.equal(h.auth.user.id, 8);
});

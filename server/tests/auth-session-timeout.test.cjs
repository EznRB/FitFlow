const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sources = ['api.js', 'auth.js'].map(file => fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8')).join('\n');

function harness(fetch) {
  const storage = new Map([['fitflow_user', '{"id":9}']]), timers = new Map(), delays = [], requests = [];
  let nextTimer = 0, cleared = 0;
  const context = vm.createContext({
    AbortController, console: { warn() {} },
    fetch: (url, options) => { requests.push({ url, options }); return fetch(url, options); },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, callback); delays.push(delay); return id; },
    clearTimeout(id) { if (timers.delete(id)) cleared++; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    window: { addEventListener() {}, dispatchEvent() {} },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  vm.runInContext(`${sources}\nglobalThis.auth = Auth; globalThis.api = API;`, context);
  return { auth: context.auth, api: context.api, storage, timers, delays, requests,
    fireTimeout() { assert.equal(timers.size, 1); [...timers.values()][0](); }, get cleared() { return cleared; } };
}

const success = () => new Response(JSON.stringify({ data: { user: { id: 7, name: 'Fixture', role: 'student' } } }), { status: 200 });

test('verificação de sessão aborta fetch pendente em 15s, libera estado e limpa timer', async () => {
  const h = harness((url, { signal }) => new Promise((resolve, reject) => {
    assert.equal(url, '/api/auth/me');
    signal.addEventListener('abort', () => reject(Object.assign(new Error('private-abort-detail'), { name: 'AbortError' })), { once: true });
  }));
  let settled = false;
  const check = h.auth.checkAuth().then(value => { settled = true; return value; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.deepEqual(h.delays, [15000]);
  assert.equal(h.requests[0].options.signal.aborted, false);
  h.fireTimeout();
  assert.equal(await check, false);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.auth.user, null);
  assert.equal(h.storage.has('fitflow_user'), false);
  assert.match(h.auth.sessionCheckError, /Confira a conexão/);
  assert.doesNotMatch(h.auth.sessionCheckError, /private/);
  assert.equal(h.timers.size, 0);
  assert.equal(h.cleared, 1);
});

test('resposta tardia após abort nunca restaura usuário ou cache, mesmo se fetch ignorar signal', async () => {
  let resolveFetch;
  const h = harness(() => new Promise(resolve => { resolveFetch = resolve; }));
  const check = h.auth.checkAuth();
  h.fireTimeout();
  resolveFetch(success());
  assert.equal(await check, false);
  assert.equal(h.auth.user, null);
  assert.equal(h.storage.has('fitflow_user'), false);
  assert.equal(h.timers.size, 0);
});

test('leitura antiga não substitui identidade nova; sucesso limpa timer e próximo check limpa aviso', async () => {
  let resolveFetch;
  const h = harness(() => new Promise(resolve => { resolveFetch = resolve; }));
  const check = h.auth.checkAuth();
  h.auth.generation++;
  h.auth.user = { id: 8, name: 'Nova sessão' };
  h.storage.set('fitflow_user', '{"id":8}');
  resolveFetch(success());
  assert.equal(await check, false);
  assert.equal(h.auth.user.id, 8);
  assert.equal(h.storage.get('fitflow_user'), '{"id":8}');
  assert.equal(h.auth.sessionCheckError, null);
  assert.equal(h.timers.size, 0);
  const successful = harness(async () => success());
  successful.auth.sessionCheckError = 'Aviso antigo';
  assert.equal(await successful.auth.checkAuth(), true);
  assert.equal(successful.auth.user.id, 7);
  assert.equal(successful.auth.sessionCheckError, null);
  assert.equal(successful.cleared, 1);
});

test('rede e gateways exibem aviso seguro; sessão ausente 401 não acusa falha de conexão', async () => {
  for (const status of [0, 502, 503, 401]) {
    const h = harness(async () => {
      if (status === 0) throw new TypeError('private-network-detail');
      return new Response(JSON.stringify({ message: 'private-provider-detail' }), { status });
    });
    assert.equal(await h.auth.checkAuth(), false);
    assert.equal(h.auth.user, null);
    assert.equal(h.timers.size, 0);
    if (status === 401) assert.equal(h.auth.sessionCheckError, null);
    else {
      assert.match(h.auth.sessionCheckError, /Confira a conexão/);
      assert.doesNotMatch(h.auth.sessionCheckError, /private/);
    }
  }
});

test('API.get transporta signal e mantém GET; escritas financeiras não ganham timeout ou abort', async () => {
  const h = harness(async () => new Response(null, { status: 204 }));
  const controller = new AbortController();
  await h.api.get('/auth/me', { signal: controller.signal, method: 'DELETE', body: 'override' });
  assert.equal(h.requests[0].options.signal, controller.signal);
  assert.equal(h.requests[0].options.method, 'GET');
  assert.equal(h.requests[0].options.body, undefined);
  await h.api.post('/pagamentos', { amount: 50 });
  assert.equal(h.requests[1].options.method, 'POST');
  assert.equal(h.requests[1].options.signal, undefined);
  assert.equal(h.timers.size, 0);
  assert.deepEqual(h.delays, []);
});

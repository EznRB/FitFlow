// O browser é simulado apenas na borda; o módulo de requisições real é executado.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/api.js'), 'utf8');
function client(fetch, extra = {}) {
  const events = [];
  const context = vm.createContext({ fetch, window: { dispatchEvent: e => events.push(e.type) },
    CustomEvent: class { constructor(type) { this.type = type; } }, ...extra });
  vm.runInContext(`${source}\nthis.testAPI = API;`, context);
  return { api: context.testAPI, events };
}
test('403 de negócio preserva sessão; 401 solicita novo login', async () => {
  for (const status of [403, 401]) {
    const c = client(async () => new Response(JSON.stringify({ message: 'Recusado' }), { status }));
    await assert.rejects(c.api.get('/teste'), e => e.status === status && e.message === 'Recusado');
    assert.equal(c.events.length, status === 401 ? 1 : 0);
  }
});
test('HTML 502 mantém status HTTP e não acusa falta de internet', async () => {
  const c = client(async () => new Response('<html>Gateway error</html>', { status: 502 }));
  await assert.rejects(c.api.get('/teste'), e => e.status === 502 && !e.message.includes('internet'));
});
test('204 é válido; erro de rede tem status zero', async () => {
  assert.equal(await client(async () => new Response(null, { status: 204 })).api.get('/teste'), null);
  await assert.rejects(client(async () => { throw new TypeError('fetch failed'); }).api.get('/teste'), e => e.status === 0);
});

test('PUT aplica o prazo optativo e descarta confirmação tardia sem reenviar', async () => {
  let finish, config, timer, calls = 0, cleared = 0;
  const c = client(async (url, options) => {
    calls++; config = options;
    return new Promise(resolve => { finish = resolve; });
  }, { AbortController, setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; }, clearTimeout: () => { cleared++; } });
  const pending = c.api.put('/checkins/10/cancelar', { motivo: 'Registro incorreto' }, { timeoutMs: 15000 });
  const outcome = pending.then(value => ({ value }), error => ({ error }));
  assert.equal(timer?.delay, 15000);
  assert.equal(config.method, 'PUT');
  assert.equal(JSON.parse(config.body).motivo, 'Registro incorreto');
  timer.callback();
  const result = await outcome;
  assert.equal(result.error.timeout, true);
  assert.equal(result.error.status, 0);
  assert.equal(config.signal.aborted, true);
  finish(new Response(JSON.stringify({ success: true }), { status: 200 }));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(cleared, 1);
});

test('PUT respeita signal externo abortado antes de enviar', async () => {
  let calls = 0; const controller = new AbortController(); controller.abort();
  const c = client(async () => { calls++; return new Response('{}'); });
  await assert.rejects(c.api.put('/checkins/10/cancelar', { motivo: 'Registro incorreto' }, { signal: controller.signal }), error => error.status === 0);
  assert.equal(calls, 0);
});

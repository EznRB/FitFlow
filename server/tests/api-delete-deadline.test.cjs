const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/api.js'), 'utf8');
function client(fetch, extra = {}) {
  const events = [];
  const context = vm.createContext({ fetch, window: { dispatchEvent: event => events.push(event.type) },
    CustomEvent: class { constructor(type) { this.type = type; } }, ...extra });
  vm.runInContext(`${source}\nthis.testAPI = API;`, context);
  return { api: context.testAPI, events };
}
test('DELETE encerra transporte que ignora abort e descarta erro tardio sem reenviar', async () => {
  let finish, config, timer, calls = 0, cleared = 0;
  const c = client(async (_, options) => {
    calls++; config = options; return new Promise(resolve => { finish = resolve; });
  }, { AbortController, setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; }, clearTimeout: () => { cleared++; } });
  const pending = c.api.delete('/planos/10', { timeoutMs: 15000 });
  const outcome = pending.then(value => ({ value }), error => ({ error }));
  assert.equal(timer?.delay, 15000); assert.equal(config.method, 'DELETE'); assert.equal(config.body, undefined);
  timer.callback(); const result = await outcome;
  assert.equal(result.error.timeout, true); assert.equal(result.error.status, 0); assert.equal(config.signal.aborted, true);
  finish(new Response(JSON.stringify({ message: 'Sessão antiga' }), { status: 401 }));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls, 1); assert.equal(cleared, 1); assert.equal(c.events.length, 0);
});
test('DELETE respeita signal externo já abortado sem enviar inativação', async () => {
  let calls = 0; const controller = new AbortController(); controller.abort();
  const c = client(async () => { calls++; return new Response('{}'); });
  await assert.rejects(c.api.delete('/planos/10', { signal: controller.signal }), error => error.status === 0);
  assert.equal(calls, 0);
});

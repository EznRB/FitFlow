// O browser é simulado apenas na borda; o módulo de requisições real é executado.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../client/js/api.js'), 'utf8');
function client(fetch) {
  const events = [];
  const context = vm.createContext({ fetch, window: { dispatchEvent: e => events.push(e.type) },
    CustomEvent: class { constructor(type) { this.type = type; } } });
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

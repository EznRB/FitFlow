const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createLogoutGuard } = require('../../client/js/pwa');
function serviceWorker() {
  const handlers = {}, fetches = [], puts = [], entries = new Map();
  const cache = { match: async key => entries.get(typeof key === 'string' ? key : new URL(key.url).pathname),
    put: async (key, value) => { const name = typeof key === 'string' ? key : new URL(key.url).pathname; puts.push(name); entries.set(name, value); } };
  const context = { URL, Request, Response, Headers, Promise, Set, console,
    self: { location: { origin: 'https://fitflow.example' }, addEventListener: (name, fn) => handlers[name] = fn, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async request => { fetches.push(request); const pathname = new URL(typeof request === 'string' ? request : request.url, 'https://fitflow.example').pathname; return new Response('public', { headers: { 'Content-Type': pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.png') ? 'image/png' : pathname.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html' } }); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../client/sw.js'), 'utf8'), context);
  return { handlers, fetches, puts, entries, context };
}
test('service worker nunca intercepta API, auth, POST, terceiros ou query privada', () => {
  const sw = serviceWorker();
  for (const request of [new Request('https://fitflow.example/api/aluno/painel'), new Request('https://fitflow.example/api/auth/me'),
    new Request('https://fitflow.example/api/sessoes/start', { method: 'POST', body: '{}' }), new Request('https://third.example/icons/icon-192.png'),
    new Request('https://fitflow.example/icons/icon-192.png?studentId=42'), new Request('https://fitflow.example/icons/icon-192.png', { headers: { Authorization: 'Bearer private' } })]) {
    let intercepted = false; sw.handlers.fetch({ request, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, request.url);
  }
  assert.deepEqual(sw.puts, []);
});
test('install cache contém somente allowlist pública; cache fetch não envia cookies', async () => {
  const sw = serviceWorker(); let installed;
  sw.handlers.install({ waitUntil(promise) { installed = promise; } }); await installed;
  assert.ok(sw.puts.includes('/offline.html')); assert.ok(!sw.puts.includes('/')); assert.ok(!sw.puts.includes('/index.html'));
  assert.ok(sw.puts.every(name => !name.startsWith('/api')));
  assert.ok(sw.fetches.every(request => request.credentials === 'omit'));
});
test('navegação offline retorna shell público sem cachear HTML autenticado', async () => {
  const sw = serviceWorker(); sw.entries.set('/offline.html', new Response('shell público'));
  sw.context.fetch = async () => { throw new Error('offline'); };
  let response; sw.handlers.fetch({ request: { method: 'GET', url: 'https://fitflow.example/', mode: 'navigate', headers: new Headers() }, respondWith(value) { response = value; } });
  assert.equal(await (await response).text(), 'shell público'); assert.deepEqual(sw.puts, []);
});
test('resposta private/no-store impede instalar uma versão com conteúdo cacheado indevido', async () => {
  const sw = serviceWorker(); sw.context.fetch = async () => new Response('private', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'private, no-store' } });
  let installed; sw.handlers.install({ waitUntil(value) { installed = value; } });
  await assert.rejects(installed, /públic/i); assert.deepEqual(sw.puts, []);
});
test('HTML de fallback em lugar de JS/ícone e Vary personalizado não entram no cache', async () => {
  for (const headers of [{ 'Content-Type': 'text/html' }, { 'Content-Type': 'text/html', Vary: '*' }, { 'Content-Type': 'text/html', Vary: 'Cookie' }]) {
    const sw = serviceWorker(); sw.context.fetch = async () => new Response('fallback', { headers });
    let installed; sw.handlers.install({ waitUntil(value) { installed = value; } });
    await assert.rejects(installed); assert.deepEqual(sw.puts, []);
  }
});
test('manifest aponta a ícones PNG com dimensões corretas e uma identidade estável', () => {
  const client = path.join(__dirname, '../../client');
  const manifest = JSON.parse(fs.readFileSync(path.join(client, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const bytes = fs.readFileSync(path.join(client, icon.src));
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  }
  const sw = serviceWorker(); let installed;
  sw.handlers.install({ waitUntil(value) { installed = value; } });
  return installed.then(() => { for (const asset of sw.puts) assert.ok(fs.existsSync(path.join(client, asset)), asset); });
});
test('logout com fila oferece decisão e nunca apaga dados antes de confirmação', async () => {
  let flushed = false, asked = 0;
  const state = { userId: 1, operations: [{ type: 'set' }] };
  const guard = createLogoutGuard({ read: async id => { assert.equal(id, 1); return state; }, flush: async () => { flushed = true; }, choose: async details => { asked++; assert.equal(details.pendingSets, 1); return 'stay'; } });
  assert.equal(await guard(1), false); assert.equal(flushed, false); assert.equal(asked, 1); assert.equal(state.operations.length, 1);
});
test('sincronizar e sair só permite logout quando todos os envios foram confirmados', async () => {
  let pending = true;
  const guard = createLogoutGuard({ read: async () => ({ userId: 1, operations: pending ? [{ type: 'set' }] : [] }), flush: async () => { pending = false; }, choose: async () => 'sync' });
  assert.equal(await guard(1), true);
  const failing = createLogoutGuard({ read: async () => ({ userId: 1, operations: [{ type: 'set' }] }), flush: async () => {}, choose: async () => 'sync' });
  assert.equal(await failing(1), false);
});
test('troca de conta durante o guard cancela logout e falha de armazenamento não autoriza descarte', async () => {
  let current = true;
  const guard = createLogoutGuard({ read: async () => ({ userId: 1, operations: [{ type: 'start' }] }), choose: async () => { current = false; return 'discard'; }, isCurrent: () => current });
  assert.equal(await guard(1), false);
  const broken = createLogoutGuard({ read: async () => { throw new Error('storage'); }, choose: async () => 'discard' });
  assert.equal(await broken(1), false);
});

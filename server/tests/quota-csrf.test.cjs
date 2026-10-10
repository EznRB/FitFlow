const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createQuotaLimiter, hashIdentity, normalizeClientIp } = require('../src/middleware/quota');
const { createCsrfProtection, normalizeOrigins } = require('../src/middleware/csrf');
const { createAuthRouter } = require('../src/routes/auth.routes');
const { createIaRouter } = require('../src/routes/ia.routes');

async function serve(t, setup) {
  const app = express(); app.use(express.json(), express.urlencoded({ extended: false }), cookieParser()); setup(app);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}
const payload = headers => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' });
function store() {
  const counts = new Map(); const identities = [];
  return { identities, counts, async increment(key) { identities.push(key); const hits = (counts.get(key) || 0) + 1; counts.set(key, hits);
    return { totalHits: hits, resetTime: new Date(Date.now() + 900000) }; } };
}

test('quota produção compartilha buckets entre routers e ignora IP encaminhado não confiado', async t => {
  const shared = store(); let logins = 0;
  const router = () => createAuthRouter({ service: { login: async () => { logins++; throw Object.assign(new Error('Inválido'), { statusCode: 401 }); } }, quotaOptions: { production: true, store: shared } });
  const url = await serve(t, app => { app.use('/a', router()); app.use('/b', router()); });
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => fetch(`${url}/${i % 2 ? 'a' : 'b'}/login`, {
    ...payload({ 'X-Forwarded-For': `198.51.100.${i}`, 'X-Vercel-Forwarded-For': `203.0.113.${i}` }), body: JSON.stringify({ email: 'fixture@example.invalid', password: 'controlled-test-password' }) })));
  assert.equal(responses.filter(response => response.status === 401).length, 10);
  assert.equal(responses.filter(response => response.status === 429).length, 2); assert.equal(logins, 10);
  assert.equal(new Set(shared.identities).size, 1); assert.match(shared.identities[0], /^[a-f0-9]{64}$/);
  assert.equal(shared.identities[0], hashIdentity('auth:login', '127.0.0.1'));
  assert.equal(responses.find(response => response.status === 429).headers.get('Retry-After'), '900');
});

test('Vercel usa somente header canônico válido; IPv6 /64 compartilha quota e ausência falha 503', async t => {
  assert.equal(normalizeClientIp('2001:db8:abcd:1234::2'), normalizeClientIp('2001:0DB8:abcd:1234:0:0:0:1'));
  assert.equal(normalizeClientIp('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(normalizeClientIp('::ffff:c000:201'), '192.0.2.1');
  for (const value of [undefined, '198.51.100.1, 198.51.100.2', 'garbage', '127.0.0.1:10', 'fe80::1%eth0']) assert.throws(() => normalizeClientIp(value));
  const shared = store();
  const url = await serve(t, app => app.post('/quota', createQuotaLimiter({ endpoint: 'fixture:vercel', production: true, vercel: true, store: shared }), (req, res) => res.sendStatus(204)));
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => fetch(url + '/quota', payload({ 'X-Vercel-Forwarded-For': `2001:db8:abcd:1234::${(i + 1).toString(16)}`, 'X-Forwarded-For': `198.51.100.${i}` }))));
  assert.equal(responses.filter(response => response.status === 204).length, 10);
  assert.equal(responses.filter(response => response.status === 429).length, 2);
  assert.equal(new Set(shared.identities).size, 1);
  assert.equal((await fetch(url + '/quota', payload({ 'X-Vercel-Forwarded-For': '2001:db8:abcd:1235::1' }))).status, 204);
  for (const value of [undefined, 'a,b', 'unknown']) assert.equal((await fetch(url + '/quota', payload(value ? { 'X-Vercel-Forwarded-For': value } : {}))).status, 503);
  assert.equal(shared.identities.length, 13);
});

test('DB indisponível é 503 antes do provedor/login; autorização 403 não gasta quota', async t => {
  let increments = 0; let calls = 0; let role = 'student';
  const failing = { async increment() { increments++; throw new Error('database-private-detail'); } };
  const url = await serve(t, app => {
    app.use('/auth', createAuthRouter({ service: { login: async () => { calls++; } }, quotaOptions: { production: true, store: failing } }));
    app.use('/ia', createIaRouter({ enabled: true, explain: async () => { calls++; } }, { authenticate: (req, res, next) => { req.user = { id: 7, role }; next(); }, quotaOptions: { production: true, store: failing } }));
  });
  for (const path of ['/auth/login', '/ia/explicar']) {
    const response = await fetch(url + path, payload()); assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /database-private-detail/);
  }
  role = 'unknown'; assert.equal((await fetch(url + '/ia/explicar', payload())).status, 403);
  assert.equal(increments, 2); assert.equal(calls, 0);
  assert.notEqual(hashIdentity('auth:login', '7'), hashIdentity('ia:explicar', '7'));
  assert.notEqual(hashIdentity('auth:login', '7', 'controlled-secret-a'), hashIdentity('auth:login', '7', 'controlled-secret-b'));
});

test('quota produção recusa trust proxy irrestrito antes de consumir bucket', async t => {
  const shared = store();
  const url = await serve(t, app => {
    app.set('trust proxy', true);
    app.post('/quota', createQuotaLimiter({ endpoint: 'fixture', production: true, store: shared }), (req, res) => res.sendStatus(204));
  });
  assert.equal((await fetch(url + '/quota', payload({ 'X-Forwarded-For': '198.51.100.1' }))).status, 503);
  assert.equal(shared.identities.length, 0);
});

test('CSRF exige origem configurada para mutações com cookie e recusa null/forged/ausente', async t => {
  assert.deepEqual(normalizeOrigins('https://fitflow.example, http://127.0.0.1:3107'), ['https://fitflow.example', 'http://127.0.0.1:3107']);
  let mutations = 0;
  const url = await serve(t, app => {
    app.use('/api', createCsrfProtection({ allowedOrigins: 'https://fitflow.example,http://127.0.0.1:3107' }));
    app.all('/api/data', (req, res) => { if (req.method !== 'GET') mutations++; res.sendStatus(204); });
    app.post('/api/auth/login', (req, res) => res.sendStatus(204));
    app.post('/api/checkout/webhook', (req, res) => res.status(401).json({ message: 'Assinatura obrigatória.' }));
  });
  for (const origin of [undefined, 'null', 'https://evil.example', 'https://fitflow.example.evil.example', 'https://fitflow.example/path']) {
    const response = await fetch(url + '/api/data', payload({ cookie: 'access_token=opaque-test', ...(origin ? { Origin: origin } : {}) }));
    assert.equal(response.status, 403);
  }
  assert.equal((await fetch(url + '/api/data', payload({ cookie: 'access_token=opaque-test', Origin: 'https://fitflow.example' }))).status, 204);
  assert.equal((await fetch(url + '/api/data', { headers: { cookie: 'access_token=opaque-test' } })).status, 204);
  assert.equal((await fetch(url + '/api/data', payload({ authorization: 'Bearer test-cli' }))).status, 204);
  assert.equal((await fetch(url + '/api/data', payload({ authorization: 'Bearer test-cli', cookie: 'access_token=opaque-test' }))).status, 403);
  assert.equal((await fetch(url + '/api/data', payload())).status, 403);
  assert.equal((await fetch(url + '/api/auth/login', payload())).status, 204);
  assert.equal((await fetch(url + '/api/auth/login', payload({ 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal((await fetch(url + '/api/data', payload({ authorization: 'Bearer test-cli', Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await fetch(url + '/api/checkout/webhook', payload())).status, 401);
  assert.equal((await fetch(url + '/api/checkout/webhook?x=1', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 403);
  assert.equal((await fetch(url + '/api/checkout/webhook/', payload())).status, 403);
  assert.equal(mutations, 2);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { normalizeOrigins, resolveAllowedOrigins } = require('../src/config/origins');
const { createCsrfProtection } = require('../src/middleware/csrf');

test('origens Vercel acrescentam apenas o deployment exato à allowlist configurada', () => {
  const origin = 'https://fit-flow-indol.vercel.app';
  const preview = 'fit-flow-abc123-eznrbs-projects.vercel.app';
  assert.deepEqual(resolveAllowedOrigins(`${origin},http://127.0.0.1:3107`, { VERCEL: '1', VERCEL_URL: preview }),
    [origin, 'http://127.0.0.1:3107', `https://${preview}`]);
  assert.deepEqual(resolveAllowedOrigins(origin, { VERCEL: '1', VERCEL_URL: 'fit-flow-indol.vercel.app' }), [origin]);
  for (const VERCEL of [undefined, '0', 'true']) {
    assert.deepEqual(resolveAllowedOrigins(origin, { VERCEL, VERCEL_URL: preview }), [origin]);
  }
  assert.deepEqual(resolveAllowedOrigins(origin, { VERCEL: '1' }), [origin]);
});

test('origens Vercel recusam esquema, credenciais, porta, caminho e host não canônico', () => {
  for (const VERCEL_URL of [
    'https://fit-flow.vercel.app', 'fit-flow.vercel.app/', 'fit-flow.vercel.app/path',
    'fit-flow.vercel.app:443', 'user@fit-flow.vercel.app', 'fit-flow.vercel.app?x=1',
    'fit-flow.vercel.app#fragment', 'fit-flow.vercel.app.evil.example', 'evil.example',
    'vercel.app', '*.vercel.app', '-fitflow.vercel.app', 'fitflow-.vercel.app',
    'fit_flow.vercel.app', 'FitFlow.vercel.app', 'fitflow.vercel.app.',
    ' fitflow.vercel.app', 'fitflow.vercel.app\n', `${'a'.repeat(64)}.vercel.app`, 42,
  ]) assert.throws(() => resolveAllowedOrigins('https://fitflow.example', { VERCEL: '1', VERCEL_URL }), /VERCEL_URL/);
  for (const origin of ['*', 'null', 'https://fitflow.example/path', 'https://user@fitflow.example']) {
    assert.throws(() => normalizeOrigins(origin));
  }
});

test('CORS e CSRF aceitam o preview exato e recusam outros deployments e Host forjado', async t => {
  const canonical = 'https://fit-flow-indol.vercel.app';
  const preview = 'https://fit-flow-abc123-eznrbs-projects.vercel.app';
  const allowedOrigins = resolveAllowedOrigins(canonical, { VERCEL: '1', VERCEL_URL: preview.slice(8) });
  const app = express();
  app.use(cors({ origin: allowedOrigins, credentials: true }), express.json(), cookieParser());
  app.use('/api', createCsrfProtection({ allowedOrigins }));
  let mutations = 0;
  app.post('/api/data', (req, res) => { mutations++; res.sendStatus(204); });
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/data`;
  const send = origin => fetch(url, { method: 'POST', headers: {
    Origin: origin, 'Content-Type': 'application/json', Cookie: 'access_token=fixture',
    Host: 'evil.vercel.app', 'X-Forwarded-Host': 'evil.vercel.app',
  }, body: '{}' });
  for (const origin of [canonical, preview]) {
    const response = await send(origin);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  }
  for (const origin of ['https://evil.vercel.app', `${preview}.evil.example`, `${preview}:444`,
    preview.replace('https:', 'http:'), 'null']) {
    const response = await send(origin);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(mutations, 2);
});

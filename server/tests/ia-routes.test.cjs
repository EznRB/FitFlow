// Exercita HTTP, JWT real de teste e limite de usuário sem banco ou provedor externo.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const { createIaRouter } = require('../src/routes/ia.routes');
const { createAuthenticate } = require('../src/middleware/auth');
const { createIaService } = require('../src/services/ia.service');

test('IA HTTP exige sessão/role e limita chamadas por usuário', async t => {
  let calls = 0;
  let role = 'student';
  const authenticate = createAuthenticate({ findUser: async id => ({ id, role, active: true }) });
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api/ia', createIaRouter({ enabled: true, explain: async () => {
    calls++; return { explanation: 'Explicação controlada de teste, sem geração real.' };
  } }, { authenticate }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/ia`;
  const cookie = role => `access_token=${jwt.sign({ id: 72500, role }, env.jwt.secret, { expiresIn: '5m' })}`;
  assert.equal((await fetch(`${url}/status`)).status, 401);
  role = 'unknown';
  assert.equal((await fetch(`${url}/status`, { headers: { cookie: cookie('unknown') } })).status, 403);
  role = 'student';
  const status = await fetch(`${url}/status`, { headers: { cookie: cookie('student') } });
  assert.deepEqual(await status.json(), { status: 'success', data: { enabled: true } });
  for (let i = 0; i < 11; i++) {
    const response = await fetch(`${url}/explicar`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cookie('student') }, body: JSON.stringify({ topic: 'volume' }) });
    assert.equal(response.status, i < 10 ? 200 : 429);
  }
  assert.equal(calls, 10);
});

test('IA HTTP Groq revela só disponibilidade/provedor e retorna fontes curadas sem credencial', async t => {
  let calls = 0;
  const service = createIaService({ provider: 'groq', groqApiKey: 'fixture-private-groq-key',
    groqModel: 'openai/gpt-oss-120b', freeTierConfirmed: true, fetchImpl: async () => {
      calls++; return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
        content: JSON.stringify({ explanation: 'A organização do treino depende da disponibilidade e de comparar o volume explicitamente.', sourceIds: ['split-2024'] }),
        reasoning: 'fixture-private-reasoning',
      } }] }));
    } });
  const authenticate = createAuthenticate({ findUser: async id => ({ id, role: 'student', active: true }) });
  const app = express(); app.use(express.json(), cookieParser());
  app.use('/api/ia', createIaRouter(service, { authenticate }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/ia`;
  const cookie = `access_token=${jwt.sign({ id: 72501, role: 'student' }, env.jwt.secret, { expiresIn: '5m' })}`;
  const status = await fetch(`${url}/status`, { headers: { cookie } });
  assert.deepEqual(await status.json(), { status: 'success', data: { enabled: true, provider: 'groq' } });
  assert.equal(calls, 0, 'status não faz inferência');
  const response = await fetch(`${url}/explicar`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ topic: 'divisoes' }) });
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.data.generatedByAI, true); assert.equal(calls, 1);
  assert.equal(result.data.sources[0].id, 'split-2024');
  assert.equal(JSON.stringify(result).includes('fixture-private'), false);
});

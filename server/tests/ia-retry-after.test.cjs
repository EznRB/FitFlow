const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createIaChatService } = require('../src/services/ia-chat.service');
const { createIaRouter } = require('../src/routes/ia.routes');
const { errorHandler } = require('../src/middleware/errorHandler');
const { program, routineUserText } = require('./fixtures/ia-routine.cjs');
const input = { consent: true, messages: [{ role: 'user', content: routineUserText }] };
const completed = content => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }));
const limited = value => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'provider-private-message' } }),
  { status: 429, headers: value === null ? {} : { 'Retry-After': value } });
const service = fetchImpl => createIaChatService({ provider: 'groq', groqApiKey: 'fixture-only', freeTierConfirmed: true, fetchImpl });

test('429 preserva espera válida em qualquer etapa, sem retry e sem conteúdo privado', async () => {
  for (const stage of ['primary', 'routine', 'grounded']) {
    let calls = 0;
    const current = service(async () => {
      calls++;
      if (stage !== 'primary' && calls === 1) return completed({ turn: stage === 'routine'
        ? { kind: 'routine_draft', context: program().context } : { kind: 'answer', sourceIds: [] } });
      return limited('37');
    });
    await assert.rejects(current.chat(input), error => error.statusCode === 429 && error.retryAfterSeconds === 37
      && /37/.test(error.message) && !/provider-private/.test(error.message));
    assert.equal(calls, stage === 'primary' ? 1 : 2);
  }
});

test('espera ausente, inválida ou excessiva não inventa prazo de recuperação da quota', async () => {
  for (const value of [null, '', '0', '-1', '1.5', '1e3', '86401', 'tomorrow', '37, 50']) {
    await assert.rejects(service(async () => limited(value)).chat(input), error => error.statusCode === 429
      && error.retryAfterSeconds === undefined && error.message === 'A quota gratuita da IA foi atingida. Tente novamente mais tarde.');
  }
});

test('limites de espera válidos são preservados, com mensagem legível e sem garantia de recuperação', async () => {
  for (const [value, label] of [['1', '1 segundo'], ['60', '1 minuto'], ['61', '2 minutos'], ['86400', '1440 minutos']]) {
    await assert.rejects(service(async () => limited(value)).chat(input), error => error.statusCode === 429
      && error.retryAfterSeconds === Number(value) && error.message.includes(label)
      && error.message.includes('A quota pode continuar indisponível.'));
  }
});

test('HTTP devolve Retry-After validado e não cacheia falha da IA', async t => {
  let calls = 0;
  const app = express(); app.use(express.json());
  app.use('/api/ia', createIaRouter({ enabled: false }, {
    authenticate(req, res, next) { req.user = { id: 4242, role: 'student' }; next(); },
    quotaOptions: { production: true, store: { async increment() { return { totalHits: 1, resetTime: new Date(Date.now() + 900000) }; } } },
    chatService: service(async () => { calls++; return limited('37'); }),
  }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/ia/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '37');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const body = await response.json();
  assert.match(body.message, /37/); assert.doesNotMatch(JSON.stringify(body), /provider-private|fixture-only/);
  assert.equal(calls, 1);
});

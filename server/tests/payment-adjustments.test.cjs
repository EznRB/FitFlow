const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPaymentAdjustmentsService } = require('../src/services/payment-adjustments.service');
const { adjustmentSummary } = require('../src/utils/paymentAdjustment');

function fixture() {
  const actor = { id: 7, role: 'admin', active: true, name: 'Administrador original' };
  const student = { id: 11, planId: 2, planStartDate: new Date('2026-10-01'), planEndDate: new Date('2026-11-01'),
    membershipRevision: 3, status: 'active', user: { active: true } };
  const payment = { id: 21, studentId: 11, status: 'paid', amount: '150.00', paymentDate: new Date('2026-10-08'),
    dueDate: new Date('2026-11-01'), registeredBy: 7, intent: null, membershipGrant: null };
  const events = []; let barrier = Promise.resolve(), now = new Date('2026-10-11T12:00:00Z');
  const db = {
    user: { findUnique: async ({ where }) => where.id === actor.id ? structuredClone(actor) : null },
    student: { findUnique: async () => structuredClone(student), update: async ({ data }) => {
      Object.assign(student, data, ...(data.membershipRevision?.increment ? [{ membershipRevision: student.membershipRevision + data.membershipRevision.increment }] : []));
      return structuredClone(student);
    } },
    payment: { findUnique: async ({ where }) => where.id === payment.id ? structuredClone(payment) : null,
      update: async () => assert.fail('Recibo original não pode ser alterado') },
    paymentAdjustment: {
      findUnique: async ({ where }) => structuredClone(events.find(row => row.id === where.id) || null),
      findMany: async ({ where }) => structuredClone(events.filter(row => row.paymentId === where.paymentId)),
      create: async ({ data }) => { if (events.some(row => row.id === data.id)) throw Object.assign(new Error('UUID duplicado'), { code: 'P2002' });
        const event = { ...structuredClone(data), createdAt: new Date(now) }; events.push(event); return structuredClone(event); },
    },
    async $transaction(run) {
      let release, savedStudent, savedEvents;
      const tx = { ...db, $queryRaw: async () => {
        const prior = barrier; barrier = new Promise(resolve => { release = resolve; }); await prior;
        savedStudent = structuredClone(student); savedEvents = structuredClone(events);
      } };
      try { return await run(tx); }
      catch (error) { if (savedStudent) { Object.assign(student, savedStudent); events.splice(0, events.length, ...savedEvents); } throw error; }
      finally { release?.(); }
    },
  };
  const service = createPaymentAdjustmentsService({ db, now: () => now });
  const input = { idempotencyKey: randomUUID(), expectedActorId: 7, kind: 'correction', amount: '50.00', reason: 'Recebimento lançado com valor incorreto.' };
  return { service, db, actor, student, payment, events, input, advance: value => { now = new Date(value); } };
}

test('ajuste parcial preserva recibo e vigência, captura ator e estado e não executa PSP', async () => {
  const f = fixture(), before = structuredClone(f.payment), studentBefore = structuredClone(f.student);
  const event = await f.service.registrar(21, f.input, 7);
  assert.deepEqual(f.payment, before); assert.deepEqual(f.student, studentBefore);
  assert.equal(event.amount, 50); assert.equal(event.actorName, 'Administrador original');
  assert.equal(event.providerRefundPerformed, false); assert.equal(event.requestHash, undefined);
  assert.deepEqual(event.membershipBefore, event.membershipAfter);
  assert.equal(event.membershipBefore.membershipRevision, 3); assert.equal(event.membershipBefore.planEndDate, '2026-11-01');
  assert.equal(event.membershipBefore.userActive, true); assert.equal(f.events.length, 1);
});

test('ajustes parciais acumulam exatamente até o integral e não deixam saldo negativo', async () => {
  const f = fixture();
  await f.service.registrar(21, { ...f.input, amount: '0.01' }, 7);
  await f.service.registrar(21, { ...f.input, idempotencyKey: randomUUID(), amount: '149.99', kind: 'refund_recorded' }, 7);
  assert.deepEqual(adjustmentSummary(f.payment, f.events), { originalAmount: 150, adjustedAmount: 150, remainingAmount: 0, correctionAmount: 0.01, refundRecordedAmount: 149.99 });
  await assert.rejects(f.service.registrar(21, { ...f.input, idempotencyKey: randomUUID(), amount: '0.01' }, 7), e => e.statusCode === 409);
  assert.equal(f.events.length, 2);
});

test('replay antes do saldo retorna evento original após integral, mudança de data e mudança de nome do ator', async () => {
  const f = fixture(), request = { ...f.input, amount: 150 };
  const first = await f.service.registrar(21, request, 7);
  f.advance('2026-10-13T12:00:00Z'); f.actor.name = 'Nome novo';
  const replay = await f.service.registrar(21, { ...request, amount: '150.00' }, 7);
  assert.deepEqual(replay, first); assert.equal(f.events.length, 1);
  for (const changes of [{ amount: 149 }, { reason: 'Outro motivo' }, { effectiveDate: '2026-10-13' }, { kind: 'refund_recorded' }])
    await assert.rejects(f.service.registrar(21, { ...request, ...changes }, 7), e => e.statusCode === 409);
});

test('concorrência de UUID igual cria um evento e pedidos diferentes respeitam saldo sob lock', async () => {
  const f = fixture();
  const [first, replay] = await Promise.all([f.service.registrar(21, f.input, 7), f.service.registrar(21, f.input, 7)]);
  assert.equal(first.id, replay.id); assert.equal(f.events.length, 1);
  const competing = await Promise.allSettled([f.service.registrar(21, { ...f.input, idempotencyKey: randomUUID(), amount: 100 }, 7),
    f.service.registrar(21, { ...f.input, idempotencyKey: randomUUID(), amount: 100 }, 7)]);
  assert.equal(competing.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(competing.find(row => row.status === 'rejected').reason.statusCode, 409);
  assert.equal(adjustmentSummary(f.payment, f.events).remainingAmount, 0);
});

test('alteração explícita de vencimento exige revisão atual e preserva início, plano, status e recibo legado', async () => {
  const f = fixture(); f.student.status = 'blocked';
  const event = await f.service.registrar(21, { ...f.input, membershipEffect: 'set_end_date', expectedMembershipRevision: 3,
    newPlanEndDate: '2026-10-20' }, 7);
  assert.equal(f.student.planEndDate.toISOString().slice(0, 10), '2026-10-20'); assert.equal(f.student.membershipRevision, 4);
  assert.equal(f.student.status, 'blocked'); assert.equal(f.student.planId, 2);
  assert.equal(f.student.planStartDate.toISOString().slice(0, 10), '2026-10-01'); assert.equal(f.payment.membershipGrant, null);
  assert.equal(event.membershipBefore.membershipRevision, 3); assert.equal(event.membershipAfter.membershipRevision, 4);
  await assert.rejects(f.service.registrar(21, { ...f.input, idempotencyKey: randomUUID(), membershipEffect: 'set_end_date',
    expectedMembershipRevision: 3, newPlanEndDate: '2026-10-21' }, 7), e => e.statusCode === 409);
  assert.equal(f.events.length, 1);
});

test('vencimento antes do início e matrícula/conta inativas impedem mudar acesso, mas permitem registrar ajuste preservando', async () => {
  for (const change of [{ user: { active: false } }, { status: 'inactive' }, {}]) {
    const f = fixture(); Object.assign(f.student, change);
    await assert.rejects(f.service.registrar(21, { ...f.input, membershipEffect: 'set_end_date', expectedMembershipRevision: 3,
      newPlanEndDate: Object.keys(change).length ? '2026-10-20' : '2026-09-30' }, 7), e => [400, 409].includes(e.statusCode));
    assert.equal(f.events.length, 0);
    await f.service.registrar(21, f.input, 7); assert.equal(f.events.length, 1);
    assert.equal(f.student.membershipRevision, 3);
  }
});

test('validação rejeita campos forjados, precisão inválida, motivo vazio, tipos e datas indevidas', async () => {
  const f = fixture();
  for (const change of [{ idempotencyKey: null }, { expectedActorId: 8 }, { amount: 0 }, { amount: '1.001' }, { amount: true },
    { reason: '  ' }, { reason: 'curto' }, { reason: 'x'.repeat(1001) }, { kind: 'paid' }, { membershipEffect: 'proportional' },
    { effectiveDate: '2026-02-30' }, { effectiveDate: '2026-10-07' }, { effectiveDate: '2026-10-12' },
    { requestHash: 'forged' }, { actorId: 99 }, { actorName: 'forged' }, { providerRefundPerformed: true },
    { membershipBefore: {} }, { membershipAfter: {} }, { expectedMembershipRevision: 3 }, { newPlanEndDate: '2026-10-20' },
    { membershipEffect: 'set_end_date', newPlanEndDate: '2026-10-20' },
    { membershipEffect: 'set_end_date', expectedMembershipRevision: true, newPlanEndDate: '2026-10-20' }]) {
    await assert.rejects(f.service.registrar(21, { ...f.input, ...change }, 7), e => [400, 403].includes(e.statusCode));
  }
  assert.equal(f.events.length, 0); assert.equal(f.student.membershipRevision, 3);
});

test('administrador precisa existir e continuar ativo; recibo não pago ou PSP não aceita correção manual', async () => {
  for (const change of [{ active: false }, { role: 'instructor' }]) {
    const f = fixture(); Object.assign(f.actor, change);
    await assert.rejects(f.service.registrar(21, f.input, 7), e => e.statusCode === 403);
  }
  const absent = fixture(); await assert.rejects(absent.service.registrar(21, { ...absent.input, expectedActorId: 8 }, 8), e => e.statusCode === 403);
  const unpaid = fixture(); unpaid.payment.status = 'pending'; await assert.rejects(unpaid.service.registrar(21, unpaid.input, 7), e => e.statusCode === 400);
  const provider = fixture(); provider.payment.intent = { id: 'provider-checkout' };
  await assert.rejects(provider.service.registrar(21, provider.input, 7), e => e.statusCode === 400);
  const declared = await provider.service.registrar(21, { ...provider.input, kind: 'refund_recorded' }, 7);
  assert.equal(declared.providerRefundPerformed, false);
});

test('consulta por UUID pertence ao ator e eventos públicos não revelam hash', async () => {
  const f = fixture(), event = await f.service.registrar(21, f.input, 7);
  assert.deepEqual(await f.service.buscarPorSolicitacao(event.id, 7), event);
  f.actor.id = 8;
  await assert.rejects(f.service.buscarPorSolicitacao(event.id, 8), e => e.statusCode === 404);
  await assert.rejects(f.service.buscarPorSolicitacao(randomUUID(), 8), e => e.statusCode === 404);
  const listed = await f.service.listar(21, 8); assert.equal(listed.length, 1); assert.equal(listed[0].requestHash, undefined);
});

test('erro após criar ajuste reverte evento e vencimento na mesma transação', async () => {
  const f = fixture(), before = structuredClone(f.student);
  f.db.student.update = async () => { throw new Error('falha sintética de banco'); };
  await assert.rejects(f.service.registrar(21, { ...f.input, membershipEffect: 'set_end_date', expectedMembershipRevision: 3,
    newPlanEndDate: '2026-10-20' }, 7), /falha sintética/);
  assert.equal(f.events.length, 0); assert.deepEqual(f.student, before);
});

test('UUID disputado em índice global é reconciliado após rollback somente para intenção e ator originais', async () => {
  const f = fixture(), first = await f.service.registrar(21, f.input, 7);
  f.db.$transaction = async () => { throw Object.assign(new Error('corrida no índice global'), { code: 'P2002' }); };
  assert.deepEqual(await f.service.registrar(21, f.input, 7), first);
  await assert.rejects(f.service.registrar(21, { ...f.input, reason: 'Motivo diferente para a mesma chave.' }, 7), e => e.statusCode === 409);
  f.actor.id = 8;
  await assert.rejects(f.service.registrar(21, { ...f.input, expectedActorId: 8 }, 8), e => e.statusCode === 409);
  f.actor.active = false;
  await assert.rejects(f.service.registrar(21, { ...f.input, expectedActorId: 8 }, 8), e => e.statusCode === 403);
  assert.equal(f.events.length, 1);
});

test('duas mudanças de vigência com a mesma revisão só aplicam a primeira e replay não avança novamente', async () => {
  const f = fixture();
  const request = { ...f.input, membershipEffect: 'set_end_date', expectedMembershipRevision: 3, newPlanEndDate: '2026-10-20' };
  const results = await Promise.allSettled([f.service.registrar(21, request, 7),
    f.service.registrar(21, { ...request, idempotencyKey: randomUUID(), newPlanEndDate: '2026-10-21' }, 7)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(f.student.membershipRevision, 4); assert.equal(f.events.length, 1);
  const first = results.find(result => result.status === 'fulfilled').value;
  const replay = await f.service.registrar(21, first.membershipAfter.planEndDate === request.newPlanEndDate ? request
    : { ...request, idempotencyKey: first.id, newPlanEndDate: '2026-10-21' }, 7);
  assert.equal(replay.id, first.id); assert.equal(f.student.membershipRevision, 4);
});

test('HTTP de ajustes aplica autenticação, administração, CSRF, consulta privada e imutabilidade', async t => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), express = require('express');
  const cookieParser = require('cookie-parser');
  const { createCsrfProtection } = require('../src/middleware/csrf');
  const f = fixture(), controllerModule = { exports: {} }, routeModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/pagamentos.controller.js'), 'utf8'), {
    module: controllerModule, require(name) {
      if (name.includes('payment-adjustments.service')) return f.service;
      if (name.includes('pagamentos.service')) return {};
      return require(path.resolve(__dirname, '../src/controllers', name));
    },
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/pagamentos.routes.js'), 'utf8'), {
    module: routeModule, require(name) {
      if (name === 'express') return express;
      if (name.includes('controllers/')) return new Proxy(controllerModule.exports, { get: (target, key) => target[key] || ((req, res) => res.sendStatus(200)) });
      if (name.includes('middleware/auth')) return {
        authenticate(req, res, next) { if (!req.headers['x-role']) return res.sendStatus(401); req.user = { id: 7, role: req.headers['x-role'] }; next(); },
        authorize(role) { return (req, res, next) => req.user.role === role ? next() : res.sendStatus(403); },
      };
      throw new Error('Dependência inesperada');
    },
  });
  const app = express(); app.use(express.json(), cookieParser());
  app.use('/api', createCsrfProtection({ allowedOrigins: 'https://fitflow.example' }));
  app.use('/api/pagamentos', routeModule.exports);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/pagamentos`;
  const headers = { 'x-role': 'admin', 'Content-Type': 'application/json', Cookie: 'access_token=fixture', Origin: 'https://fitflow.example' };
  const post = customHeaders => fetch(url + '/21/ajustes', { method: 'POST', headers: customHeaders, body: JSON.stringify(f.input) });
  assert.equal((await post({ 'Content-Type': 'application/json', Origin: 'https://fitflow.example' })).status, 401);
  assert.equal((await post({ ...headers, 'x-role': 'instructor' })).status, 403);
  assert.equal((await post({ ...headers, Origin: 'https://evil.example' })).status, 403);
  assert.equal(f.events.length, 0);
  const created = await post(headers); assert.equal(created.status, 201);
  const event = (await created.json()).data; assert.equal(event.providerRefundPerformed, false); assert.equal(event.requestHash, undefined);
  assert.equal((await fetch(url + '/21/ajustes', { headers })).status, 200);
  const lookup = await fetch(url + '/ajustes/solicitacoes/' + event.id, { headers });
  assert.equal(lookup.status, 200); assert.equal((await lookup.json()).data.id, event.id);
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    for (const endpoint of ['/21/ajustes', '/ajustes/' + event.id, '/21'])
      assert.equal((await fetch(url + endpoint, { method, headers })).status, 405);
  }
  assert.equal(f.events.length, 1);
});

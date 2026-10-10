const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPagamentosService } = require('../src/services/pagamentos.service');
function fixture() {
  const student = { id: 11, user: { active: true }, status: 'active', planId: 2, planEndDate: new Date('2026-11-01T00:00:00Z') };
  const rows = []; let barrier = Promise.resolve();
  const payment = { findUnique: async ({ where }) => rows.find(row => where.manualRequestId ? row.manualRequestId === where.manualRequestId : row.id === where.id) || null,
    update: async ({ where, data }) => Object.assign(rows.find(row => row.id === where.id), data),
    create: async ({ data }) => { const row = { id: rows.length + 1, ...data }; rows.push(row); return row; } };
  const db = { payment, rows, studentState: student,
    async $transaction(run) {
      let release;
      const tx = { payment, plan: { findUnique: async () => ({ id: 2, active: true, durationDays: 30 }) },
        student: { findUnique: async () => ({ ...student }), update: async ({ data }) => Object.assign(student, data) },
        async $queryRaw() { const previous = barrier; barrier = new Promise(resolve => { release = resolve; }); await previous; } };
      try { return await run(tx); } finally { release?.(); }
    } };
  return { db, service: createPagamentosService({ db }), payload: { studentId: 11, planId: 2, amount: '150.00', paymentDate: '2026-10-08', paymentMethod: 'pix', idempotencyKey: randomUUID() } };
}
test('UUID igual em duas solicitações concorrentes cria somente um ledger e uma renovação', async () => {
  const { db, service, payload } = fixture();
  const [first, retry] = await Promise.all([service.registrar(payload, 7), service.registrar(payload, 7)]);
  assert.equal(first.id, retry.id); assert.equal(db.rows.length, 1);
  assert.equal(db.studentState.planEndDate.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(db.rows[0].manualRequestId, payload.idempotencyKey);
  assert.match(db.rows[0].manualRequestHash, /^[a-f0-9]{64}$/);
});
test('UUID diferente preserva duas renovações intencionais e valores equivalentes repetem a mesma intenção', async () => {
  const { db, service, payload } = fixture();
  await service.registrar(payload, 7);
  assert.equal((await service.registrar({ ...payload, amount: 150, studentId: '11', planId: '2', paymentMethod: 'PIX' }, 7)).id, 1);
  await service.registrar({ ...payload, idempotencyKey: randomUUID() }, 7);
  assert.equal(db.rows.length, 2); assert.equal(db.studentState.planEndDate.toISOString(), '2026-12-31T00:00:00.000Z');
});
test('UUID usado com outro ator ou payload retorna 409 sem renovar nem alterar ledger', async () => {
  const { db, service, payload } = fixture(); await service.registrar(payload, 7);
  for (const [data, actor] of [[{ ...payload, amount: '151.00' }, 7], [payload, 8], [{ ...payload, studentId: 12 }, 7]]) {
    await assert.rejects(service.registrar(data, actor), error => error.statusCode === 409);
  }
  assert.equal(db.rows.length, 1); assert.equal(db.studentState.planEndDate.toISOString(), '2026-12-01T00:00:00.000Z');
});
test('edição posterior não altera fingerprint e repetição original retorna registro corrigido', async () => {
  const { db, service, payload } = fixture(); const first = await service.registrar(payload, 7);
  const originalHash = db.rows[0].manualRequestHash;
  await service.atualizar(first.id, { amount: '140.00', notes: 'Correção administrativa' });
  const retry = await service.registrar(payload, 7);
  assert.equal(retry.id, first.id); assert.equal(retry.amount, 140);
  assert.equal(db.rows.length, 1); assert.equal(db.rows[0].manualRequestHash, originalHash);
});
test('UUID ausente/inválido e ator ausente falham antes de uma criação', async () => {
  const { db, service, payload } = fixture();
  for (const key of [undefined, '', 'legacy-key', null]) await assert.rejects(service.registrar({ ...payload, idempotencyKey: key }, 7), error => error.statusCode === 400);
  await assert.rejects(service.registrar(payload, null), error => error.statusCode === 400);
  assert.equal(db.rows.length, 0);
});
test('pedido com data/plano omitidos repete a intenção original apesar da mudança dos padrões', async () => {
  const { db, payload } = fixture(); let now = new Date('2026-10-08T23:00:00Z');
  const service = createPagamentosService({ db, now: () => now });
  const input = { studentId: 11, amount: 150, idempotencyKey: payload.idempotencyKey };
  const first = await service.registrar(input, 7); now = new Date('2026-10-10T00:00:00Z'); db.studentState.planId = 99;
  assert.equal((await service.registrar(input, 7)).id, first.id);
  assert.equal(db.rows.length, 1);
});
test('consulta por UUID pertence ao ator original e não revela pedido de outro administrador', async () => {
  const { service, payload } = fixture(); const first = await service.registrar(payload, 7);
  assert.equal((await service.buscarPorSolicitacao(payload.idempotencyKey, 7)).id, first.id);
  await assert.rejects(service.buscarPorSolicitacao(payload.idempotencyKey, 8), error => error.statusCode === 404);
  await assert.rejects(service.buscarPorSolicitacao(randomUUID(), 7), error => error.statusCode === 404);
});

test('cookie de outra conta rejeita ator esperado divergente antes de iniciar transação', async () => {
  const { db, service, payload } = fixture(); let transactions = 0;
  const original = db.$transaction; db.$transaction = async (...args) => { transactions++; return original.apply(db, args); };
  await assert.rejects(service.registrar({ ...payload, expectedActorId: 7 }, 8), error => error.statusCode === 403 && /sessão mudou/i.test(error.message));
  assert.equal(transactions, 0); assert.equal(db.rows.length, 0);
  const accepted = await service.registrar({ ...payload, expectedActorId: 8 }, 8);
  assert.equal(accepted.registeredBy, 8);
});

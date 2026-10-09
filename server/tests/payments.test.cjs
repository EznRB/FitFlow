const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPagamentosService } = require('../src/services/pagamentos.service');
const { moneyCents, paymentId, paymentDate } = require('../src/utils/paymentValidation');
const { renewalDates } = require('../src/utils/membershipRenewal');

function ledgerDB() {
  const student = { id: 11, user: { active: true }, status: 'active', planId: 2, planEndDate: new Date('2026-11-01T00:00:00Z') };
  const payments = []; let barrier = Promise.resolve(); let locks = 0;
  const db = { student, payments, get locks() { return locks; },
    payment: { findUnique: async ({ where }) => where.manualRequestId ? payments.find(row => row.manualRequestId === where.manualRequestId) || null : payments.find(row => row.id === where.id), update: async ({ data }) => Object.assign(payments[0], data) },
    async $transaction(run) {
      let release;
      const tx = {
        async $queryRaw(strings, id) {
          assert.match(strings.join('?'), /students.*FOR UPDATE/); assert.equal(id, 11); locks++;
          const previous = barrier; barrier = new Promise(resolve => { release = resolve; }); await previous;
        },
        student: { findUnique: async () => ({ ...student }), update: async ({ data }) => Object.assign(student, data) },
        plan: { findUnique: async () => ({ id: 2, active: true, durationDays: 30 }) },
        payment: { findUnique: db.payment.findUnique, create: async ({ data }) => { const row = { id: payments.length + 1, ...data }; payments.push(row); return row; } }
      };
      try { return await run(tx); } finally { release?.(); }
    }
  }; return db;
}

test('renovação antecipada preserva saldo e duas transações simultâneas acumulam vigência', async () => {
  const db = ledgerDB(); const service = createPagamentosService({ db });
  const payload = { studentId: 11, planId: 2, amount: '150.00', paymentDate: '2026-10-08', paymentMethod: 'pix' };
  await Promise.all([service.registrar({ ...payload, idempotencyKey: randomUUID() }, 7), service.registrar({ ...payload, idempotencyKey: randomUUID() }, 7)]);
  assert.equal(db.student.planEndDate.toISOString().slice(0, 10), '2026-12-31');
  assert.equal(db.payments[0].dueDate.toISOString().slice(0, 10), '2026-12-01');
  assert.equal(db.payments.length, 2); assert.equal(db.locks, 2); assert.equal(db.payments[0].registeredBy, 7);
  assert.equal(renewalDates(new Date('2026-09-01'), new Date('2026-10-08'), 30).endDate.toISOString().slice(0, 10), '2026-11-07');
});
test('rejeita coerções, valores não finitos, IDs parciais e calendários inválidos', async () => {
  for (const amount of [true, {}, [], '', ' 10', '1e2', Infinity, NaN, -1, 0, '10.123', '100000000.00']) assert.throws(() => moneyCents(amount));
  for (const id of [true, {}, [], '', '11x', 1.5, -1, '2147483648']) assert.throws(() => paymentId(id));
  for (const date of [new Date(), '2026-02-30', '2026-13-01', '2026-1-01', '2026-10-08T00:00:00Z', '0001-01-01']) assert.throws(() => paymentDate(date));
  assert.equal(moneyCents('0.01'), 1); assert.equal(moneyCents(150.25), 15025);
  const db = ledgerDB(); const service = createPagamentosService({ db });
  const base = { studentId: 11, amount: 150, paymentDate: '2026-10-08', idempotencyKey: randomUUID() };
  for (const data of [null, [], { ...base, studentId: '11x' }, { ...base, amount: true }, { ...base, paymentDate: '2026-02-30' }, { ...base, planId: {} }]) await assert.rejects(service.registrar(data, 7), error => error.statusCode === 400);
  assert.equal(db.payments.length, 0); assert.equal(db.locks, 0);
  for (const data of [null, [], { status: 'approved' }, { amount: '20oops' }, { dueDate: '2026-02-30' }, { paymentMethod: '<script>' }]) await assert.rejects(service.atualizar(1, data), error => error.statusCode === 400);
});

test('consulta antiga de inadimplência não bloqueia aluno que renovou enquanto aguardava lock', async () => {
  const db = ledgerDB();
  db.student.planEndDate = new Date('9999-01-01');
  db.student.findMany = async () => [{ id: 11, planEndDate: new Date('2000-01-01') }];
  db.payment.updateMany = async () => ({ count: 0 });
  const result = await createPagamentosService({ db }).verificarInadimplencia();
  assert.equal(result.alunosBloqueados, 0);
  assert.equal(db.student.status, 'active');
  assert.equal(db.locks, 1);
});
test('pagamento conciliado do provedor não pode ser editado manualmente', async () => {
  const db = ledgerDB(); const service = createPagamentosService({ db });
  await service.registrar({ studentId: 11, amount: 150, idempotencyKey: randomUUID() }, 7);
  db.paymentIntent = { findFirst: async () => ({ id: 'owned-intent', paymentId: 1 }) };
  await assert.rejects(service.atualizar(1, { amount: 1 }), error => error.statusCode === 409);
  assert.equal(db.payments[0].amount, 150);
});

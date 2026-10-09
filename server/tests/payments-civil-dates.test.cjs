const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { createPagamentosService } = require('../src/services/pagamentos.service');

const date = value => new Date(value);
const civil = value => date(`${value}T00:00:00.000Z`);

function fixture(now) {
  const students = [
    { id: 1, status: 'active', planEndDate: civil('2026-09-30') },
    { id: 2, status: 'active', planEndDate: civil('2026-09-25') },
    { id: 3, status: 'active', planEndDate: civil('2026-09-24') },
    { id: 4, status: 'blocked', planEndDate: civil('2026-11-01') },
  ];
  const payments = [
    { status: 'pending', dueDate: civil('2026-09-30') },
    { status: 'pending', dueDate: civil('2026-09-29') },
  ];
  const calls = [];
  const matches = (student, where) => student.status === where.status && student.planEndDate < where.planEndDate.lt;
  const db = {
    student: {
      findMany: async args => {
        calls.push(args.where);
        return students.filter(student => args.where.OR
          ? args.where.OR.some(where => where.planEndDate ? matches(student, where) : student.status === where.status)
          : matches(student, args.where));
      },
      findUnique: async args => students.find(student => student.id === args.where.id),
      update: async args => Object.assign(students.find(student => student.id === args.where.id), args.data),
    },
    payment: {
      updateMany: async args => {
        calls.push(args.where);
        const rows = payments.filter(payment => payment.status === args.where.status && payment.dueDate < args.where.dueDate.lt);
        rows.forEach(payment => Object.assign(payment, args.data));
        return { count: rows.length };
      },
    },
    $queryRaw: async () => [],
    $transaction: async callback => callback(db),
  };
  return { service: createPagamentosService({ db, now: () => date(now) }), students, payments, calls, db };
}

test('inadimplência só vence após a virada brasileira e preserva os cinco dias de carência', async () => {
  for (const [instant, expectedBlocked, expectedOverdue, expectedActiveListed] of [
    ['2026-10-01T02:59:59Z', 1, 1, [2, 3]],
    ['2026-10-01T03:00:00Z', 2, 2, [1, 2, 3]],
  ]) {
    const current = fixture(instant);
    const listed = await current.service.listarInadimplentes();
    assert.deepEqual(listed.filter(student => student.status === 'active').map(student => student.id), expectedActiveListed);
    assert.ok(listed.some(student => student.id === 4));
    const summary = await current.service.verificarInadimplencia();
    assert.equal(summary.alunosBloqueados, expectedBlocked);
    assert.equal(summary.pagamentosAtualizados, expectedOverdue);
    assert.equal(summary.verificadoEm, date(instant).toISOString());
    assert.equal(current.students[0].status, 'active'); // No immediate block merely for expiry.
    assert.equal(current.students[1].status, expectedBlocked === 1 ? 'active' : 'blocked');
    assert.equal(current.payments[0].status, expectedOverdue === 1 ? 'pending' : 'overdue');
    const threshold = current.calls.at(-1).dueDate.lt;
    assert.equal(threshold.toISOString(), expectedOverdue === 1 ? '2026-09-30T00:00:00.000Z' : '2026-10-01T00:00:00.000Z');
  }
});

test('verificação relê a vigência sob lock e não bloqueia uma renovação confirmada', async () => {
  const current = fixture('2026-10-01T03:00:00Z');
  current.db.student.findMany = async () => [{ id: 2, status: 'active', planEndDate: civil('2026-09-25') }];
  current.db.student.findUnique = async () => ({ id: 2, status: 'active', planEndDate: civil('2026-11-01') });
  current.db.student.update = async () => assert.fail('Aluno renovado não deve ser bloqueado.');
  const result = await current.service.verificarInadimplencia();
  assert.equal(result.alunosBloqueados, 0);
});

test('resumo inclui primeiro e último dia civil, exclui mês seguinte e independe do fuso do host', () => {
  const script = `
    const { createPagamentosService } = require('./src/services/pagamentos.service');
    const rows = [
      { paymentDate: new Date('2026-09-01T00:00:00Z'), amount: 10 },
      { paymentDate: new Date('2026-09-30T00:00:00Z'), amount: 20 },
      { paymentDate: new Date('2026-10-01T00:00:00Z'), amount: 40 }
    ];
    let period;
    const service = createPagamentosService({ now: () => new Date(process.env.TEST_NOW), db: {
      payment: {
        aggregate: async args => {
          period = args.where.paymentDate;
          const filtered = rows.filter(row => row.paymentDate >= period.gte && row.paymentDate < period.lt);
          return { _sum: { amount: filtered.reduce((sum, row) => sum + row.amount, 0) }, _count: filtered.length };
        },
        count: async () => 0
      }, student: { count: async () => 0 }
    } });
    service.resumoFinanceiro().then(result => console.log(JSON.stringify({ period, amount: result.receitaMesAtual, count: result.pagamentosMes })));
  `;
  for (const TZ of ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo']) {
    for (const [TEST_NOW, expected] of [
      ['2026-10-01T02:59:59Z', { period: { gte: '2026-09-01T00:00:00.000Z', lt: '2026-10-01T00:00:00.000Z' }, amount: 30, count: 2 }],
      ['2026-10-01T03:00:00Z', { period: { gte: '2026-10-01T00:00:00.000Z', lt: '2026-11-01T00:00:00.000Z' }, amount: 40, count: 1 }],
    ]) {
      const output = execFileSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, TZ, TEST_NOW }, encoding: 'utf8' });
      assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1)), expected);
    }
  }
});

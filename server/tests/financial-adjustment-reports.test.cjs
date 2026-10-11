'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createRelatoriosController } = require('../src/controllers/relatorios.controller');
const { createPagamentosService } = require('../src/services/pagamentos.service');
const { financialSummary, financialCents } = require('../src/utils/financialTotals');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const date = text => new Date(text + 'T00:00:00Z');
const payment = { id: 5, studentId: 9, amount: '100.01', paymentDate: date('2026-09-30'), dueDate: date('2026-10-30'), status: 'paid',
  student: { user: { name: 'Fixture student' } }, plan: { name: 'Fixture plan' } };
const events = ['correction', 'refund_recorded'].map((kind, i) => ({ id: `event-${i}`, paymentId: 5, payment,
  kind, amount: i ? '10.00' : '25.01', effectiveDate: date('2026-10-10'), createdAt: date('2026-10-11'), actorName: 'Fixture admin', reason: 'Synthetic adjustment' }));
function fixture() {
  const calls = [], inPeriod = (value, period) => (!period?.gte || value >= period.gte) && (!period?.lt || value < period.lt) && (!period?.lte || value <= period.lte);
  const db = {
    payment: { findMany: async args => inPeriod(payment.paymentDate, args.where.paymentDate) ? [payment] : [], count: async () => 1,
      aggregate: async args => { calls.push(args); const present = inPeriod(payment.paymentDate, args.where.paymentDate); return { _sum: { amount: present ? '100.01' : null }, _count: present ? 1 : 0 }; } },
    paymentAdjustment: { findMany: async args => { calls.push(args); return events.filter(event => inPeriod(event.effectiveDate, args.where.effectiveDate)); },
      groupBy: async args => { calls.push(args); return events.filter(event => inPeriod(event.effectiveDate, args.where.effectiveDate)).map(event => ({ kind: event.kind, _sum: { amount: event.amount }, _count: 1 })); } },
    paymentIntent: { count: async () => 2 }, student: { count: async () => 1, findMany: async () => [] },
    workout: { count: async () => 0 }, checkin: { findMany: async () => [] }
  };
  const now = () => new Date('2026-10-11T12:00:00Z');
  return { db, calls, controller: createRelatoriosController({ db, now, repository: { countToday: async () => 0 } }), service: createPagamentosService({ db, now }) };
}
async function invoke(controller, method, query = {}) {
  let error; const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await controller[method]({ query }, res, value => { error = value; });
  if (error) throw error; assert.equal(res.code, 200); return res.body.data;
}
test('devolução e correção deste mês de recibo antigo entram no período do evento, com líquido negativo', async () => {
  const { controller, calls } = fixture();
  const current = await invoke(controller, 'financeiro', { startDate: '2026-10-01', endDate: '2026-10-31' });
  assert.equal(current.resumo.totalBruto, 0); assert.equal(current.resumo.totalCorrecoes, 25.01);
  assert.equal(current.resumo.totalDevolucoesInformadas, 10); assert.equal(current.resumo.totalReceita, -35.01);
  assert.equal(current.resumo.conferenciasProvedor, 2); assert.equal(current.items.length, 2);
  assert.equal(current.items[0].paymentId, 5); assert.ok(current.items.every(row => row.providerRefundPerformed === false));
  assert.match(current.resumo.criterio, /data efetiva/);
  const previous = await invoke(controller, 'financeiro', { startDate: '2026-09-01', endDate: '2026-09-30' });
  assert.equal(previous.resumo.totalBruto, 100.01); assert.equal(previous.resumo.totalAjustes, 0); assert.equal(previous.items.length, 1);
  assert.equal(calls[0].where.effectiveDate.gte.toISOString(), '2026-10-01T00:00:00.000Z');
});
test('dashboard e resumo financeiro usam os mesmos centavos, período e conferências separadas', async () => {
  const { controller, service } = fixture(), data = await invoke(controller, 'dashboard'), summary = await service.resumoFinanceiro();
  assert.equal(data.receitaEstimada, -35.01); assert.equal(summary.receitaMesAtual, -35.01);
  assert.deepEqual(data.financeiroMes, summary.financeiroMes);
  assert.equal(data.historico.receita.at(-2), -35.01); assert.equal(data.conferenciasProvedor, 2);
  assert.equal(summary.pagamentosMes, 0); assert.equal(summary.financeiroMes.adjustmentCount, 2);
});
test('somar parcelas de centavos não produz saldo residual; agregados fora da precisão são recusados', () => {
  assert.equal(financialSummary('0.03', [{kind:'correction',amount:'0.01'},{kind:'refund_recorded',amount:'0.02'}]).netAmount, 0);
  assert.throws(() => financialCents('90071992547409.92'));
});
test('relatório apresenta líquido negativo como moeda e preserva validação de contagem', () => {
  const context = vm.createContext({ Intl, window: {}, document: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/relatorios.js'), 'utf8'), context);
  assert.match(vm.runInContext('RelatoriosView.formatMoney(-35.01)', context), /-.*35,01/);
  assert.equal(vm.runInContext('RelatoriosView.count(-1)', context), '—');
  assert.equal(vm.runInContext('RelatoriosView.formatMoney("<script>")', context), '—');
});

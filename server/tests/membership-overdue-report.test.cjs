'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRelatoriosController } = require('../src/controllers/relatorios.controller');
const day = value => new Date(`${value}T00:00:00Z`);
const student = (id, status, expiry, payments = []) => ({ id, status, planEndDate: expiry && day(expiry),
  user: { name: `Synthetic ${id}`, email: `fixture${id}@example.invalid` }, plan: { name: 'Synthetic' }, payments });
function matches(row, where) {
  return where.OR.some(condition => {
    if (condition.payments) return row.payments.some(payment => payment.status === 'overdue');
    if (condition.status && row.status !== condition.status) return false;
    if (condition.planEndDate) return row.planEndDate !== null && row.planEndDate < condition.planEndDate.lt;
    return true;
  });
}
async function report(rows, instant) {
  let query, error, body;
  const db = { student: { findMany: async args => {
    query = args;
    return rows.filter(row => matches(row, args.where)).map(row => ({ ...row,
      payments: row.payments.filter(payment => payment.status === 'overdue') }));
  } } };
  const controller = createRelatoriosController({ db, now: () => new Date(instant) });
  await controller.inadimplencia({}, { status(code) { assert.equal(code, 200); return this; }, json(value) { body = value; } }, value => { error = value; });
  if (error) throw error;
  return { data: body.data, query };
}
test('active expired membership appears without inventing debt, payment or cadastral status', async () => {
  const { data, query } = await report([student(1, 'active', '2026-11-16')], '2026-11-22T12:00:00Z');
  assert.equal(data.length, 1);
  assert.equal(data[0].status, 'active');
  assert.equal(data[0].totalAtraso, 0);
  assert.equal(data[0].mensalidadesAtrasadas, 0);
  assert.deepEqual(data[0].vencimentos, []);
  assert.equal(data[0].planEndDate.toISOString(), '2026-11-16T00:00:00.000Z');
  assert.equal(data[0].membershipOverdue, true);
  assert.equal(data[0].trainingAccessBlocked, true);
  assert.deepEqual(data[0].reasons, ['membership_expired']);
  assert.equal(query.where.OR.find(part => part.planEndDate).planEndDate.lt.toISOString(), '2026-11-17T00:00:00.000Z');
});
test('five-day grace uses Brazilian date across UTC day boundary; no date and inactive are not debt', async () => {
  const rows = [student(1, 'active', '2026-11-16'), student(2, 'active', '2026-11-17'),
    student(3, 'active', null), student(4, 'inactive', '2026-10-01'), student(5, 'active', '2026-11-23')];
  assert.deepEqual((await report(rows, '2026-11-22T02:59:59Z')).data, []);
  assert.deepEqual((await report(rows, '2026-11-22T03:00:00Z')).data.map(row => row.id), [1]);
});
test('manual block and overdue ledger remain independent reasons with original financial values', async () => {
  const debt = { status: 'overdue', amount: '12.30', dueDate: day('2026-11-01') };
  const paid = { status: 'paid', amount: '999.00', dueDate: day('2026-11-01') };
  const { data } = await report([student(1, 'blocked', null), student(2, 'active', '2026-12-01', [debt, paid]),
    student(3, 'active', '2026-11-16', [debt]), student(4, 'inactive', null, [debt])], '2026-11-22T12:00:00Z');
  assert.deepEqual(data.map(row => row.id), [2, 3, 4, 1]);
  assert.equal(data[0].totalAtraso, 12.3);
  assert.equal(data[0].mensalidadesAtrasadas, 1);
  assert.equal(data[0].membershipOverdue, false);
  assert.equal(data[0].trainingAccessBlocked, false);
  assert.deepEqual(data[0].reasons, ['overdue_payments']);
  assert.deepEqual(data[1].reasons, ['membership_expired', 'overdue_payments']);
  assert.equal(data[2].status, 'inactive');
  assert.deepEqual(data[2].reasons, ['overdue_payments']);
  assert.equal(data[2].trainingAccessBlocked, true);
  assert.deepEqual(data[3].reasons, ['blocked_status']);
  assert.equal(data[3].trainingAccessBlocked, true);
});

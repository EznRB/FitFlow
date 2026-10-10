const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlunosService } = require('../src/services/alunos.service');
const { createCheckinsService } = require('../src/services/checkins.service');
const { createCheckinsRepository } = require('../src/repositories/checkins.repository');

test('editar só telefone não restaura status e campos antigos após renovação concorrente', async () => {
  const row = { id: 11, userId: 7, status: 'blocked', phone: 'old', cpf: null, address: 'Old address', notes: 'Old note',
    birthDate: null, planId: 2, user: { name: 'Old name', email: 'fixture@example.invalid' } };
  const snapshot = structuredClone(row); let releaseRead; const writes = [];
  const db = {
    student: { findUnique: () => new Promise(resolve => { releaseRead = () => resolve(snapshot); }),
      update: async ({ data }) => { writes.push(data); return Object.assign(row, data); } },
    user: { update: async ({ data }) => Object.assign(row.user, data) }, $transaction: async operations => Promise.all(operations),
  };
  const editing = createAlunosService({ db }).atualizar(11, { phone: 'new' });
  Object.assign(row, { status: 'active', address: 'New address', notes: 'New note', birthDate: new Date('1990-01-01'),
    planEndDate: new Date('2026-12-31') }); row.user.name = 'New name';
  releaseRead(); await editing;
  assert.equal(row.status, 'active'); assert.equal(row.phone, 'new'); assert.equal(row.address, 'New address');
  assert.equal(row.notes, 'New note'); assert.equal(row.birthDate.toISOString().slice(0, 10), '1990-01-01');
  assert.equal(row.user.name, 'New name'); assert.equal(row.planEndDate.toISOString().slice(0, 10), '2026-12-31');
  assert.deepEqual(Object.keys(writes[0]), ['phone']);
});

function presence() {
  const row = { id: 5, studentId: 11, status: 'present', cancelReason: null, cancelledBy: null, cancelledAt: null }, writes = [];
  const db = { checkin: { findUnique: async () => structuredClone(row),
    update: async ({ data }) => { writes.push(data); return Object.assign(row, data); },
    updateMany: async ({ where, data }) => {
      assert.equal(where.id, 5); assert.equal(where.status, 'present');
      if (row.status !== where.status) return { count: 0 };
      writes.push(data); Object.assign(row, data); return { count: 1 };
    } } };
  return { row, writes, repository: createCheckinsRepository({ db }) };
}
test('cancelamentos concorrentes preservam primeiro ator/motivo/data e só um retorna sucesso', async () => {
  const h = presence(), service = createCheckinsService({ db: {}, repository: h.repository });
  const results = await Promise.allSettled([
    service.cancelarCheckin(5, 'Cancelamento do primeiro administrador', 9),
    service.cancelarCheckin(5, 'Cancelamento do segundo administrador', 10),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(h.writes.length, 1); assert.equal(h.row.cancelledBy, 9);
  assert.equal(h.row.cancelReason, 'Cancelamento do primeiro administrador');
  assert.ok(h.row.cancelledAt instanceof Date);
  const timestamp = h.row.cancelledAt.getTime();
  await assert.rejects(h.repository.cancelCheckin(5, 'Terceira tentativa administrativa', 11), error => error.statusCode === 409);
  assert.equal(h.row.cancelledAt.getTime(), timestamp); assert.equal(h.writes.length, 1);
});

test('presença recusa matrícula inactive mesmo quando conta de autenticação continua ativa', async () => {
  let writes = 0;
  const service = createCheckinsService({ db: { student: { findUnique: async () => ({ id: 11,
    status: 'inactive', user: { active: true }, planEndDate: new Date('9999-01-01') }) } },
    repository: { hasCheckedInToday: async () => null, create: async () => { writes++; return { status: 'present' }; } } });
  await assert.rejects(service.registrar(11, 7), error => error.statusCode === 403);
  assert.equal(writes, 0);
});

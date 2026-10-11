const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlunosService } = require('../src/services/alunos.service');
const plans = require('../src/services/planos.service');

function fixture(instant = '2026-10-10T01:30:00Z') {
  const students = [1, 2].map(id => ({ id, userId: id, cpf: null, birthDate: new Date('1990-05-10T00:00:00Z'),
    planId: 1, membershipRevision: 0, status: 'active', user: { id, name: `Aluno ${id}`, email: `student${id}@example.invalid` } }));
  const writes = [];
  const db = {
    user: {
      findUnique: async () => null,
      update: async ({ where, data }) => Object.assign(students.find(s => s.userId === where.id).user, data),
      create: async ({ data }) => { writes.push(data); return { id: 3, ...data, student: data.student.create }; },
    },
    student: {
      findUnique: async ({ where }) => students.find(s => where.id !== undefined ? s.id === where.id : s.cpf === where.cpf) || null,
      update: async ({ where, data }) => {
        if (data.cpf !== null && students.some(s => s.id !== where.id && s.cpf === data.cpf)) throw Object.assign(new Error('CPF unique'), { code: 'P2002' });
        const row = students.find(s => s.id === where.id);
        if (data.membershipRevision?.increment) data = { ...data, membershipRevision: row.membershipRevision + data.membershipRevision.increment };
        return Object.assign(row, data);
      },
    },
    $queryRaw: async () => [],
    plan: { findUnique: async ({where}) => ({ id: where.id, active: true, durationDays: 30 }) },
    $transaction: callback => callback(db),
  };
  const service = createAlunosService({ db, now: () => new Date(instant), plans: {
    buscarPorId: async id => ({ id: Number(id), active: true, durationDays: 30 }),
    calcularVencimento: plans.calcularVencimento,
  } });
  return { service, students, writes };
}

test('editar dois alunos sem CPF mantém NULL e não causa colisão no índice único', async () => {
  const { service, students } = fixture();
  await service.atualizar(1, { name: 'Primeiro editado', cpf: '' });
  await service.atualizar(2, { name: 'Segundo editado', cpf: '' });
  await service.atualizar(2, { cpf: '   ' });
  assert.equal(students[0].cpf, null); assert.equal(students[1].cpf, null);
  assert.equal(students[1].user.name, 'Segundo editado');
});

test('campo omitido preserva CPF/nascimento; vazio ou null explícito limpa nascimento', async () => {
  const { service, students } = fixture(); students[0].cpf = '123.456.789-00';
  await service.atualizar(1, { phone: '11999999999' });
  assert.equal(students[0].cpf, '123.456.789-00');
  assert.equal(students[0].birthDate.toISOString(), '1990-05-10T00:00:00.000Z');
  await service.atualizar(1, { birthDate: '' }); assert.equal(students[0].birthDate, null);
  await service.atualizar(1, { birthDate: '2000-02-29' }); assert.equal(students[0].birthDate.toISOString(), '2000-02-29T00:00:00.000Z');
  await service.atualizar(1, { birthDate: null, cpf: null });
  assert.equal(students[0].birthDate, null); assert.equal(students[0].cpf, null);
});

test('datas civis inválidas e CPF de tipo/tamanho inválido são rejeitados antes de escrever', async () => {
  for (const body of [{ birthDate: '2026-02-30' }, { birthDate: [] }, { cpf: {} }, { cpf: 'x'.repeat(15) }]) {
    const { service, students } = fixture();
    await assert.rejects(() => service.atualizar(1, body), e => e.statusCode === 400);
    assert.equal(students[0].birthDate.toISOString(), '1990-05-10T00:00:00.000Z');
    assert.equal(students[0].cpf, null);
  }
});

test('matrícula e troca de plano usam o dia brasileiro às 22h30, sem somar um dia UTC', async () => {
  const { service, writes, students } = fixture();
  await service.criar({ name: 'Aluno novo', email: 'new@example.invalid', password: 'fixture-password-only', planId: 1, cpf: ' ' });
  const created = writes[0].student.create;
  assert.equal(created.cpf, null);
  assert.equal(created.planStartDate.toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(created.planEndDate.toISOString(), '2026-11-08T00:00:00.000Z');
  await service.atualizar(1, { planId: 2, expectedMembershipRevision: 0 });
  assert.equal(students[0].planStartDate.toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(students[0].planEndDate.toISOString(), '2026-11-08T00:00:00.000Z');
});

test('data de início muda exatamente à meia-noite brasileira e remoção de plano limpa datas', async () => {
  const before = fixture('2026-10-10T02:59:59Z'), after = fixture('2026-10-10T03:00:00Z');
  await before.service.atualizar(1, { planId: 2, expectedMembershipRevision: 0 }); await after.service.atualizar(1, { planId: 2, expectedMembershipRevision: 0 });
  assert.equal(before.students[0].planStartDate.toISOString(), '2026-10-09T00:00:00.000Z');
  assert.equal(after.students[0].planStartDate.toISOString(), '2026-10-10T00:00:00.000Z');
  await after.service.atualizar(1, { planId: null, expectedMembershipRevision: 1 });
  assert.equal(after.students[0].planId, null); assert.equal(after.students[0].planStartDate, null); assert.equal(after.students[0].planEndDate, null);
});

test('API exige revisão atual para alterar plano/status e preserva renovação diante de cliente antigo', async () => {
  const { service, students } = fixture();
  Object.assign(students[0], { planId: 2, membershipRevision: 4, planEndDate: new Date('2026-12-11T00:00:00Z') });
  const before = structuredClone(students[0]);
  for (const body of [{ planId: 1 }, { planId: 1, expectedMembershipRevision: 3 }, { status: 'blocked' }, { planId: null }]) {
    await assert.rejects(service.atualizar(1, body), error => error.statusCode === 409);
    assert.deepEqual(students[0], before);
  }
  await service.atualizar(1, { phone: 'new phone' });
  assert.equal(students[0].membershipRevision, 4); assert.equal(students[0].planEndDate.toISOString(), '2026-12-11T00:00:00.000Z');
  await service.atualizar(1, { planId: 1, expectedMembershipRevision: 4 });
  assert.equal(students[0].membershipRevision, 5); assert.equal(students[0].planId, 1);
});

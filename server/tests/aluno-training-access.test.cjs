const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlunoPainelService } = require('../src/services/aluno-painel.service');
const businessRules = require('../src/utils/businessRules');
const AppError = require('../src/utils/AppError');

function fixture({ status = 'active', expired = false, workouts = [], workoutError } = {}) {
  const queries = [];
  const aluno = { id: 11, status, planEndDate: new Date(expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z'),
    user: { id: 7, name: 'Aluno', email: 'fixture@example.invalid' } };
  const db = {
    student: { findUnique: async args => { queries.push(['student', args]); return aluno; } },
    workout: { findMany: async args => { queries.push(['workout', args]); if (workoutError) throw workoutError; return workouts; } },
    checkin: { findMany: async () => [], count: async () => 0 }, payment: { findFirst: async () => null },
  };
  return { service: createAlunoPainelService({ db }), queries, aluno };
}

test('aluno ativo vencido há mais de cinco dias recebe motivo do bloqueio sem consultar fichas', async t => {
  const original = businessRules.validateWorkoutView;
  const validation = t.mock.method(businessRules, 'validateWorkoutView', function (aluno) { return original.call(this, aluno); });
  const { service, queries } = fixture({ expired: true });
  const result = await service.getPainelCompleto(7);
  assert.equal(validation.mock.callCount(), 1);
  assert.equal(result.trainingAccess.allowed, false);
  assert.match(result.trainingAccess.reason, /mais de 5 dias/);
  assert.deepEqual(result.treinos, []);
  assert.equal(queries.some(([name]) => name === 'workout'), false);
  assert.equal(result.alertas.some(a => a.mensagem.includes('não tem uma ficha')), false);
  assert.equal(result.alertas.filter(a => a.tipo === 'bloqueio').length, 1);
  assert.equal(result.alertas.find(a => a.tipo === 'bloqueio').mensagem, result.trainingAccess.reason);
});

test('aluno com status bloqueado recebe apenas um alerta de bloqueio', async () => {
  const result = await fixture({ status: 'blocked' }).service.getPainelCompleto(7);
  assert.equal(result.trainingAccess.allowed, false);
  assert.equal(result.alertas.filter(a => a.tipo === 'bloqueio').length, 1);
  assert.equal(result.alertas.some(a => a.tipo === 'treino'), false);
});

test('aluno autorizado sem ficha mantém aviso de ausência e contrato permitido', async () => {
  const { service, queries } = fixture();
  const result = await service.getPainelCompleto('7');
  assert.deepEqual(result.trainingAccess, { allowed: true, reason: null });
  assert.equal(result.alertas.some(a => a.mensagem.includes('não tem uma ficha')), true);
  assert.deepEqual(queries.find(([name]) => name === 'workout')[1].where, { studentId: 11, active: true });
  assert.equal(queries[0][1].where.userId, 7);
});

test('aluno autorizado com ficha mantém o mapeamento do painel', async () => {
  const result = await fixture({ workouts: [{ id: 5, name: 'Ficha A', exercises: [], instructor: { name: 'Instrutor A' } }] }).service.getPainelCompleto(7);
  assert.deepEqual(result.trainingAccess, { allowed: true, reason: null });
  assert.equal(result.treinos[0].nome, 'Ficha A');
  assert.equal(result.treinos[0].instrutor, 'Instrutor A');
  assert.equal(result.alertas.some(a => a.tipo === 'treino'), false);
});

test('falha de banco não se transforma em ausência de ficha', async () => {
  const failure = new Error('Banco indisponível');
  await assert.rejects(fixture({ workoutError: failure }).service.getPainelCompleto(7), error => error === failure);
});

test('somente AppError operacional 403 de validação se transforma em bloqueio', async t => {
  for (const failure of [new AppError('Inválido', 404), new Error('Bug'), Object.assign(new Error('Falso 403'), { statusCode: 403, isOperational: true }), Object.assign(new AppError('Bug 403', 403), { isOperational: false })]) {
    const mocked = t.mock.method(businessRules, 'validateWorkoutView', () => { throw failure; });
    const { service, queries } = fixture();
    await assert.rejects(service.getPainelCompleto(7), error => error === failure);
    assert.equal(queries.some(([name]) => name === 'workout'), false);
    mocked.mock.restore();
  }
});

test('geração de alertas sem argumento de acesso preserva contrato anterior', () => {
  assert.equal(fixture().service._gerarAlertas({ status: 'active' }, { statusVisual: 'em_dia' }, []).some(a => a.tipo === 'treino'), true);
});

test('bloqueio por vencimento não recomenda evitar um bloqueio já vigente', async () => {
  const result = await fixture({ expired: true }).service.getPainelCompleto(7);
  assert.equal(result.trainingAccess.allowed, false);
  assert.equal(result.alertas.filter(a => a.tipo === 'bloqueio').length, 1);
  assert.equal(result.alertas.some(a => a.mensagem.includes('evitar bloqueio')), false);
});

test('vencimento até cinco dias com acesso permitido mantém aviso preventivo', async () => {
  const { service, aluno } = fixture();
  aluno.planEndDate = new Date(Date.now() - 2 * 86400000);
  const result = await service.getPainelCompleto(7);
  assert.deepEqual(result.trainingAccess, { allowed: true, reason: null });
  assert.equal(result.alertas.some(a => a.mensagem.includes('evitar bloqueio')), true);
});

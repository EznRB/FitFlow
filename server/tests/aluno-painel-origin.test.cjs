const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlunoPainelService } = require('../src/services/aluno-painel.service');

function fixture({ blocked = false } = {}) {
  const queries = [];
  const snapshot = {
    version: 1, catalogExerciseId: 9, source: 'wger', externalId: '75', locale: 'pt', curated: true,
    originalName: 'Supino original', originalMuscleGroup: 'Peito', instructions: 'Descrição preservada na ficha.',
    sourceMetadata: { text: { author: 'Autoria original', license: { code: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } },
      media: [{ author: 'Autoria da imagem', license: { code: 'CC-BY-SA-3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' }, url: 'https://example.invalid/image.png' }] }
  };
  const exercises = [
    { id: 31, name: 'Supino adaptado', muscleGroup: 'Peito', sets: 3, reps: '8–12', restSeconds: 90, suggestedLoad: 12,
      notes: 'Orientação da ficha', catalogExerciseId: 9, catalogSnapshot: snapshot, workoutId: 5,
      workoutLogs: [{ weight: 14, repsCompleted: 10, createdAt: new Date('2026-10-10T12:00:00Z'), studentId: 11 }] },
    // Deliberately the same name: a manual exercise must never acquire a catalog identity by matching text.
    { id: 32, name: 'Supino original', muscleGroup: 'Peito', sets: 2, reps: '10', restSeconds: 0,
      catalogExerciseId: null, catalogSnapshot: null, workoutLogs: [] }
  ];
  const db = {
    student: { findUnique: async args => {
      queries.push(['student', args]);
      return { id: 11, userId: 7, status: blocked ? 'blocked' : 'active', planEndDate: new Date('2030-12-31T00:00:00Z'),
        user: { id: 7, name: 'Aluno fictício', email: 'fixture@example.invalid' } };
    } },
    workout: { findMany: async args => {
      queries.push(['workout', args]);
      return [{ id: 5, name: 'Ficha', description: 'Exemplo', instructor: { name: 'Instrutor' }, createdAt: new Date('2026-10-01T12:00:00Z'), exercises }];
    } },
    catalogoExercicio: { findMany: async () => { throw new Error('A ficha deve usar seu snapshot, sem consultar o catálogo atual.'); } },
    checkin: { findMany: async () => [], count: async () => 0 }, payment: { findFirst: async () => null }
  };
  return { service: createAlunoPainelService({ db }), snapshot, queries };
}

test('painel entrega identidade e créditos do snapshot persistido sem inferir origem pelo nome', async () => {
  const { service, snapshot } = fixture();
  const result = await service.getPainelCompleto(7);
  const [catalog, manual] = result.treinos[0].exercicios;
  assert.equal(catalog.id, 31);
  assert.equal(catalog.nome, 'Supino adaptado');
  assert.equal(catalog.catalogExerciseId, 9);
  assert.deepEqual(catalog.catalogSnapshot, snapshot);
  assert.deepEqual(catalog.ultimaCarga, { peso: 14, reps: 10, data: new Date('2026-10-10T12:00:00Z') });
  assert.equal(catalog.workoutId, undefined);
  assert.equal(catalog.workoutLogs, undefined);
  assert.equal(manual.catalogExerciseId, null);
  assert.equal(manual.catalogSnapshot, null);
});

test('consulta da ficha mantém isolamento por aluno e seleciona somente os campos usados pelo painel', async () => {
  const { service, queries } = fixture();
  await service.getPainelCompleto('7');
  assert.equal(queries[0][1].where.userId, 7);
  const query = queries.find(([name]) => name === 'workout')[1];
  assert.deepEqual(query.where, { studentId: 11, active: true });
  const exercise = query.select.exercises;
  assert.deepEqual(exercise.orderBy, { orderIndex: 'asc' });
  assert.equal(exercise.select.catalogExerciseId, true);
  assert.equal(exercise.select.catalogSnapshot, true);
  assert.deepEqual(exercise.select.workoutLogs.where, { studentId: 11 });
  assert.equal(exercise.select.workoutLogs.take, 1);
  assert.deepEqual(exercise.select.workoutLogs.select, { weight: true, repsCompleted: true, createdAt: true });
  assert.equal(query.include, undefined);
  assert.equal(exercise.include, undefined);
});

test('aluno bloqueado não recebe ficha nem seus créditos e nenhuma ficha é consultada', async () => {
  const { service, queries } = fixture({ blocked: true });
  const result = await service.getPainelCompleto(7);
  assert.deepEqual(result.treinos, []);
  assert.equal(queries.some(([name]) => name === 'workout'), false);
});

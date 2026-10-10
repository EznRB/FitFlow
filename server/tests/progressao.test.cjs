const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExerciseHistory, selectSeries } = require('../../client/js/progressao');
function session(id, records, exerciseId = 3, name = 'Supino') {
  return { id, planSnapshot: { name: 'Ficha A', exercises: [{ id: exerciseId, name }] }, sets: records };
}
const record = (id, extra = {}) => ({ id, exerciseId: 3, exerciseName: 'Supino', weightKg: 20, reps: 10, kind: 'working', rir: 2, performedAt: '2026-10-08T10:00:00Z', ...extra });
test('somente mesmo exerciseId é agrupado; nome igual em revisão fica separado', () => {
  const result = buildExerciseHistory([session('one', [record('a')]), session('two', [record('b', { exerciseId: 9 })], 9)]);
  assert.equal(result.exercises.length, 2);
  assert.equal(result.exercises.find(e => e.id === 3).records.length, 1);
  assert.equal(result.exercises.find(e => e.id === 9).records.length, 1);
});
test('filtro de repetições compara trabalho compatível e separa aquecimentos', () => {
  const group = buildExerciseHistory([session('one', [record('a'), record('b', { reps: 8, weightKg: 25 }), record('c', { kind: 'warmup', weightKg: 10 })])]).exercises[0];
  const all = selectSeries(group), ten = selectSeries(group, { reps: 10 });
  assert.equal(all.working.length, 2); assert.equal(all.warmup.length, 1);
  assert.equal(all.workingVolumeKg, 400); assert.equal(all.warmupVolumeKg, 100);
  assert.equal(ten.working.length, 1); assert.equal(ten.workingPoints[0].weightKg, 20);
  assert.equal(ten.workingVolumeKg, 200); assert.equal(ten.warmupPoints.length, 1);
});
test('zero de carga externa é real; ausência/boolean/unidade não viram zero nem reps fictícias', () => {
  const group = buildExerciseHistory([session('one', [record('zero', { weightKg: 0 }), record('null', { weightKg: null }),
    record('bool', { weightKg: true }), record('missing', { reps: null }), record('unit', { weightKg: '20kg' })])]).exercises[0];
  const result = selectSeries(group);
  assert.equal(result.workingPoints.length, 1); assert.equal(result.workingPoints[0].weightKg, 0);
  assert.equal(result.workingVolumeKg, 0); assert.equal(result.incomplete.length, 4);
});
test('data ausente não ganha ponto temporal e IDs repetidos não duplicam volume', () => {
  const result = buildExerciseHistory([session('one', [record('a'), record('a'), record('b', { performedAt: null }), record('c', { kind: 'invented' })])]);
  const selected = selectSeries(result.exercises[0]);
  assert.equal(result.duplicateRecords, 1); assert.equal(selected.workingPoints.length, 1);
  assert.equal(selected.workingVolumeKg, 400); assert.equal(selected.incomplete.length, 2);
});
test('registro requer exercício presente no snapshot e filtro aceita somente repetição inteira positiva', () => {
  const result = buildExerciseHistory([session('one', [record('valid'), record('wrong', { exerciseId: 9 }), record('boolean', { exerciseId: true })])]);
  assert.equal(result.ignoredRecords, 2);
  assert.throws(() => selectSeries(result.exercises[0], { reps: true }));
  assert.throws(() => selectSeries(result.exercises[0], { reps: 2.5 }));
  assert.throws(() => selectSeries(result.exercises[0], { reps: 0 }));
});

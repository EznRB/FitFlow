const test = require('node:test');
const assert = require('node:assert/strict');
const planner = require('../../client/js/planejamento-ciencia.js');
const base = { days: 3, minutes: 45, goal: 'general', consistency: 'regular', equipment: ['dumbbells'] };

test('compara sequências compatíveis com frequência sem escolher uma melhor divisão ou doses', () => {
  for (let days = 1; days <= 6; days++) {
    const result = planner.compare({ ...base, days });
    assert.equal(result.options.length, 3); assert.equal(result.best, undefined);
    for (const option of result.options) {
      assert.equal(option.schedule.length, days); assert.equal(option.nextWeek.length, days);
      assert.equal(option.sets, undefined); assert.equal(option.reps, undefined); assert.equal(option.load, undefined);
    }
    assert.ok(result.references.some(ref => ref.url === 'https://pubmed.ncbi.nlm.nih.gov/41843416/'));
    assert.ok(result.references.some(ref => ref.url === 'https://pubmed.ncbi.nlm.nih.gov/38595233/'));
  }
});
test('continuidade alterna regiões em semanas ímpares sem prometer frequência por nome da divisão', () => {
  const result = planner.compare(base), upperLower = result.options.find(o => o.id === 'upper-lower');
  assert.deepEqual(upperLower.schedule, ['Superiores', 'Inferiores', 'Superiores']);
  assert.deepEqual(upperLower.nextWeek, ['Inferiores', 'Superiores', 'Inferiores']);
  const ppl = result.options.find(o => o.id === 'push-pull-legs');
  assert.deepEqual(ppl.schedule, ['Empurrar', 'Puxar', 'Pernas']);
  assert.ok(ppl.tradeoff.includes('uma exposição'));
});
test('contexto exige dados explícitos e mudança de adesão/objetivo informa revisão sem prescrever', () => {
  for (const extra of [{ days: true }, { days: 2.5 }, { days: 0 }, { days: 7 }, { minutes: '' }, { goal: 'medicina' },
    { consistency: 'daily' }, { equipment: [] }, { equipment: ['inventado'] }]) assert.throws(() => planner.compare({ ...base, ...extra }));
  const result = planner.compare({ ...base, minutes: 20, consistency: 'variable', goal: 'hypertrophy', equipment: ['bands', 'bodyweight'] });
  assert.ok(result.considerations.some(x => x.includes('sequência')));
  assert.ok(result.considerations.some(x => x.includes('séries semanais')));
  assert.ok(result.considerations.some(x => x.includes('Elásticos')));
});
test('volume semanal usa séries por exposição e frequência explicitamente declaradas', () => {
  assert.equal(planner.weeklyVolume({ setsPerExposure: 4, exposures: 2 }), 8);
  assert.equal(planner.weeklyVolume({ setsPerExposure: 0, exposures: 3 }), 0);
  for (const bad of [null, true, '', '3x', -1, 2.5]) assert.throws(() => planner.weeklyVolume({ setsPerExposure: bad, exposures: 2 }));
});
test('resumo de ficha não soma músculos indiretos nem multiplica por uma frequência presumida', () => {
  const r = planner.summarizeRoutine([{ muscleGroup: 'Peito', sets: 3 }, { muscleGroup: 'Peito', sets: 2 },
    { muscleGroup: 'Múltiplos', sets: 4 }, { muscleGroup: '', sets: 1 }, { muscleGroup: 'Costas', sets: '' }]);
  assert.equal(r.directSets.Peito, 5); assert.equal(r.directSets.Tríceps, undefined);
  assert.equal(r.unassignedSets, 5); assert.equal(r.incompleteExercises, 1); assert.equal(r.totalSets, 10);
  assert.equal(r.weeklySets, undefined);
});
test('categorias genéricas com espaços, caixa ou acentos variados permanecem sem músculo direto', () => {
  const categories = [' MÚLTIPLOS ', 'multiplos', 'Mu\u0301ltiplos', ' OUTROS ', ' NÃO INFORMADO ',
    'nao   informado', ' cardio ', 'FUNCIONAL', ' ', null];
  const r = planner.summarizeRoutine(categories.map(muscleGroup => ({ muscleGroup, sets: 2 }))
    .concat([{ muscleGroup: ' Peito ', sets: 3 }]));
  assert.deepEqual({ ...r.directSets }, { Peito: 3 });
  assert.equal(r.unassignedSets, categories.length * 2);
  assert.equal(r.totalSets, categories.length * 2 + 3);
  assert.equal(r.incompleteExercises, 0);
});

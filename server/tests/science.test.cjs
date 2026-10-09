// Casos calculados à mão verificam fórmulas, unidades e conservação de energia.
const test = require('node:test');
const assert = require('node:assert/strict');
const science = require('../../client/js/science.js');
const base = { formula: 'mifflin', sex: 'male', age: 30, weightKg: 80, heightCm: 180,
  activityFactor: 1.5, adjustmentPercent: 0, proteinPerKg: 1.6, fatPercent: 25, eligible: true };

test('Mifflin usa coeficientes corretos e preserva energia dos macros', () => {
  const r = science.calculateNutrition(base);
  assert.equal(r.restingKcal, 1780);
  assert.equal(r.estimatedTotalKcal, 2670);
  assert.equal(r.proteinG, 128);
  assert.ok(Math.abs(4 * r.proteinG + 9 * r.fatG + 4 * r.carbsG - r.targetKcal) < 1e-8);
  assert.equal(science.calculateNutrition({ ...base, sex: 'female' }).restingKcal, 1614);
});
test('Harris–Benedict é a revisão de 1984 e ajuste é explícito', () => {
  const male = science.calculateNutrition({ ...base, formula: 'harris', adjustmentPercent: -10 });
  assert.ok(Math.abs(male.restingKcal - 1853.632) < 1e-8);
  assert.ok(Math.abs(male.targetKcal - male.estimatedTotalKcal * 0.9) < 1e-8);
  assert.ok(Math.abs(science.calculateNutrition({ ...base, formula: 'harris', sex: 'female' }).restingKcal - 1615.093) < 1e-8);
});
test('recusa campos vazios, unidades inválidas e pessoas fora do escopo', () => {
  for (const value of ['', null, undefined, NaN, Infinity, '80kg', true, []]) {
    assert.throws(() => science.calculateNutrition({ ...base, weightKg: value }));
  }
  for (const extra of [{ age: 18 }, { age: 79 }, { age: 30.5 }, { eligible: false },
    { sex: 'unknown' }, { formula: 'inventada' }, { activityFactor: 9 }, { adjustmentPercent: -90 },
    { fatPercent: 80 }, { proteinPerKg: 0 }]) {
    assert.throws(() => science.calculateNutrition({ ...base, ...extra }));
  }
});
test('não produz carboidratos negativos para combinação inviável', () => {
  assert.throws(() => science.calculateNutrition({ ...base, weightKg: 250, heightCm: 120,
    age: 78, sex: 'female', activityFactor: 1.2, adjustmentPercent: -20,
    proteinPerKg: 2.2, fatPercent: 35 }), /energia/i);
});
test('volume inclui somente carga e repetições conhecidas, sem inventar séries', () => {
  const result = science.summarizeLogs([{ weight: '40', repsCompleted: 10 },
    { weight: '50', repsCompleted: null }, { weight: '60', repsCompleted: 8 }]);
  assert.equal(result.knownVolumeKg, 880);
  assert.equal(result.completeRecords, 2);
  assert.equal(result.incompleteRecords, 1);
});
test('volume não transforma carga ausente ou boolean em registro completo', () => {
  const result = science.summarizeLogs([{ peso: null, reps: 10 }, { weight: '', reps: 10 }, { weight: 50, reps: true }]);
  assert.equal(result.completeRecords, 0);
  assert.equal(result.incompleteRecords, 3);
  assert.equal(result.knownVolumeKg, 0);
});

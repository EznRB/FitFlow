const test = require('node:test');
const assert = require('node:assert/strict');
const { createNutricaoService } = require('../src/services/nutricao.service');
const science = require('../../client/js/science');
const inputs = { formula: 'mifflin', sex: 'male', age: 30, weightKg: 80, heightCm: 180, activityFactor: 1.5,
  adjustmentPercent: 0, proteinPerKg: 1.6, fatPercent: 25, eligible: true };
function fixture() {
  const rows = new Map(); let reads = 0, writes = 0;
  const repo = { find: async userId => { reads++; return rows.get(userId) || null; },
    save: async (userId, data) => { writes++; const row = { userId, ...structuredClone(data), updatedAt: new Date('2026-10-08T12:00:00Z') }; rows.set(userId, row); return row; },
    remove: async userId => ({ count: rows.delete(userId) ? 1 : 0 }) };
  return { service: createNutricaoService(repo), rows, stats: () => ({ reads, writes }) };
}
const rejectsStatus = (promise, status) => assert.rejects(promise, error => error.statusCode === status);
test('save exige consentimento e usa equação compartilhada com parâmetros normalizados', async () => {
  const f = fixture();
  await rejectsStatus(f.service.save(1, { inputs }), 400);
  const saved = await f.service.save(1, { consent: true, inputs: { ...inputs, weightKg: '80' } });
  assert.equal(saved.scenario.inputs.weightKg, 80);
  assert.equal(saved.scenario.formulaVersion, science.version);
  assert.equal(saved.scenario.inputs.eligible, undefined);
  assert.equal(science.calculateNutrition({ ...saved.scenario.inputs, eligible: true }).targetKcal, 2670);
  assert.equal(f.stats().writes, 1);
});
test('consulta e exclusão usam só ID autenticado e preservam outra conta', async () => {
  const f = fixture(); await f.service.save(1, { consent: true, inputs });
  await f.service.save(2, { consent: true, inputs: { ...inputs, weightKg: 90 } });
  assert.equal((await f.service.get(1)).scenario.inputs.weightKg, 80);
  assert.equal((await f.service.get(2)).scenario.inputs.weightKg, 90);
  await f.service.remove(1); await f.service.remove(1);
  assert.equal((await f.service.get(1)).scenario, null);
  assert.equal((await f.service.get(2)).scenario.inputs.weightKg, 90);
});
test('versão antiga exige nova confirmação e retorna inputs sem calcular resultado automaticamente', async () => {
  const f = fixture(); await f.service.save(1, { consent: true, inputs });
  f.rows.get(1).formulaVersion = 'old';
  const response = await f.service.get(1);
  assert.equal(response.versionChanged, true); assert.equal(response.requiresScopeConfirmation, true);
  assert.equal(response.scenario.inputs.eligible, undefined); assert.equal(response.result, undefined);
  assert.equal(response.currentFormulaVersion, science.version);
});
test('rejeita identidade, JSON arbitrário, coerções e números fora do escopo antes do banco', async () => {
  const f = fixture();
  for (const data of [null, [], { consent: 'true', inputs }, { consent: true, inputs, userId: 2 },
    { consent: true, inputs: { ...inputs, email: 'private@example.com' } }, { consent: true, inputs: [] }]) {
    await rejectsStatus(f.service.save(1, data), 400);
  }
  for (const extra of [{ weightKg: null }, { age: true }, { age: 30.5 }, { age: 18 }, { sex: [] }, { weightKg: '' },
    { heightCm: {} }, { activityFactor: 3 }, { adjustmentPercent: -21 }, { proteinPerKg: 0 }, { fatPercent: 36 }, { formula: 'invented' }, { eligible: false }]) {
    await rejectsStatus(f.service.save(1, { consent: true, inputs: { ...inputs, ...extra } }), 400);
  }
  assert.equal(f.stats().writes, 0); assert.equal(f.stats().reads, 0);
});
test('distribuição impossível de macros não é salva', async () => {
  const f = fixture();
  await rejectsStatus(f.service.save(1, { consent: true, inputs: { ...inputs, weightKg: 250, heightCm: 120,
    age: 78, sex: 'female', activityFactor: 1.2, adjustmentPercent: -20, proteinPerKg: 2.2, fatPercent: 35 } }), 400);
  assert.equal(f.stats().writes, 0);
});

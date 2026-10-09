'use strict';
const AppError = require('../utils/AppError');
const science = require('../../../client/js/science.js');
const numericFields = Object.freeze(['age', 'weightKg', 'heightCm', 'activityFactor', 'adjustmentPercent', 'proteinPerKg', 'fatPercent']);
const inputFields = new Set(['formula', 'sex', 'eligible', ...numericFields]);
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(`${label} inválidos.`, 400);
}
function userId(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new AppError('Autenticação necessária.', 401);
  return value;
}
function normalizedInputs(value) {
  object(value, 'Parâmetros');
  if (Object.keys(value).some(key => !inputFields.has(key))) throw new AppError('Envie somente os parâmetros da simulação.', 400);
  if (value.eligible !== true) throw new AppError('Confirme o escopo da simulação antes de salvar.', 400);
  if (typeof value.formula !== 'string' || typeof value.sex !== 'string') throw new AppError('Selecione equação e coeficiente válidos.', 400);
  const inputs = { formula: value.formula, sex: value.sex };
  for (const key of numericFields) {
    if (!['number', 'string'].includes(typeof value[key]) || !String(value[key]).trim()) throw new AppError(`Parâmetro ${key} deve ser numérico.`, 400);
    inputs[key] = Number(value[key]);
  }
  try { science.calculateNutrition({ ...inputs, eligible: true }); }
  catch (error) { throw new AppError(error.message, 400); }
  // Scope confirmation is not a saved health claim; restoring always requires a new check.
  return inputs;
}
function createNutricaoService(repo) {
  function present(row) {
    return { scenario: row ? { inputs: row.inputs, formulaVersion: row.formulaVersion, updatedAt: row.updatedAt } : null,
      currentFormulaVersion: science.version, versionChanged: !!row && row.formulaVersion !== science.version, requiresScopeConfirmation: true };
  }
  return {
    async get(owner) { return present(await repo.find(userId(owner))); },
    async save(owner, body) {
      const id = userId(owner); object(body, 'Dados');
      if (Object.keys(body).some(key => !['consent', 'inputs'].includes(key)) || body.consent !== true) throw new AppError('Salvar exige consentimento explícito e somente os parâmetros da simulação.', 400);
      const inputs = normalizedInputs(body.inputs);
      return present(await repo.save(id, { inputs, formulaVersion: science.version }));
    },
    async remove(owner) { const result = await repo.remove(userId(owner)); return { deleted: result.count > 0 }; },
  };
}
module.exports = { createNutricaoService, normalizedInputs };

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const science = require('../../client/js/science');
const input = { formula: 'mifflin', sex: 'male', age: 30, weightKg: 80, heightCm: 180,
  activityFactor: 1.5, adjustmentPercent: 0, proteinPerKg: 1.6, fatPercent: 25, eligible: true };
function viewFixture(api, authenticated = true) {
  const elements = Object.fromEntries(Object.keys(input).map(key => [key, { value: 'typed', checked: true, focus() {} }]));
  const form = { elements, addEventListener() {}, reset() {} };
  const nodes = { '#nutrition-form': form };
  for (const selector of ['#nutrition-save', '#nutrition-restore', '#nutrition-delete', '#nutrition-save-summary', '#nutrition-account-status', '#nutrition-error', '#nutrition-result', '#nutrition-sources', '#nutrition-ai']) {
    nodes[selector] = { textContent: '', innerHTML: 'local result', disabled: false };
  }
  const container = { isConnected: true, innerHTML: '', querySelector: selector => nodes[selector] };
  const context = { window: { addEventListener() {} }, document: {}, structuredClone, FitFlowScience: science, API: api,
    EvidenciasView: { renderSources() {}, mountAI() {} }, ...(authenticated ? { Auth: { user: { id: 1, role: 'student' } } } : {}) };
  vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/nutricao.js'), 'utf8'), context);
  const view = vm.runInContext('NutricaoView', context); view.container = container; view.lastInputs = structuredClone(input);
  return { view, nodes, elements, context, container };
}
test('erro ao salvar conserva cálculo local e só envia após o clique explícito', async () => {
  const calls = [];
  const f = viewFixture({ put: async (endpoint, body) => { calls.push({ endpoint, body }); throw new Error('offline'); } });
  assert.equal(calls.length, 0);
  await f.view.saveScenario(1);
  assert.equal(calls.length, 1); assert.equal(calls[0].endpoint, '/nutricao/scenario'); assert.equal(calls[0].body.consent, true);
  assert.equal(f.nodes['#nutrition-result'].innerHTML, 'local result'); assert.equal(f.view.lastInputs.weightKg, 80);
  assert.match(f.nodes['#nutrition-account-status'].textContent, /cálculo nesta tela continua/);
});
test('recuperação explícita restaura medidas mas nunca restaura confirmação de escopo', async () => {
  const f = viewFixture({ get: async () => ({ data: { scenario: { inputs: { ...input, weightKg: 90 }, formulaVersion: 'old' }, versionChanged: true } }) });
  await f.view.restoreScenario(1);
  assert.equal(f.elements.weightKg.value, '90'); assert.equal(f.elements.eligible.checked, false);
  assert.equal(f.view.lastInputs, null); assert.equal(f.nodes['#nutrition-save'].disabled, true);
  assert.match(f.nodes['#nutrition-account-status'].textContent, /outra versão/);
  assert.match(f.nodes['#nutrition-result'].innerHTML, /Confirme novamente/);
});
test('dados salvos inválidos e edição durante GET preservam dados e resultado local', async () => {
  const invalid = viewFixture({ get: async () => ({ data: { scenario: { inputs: { ...input, age: 5 }, formulaVersion: science.version } } }) });
  await invalid.view.restoreScenario(1);
  assert.equal(invalid.elements.weightKg.value, 'typed'); assert.equal(invalid.nodes['#nutrition-result'].innerHTML, 'local result');
  let resolve;
  const waiting = viewFixture({ get: () => new Promise(done => { resolve = done; }) });
  const action = waiting.view.restoreScenario(1); waiting.view.editRevision++;
  resolve({ data: { scenario: { inputs: input, formulaVersion: science.version } } }); await action;
  assert.equal(waiting.elements.weightKg.value, 'typed'); assert.equal(waiting.nodes['#nutrition-result'].innerHTML, 'local result');
});
test('excluir dados salvos mantém resultado temporário e recuperação de outra conta é recusada', async () => {
  let calls = 0;
  const f = viewFixture({ delete: async () => { calls++; return { data: { deleted: true } }; }, get: async () => { calls++; return {}; } });
  await f.view.deleteScenario(1);
  assert.equal(f.nodes['#nutrition-result'].innerHTML, 'local result'); assert.equal(f.view.lastInputs.weightKg, 80);
  f.context.Auth.user.id = 2; await f.view.restoreScenario(1);
  assert.equal(calls, 1);
});
test('laboratório público mostra somente calculadora sem ações nem chamadas de persistência', () => {
  let calls = 0;
  const f = viewFixture({ get: async () => calls++, put: async () => calls++, delete: async () => calls++ }, false);
  f.view.render(f.container);
  assert.doesNotMatch(f.container.innerHTML, /id="nutrition-account"|id="nutrition-save"|id="nutrition-restore"/);
  assert.equal(calls, 0);
});
test('salvamento em curso impede exclusão concorrente que poderia reaparecer no servidor', async () => {
  let resolve, deleted = false;
  const f = viewFixture({ put: () => new Promise(done => { resolve = done; }), delete: async () => { deleted = true; return { data: { deleted: true } }; } });
  const saving = f.view.saveScenario(1);
  f.view.updateAccountPreview();
  assert.equal(f.nodes['#nutrition-save'].disabled, true);
  await f.view.deleteScenario(1); assert.equal(deleted, false);
  resolve({ data: { currentFormulaVersion: science.version } }); await saving;
  await f.view.deleteScenario(1); assert.equal(deleted, true);
});

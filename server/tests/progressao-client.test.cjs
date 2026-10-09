const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function fixture(role, get) {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', value: '', checked: false,
      disabled: false, hidden: false, querySelector: node });
    return nodes.get(selector);
  }
  const container = { isConnected: true, innerHTML: '', querySelector: node };
  const context = { window: { addEventListener() {}, dispatchEvent() {} }, Auth: { user: { id: 1, role } }, API: { get },
    FitFlowSecurity: { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]) } };
  vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/progressao.js'), 'utf8'), context);
  return { view: context.ProgressaoView, context, container, node };
}
test('visualização de aluno não consulta API para admin ou instrutor', async () => {
  for (const role of ['admin', 'instructor']) {
    let calls = 0; const f = fixture(role, async () => calls++);
    await f.view.render(f.container); assert.equal(calls, 0);
    assert.match(f.container.innerHTML, /conta de aluno/);
  }
});
test('consulta usa mine sem ID controlado pelo browser e troca de conta invalida resposta pendente', async () => {
  let resolve, endpoint;
  const f = fixture('student', route => { endpoint = route; return new Promise(done => { resolve = done; }); });
  const rendering = f.view.render(f.container);
  f.context.Auth.user = { id: 2, role: 'student' };
  resolve({ data: { sessions: [{ planSnapshot: { name: 'Private previous account', exercises: [] }, sets: [] }] } });
  await rendering; assert.equal(endpoint, '/sessoes/mine'); assert.equal(f.view.data, null);
  assert.doesNotMatch(f.container.innerHTML, /Private previous account/);
});
test('estado vazio e falha de rede não exibem métricas fictícias', async () => {
  const empty = fixture('student', async () => ({ data: { sessions: [], historyLimit: 100 } }));
  await empty.view.render(empty.container);
  assert.match(empty.node('[data-progress-content]').innerHTML, /histórico de séries começa/);
  assert.match(empty.node('[data-progress-status]').textContent, /100 sessões mais recentes/);
  const offline = fixture('student', async () => { throw new Error('Sem conexão'); });
  await offline.view.render(offline.container);
  assert.match(offline.node('[data-progress-status]').textContent, /Nenhum registro foi alterado/);
  assert.equal(offline.view.history, null);
});
test('nomes e notas entram escapados e tabela conserva zero e RIR ausente', () => {
  const f = fixture('student', async () => {});
  const html = f.view.table([{ weightKg: 0, reps: 10, rir: null, timestamp: 0, notes: '<img src=x onerror=attack>' }], 'Registros');
  assert.match(html, /0 kg/); assert.match(html, /Não informado/); assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x/);
});

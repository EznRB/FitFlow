const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup() {
  const nodes = new Map(), requests = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', style: {}, isConnected: true }); return nodes.get(id); };
  const Auth = { user: { id: 7, role: 'instructor' }, generation: 1, sessionEpoch: 'first', getSessionEpoch() { return this.sessionEpoch; } };
  const context = vm.createContext({ Auth, App: { currentPage: 'treinos' },
    document: { getElementById: node }, window: { addEventListener() {} }, Toast: { error() {} },
    API: { get: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })) } });
  for (const file of ['security.js', 'treinos.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('globalThis.view = TreinosView', context);
  return { view: context.view, node, nodes, requests, Auth };
}
test('student failure survives filtering; retry is single use and preserves filter', async () => {
  const h = setup(), pending = h.view.carregarAlunosParaPerfis(), grid = h.node('treinos-alunos-grid');
  assert.match(grid.innerHTML, /Carregando/);
  h.view.filtrarAlunos('Ana'); assert.match(grid.innerHTML, /Carregando/);
  h.requests[0].reject(new Error('offline')); await pending;
  h.view.filtrarAlunos('Bia'); assert.match(grid.innerHTML, /Tentar novamente/); assert.doesNotMatch(grid.innerHTML, /Nenhum aluno/);
  const retry = grid.onclick; retry(); retry(); assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bia' }] });
  await new Promise(resolve => setImmediate(resolve)); assert.match(grid.innerHTML, /Bia/); assert.doesNotMatch(grid.innerHTML, /Ana/);
});
test('blank names and duplicate student IDs remain recoverable through retries', async () => {
  const h = setup(), grid = h.node('treinos-alunos-grid');
  let pending = h.view.carregarAlunosParaPerfis();
  for (const [index, data] of [[{ id: 1, name: '   ' }], [{ id: 1, name: 'Ana' }, { id: 1, name: 'Bia' }]].entries()) {
    h.requests[index].resolve({ data }); await pending;
    assert.match(grid.innerHTML, /Tentar novamente/); assert.doesNotMatch(grid.innerHTML, /data-student/);
    assert.equal(h.view.alunosCache.length, 0);
    pending = grid.onclick();
  }
  h.requests[2].resolve({ data: [{ id: 2, name: 'Bia' }] }); await pending;
  assert.match(grid.innerHTML, /Bia/);
});
for (const kind of ['alunos', 'fichas']) {
  for (const change of ['account', 'role', 'generation', 'epoch', 'DOM']) {
    test(`${kind}: unused retry rejects stale ${change} context`, async () => {
      const h = setup(); if (kind === 'fichas') h.view.currentStudentId = 1;
      const pending = kind === 'fichas' ? h.view.carregarTreinos(1) : h.view.carregarAlunosParaPerfis();
      h.requests[0].reject(new Error('offline')); await pending;
      const id = kind === 'fichas' ? 'treinos-table-body' : 'treinos-alunos-grid', node = h.node(id), retry = node.onclick;
      retry({ target: { closest: () => null } }); assert.equal(h.requests.length, 1);
      const original = node.innerHTML;
      if (change === 'account') h.Auth.user.id = 8;
      if (change === 'role') h.Auth.user.role = 'admin';
      if (change === 'generation') h.Auth.generation++;
      if (change === 'epoch') h.Auth.sessionEpoch = 'second';
      if (change === 'DOM') h.nodes.set(id, { innerHTML: 'replacement', isConnected: true });
      retry({ target: { closest: () => ({}) } });
      assert.equal(h.requests.length, 1); assert.equal(node.innerHTML, original);
      if (change === 'DOM') assert.equal(h.node(id).innerHTML, 'replacement');
    });
  }
}
test('workout malformed fields yield retry, zero is legitimate, stale retry cannot load another student', async () => {
  const h = setup(); h.view.currentStudentId = 1;
  const pending = h.view.carregarTreinos(1), body = h.node('treinos-table-body');
  assert.match(body.innerHTML, /Carregando/);
  h.requests[0].resolve({ data: [{ id: 1, name: 'A', active: 'false', exercises: {} }] }); await pending;
  assert.match(body.innerHTML, /Tentar novamente/); assert.doesNotMatch(body.innerHTML, /Nenhuma ficha/);
  const stale = body.onclick; const retry = stale(); stale(); assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: [] }); await retry; assert.match(body.innerHTML, /Nenhuma ficha/);
  h.view.currentStudentId = 2; stale(); assert.equal(h.requests.length, 2);
});
test('empty students are legitimate; malformed students have an inline recovery action', async () => {
  const h = setup(); let pending = h.view.carregarAlunosParaPerfis();
  h.requests[0].resolve({ data: [] }); await pending;
  assert.match(h.node('treinos-alunos-grid').innerHTML, /Nenhum aluno/);
  pending = h.view.carregarAlunosParaPerfis(); h.requests[1].resolve({ data: [{ id: 1 }] }); await pending;
  assert.match(h.node('treinos-alunos-grid').innerHTML, /Tentar novamente/);
});
test('archived historical metadata and zero exercises render without fabricated status or count', async () => {
  const h = setup(); h.view.currentStudentId = 1;
  const pending = h.view.carregarTreinos(1);
  h.requests[0].resolve({ data: [{ id: 1, name: 'Histórico', description: null, active: false,
    createdAt: '2020-01-01T00:00:00.000Z', exercises: [] }] }); await pending;
  assert.match(h.node('treinos-table-body').innerHTML, /Arquivada/);
  assert.match(h.node('treinos-table-body').innerHTML, /<td>0<\/td>/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function harness() {
  const nodes = new Map(), events = new Map(), requests = [], modals = [], errors = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', style: {}, isConnected: true }); return nodes.get(id); };
  const Auth = { user: { id: 7, role: 'instructor' }, generation: 1 }, App = { currentPage: 'treinos' };
  const context = vm.createContext({ Auth, App, URL, window: { addEventListener: (name, fn) => events.set(name, fn) },
    document: { getElementById: node },
    API: { get: url => new Promise((resolve, reject) => requests.push({ url, resolve, reject })) },
    Modal: { open: (title, html) => modals.push({ title, html }), close: () => {}, confirm: () => {} },
    Toast: { error: message => errors.push(message), warning: message => errors.push(message) } });
  for (const file of ['security.js', 'treinos.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('globalThis.view = TreinosView', context);
  context.view.iniciarConstrutor = () => {}; context.view.adicionarExercicio = () => {};
  return { context, view: context.view, Auth, App, nodes, node, events, requests, modals, errors };
}
const row = (id, name) => ({ id, name, active: true, createdAt: '2026-10-09T00:00:00.000Z', exercises: [] });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('A→voltar→B não aplica tabela de A quando a resposta chega por último', async () => {
  const h = harness(); const first = h.view.abrirPerfilAluno(1, 'A'); h.view.voltarParaPerfis();
  const second = h.view.abrirPerfilAluno(2, 'B');
  h.requests[1].resolve({ data: [row(22, 'Ficha B')] }); await second;
  h.requests[0].resolve({ data: [row(11, 'Ficha A')] }); await first;
  assert.equal(h.view.currentStudentId, 2); assert.equal(h.node('treinos-aluno-nome').textContent, 'Fichas de B');
  assert.match(h.node('treinos-table-body').innerHTML, /Ficha B/); assert.doesNotMatch(h.node('treinos-table-body').innerHTML, /Ficha A/);
});

test('seleção A→B→A rejeita a primeira resposta de A mesmo com o mesmo ID atual', async () => {
  const h = harness(); const first = h.view.abrirPerfilAluno(1, 'A');
  const second = h.view.abrirPerfilAluno(2, 'B'), third = h.view.abrirPerfilAluno(1, 'A');
  h.requests[2].resolve({ data: [row(13, 'A mais recente')] }); await third;
  h.requests[0].resolve({ data: [row(11, 'A antigo')] }); h.requests[1].resolve({ data: [row(22, 'B antigo')] });
  await Promise.all([first, second]); assert.match(h.node('treinos-table-body').innerHTML, /A mais recente/);
  assert.doesNotMatch(h.node('treinos-table-body').innerHTML, /antigo/);
});

test('logout/entrada na mesma conta com nova geração não aplica dados nem erro antigo', async () => {
  const h = harness(); const request = h.view.abrirPerfilAluno(1, 'A');
  h.Auth.user = null; h.Auth.generation++; h.events.get('auth:logout')?.({ detail: { userId: 7 } });
  h.Auth.user = { id: 7, role: 'instructor' }; h.Auth.generation++;
  h.requests[0].reject(new Error('erro da conta anterior')); await request;
  assert.equal(h.errors.length, 0); assert.equal(h.node('treinos-table-body').innerHTML, '');
});

test('navegação e substituição do DOM rejeitam tabela antiga', async () => {
  const h = harness(); const request = h.view.abrirPerfilAluno(1, 'A');
  h.App.currentPage = 'dashboard'; h.events.get('navigate')?.({ detail: { page: 'dashboard' } });
  const replacement = { innerHTML: 'nova página', style: {}, isConnected: true }; h.nodes.set('treinos-table-body', replacement);
  h.requests[0].resolve({ data: [row(11, 'Ficha antiga')] }); await request;
  assert.equal(replacement.innerHTML, 'nova página');
});

test('detalhe atrasado não abre ficha de A na seleção de B; outro detalhe vence o primeiro', async () => {
  const h = harness(); h.view.currentStudentId = 1;
  const first = h.view.abrirModalDetalhe(11); h.view.currentStudentId = 2;
  const second = h.view.abrirModalDetalhe(22);
  h.requests[1].resolve({ data: { ...row(22, 'Ficha B'), studentId: 2 } }); await second;
  h.requests[0].resolve({ data: { ...row(11, 'Ficha A'), studentId: 1 } }); await first;
  assert.equal(h.modals.length, 1); assert.equal(h.modals[0].title, 'Ficha: Ficha B');
});

test('edição não abre modal se a seleção muda durante a consulta do catálogo', async () => {
  const h = harness(); h.view.currentStudentId = 1;
  const editing = h.view.abrirModalEditar(11);
  h.requests[0].resolve({ data: { ...row(11, 'Ficha A'), studentId: 1 } }); await tick();
  assert.equal(h.requests[1].url, '/treinos/catalogo');
  h.view.voltarParaPerfis(); h.view.currentStudentId = 2;
  h.requests[1].resolve({ data: [{ id: 9, nome: 'Catálogo antigo' }] }); await editing;
  assert.equal(h.modals.length, 0); assert.equal(h.view.catalogoCache.length, 0);
});

test('nova leitura da mesma tabela vence leitura antiga sem trocar aluno', async () => {
  const h = harness(); h.view.currentStudentId = 1;
  const first = h.view.carregarTreinos(1), second = h.view.carregarTreinos(1);
  h.requests[1].resolve({ data: [row(12, 'Ficha atual')] }); await second;
  h.requests[0].reject(new Error('erro antigo')); await first;
  assert.match(h.node('treinos-table-body').innerHTML, /Ficha atual/); assert.equal(h.errors.length, 0);
});

test('troca de conta A→B→A com novas gerações rejeita modal e alunos da sessão anterior', async () => {
  const h = harness(); h.view.currentStudentId = 1;
  const detail = h.view.abrirModalDetalhe(11), students = h.view.carregarAlunosParaPerfis();
  h.Auth.user = { id: 8, role: 'instructor' }; h.Auth.generation++;
  h.Auth.user = { id: 7, role: 'instructor' }; h.Auth.generation++;
  h.requests[0].resolve({ data: row(11, 'Ficha da sessão antiga') });
  h.requests[1].resolve({ data: [{ id: 1, name: 'Aluno da sessão antiga' }] });
  await Promise.all([detail, students]); assert.equal(h.modals.length, 0); assert.equal(h.view.alunosCache.length, 0);
  assert.doesNotMatch(h.node('treinos-alunos-grid').innerHTML, /sessão antiga/);
});

test('DOM substituído na mesma página rejeita modal sem depender de evento de navegação', async () => {
  const h = harness(); h.view.currentStudentId = 1;
  const detail = h.view.abrirModalDetalhe(11);
  h.nodes.set('treinos-table-body', { innerHTML: 'novo conteúdo', isConnected: true });
  h.requests[0].resolve({ data: row(11, 'Ficha antiga') }); await detail;
  assert.equal(h.modals.length, 0);
});

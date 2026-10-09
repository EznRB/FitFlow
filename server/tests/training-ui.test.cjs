const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function browser(globals = {}) {
  const context = vm.createContext({ window: {}, URL, ...globals });
  for (const file of ['security.js', 'treinos.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('this.view = TreinosView; this.studentView = MeuTreinoView;', context);
  return context;
}
test('interface usa seleção mínima e escapa nomes/descrições no aluno, lista, modal e catálogo', async () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const node = { innerHTML: '', contains: () => true };
  const requests = []; let modal;
  const context = browser({ document: { getElementById: () => node },
    API: { get: async url => { requests.push(url); return { data: url === '/treinos/alunos' ? [{ id: 11, name: evil }] :
      url === '/treinos/catalogo' ? [{ id: 9, nome: evil, grupo_muscular: evil }] :
      { name: evil, description: evil, notes: evil, student: { user: { name: evil } }, instructor: { name: evil },
        exercises: [{ name: evil, muscleGroup: evil, sets: 3, reps: evil, suggestedLoad: evil, notes: evil }] } }; } },
    Modal: { open: (title, html) => { modal = html; }, confirm: html => { modal = html; } },
    Toast: { error: error => { throw new Error(error); }, warning: error => { throw new Error(error); } } });
  await context.view.carregarAlunosParaPerfis(); assert.equal(requests[0], '/treinos/alunos');
  assert.ok(!node.innerHTML.includes('<img src=x')); assert.ok(!node.innerHTML.includes('onclick='));
  context.view.renderizarTabela([{ id: 5, name: evil, description: evil, active: true, createdAt: new Date().toISOString() }]);
  assert.ok(!node.innerHTML.includes('<img src=x')); assert.ok(!node.innerHTML.includes('onclick='));
  await context.view.abrirModalDetalhe(5); assert.ok(!modal.includes('<img src=x')); assert.ok(modal.includes('&lt;img'));
  await context.view.carregarCatalogo(); assert.equal(requests.at(-1), '/treinos/catalogo');
  context.view.renderizarCatalogoLista(); assert.ok(!node.innerHTML.includes('<img src=x'));
  context.view.confirmarDesativar(5, evil); assert.ok(!modal.includes('<img src=x'));
});
test('catálogo não preenche dose automaticamente e editor preserva zero de pausa com valores escapados', () => {
  let added;
  const row = { innerHTML: '' };
  const label = { textContent: '' };
  const container = { querySelectorAll: () => [], querySelector: () => null, appendChild: () => {} };
  const context = browser({ document: { createElement: () => row, getElementById: id => id === 'qtd-exercicios' ? label : container },
    Toast: { warning: () => {} } });
  context.view.catalogoCache = [{ id: 9, nome: 'Remada', grupo_muscular: 'Costas' }];
  const original = context.view.adicionarExercicio;
  context.view.adicionarExercicio = data => { added = data; };
  context.view.adicionarExercicioFromCatalogo(9);
  assert.equal(added.name, 'Remada'); assert.equal(added.sets, undefined); assert.equal(added.reps, undefined); assert.equal(added.restSeconds, undefined);
  const evil = '"><svg onload=alert(1)>';
  original.call(context.view, { name: evil, muscleGroup: evil, sets: 2, reps: '8-12', restSeconds: 0, notes: evil });
  assert.ok(!row.innerHTML.includes('<svg onload'));
  assert.ok(row.innerHTML.includes('class="ex-pausa" type="number" value="0"'));
  assert.ok(!row.innerHTML.includes('onclick='));
});
test('cadastro exige pausa explícita e não troca campo vazio por um valor padrão', async () => {
  let writes = 0, warning;
  const inputs = { 'treino-nome': { value: 'A' }, 'treino-aluno': { value: '11' },
    'treino-descricao': { value: '' }, 'treino-notas': { value: '' } };
  const context = browser({ document: { getElementById: id => inputs[id] }, API: { post: async () => { writes++; } },
    Toast: { warning: message => { warning = message; } } });
  context.view.coletarExercicios = () => [{ name: 'Remada', sets: '3', reps: '8-12', restSeconds: '' }];
  await context.view.salvarTreino(); assert.equal(writes, 0); assert.ok(warning.includes('pausa'));
});

test('catálogo amplo tem páginas limitadas e busca encontra exercícios fora da primeira página', () => {
  const node = { innerHTML: '' };
  const context = browser({ document: { getElementById: () => node } });
  context.view.catalogoCache = Array.from({ length: 95 }, (_, index) => ({ id: index + 1, nome: `Exercício ${index + 1}`, grupo_muscular: 'Costas' }));
  context.view.renderizarCatalogoLista();
  assert.equal((node.innerHTML.match(/data-catalog="/g) || []).length, 30);
  assert.ok(node.innerHTML.includes('1–30 de 95'));
  assert.ok(!node.innerHTML.includes('data-catalog="95"'));
  context.view.renderizarCatalogoLista('', 3);
  assert.equal((node.innerHTML.match(/data-catalog="/g) || []).length, 5);
  assert.ok(node.innerHTML.includes('91–95 de 95'));
  context.view.filtrarCatalogo('Exercício 95');
  assert.ok(node.innerHTML.includes('data-catalog="95"'));
  assert.ok(node.innerHTML.includes('1–1 de 1'));
});

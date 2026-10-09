const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(api = {}) {
  const nodes = new Map(), modals = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', contains: button => button.contained !== false });
    return nodes.get(id);
  };
  const context = vm.createContext({ window: {}, console, setTimeout: () => {}, API: api,
    document: { getElementById: node }, Modal: { open: (title, html) => modals.push({ title, html }) }, Toast: { error: message => { throw new Error(message); } } });
  for (const file of ['security', 'alunos', 'pagamentos']) vm.runInContext(fs.readFileSync(path.join(__dirname, `../../client/js/${file}.js`), 'utf8'), context);
  vm.runInContext('globalThis.views = { AlunosView, PagamentosView };', context);
  const click = (host, dataset, contained = true) => host.onclick({ target: { closest: () => ({ dataset, contained }) } });
  return { ...context.views, node, modals, click };
}
const unsafe = '"><img src=x onerror=alert(1)>';

test('editar/inativar aluno funcionam pelo clique no ícone sem handler HTML ou duplicação', () => {
  const h = harness(), calls = [], student = { id: 9, user: { name: unsafe, email: unsafe }, status: 'active' };
  h.AlunosView.abrirModalEdicao = id => calls.push(['edit', id]);
  h.AlunosView.inativarAluno = id => calls.push(['deactivate', id]);
  h.AlunosView.renderTabela([student]); h.AlunosView.renderTabela([student]);
  const host = h.node('alunos-table-body');
  assert.ok(!host.innerHTML.includes('onclick=')); assert.ok(!host.innerHTML.includes('<img'));
  h.click(host, { alunoAction: 'edit', alunoId: '9' });
  h.click(host, { alunoAction: 'deactivate', alunoId: '9' });
  for (const alunoId of ['9foo', '0', '-1', unsafe, '9007199254740992']) h.click(host, { alunoAction: 'edit', alunoId });
  h.click(host, { alunoAction: 'edit', alunoId: '9' }, false);
  assert.deepEqual(calls, [['edit', 9], ['deactivate', 9]]);
});

test('detalhes financeiros continuam funcionando após recarregar a tabela sem executar strings', async () => {
  const payment = { id: 4, amount: 10, student: { user: { name: unsafe } }, plan: { name: unsafe }, status: 'paid', paymentMethod: 'pix' };
  const h = harness({ get: async () => ({ data: [payment] }) }), calls = [];
  h.PagamentosView.verDetalhes = id => calls.push(id);
  await h.PagamentosView.carregarLista(); await h.PagamentosView.carregarLista();
  const host = h.node('pagamentos-table-body');
  assert.ok(!host.innerHTML.includes('onclick=')); assert.ok(!host.innerHTML.includes('<img'));
  h.click(host, { paymentDetails: '4' });
  for (const paymentDetails of ['4foo', '0', unsafe, '9007199254740992']) h.click(host, { paymentDetails });
  h.click(host, { paymentDetails: '4' }, false);
  assert.deepEqual(calls, [4]);
});

test('atalho no modal de inadimplentes seleciona somente ID válido do botão contido', async () => {
  const h = harness({ post: async () => ({}), get: async () => ({ data: [{ id: 3, user: { name: unsafe, email: unsafe }, status: 'blocked' }] }) }), calls = [];
  h.PagamentosView.registrarPagamentoRapido = id => calls.push(id);
  await h.PagamentosView.abrirModalInadimplentes();
  assert.ok(!h.modals[0].html.includes('onclick=')); assert.ok(!h.modals[0].html.includes('<img'));
  const host = h.node('modal-body');
  h.click(host, { paymentStudent: '3' });
  h.click(host, { paymentStudent: '3foo' }); h.click(host, { paymentStudent: unsafe });
  h.click(host, { paymentStudent: '3' }, false);
  assert.deepEqual(calls, [3]);
});

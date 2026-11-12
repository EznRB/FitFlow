'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(total = 25) {
  const nodes = new Map();
  const document = { activeElement: null, getElementById: id => nodes.get(id) || null };
  for (const id of ['exercicios-table-body', 'catalog-count', 'catalog-page', 'catalog-prev', 'catalog-next', 'filtro-nome-exercicio', 'filtro-idioma-exercicio']) {
    nodes.set(id, { id, value: '', disabled: false, isConnected: true, focus() { document.activeElement = this; } });
  }
  const context = vm.createContext({ document, window: {}, Auth: { user: { id: 1, role: 'admin' }, generation: 1 }, App: { currentPage: 'exercicios' } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../client/js/exercicios-catalogo.js'), 'utf8') + '\nglobalThis.view = ExerciciosCatalogoView;', context);
  const view = context.view;
  view.dados = Array.from({ length: total }, (_, i) => ({ id: i + 1, nome: `Movimento ${i + 1}`, ativo: true }));
  view.cacheContext = view.contexto();
  view.configurarEventos();
  view.renderizarResultados();
  return { view, nodes, document };
}

test('catalog pagination keeps keyboard focus on an enabled control at either boundary', () => {
  const { view, nodes, document } = fixture();
  const previous = nodes.get('catalog-prev'), next = nodes.get('catalog-next');
  next.focus(); next.onclick();
  assert.equal(view.page, 2);
  assert.equal(next.disabled, true);
  assert.equal(document.activeElement, previous);
  assert.match(nodes.get('exercicios-table-body').innerHTML, /Movimento 25/);
  previous.onclick();
  assert.equal(view.page, 1);
  assert.equal(previous.disabled, true);
  assert.equal(document.activeElement, next);
});

test('catalog pagination keeps focus on its control between boundaries and on filters during filtering', () => {
  const { view, nodes, document } = fixture(73);
  const next = nodes.get('catalog-next'), search = nodes.get('filtro-nome-exercicio');
  next.focus(); next.onclick();
  assert.equal(view.page, 2);
  assert.equal(document.activeElement, next);
  search.focus(); search.value = 'Movimento 73'; view.aplicarFiltros();
  assert.equal(document.activeElement, search);
  assert.equal(nodes.get('catalog-prev').disabled, true);
  assert.equal(next.disabled, true);
});

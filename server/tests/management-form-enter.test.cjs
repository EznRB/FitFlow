const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture(file, symbol) {
  const nodes = new Map(); let html = '';
  const node = id => { if (!nodes.has(id)) nodes.set(id, { isConnected: true, querySelector() { return {}; } }); return nodes.get(id); };
  const context = vm.createContext({ console, window: { addEventListener() {} },
    document: { getElementById: node, querySelectorAll() { return []; } },
    Auth: { user: { id: 7, role: 'admin' }, generation: 1 },
    Modal: { open(title, body) { html = body; }, isOpen() { return true; } },
    FitFlowSecurity: { escapeHtml(value) { return String(value ?? ''); } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  return { view: vm.runInContext(symbol, context), html: () => html };
}
function assertSubmit(html, id) {
  const form = html.match(new RegExp(`<form[^>]*id="${id}"[^>]*>([\\s\\S]*?)</form>`));
  assert.ok(form, 'renderiza formulário');
  assert.match(form[1], /<button\b[^>]*type="submit"[^>]*>/, 'Enter precisa de submit real dentro do formulário');
  assert.doesNotMatch(form[0], /novalidate/, 'preserva validação nativa');
}
test('matrícula e edição de aluno oferecem submit real para Enter', () => {
  const h = fixture('alunos.js', 'AlunosView');
  h.view.carregarPlanosSelect = () => {};
  h.view.abrirModalCriacao(); assertSubmit(h.html(), 'form-aluno');
  h.view.dados = [{ id: 1, user: { name: 'Aluno', email: 'aluno@example.invalid' } }];
  h.view.abrirModalEdicao(1); assertSubmit(h.html(), 'form-aluno');
});
test('criação e edição de exercício oferecem submit real para Enter', () => {
  const h = fixture('exercicios-catalogo.js', 'ExerciciosCatalogoView');
  assertSubmit(h.view.formulario(), 'form-exercicio');
  assertSubmit(h.view.formulario({ id: 1, nome: 'Supino', grupo_muscular: 'Peito', source: 'local' }), 'form-exercicio');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const student = (id, name) => ({ id, user: { name, email: `${name}@example.invalid` }, status: 'active' });

function fixture() {
  const nodes = new Map(), calls = [], notices = [], listeners = {}, autocomplete = [];
  let epoch = 'initial', modalOpen = false, closes = 0, footerActions = [];
  function node(id, value = '') { const n = { id, value, innerHTML: '', textContent: '', isConnected: true, disabled: false,
    contains: () => true, reportValidity: () => true }; nodes.set(id, n); return n; }
  node('alunos-table-body'); node('btn-novo-aluno'); node('filtro-nome-aluno');
  const Auth = { user: { id: 7, role: 'admin' }, generation: 1, sessionEpoch: 'initial', getSessionEpoch: () => epoch };
  function clearModal() {
    for (const [id, n] of nodes) if (id.startsWith('input-aluno-') || ['form-aluno', 'confirm-aluno-inativacao', 'modal-save'].includes(id)) { n.isConnected = false; nodes.delete(id); }
  }
  const Modal = {
    open(title, html, actions) {
      clearModal(); modalOpen = true; footerActions = actions;
      const fields = new Map();
      for (const match of html.matchAll(/<(?:input|select)[^>]*id="([^"]+)"[^>]*>/g)) {
        const field = node(match[1], match[0].match(/value="([^"]*)"/)?.[1] || ''); fields.set(match[1], field);
      }
      if (html.includes('id="form-aluno"')) { const form = node('form-aluno'); form.querySelector = selector => fields.get(selector.slice(1)) || null; }
      if (html.includes('id="confirm-aluno-inativacao"')) node('confirm-aluno-inativacao');
      const primary = actions.find(a => a.class === 'btn-primary');
      if (primary) { const button = node('modal-save'); button.innerHTML = primary.text; button.textContent = primary.text; }
    },
    close() { closes++; clearModal(); modalOpen = false; },
    isOpen: () => modalOpen,
    confirm(message, callback) { footerActions = [{ action: callback }]; },
  };
  const context = vm.createContext({ console, TextEncoder, window: { addEventListener: (name, fn) => { listeners[name] = fn; } }, Auth,
    App: { currentPage: 'alunos' }, Modal,
    document: { getElementById: id => nodes.get(id) || null, querySelectorAll: () => nodes.has('modal-save') ? [nodes.get('modal-save')] : [] },
    API: Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (route, payload) => { const response = deferred(); calls.push({ method, route, payload, ...response }); return response.promise; }])),
    Toast: { error: message => notices.push(['error', message]), success: message => notices.push(['success', message]) },
    Autocomplete: { init: (...args) => autocomplete.push(args) },
    FitFlowSecurity: { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/alunos.js'), 'utf8') + '\nglobalThis.view = AlunosView;', context);
  const view = context.view;
  function fill() { for (const [key, value] of Object.entries({ nome: 'Nome válido', email: 'aluno@example.invalid', senha: 'own-password', plano: '3' })) if (nodes.has(`input-aluno-${key}`)) nodes.get(`input-aluno-${key}`).value = value; }
  return { view, context, Auth, nodes, node, calls, notices, listeners, autocomplete, Modal, fill,
    epoch: value => { epoch = value; }, actions: () => footerActions, closes: () => closes };
}

test('lista concorrente descarta sucesso e erro antigos sem sobrescrever a leitura mais nova', async () => {
  for (const rejectOld of [false, true]) {
    const h = fixture(), old = h.view.carregarLista(), fresh = h.view.carregarLista();
    h.calls[1].resolve({ data: [student(2, 'Atual')] }); await fresh;
    if (rejectOld) h.calls[0].reject(new Error('Erro antigo')); else h.calls[0].resolve({ data: [student(1, 'Antigo')] });
    await old;
    assert.equal(h.view.dados[0].id, 2); assert.match(h.nodes.get('alunos-table-body').innerHTML, /Atual/);
    assert.deepEqual(h.notices, []);
  }
});

test('lista não altera DOM substituído nem instala evento de inicialização numa tela nova', async () => {
  const h = fixture(), rendering = h.view.inicializar();
  const table = h.node('alunos-table-body'); table.innerHTML = 'Outra tela';
  const button = h.node('btn-novo-aluno');
  h.calls[0].resolve({ data: [student(1, 'Privado')] }); await rendering;
  assert.equal(table.innerHTML, 'Outra tela'); assert.equal(button.onclick, undefined); assert.equal(h.view.dados.length, 0);
});

test('epoch remoto antes do storage event impede consulta e mutação sob identidade antiga', async () => {
  const h = fixture(); h.view.abrirModalCriacao(); h.fill(); h.epoch('other-tab');
  const reading = h.view.carregarLista(), writing = h.view.submeterFormulario();
  assert.equal(h.calls.length, 1, 'somente a consulta de planos feita antes da troca');
  assert.equal(h.calls[0].method, 'get');
  h.calls[0].resolve({ data: [] }); await Promise.all([reading, writing]);
});

test('planos usa ativo=true e resposta antiga não altera outro formulário', async () => {
  const h = fixture(); h.view.abrirModalCriacao(); const first = h.nodes.get('input-aluno-plano');
  h.view.abrirModalCriacao(); const second = h.nodes.get('input-aluno-plano');
  assert.equal(h.calls[0].route, '/planos?ativo=true');
  h.calls[1].resolve({ data: [{ id: 8, name: 'Atual', price: 20 }] }); await tick();
  h.calls[0].resolve({ data: [{ id: 4, name: 'Antigo', price: 10 }] }); await tick();
  assert.match(second.innerHTML, /Atual/); assert.doesNotMatch(second.innerHTML, /Antigo/); assert.doesNotMatch(first.innerHTML, /Antigo/);
});

test('Enter impede navegação e compartilha o envio pendente com o botão do mesmo formulário', async () => {
  const h = fixture(); h.view.abrirModalCriacao(); h.fill();
  const form = h.nodes.get('form-aluno'); assert.equal(typeof form.onsubmit, 'function');
  let prevented = 0; const first = form.onsubmit({ preventDefault: () => prevented++ });
  const second = form.onsubmit({ preventDefault: () => prevented++ });
  const third = h.actions().find(a => a.class === 'btn-primary').action();
  assert.equal(prevented, 2); assert.equal(h.calls.filter(c => c.method === 'post').length, 1);
  const writing = h.calls.find(c => c.method === 'post'); writing.resolve({ data: { id: 5 } });
  await tick(); h.calls.find(c => c.route === '/alunos' && c.method === 'get').resolve({ data: [] });
  await Promise.all([first, second, third]); assert.equal(h.closes(), 1); assert.equal(h.notices.length, 1);
});

test('formulário inválido não envia e erro atual permite tentar novamente sem duplicar', async () => {
  const h = fixture(); h.view.abrirModalCriacao(); h.fill(); const form = h.nodes.get('form-aluno');
  form.reportValidity = () => false; const invalid = h.view.submeterFormulario(); assert.equal(h.calls.length, 1); await invalid;
  form.reportValidity = () => true; const first = h.view.submeterFormulario(); h.calls[1].reject(new Error('Falhou')); await first;
  assert.equal(h.closes(), 0); assert.equal(h.nodes.get('modal-save').disabled, false);
  const second = h.view.submeterFormulario(); assert.equal(h.calls.filter(c => c.method === 'post').length, 2);
  h.calls[2].reject(new Error('Falhou de novo')); await second;
});

test('salvamento antigo não fecha modal novo nem altera seu botão ou Toast', async () => {
  for (const rejectOld of [false, true]) {
    const h = fixture(); h.view.dados = [student(5, 'Aluno')]; h.view.abrirModalEdicao(5); h.fill();
    const writing = h.view.submeterFormulario(); assert.equal(h.calls[0].route, '/alunos/5');
    h.view.abrirModalCriacao(); const button = h.nodes.get('modal-save'); button.innerHTML = 'Novo formulário';
    const result = { data: { id: 5 } };
    if (rejectOld) h.calls[0].reject(new Error('Antigo')); else h.calls[0].resolve(result);
    const received = await writing; if (!rejectOld) assert.equal(received, result, 'resultado real da escrita deve ser preservado');
    assert.equal(h.closes(), 0); assert.equal(button.innerHTML, 'Novo formulário'); assert.equal(button.disabled, false);
    assert.deepEqual(h.notices, []); assert.equal(h.calls.filter(c => c.route === '/alunos' && c.method === 'get').length, 0);
  }
});

test('edição captura ID e dados, preserva nascimento vazio e recarrega a lista atual uma vez', async () => {
  const h = fixture(); h.view.dados = [student(5, 'Aluno')]; h.view.abrirModalEdicao(5); h.fill();
  const writing = h.view.submeterFormulario(); h.view.alunoAtualId = 999;
  assert.equal(h.calls[0].method, 'put'); assert.equal(h.calls[0].route, '/alunos/5');
  assert.equal(h.calls[0].payload.birthDate, ''); assert.equal(h.calls[0].payload.password, undefined);
  h.calls[0].resolve({ data: { id: 5 } }); await tick();
  assert.equal(h.calls[1].route, '/alunos'); h.calls[1].resolve({ data: [student(5, 'Atualizado')] }); await writing;
  assert.equal(h.closes(), 1); assert.equal(h.notices[0][0], 'success'); assert.equal(h.view.dados[0].user.name, 'Atualizado');
});

test('Enter e botão de um formulário substituído não enviam os dados do formulário novo', async () => {
  const h = fixture(); h.view.abrirModalCriacao(); h.fill();
  const form = h.nodes.get('form-aluno'), save = h.actions().find(a => a.class === 'btn-primary').action;
  h.view.abrirModalCriacao(); h.fill(); let prevented = false;
  await form.onsubmit({ preventDefault: () => { prevented = true; } }); await save();
  assert.equal(prevented, true); assert.equal(h.calls.filter(c => c.method === 'post').length, 0); assert.equal(h.closes(), 0);
});

test('fechar formulário durante a consulta de planos não atualiza seletor desconectado', async () => {
  const h = fixture(); h.view.abrirModalCriacao(); const select = h.nodes.get('input-aluno-plano');
  h.Modal.close(); h.calls[0].reject(new Error('Consulta antiga')); await tick();
  assert.equal(select.innerHTML, ''); assert.equal(h.notices.length, 0);
});

test('autocomplete reutiliza o input e atualiza suas opções e dados após recarregar a lista', async () => {
  const h = fixture(); const initial = h.view.carregarLista(); h.calls[0].resolve({ data: [student(1, 'Antigo')] }); await initial;
  const next = h.view.carregarLista(); h.calls[1].resolve({ data: [student(2, 'Atual')] }); await next;
  assert.equal(h.autocomplete.length, 1); assert.equal(h.autocomplete[0][1][0].label, 'Atual');
  h.autocomplete[0][2]({ id: 2 }); assert.match(h.nodes.get('alunos-table-body').innerHTML, /Atual/);
  assert.doesNotMatch(h.nodes.get('alunos-table-body').innerHTML, /Antigo/);
});

test('inativação exige confirmação atual e resposta tardia não afeta modal novo', async () => {
  for (const replaceModal of [false, true]) {
    const h = fixture(); await h.view.inativarAluno(5);
    assert.equal(h.calls.length, 0); const leaving = h.actions().at(-1).action();
    assert.equal(h.calls[0].route, '/alunos/5'); assert.equal(h.calls[0].method, 'delete'); assert.equal(h.closes(), 1);
    if (replaceModal) h.view.abrirModalCriacao();
    h.calls[0].resolve({}); await tick();
    if (!replaceModal) { assert.equal(h.calls[1].route, '/alunos'); h.calls[1].resolve({ data: [] }); }
    await leaving;
    assert.equal(h.closes(), 1); assert.equal(h.notices.length, replaceModal ? 0 : 1);
  }
});

test('troca de conta, papel, geração, epoch ou tela descarta continuação do salvamento', async () => {
  for (const switchIdentity of [h => { h.Auth.user.id = 8; }, h => { h.Auth.user.role = 'instructor'; },
    h => { h.Auth.generation++; }, h => h.epoch('remote'), h => { h.context.App.currentPage = 'dashboard'; }]) {
    const h = fixture(); h.view.abrirModalCriacao(); h.fill(); const writing = h.view.submeterFormulario();
    switchIdentity(h); h.calls.find(c => c.method === 'post').resolve({ data: { id: 5 } }); await writing;
    assert.equal(h.closes(), 0); assert.deepEqual(h.notices, []); assert.equal(h.calls.length, 2);
  }
});

test('autocomplete antigo e confirmação de inativação não agem depois de substituir a view', async () => {
  const h = fixture(), reading = h.view.carregarLista(); h.calls[0].resolve({ data: [student(5, 'Atual')] }); await reading;
  const callback = h.autocomplete[0][2]; h.node('alunos-table-body').innerHTML = 'Outra view'; callback({ id: 5 });
  assert.equal(h.nodes.get('alunos-table-body').innerHTML, 'Outra view');
  h.view.inativarAluno(5); const confirmAction = h.actions().at(-1).action;
  h.Auth.generation++; await confirmAction(); assert.equal(h.calls.filter(c => c.method === 'delete').length, 0);
});

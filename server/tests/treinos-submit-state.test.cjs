const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The DOM and transport are isolated; the editor, payload collection and guards
// run from the production script. No database or provider is contacted.
function harness() {
  const nodes = new Map(), requests = [], notices = [], events = new Map();
  const element = () => ({ isConnected: true, value: '', textContent: '', innerHTML: '',
    style: {}, dataset: {}, disabled: false, hidden: false, attributes: {},
    setAttribute(key, value) { this.attributes[key] = String(value); },
    removeAttribute(key) { delete this.attributes[key]; },
    getAttribute(key) { return this.attributes[key] ?? null; },
    prepend(child) { child.parentElement = this; },
    focus() { this.focused = true; }, reportValidity() { return true; },
    querySelector(selector) { return selector.startsWith('#') ? nodes.get(selector.slice(1)) : null; },
    querySelectorAll() { return []; }, contains(node) { return node?.isConnected; } });
  const node = id => nodes.get(id) || null;
  nodes.set('treinos-table-body', element());
  const Auth = { user: { id: 7, role: 'instructor' }, generation: 1, sessionEpoch: 'first',
    getSessionEpoch() { return this.storedEpoch; }, storedEpoch: 'first' };
  const App = { currentPage: 'treinos' };
  const Modal = { revision: 0, opened: false, closes: 0, buttons: [],
    isOpen() { return this.opened; },
    open(title, html, buttons) {
      this.revision++; this.opened = true; this.html = html;
      for (const [id, item] of nodes) if (id !== 'treinos-table-body') { item.isConnected = false; nodes.delete(id); }
      for (const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], element());
      this.buttons = buttons.map(item => Object.assign(element(), { textContent: item.text, action: item.action, className: item.class }));
      const footer = element(); footer.querySelector = () => this.buttons.find(item => item.className === 'btn-primary');
      nodes.set('modal-footer', footer);
      node('exercicios-container').rows = [];
      node('exercicios-container').querySelectorAll = () => node('exercicios-container').rows;
      if (node('treino-aluno')) node('treino-aluno').value = '11';
      node('treino-nome').value = 'Ficha A';
    },
    close() { this.closes++; this.revision++; this.opened = false;
      for (const [id, item] of nodes) if (id !== 'treinos-table-body') { item.isConnected = false; nodes.delete(id); }
    } };
  const API = { get: async url => ({ data: url === '/treinos/catalogo' ? [] : { id: 20, name: 'Ficha A', exercises: [] } }),
    post: (url, payload, options) => new Promise((resolve, reject) => requests.push({ method: 'POST', url, payload, options, resolve, reject })),
    put: (url, payload, options) => new Promise((resolve, reject) => requests.push({ method: 'PUT', url, payload, options, resolve, reject })) };
  const context = vm.createContext({ Auth, App, Modal, API, URL,
    window: { addEventListener: (name, callback) => events.set(name, callback) },
    document: { getElementById: node, querySelector: selector => selector === '#modal-footer .btn-primary' ? Modal.buttons.find(button => button.className === 'btn-primary') : null },
    Toast: Object.fromEntries(['success', 'warning', 'error'].map(type => [type, message => notices.push([type, message])])) });
  for (const file of ['security.js', 'treinos.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('globalThis.view = TreinosView;', context);
  const view = context.view; view.currentStudentId = 11; view.alunosCache = [{ id: 11, name: 'Aluno fixture' }];
  view.carregarTreinos = async () => { context.reloads++; }; context.reloads = 0;
  function exercise() {
    const values = { 'ex-nome': 'Remada', 'ex-grupo': 'Costas', 'ex-series': '3', 'ex-reps': '8-12', 'ex-pausa': '60', 'ex-carga': '', 'ex-obs': '' };
    const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Object.assign(element(), { value })]));
    const row = Object.assign(element(), { dataset: {}, querySelector: selector => fields[selector.slice(1)] || null });
    node('exercicios-container').rows.push(row); return fields;
  }
  async function open(id = null) {
    if (id) await view.abrirModalEditar(id); else await view.abrirModalCriar();
    const fields = exercise(); return { fields, form: node('form-treino'), button: Modal.buttons.find(button => button.className === 'btn-primary'),
      feedback: node('treino-save-feedback'), save: () => Modal.buttons.find(button => button.className === 'btn-primary').action() };
  }
  return { context, view, nodes, node, Auth, App, Modal, API, requests, notices, events, open };
}

test('cliques concorrentes criam somente uma ficha e mantêm o primeiro sucesso', async () => {
  const h = harness(), editor = await h.open();
  const first = editor.save(), second = editor.save();
  const count = h.requests.length;
  h.requests.forEach(request => request.resolve({ message: 'Ficha salva.' }));
  await Promise.all([first, second]);
  assert.equal(count, 1); assert.equal(h.Modal.closes, 1); assert.equal(h.context.reloads, 1);
  assert.equal(h.notices.filter(([type]) => type === 'success').length, 1);
});

test('dois acionamentos de revisão não descartam o sucesso nem enviam PUT para ficha já arquivada', async () => {
  const h = harness(), editor = await h.open(20);
  const first = editor.save(), second = editor.save(); const count = h.requests.length;
  h.requests[0].resolve({ message: 'Revisão salva.' });
  for (const request of h.requests.slice(1)) request.reject(Object.assign(new Error('Ficha arquivada.'), { status: 409 }));
  await Promise.all([first, second]);
  assert.equal(count, 1); assert.equal(h.Modal.closes, 1); assert.equal(h.requests[0].url, '/treinos/20');
  assert.ok(!h.notices.some(([type]) => type === 'error'));
});

test('Enter e rodapé compartilham envio com estado acessível e prazo de 15 segundos', async () => {
  const h = harness(), editor = await h.open(); let prevented = false;
  assert.equal(typeof editor.form.onsubmit, 'function');
  const first = editor.form.onsubmit({ preventDefault() { prevented = true; } });
  const second = editor.save();
  assert.equal(prevented, true); assert.equal(h.requests.length, 1);
  assert.equal(editor.button.disabled, true); assert.equal(editor.form.getAttribute('aria-busy'), 'true');
  assert.match(editor.feedback.textContent, /salvando/i); assert.equal(h.requests[0].options.timeoutMs, 15000);
  h.requests[0].resolve({}); await Promise.all([first, second]); assert.equal(h.Modal.closes, 1);
});

test('confirmação e feedback permanecem no rodapé sem reconstruir o formulário', async () => {
  const h = harness(), editor = await h.open();
  assert.equal(h.node('treino-save-confirmation')?.parentElement, h.node('modal-footer'));
  assert.equal(editor.form, h.node('form-treino'));
  assert.match(editor.button.getAttribute('aria-describedby'), /treino-save-feedback/);
});

test('payload é capturado antes da resposta e sucesso mantém rascunho digitado durante o envio', async () => {
  const h = harness(), editor = await h.open(20);
  const sending = editor.save();
  h.node('treino-nome').value = 'Nova digitação'; editor.fields['ex-reps'].value = '10-15';
  assert.equal(h.requests[0].payload.name, 'Ficha A'); assert.equal(h.requests[0].payload.exercises[0].reps, '8-12');
  h.requests[0].resolve({}); await sending;
  assert.equal(h.Modal.closes, 0); assert.equal(h.node('treino-nome').value, 'Nova digitação');
  assert.equal(editor.fields['ex-reps'].value, '10-15'); assert.match(editor.feedback.textContent, /salv[ao].*rascunho|rascunho.*salv[ao]/i);
  await editor.save(); assert.equal(h.requests.length, 1); assert.equal(editor.button.disabled, true);
  assert.equal(h.node('treino-check-saved').hidden, false);
});

test('recusa confirmada mantém campos, mostra erro junto à ação e permite envio corrigido', async () => {
  const h = harness(), editor = await h.open();
  const sending = editor.save(); h.requests[0].reject(Object.assign(new Error('Repetições fora do intervalo.'), { status: 400 })); await sending;
  assert.equal(h.Modal.closes, 0); assert.equal(editor.button.disabled, false);
  assert.equal(editor.form.getAttribute('aria-busy'), 'false'); assert.match(editor.feedback.textContent, /Repetições/);
  editor.fields['ex-reps'].value = '10'; const corrected = editor.save();
  assert.equal(h.requests.length, 2); assert.equal(h.requests[1].payload.exercises[0].reps, '10');
  h.requests[1].resolve({}); await corrected; assert.equal(h.Modal.closes, 1);
});

for (const failure of [{ status: 0, timeout: true }, { status: 0 }, { status: 502 }]) {
  test(`resultado incerto ${JSON.stringify(failure)} exige conferir fichas e bloqueia repetição`, async () => {
    const h = harness(), editor = await h.open();
    const sending = editor.save(); h.requests[0].reject(Object.assign(new Error('Tente novamente.'), failure)); await sending;
    assert.equal(h.Modal.closes, 0); assert.match(editor.feedback.textContent, /resultado.*não confirmado|não foi possível confirmar/i);
    assert.match(editor.feedback.textContent, /confer|fichas/i); assert.doesNotMatch(editor.feedback.textContent, /tente novamente/i);
    assert.equal(editor.button.disabled, true); assert.equal(h.node('treino-nome').value, 'Ficha A');
    await editor.save(); assert.equal(h.requests.length, 1);
    const check = h.node('treino-check-saved'); assert.equal(check.hidden, false);
    await check.onclick(); assert.equal(h.Modal.closes, 1); assert.equal(h.context.reloads, 1);
  });
}

for (const replace of [
  ['modal', h => { h.Modal.revision++; }],
  ['mesmo modal fechado', h => { h.Modal.opened = false; }],
  ['formulário', h => { h.nodes.set('form-treino', { isConnected: true, textContent: 'novo formulário' }); }],
  ['lista de exercícios', h => { h.nodes.set('exercicios-container', { isConnected: true, textContent: 'nova lista' }); }],
  ['rodapé', h => { h.nodes.set('modal-footer', { isConnected: true, textContent: 'novo rodapé' }); }],
  ['nome', h => { h.nodes.set('treino-nome', { isConnected: true, value: 'nome de outro formulário' }); }],
  ['página', h => { h.App.currentPage = 'dashboard'; }],
  ['aluno', h => { h.view.currentStudentId = 12; }],
  ['ator', h => { h.Auth.user = { id: 8, role: 'instructor' }; }],
  ['perfil', h => { h.Auth.user.role = 'student'; }],
  ['geração autenticação', h => { h.Auth.generation++; }],
  ['geração da view', h => { h.view.generation++; }],
  ['epoch em memória', h => { h.Auth.sessionEpoch = 'second'; }],
  ['epoch no storage', h => { h.Auth.storedEpoch = 'second'; }],
  ['âncora da página', h => { h.nodes.set('treinos-table-body', { isConnected: true, innerHTML: 'nova tabela' }); }]
]) {
  test(`resposta de editor anterior não altera ${replace[0]} nem dispara atualização`, async () => {
    const h = harness(), editor = await h.open();
    const sending = editor.save(), feedback = editor.feedback.textContent; replace[1](h);
    h.requests[0].resolve({}); await sending;
    assert.equal(h.Modal.closes, 0); assert.equal(h.context.reloads, 0);
    assert.equal(h.notices.length, 0); assert.equal(editor.feedback.textContent, feedback);
  });
}

test('callback de rodapé antigo não envia dados de um novo editor', async () => {
  const h = harness(), first = await h.open();
  // Capture the actual old callback, rather than a lookup that finds the new button.
  const action = first.button.action; const next = await h.open(); h.node('treino-nome').value = 'Novo editor';
  const sending = action(), count = h.requests.length;
  h.requests.forEach(request => request.resolve({})); await sending;
  assert.equal(count, 0); assert.equal(next.button.disabled, false);
});

test('sessão já obsoleta impede envio antes de chamar a API', async () => {
  const h = harness(), editor = await h.open(); h.Auth.storedEpoch = 'other';
  const sending = editor.save(), count = h.requests.length;
  h.requests.forEach(request => request.resolve({})); await sending; assert.equal(count, 0);
});

test('erro de resposta antiga não altera feedback nem controles do editor novo', async () => {
  const h = harness(), old = await h.open(); const sending = old.save();
  const next = await h.open(); const feedback = next.feedback.textContent;
  h.requests[0].reject(Object.assign(new Error('Erro antigo'), { status: 400 })); await sending;
  assert.equal(next.feedback.textContent, feedback); assert.equal(next.button.disabled, false);
  assert.equal(h.Modal.closes, 0); assert.equal(h.notices.length, 0);
});

test('validação nativa impede envio e conserva valores do formulário', async () => {
  const h = harness(), editor = await h.open(); editor.form.reportValidity = () => false;
  await editor.save(); assert.equal(h.requests.length, 0); assert.equal(h.node('treino-nome').value, 'Ficha A');
  assert.equal(editor.button.disabled, false);
});

test('conferir fichas de um editor antigo não fecha o novo editor', async () => {
  const h = harness(), editor = await h.open();
  const sending = editor.save(); h.requests[0].reject(Object.assign(new Error('offline'), { status: 0 })); await sending;
  const oldCheck = h.node('treino-check-saved').onclick, next = await h.open();
  await oldCheck(); assert.equal(h.Modal.closes, 0); assert.equal(h.context.reloads, 0); assert.equal(next.button.disabled, false);
});

test('criação para outro aluno consulta o destinatário capturado e não o perfil anterior', async () => {
  const h = harness(), editor = await h.open(); h.node('treino-aluno').value = '12';
  h.view.alunosCache.push({ id: 12, name: 'Outro aluno' }); const profiles = [];
  h.view.abrirPerfilAluno = async (id, name) => { profiles.push({ id, name }); };
  const sending = editor.save(); h.requests[0].resolve({}); await sending;
  assert.equal(h.requests[0].payload.studentId, 12); assert.deepEqual(profiles, [{ id: 12, name: 'Outro aluno' }]);
  assert.equal(h.context.reloads, 0);
});

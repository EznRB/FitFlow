const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const plan = (id = 3, name = 'Plano atual') => ({ id, name, price: '150.00', durationDays: 30, active: true });
function fixture({ get = async () => ({ data: [] }) } = {}) {
  const nodes = new Map(), events = new Map(), calls = [], toasts = [], modals = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', style: {}, isConnected: true, firstElementChild: null, contains: () => true }); return nodes.get(id); };
  const modalIds = new Set(); let open = false, epoch = 'epoch-a';
  const close = () => { open = false; for (const id of modalIds) { const old = nodes.get(id); if (old) old.isConnected = false; nodes.delete(id); } modalIds.clear(); node('modal-body').firstElementChild = null; };
  const modalOpen = (title, html, buttons) => {
    close(); open = true;
    for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) { modalIds.add(id); node(id); }
    const form = nodes.get('form-plano');
    if (form) {
      form.reportValidity = () => true;
      const fields = new Map([...modalIds].map(id => [id, nodes.get(id)]));
      form.querySelector = selector => fields.get(selector.slice(1)) || null;
      node('input-plano-nome').value = 'Fixture'; node('input-plano-valor').value = '150.00'; node('input-plano-periodo').value = '30';
    }
    node('modal-body').firstElementChild = form || node('confirm-plano-inativacao');
    const button = { disabled: false, textContent: buttons?.at(-1)?.text || '', isConnected: true };
    modalIds.add('submit-button'); nodes.set('submit-button', button);
    modals.push({ title, html, buttons, form, button });
  };
  const request = method => (route, payload) => { const pending = deferred(); calls.push({ method, route, payload: payload ? structuredClone(payload) : undefined, ...pending }); return pending.promise; };
  const context = vm.createContext({ API: { get, post: request('post'), put: request('put'), delete: request('delete') },
    Auth: { user: { id: 7, role: 'admin' }, generation: 1, sessionEpoch: epoch, getSessionEpoch: () => epoch }, App: { currentPage: 'planos' },
    window: { addEventListener: (name, fn) => { const listeners = events.get(name) || []; listeners.push(fn); events.set(name, listeners); } },
    document: { getElementById: id => modalIds.has(id) || !id.startsWith('form-') ? node(id) : null, querySelector: () => nodes.get('submit-button'), querySelectorAll: () => nodes.has('submit-button') ? [nodes.get('submit-button')] : [] },
    Modal: { open: modalOpen, close, isOpen: () => open, confirm: (html, callback, label) => modalOpen('Confirmação', `<p>${html}</p>`, [{ action: close }, { text: label, action: () => { close(); return callback(); } }]) },
    Toast: { warning: message => toasts.push(['warning', message]), error: message => toasts.push(['error', message]), success: message => toasts.push(['success', message]) }, Intl });
  for (const file of ['security', 'planos']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', `${file}.js`), 'utf8'), context);
  vm.runInContext('this.view = PlanosView;', context);
  return { context, view: context.view, node, nodes, calls, toasts, modals, close,
    emit(type, detail = {}) { for (const callback of events.get(type) || []) callback({ detail }); },
    change(kind) {
      if (kind === 'page') context.App.currentPage = 'alunos';
      if (kind === 'account') context.Auth.user = { id: 8, role: 'admin' };
      if (kind === 'generation') context.Auth.generation++;
      if (kind === 'epoch') epoch = 'epoch-b';
      if (kind === 'role') context.Auth.user.role = 'student';
      if (kind === 'anchor') { node('planos-grid').isConnected = false; nodes.delete('planos-grid'); node('planos-grid'); }
    }
  };
}

test('lista de planos conserva consulta mais recente e não deixa erro antigo limpar seu cache', async () => {
  for (const fails of [false, true]) {
    const old = deferred(); let calls = 0;
    const h = fixture({ get: () => ++calls === 1 ? old.promise : Promise.resolve({ data: [plan(2, 'Atual')] }) });
    const first = h.view.carregarLista(); await h.view.carregarLista();
    if (fails) old.reject(new Error('Falha antiga')); else old.resolve({ data: [plan(1, 'Antigo')] });
    await first;
    assert.equal(h.view.dados[0].id, 2); assert.match(h.node('planos-grid').innerHTML, /Atual/); assert.equal(h.toasts.length, 0);
  }
});

test('novo plano abre durante a leitura da lista e não perde o formulário quando ela termina', async () => {
  const pending = deferred(), h = fixture({ get: () => pending.promise }), loading = h.view.inicializar();
  const button = h.node('btn-novo-plano'); assert.equal(typeof button.onclick, 'function'); button.onclick();
  assert.equal(h.modals.length, 1); const form = h.modals[0].form;
  pending.resolve({ data: [] }); await loading;
  assert.equal(h.modals.length, 1); assert.equal(h.modals[0].form, form);
});
test('falha da lista de planos oferece retry próprio sem duplicar leitura ou executar handler antigo', async () => {
  const pending = [], h = fixture({ get: () => { const call = deferred(); pending.push(call); return call.promise; } });
  const reading = h.view.inicializar(); pending[0].reject(new Error('<img src=x> Consulta falhou')); await reading;
  const grid = h.node('planos-grid'); assert.match(grid.innerHTML, /data-plan-retry/); assert.doesNotMatch(grid.innerHTML, /<img src=x>/);
  assert.deepEqual(h.toasts, [], 'A falha permanece junto da lista e de sua ação de recuperação.');
  const oldRetry = grid.onclick, event = { target: { closest: () => ({}) } };
  const retry = oldRetry(event); oldRetry(event); assert.equal(pending.length, 2);
  pending[1].resolve({ data: [plan(5, 'Recuperado')] }); await retry;
  assert.match(grid.innerHTML, /Recuperado/);
  h.change('account'); oldRetry(event); assert.equal(pending.length, 2);
});

test('consulta antiga não altera DOM/cache depois de trocar página, âncora, conta, geração, epoch ou papel', async () => {
  for (const change of ['page', 'anchor', 'account', 'generation', 'epoch', 'role']) for (const fails of [false, true]) {
    const pending = deferred(), h = fixture({ get: () => pending.promise });
    const reading = h.view.carregarLista(); h.change(change);
    const grid = h.node('planos-grid'); grid.innerHTML = 'Tela atual'; grid.textContent = 'Texto atual';
    if (fails) pending.reject(new Error('Falha antiga')); else pending.resolve({ data: [plan(1, 'Antigo')] });
    await reading;
    assert.equal(grid.innerHTML, 'Tela atual', change); assert.equal(grid.textContent, 'Texto atual', change);
    assert.equal(h.view.dados.length, 0, change); assert.equal(h.toasts.length, 0, change);
  }
});

test('save antigo não bloqueia formulário novo e conserva ambos os resultados reais', async () => {
  const h = fixture(); h.view.abrirModalCriacao();
  const first = h.view.submeterFormulario();
  h.change('account'); h.context.Auth.generation++; await h.view.inicializar();
  h.view.abrirModalCriacao(); h.node('input-plano-nome').value = 'Outro formulário';
  const second = h.view.submeterFormulario();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].payload.name, 'Outro formulário');
  h.calls[0].resolve({ data: { id: 11 } }); const firstResult = await first;
  assert.equal(firstResult.data.id, 11);
  assert.equal(h.modals.at(-1).button.disabled, true);
  assert.equal(h.toasts.length, 0);
  h.calls[1].resolve({ data: { id: 12 } }); const secondResult = await second;
  assert.equal(secondResult.data.id, 12); assert.equal(h.toasts.filter(([type]) => type === 'success').length, 1);
});

test('duplo clique do mesmo formulário produz um único envio com os mesmos campos', async () => {
  const h = fixture(); h.view.abrirModalCriacao();
  const first = h.view.submeterFormulario(), second = h.view.submeterFormulario();
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve({ data: { id: 11 } });
  const results = await Promise.all([first, second]);
  assert.equal(results[0].data.id, 11); assert.equal(results[1].data.id, 11);
});

test('save já enviado não fecha/resetta modal substituto nem atualiza página nova', async () => {
  for (const change of ['page', 'account', 'generation', 'epoch', 'anchor', 'modal', 'close']) for (const fails of [false, true]) {
    let reads = 0; const h = fixture({ get: async () => { reads++; return { data: [] }; } });
    h.view.abrirModalCriacao(); const writing = h.view.submeterFormulario();
    if (change === 'modal') h.context.Modal.open('Outro cadastro', '<div id="outro-formulario">Atual</div>', []);
    else if (change === 'close') h.close(); else h.change(change);
    if (fails) h.calls[0].reject(new Error('Falha do envio anterior')); else h.calls[0].resolve({ data: { id: 11 } });
    await writing;
    assert.equal(reads, 0, change); assert.equal(h.toasts.length, 0, change);
    if (change === 'modal') assert.equal(h.context.Modal.isOpen(), true);
  }
});

test('callbacks do formulário antigo não enviam nem alteram campos do novo formulário', async () => {
  const h = fixture(); h.view.abrirModalCriacao();
  const oldAction = h.modals.at(-1).buttons.at(-1).action;
  const oldInput = h.node('input-plano-valor'), oldChange = oldInput.oninput;
  h.view.abrirModalCriacao(); h.node('display-mensal').textContent = 'Atual';
  const submitted = oldAction();
  for (const call of h.calls) call.resolve({ data: { id: 11 } });
  await submitted; oldChange();
  assert.equal(h.calls.length, 0); assert.equal(h.node('display-mensal').textContent, 'Atual');
});

test('edição captura ID e valores do seu formulário e não segue planoAtualId mutável', async () => {
  const h = fixture({ get: async () => ({ data: [plan(3)] }) }); await h.view.carregarLista();
  h.view.abrirModalEdicao(3); const writing = h.view.submeterFormulario(); h.view.planoAtualId = 999;
  assert.equal(h.calls[0].route, '/planos/3');
  h.calls[0].resolve({ data: { id: 3 } }); await writing;
});

test('confirmação de inativação fechada/substituída ou de contexto antigo não envia DELETE', async () => {
  for (const change of ['page', 'account', 'generation', 'epoch', 'anchor', 'close', 'modal']) {
    const h = fixture({ get: async () => ({ data: [plan(3)] }) }); await h.view.carregarLista(); h.view.inativarPlano(3);
    const action = h.modals.at(-1).buttons.at(-1).action;
    if (change === 'close') h.close(); else if (change === 'modal') h.view.abrirModalCriacao(); else h.change(change);
    const submitted = action();
    for (const call of h.calls) call.resolve({ data: { id: 3, active: false } });
    await submitted; assert.equal(h.calls.length, 0, change);
    if (change === 'modal') assert.equal(h.context.Modal.isOpen(), true);
  }
});

test('inativação confirmada uma vez conserva resposta real e não faz efeito visual tardio', async () => {
  let reads = 0; const h = fixture({ get: async () => { reads++; return { data: [plan(3)] }; } }); await h.view.carregarLista();
  h.view.inativarPlano(3); const action = h.modals.at(-1).buttons.at(-1).action;
  const writing = action(), again = action(); assert.equal(h.calls.length, 1);
  h.change('page'); h.calls[0].resolve({ data: { id: 3, active: false } });
  const result = await writing; await again;
  assert.equal(result.data.active, false); assert.equal(reads, 1); assert.equal(h.toasts.length, 0);
});

test('logout/navegação invalidam cache e botões antigos; epoch antigo não inicia novas operações', async () => {
  const h = fixture({ get: async () => ({ data: [plan(3)] }) }); await h.view.inicializar();
  const create = h.node('btn-novo-plano').onclick;
  h.emit('auth:logout'); assert.equal(h.view.dados.length, 0); create(); assert.equal(h.modals.length, 0);
  await h.view.inicializar(); h.change('epoch');
  h.view.abrirModalCriacao(); h.view.abrirModalEdicao(3); h.view.inativarPlano(3);
  assert.equal(h.modals.length, 0); assert.equal(h.calls.length, 0);
});

test('falha atual mantém formulário disponível para correção, sem apagar registro ou inventar sucesso', async () => {
  const h = fixture(); h.view.abrirModalCriacao();
  const writing = h.view.submeterFormulario(); h.calls[0].reject(new Error('Valor inválido')); await writing;
  assert.equal(h.modals.at(-1).button.disabled, false); assert.equal(h.context.Modal.isOpen(), true);
  assert.equal(h.toasts.filter(([type]) => type === 'success').length, 0);
  h.node('input-plano-valor').value = '175.00'; const retry = h.view.submeterFormulario();
  assert.equal(h.calls.length, 2); assert.equal(h.calls[1].payload.price, 175);
  h.calls[1].resolve({ data: { id: 11 } }); await retry;
});

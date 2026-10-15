const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Apenas DOM e transporte são simulados. A view e seus cálculos são reais.
function fixture() {
  const nodes = new Map(), events = new Map(), calls = [], notices = [];
  const element = () => ({ value: '', textContent: '', innerHTML: '', isConnected: true, disabled: false,
    hidden: false, attributes: {}, contains: item => item?.isConnected !== false,
    setAttribute(key, value) { this.attributes[key] = String(value); },
    getAttribute(key) { return this.attributes[key] ?? null; },
    prepend(child) { child.parentElement = this; }, reportValidity: () => true });
  const node = id => nodes.get(id) || null; nodes.set('planos-grid', element());
  const Auth = { user: { id: 7, role: 'admin' }, generation: 1, sessionEpoch: 'first', storedEpoch: 'first',
    getSessionEpoch() { return this.storedEpoch; } };
  const App = { currentPage: 'planos' };
  const Modal = { revision: 0, opened: false, closes: 0, buttons: [], isOpen() { return this.opened; },
    open(title, html, buttons = []) {
      this.revision++; this.opened = true; this.title = title; this.html = html;
      for (const [id, item] of nodes) if (id !== 'planos-grid') { item.isConnected = false; nodes.delete(id); }
      for (const match of html.matchAll(/\bid="([^"]+)"/g)) nodes.set(match[1], element());
      this.buttons = buttons.map(button => Object.assign(element(), { textContent: button.text, action: button.action, className: button.class }));
      nodes.set('modal-footer', element());
      if (node('input-plano-nome')) {
        node('input-plano-nome').value = 'Plano A'; node('input-plano-periodo').value = '30';
        node('input-plano-valor').value = '150.00';
      }
    },
    close() { this.closes++; this.opened = false; this.revision++;
      for (const [id, item] of nodes) if (id !== 'planos-grid') { item.isConnected = false; nodes.delete(id); }
    } };
  const write = method => (url, payload, options) => new Promise((resolve, reject) => calls.push({ method, url, payload, options, resolve, reject }));
  const API = { get: async (url, options) => { calls.push({ method: 'GET', url, options }); return { data: [] }; },
    post: write('POST'), put: write('PUT'), delete: (url, options) => write('DELETE')(url, undefined, options),
    request: (url, options) => write(options.method)(url, undefined, options) };
  const context = vm.createContext({ Auth, App, Modal, API, Intl,
    window: { addEventListener: (name, callback) => events.set(name, callback) },
    document: { getElementById: node, querySelector: () => Modal.buttons.find(button => button.className === 'btn-primary') || null },
    Toast: Object.fromEntries(['success', 'warning', 'error'].map(type => [type, message => notices.push([type, message])])) });
  for (const file of ['security.js', 'planos.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('globalThis.view = PlanosView;', context);
  const view = context.view;
  function open(id = null) {
    if (id) {
      view.dados = [{ id, name: 'Plano A', price: 150, durationDays: 30, active: true }]; view.cacheContext = view.contexto(); view.abrirModalEdicao(id);
    } else view.abrirModalCriacao();
    return { form: node('form-plano'), button: Modal.buttons.find(button => button.className === 'btn-primary'),
      feedback: node('plan-save-feedback'), save: Modal.buttons.at(-1).action };
  }
  function deactivate(id = 3) {
    view.dados = [{ id, name: 'Plano A', price: 150, durationDays: 30, active: true }]; view.cacheContext = view.contexto(); view.inativarPlano(id);
    return { form: node('form-plano'), button: Modal.buttons.find(button => button.className === 'btn-primary'),
      feedback: node('plan-save-feedback'), save: Modal.buttons.at(-1).action };
  }
  return { context, Auth, App, Modal, API, nodes, node, calls, notices, events, view, open, deactivate };
}

test('sucesso de plano preserva rascunho alterado durante a resposta e não fecha o formulário', async () => {
  const h = fixture(), editor = h.open(); const sending = editor.save();
  h.node('input-plano-nome').value = 'Digitação posterior'; h.node('input-plano-valor').value = '175.00';
  assert.equal(h.calls[0].payload.name, 'Plano A'); assert.equal(h.calls[0].payload.price, 150);
  h.calls[0].resolve({ data: { id: 11 } }); await sending;
  assert.equal(h.Modal.closes, 0); assert.equal(h.node('input-plano-nome').value, 'Digitação posterior');
  assert.match(editor.feedback?.textContent || '', /rascunho|novos valores/i);
});

test('conferir o plano salvo preserva nós e rascunho posterior até revisão explícita', async () => {
  const h = fixture(), editor = h.open(), name = h.node('input-plano-nome');
  const sending = editor.save(); name.value = 'Rascunho posterior';
  h.calls[0].resolve({ data: { id: 11 } }); await sending;
  await h.node('plan-check-saved').onclick();
  assert.equal(h.Modal.closes, 0); assert.equal(h.node('input-plano-nome'), name);
  assert.equal(name.value, 'Rascunho posterior'); assert.equal(editor.button.disabled, true);
  assert.match(h.node('plan-review-list').innerHTML, /Nenhum plano|lista/i);
  await h.node('plan-check-saved').onclick();
  assert.equal(editor.button.disabled, false); assert.equal(name.value, 'Rascunho posterior');
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
});

for (const navigate of [false, true]) {
  test(`timeout exige consulta e revisão após cancelar e reabrir${navigate ? ' com navegação' : ''}`, async () => {
    const h = fixture(), editor = h.open(), sending = editor.save();
    h.calls[0].reject(Object.assign(new Error('Prazo encerrado'), { timeout: true })); await sending;
    h.Modal.buttons[0].action();
    if (navigate) {
      h.App.currentPage = 'alunos'; h.events.get('app:navigate')({ detail: { page: 'alunos' } });
      h.App.currentPage = 'planos';
    }
    const fresh = h.open(); const prevented = fresh.save();
    assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
    await prevented;
    assert.equal(fresh.button.disabled, true); assert.match(fresh.feedback.textContent, /não confirmado/i);
    await h.node('plan-check-saved').onclick();
    assert.equal(h.calls.filter(call => call.method === 'GET').length, 1); assert.equal(fresh.button.disabled, true);
    assert.match(fresh.feedback.textContent, /não prova|ainda pode/i);
    await h.node('plan-check-saved').onclick(); assert.equal(fresh.button.disabled, false);
    const second = fresh.save(); assert.equal(h.calls.filter(call => call.method === 'POST').length, 2);
    h.calls.findLast(call => call.method === 'POST').resolve({}); await second;
  });
}

test('falha de consulta não libera novo envio e conserva os campos', async () => {
  const h = fixture(), editor = h.open(), name = h.node('input-plano-nome'), sending = editor.save();
  h.calls[0].reject(Object.assign(new Error('offline'), { status: 0 })); await sending;
  h.API.get = async () => { throw new Error('Consulta indisponível'); };
  await h.node('plan-check-saved').onclick(); await editor.save();
  assert.equal(h.Modal.closes, 0); assert.equal(h.node('input-plano-nome'), name);
  assert.equal(editor.button.disabled, true); assert.equal(h.calls.length, 1);
  assert.match(editor.feedback.textContent, /consult|confirm/i);
});

test('timeout tardio de modal fechado continua exigindo conferência no formulário atual', async () => {
  const h = fixture(), old = h.open(), sending = old.save(); h.Modal.buttons[0].action();
  const fresh = h.open(); h.calls[0].reject(Object.assign(new Error('Prazo'), { timeout: true })); await sending;
  const prevented = fresh.save(); assert.equal(h.calls.filter(call => call.method === 'POST').length, 1); await prevented;
  assert.equal(fresh.button.disabled, true); assert.match(fresh.feedback.textContent, /não confirmado/);
});

test('consulta iniciada em outro modal não preenche nem libera o formulário substituto', async () => {
  const h = fixture(), editor = h.open(), sending = editor.save();
  h.calls[0].reject(Object.assign(new Error('offline'), { status: 0 })); await sending;
  let resolveRead; h.API.get = () => new Promise(resolve => { resolveRead = resolve; });
  const checking = h.node('plan-check-saved').onclick(); const fresh = h.open();
  resolveRead({ data: [{ id: 9, name: 'Plano retornado', price: 99, durationDays: 30 }] }); await checking;
  assert.equal(h.Modal.closes, 0); assert.equal(fresh.button.disabled, true);
  assert.equal(h.node('plan-review-list').hidden, true); assert.equal(h.node('plan-review-list').innerHTML, '');
});

test('logout não permite que timeout antigo recrie bloqueio na nova sessão', async () => {
  const h = fixture(), old = h.open(), sending = old.save();
  h.events.get('auth:logout')();
  h.calls[0].reject(Object.assign(new Error('Prazo antigo'), { timeout: true })); await sending;
  const fresh = h.open(); assert.equal(fresh.button.disabled, false); assert.equal(h.node('plan-check-saved').hidden, true);
});

test('consulta exibida escapa os nomes e mantém os valores digitados sem reenviar', async () => {
  const h = fixture(), editor = h.open(), sending = editor.save();
  h.node('input-plano-periodo').value = 'custom'; h.node('input-plano-duracao-custom').value = '47';
  h.node('input-plano-valor').value = '219.43'; h.node('input-plano-descricao').value = 'Condição posterior';
  const fields = ['input-plano-periodo', 'input-plano-duracao-custom', 'input-plano-valor', 'input-plano-descricao'].map(id => [id, h.node(id), h.node(id).value]);
  h.calls[0].resolve({ data: { id: 9 } }); await sending;
  h.API.get = async () => ({ data: [{ id: 9, name: '<img src=x onerror=alert(1)>', price: 150, durationDays: 30, active: true }] });
  await h.node('plan-check-saved').onclick();
  assert.match(h.node('plan-review-list').innerHTML, /&lt;img/); assert.doesNotMatch(h.node('plan-review-list').innerHTML, /<img/);
  for (const [id, field, value] of fields) { assert.equal(h.node(id), field); assert.equal(field.value, value); }
  assert.equal(h.calls.filter(call => call.method === 'POST').length, 1);
});

test('novo resultado incerto durante a consulta exige outra leitura antes de liberar envio', async () => {
  const h = fixture(), old = h.open(), oldSending = old.save(); h.Modal.buttons[0].action();
  const current = h.open(), currentSending = current.save();
  h.calls[1].reject(Object.assign(new Error('Prazo atual'), { timeout: true })); await currentSending;
  const reads = []; h.API.get = () => new Promise(resolve => reads.push(resolve));
  const checking = h.node('plan-check-saved').onclick();
  h.calls[0].reject(Object.assign(new Error('Prazo antigo'), { timeout: true })); await oldSending;
  reads[0]({ data: [] }); await checking;
  assert.equal(current.button.disabled, true); assert.equal(h.node('plan-review-list').hidden, true);
  assert.match(current.feedback.textContent, /novo resultado incerto/);
  const nextCheck = h.node('plan-check-saved').onclick(); assert.equal(reads.length, 2);
  reads[1]({ data: [] }); await nextCheck;
  assert.equal(current.button.disabled, true); await h.node('plan-check-saved').onclick();
  assert.equal(current.button.disabled, false); assert.equal(h.calls.filter(call => call.method === 'POST').length, 2);
});

test('resultado incerto da conta anterior não bloqueia novo administrador', async () => {
  const h = fixture(), old = h.open(), sending = old.save();
  h.calls[0].reject(Object.assign(new Error('Prazo'), { timeout: true })); await sending;
  h.Auth.user = { id: 8, role: 'admin' }; h.Auth.generation++;
  const fresh = h.open(); assert.equal(fresh.button.disabled, false); assert.equal(h.node('plan-check-saved').hidden, true);
});

test('consulta, POST e PUT usam prazo de quinze segundos', async () => {
  const h = fixture(); await h.view.carregarLista(); assert.equal(h.calls[0].options?.timeoutMs, 15000);
  h.calls.length = 0;
  for (const id of [null, 3]) {
    const editor = h.open(id), sending = editor.save(); const call = h.calls.findLast(item => item.method !== 'GET');
    assert.equal(call.options?.timeoutMs, 15000); call.resolve({ data: { id: 3 } }); await sending;
  }
});

test('inativação aguarda confirmação com estado visível e DELETE com prazo', async () => {
  const h = fixture(), editor = h.deactivate(); const first = editor.save(), second = editor.save();
  const writes = h.calls.filter(call => call.method === 'DELETE');
  assert.equal(writes.length, 1); assert.equal(h.Modal.closes, 0);
  assert.equal(editor.button.disabled, true); assert.match(editor.feedback?.textContent || '', /inativando/i);
  assert.equal(writes[0].options?.timeoutMs, 15000);
  writes[0].resolve({ data: { id: 3, active: false } }); await Promise.all([first, second]);
  assert.equal(h.Modal.closes, 1);
});

test('Enter e botão de plano compartilham uma confirmação e mantêm equivalência aritmética', async () => {
  const h = fixture(), editor = h.open();
  h.node('input-plano-periodo').value = 'custom'; h.node('input-plano-duracao-custom').value = '41'; h.node('input-plano-valor').value = '123.00';
  h.node('input-plano-periodo').onchange(); assert.equal(h.node('display-mensal').textContent, 'R$ 90,00 por 30 dias');
  const first = editor.form.onsubmit({ preventDefault() {} }), second = editor.save();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].payload.durationDays, 41); assert.equal(h.calls[0].payload.price, 123);
  h.calls[0].resolve({ data: { id: 11 } }); const results = await Promise.all([first, second]);
  assert.equal(results[0].data.id, 11); assert.equal(results[1].data.id, 11); assert.equal(h.Modal.closes, 1);
});

for (const action of ['create', 'update', 'deactivate']) {
  for (const failure of [{ status: 0, timeout: true }, { status: 0 }, { status: 503 }]) {
    test(`${action} incerto ${JSON.stringify(failure)} conserva formulário e exige consulta antes de repetir`, async () => {
      const h = fixture(), editor = action === 'deactivate' ? h.deactivate() : h.open(action === 'update' ? 3 : null);
      const sending = editor.save(); h.calls[0].reject(Object.assign(new Error('Tente novamente.'), failure)); await sending;
      assert.equal(h.Modal.closes, 0); assert.equal(editor.button.disabled, true);
      assert.match(editor.feedback.textContent, /resultado.*não confirmado|não foi possível confirmar/i);
      assert.match(editor.feedback.textContent, /confer|lista/i); assert.doesNotMatch(editor.feedback.textContent, /tente novamente/i);
      await editor.save(); assert.equal(h.calls.length, 1);
      const check = h.node('plan-check-saved'); assert.equal(check.hidden, false); await check.onclick();
      assert.equal(h.Modal.closes, 0); assert.equal(h.calls.filter(call => call.method === 'GET').length, 1);
      assert.equal(editor.button.disabled, true); await check.onclick(); assert.equal(editor.button.disabled, false);
    });
  }
}

for (const action of ['create', 'deactivate']) {
  test(`${action} com recusa confirmada permite correção e conserva os dados`, async () => {
    const h = fixture(), editor = action === 'deactivate' ? h.deactivate() : h.open();
    const sending = editor.save(); h.calls[0].reject(Object.assign(new Error('Operação recusada pelo servidor.'), { status: 409 })); await sending;
    assert.equal(editor.button.disabled, false); assert.equal(h.Modal.closes, 0);
    assert.match(editor.feedback.textContent, /recusada/); assert.equal(editor.form.getAttribute('aria-busy'), 'false');
    const retry = editor.save(); assert.equal(h.calls.length, 2); h.calls[1].resolve({}); await retry;
    assert.equal(h.Modal.closes, 1);
  });
}

for (const mutate of [
  ['revisão do modal', h => { h.Modal.revision++; }],
  ['formulário', h => { h.nodes.set('form-plano', { isConnected: true }); }],
  ['rodapé', h => { h.nodes.set('modal-footer', { isConnected: true }); }],
  ['campo valor', h => { h.nodes.set('input-plano-valor', { isConnected: true, value: '200.00' }); }],
  ['botão', h => { h.Modal.buttons[h.Modal.buttons.length - 1] = { className: 'btn-primary', isConnected: true, disabled: false }; }],
  ['página', h => { h.App.currentPage = 'alunos'; }],
  ['conta', h => { h.Auth.user.id = 8; }],
  ['papel', h => { h.Auth.user.role = 'instructor'; }],
  ['geração', h => { h.Auth.generation++; }],
  ['epoch local', h => { h.Auth.sessionEpoch = 'other'; }],
  ['epoch storage', h => { h.Auth.storedEpoch = 'other'; }],
  ['grade', h => { h.nodes.set('planos-grid', { isConnected: true, innerHTML: 'Grade atual' }); }]
]) {
  test(`sucesso antigo não altera ${mutate[0]} nem consulta lista nova`, async () => {
    const h = fixture(), editor = h.open(); const sending = editor.save(), feedback = editor.feedback.textContent;
    mutate[1](h); h.calls[0].resolve({ data: { id: 11 } }); const result = await sending;
    assert.equal(result.data.id, 11); assert.equal(h.Modal.closes, 0);
    assert.equal(h.calls.length, 1); assert.equal(h.notices.length, 0); assert.equal(editor.feedback.textContent, feedback);
  });
}

test('erro de formulário anterior não altera status de formulário novo', async () => {
  const h = fixture(), old = h.open(), sending = old.save(), fresh = h.open();
  const feedback = fresh.feedback.textContent;
  h.calls[0].reject(Object.assign(new Error('Erro antigo'), { status: 400 })); await sending;
  assert.equal(fresh.button.disabled, false); assert.equal(fresh.feedback.textContent, feedback); assert.equal(h.notices.length, 0);
});

test('conferência antiga não fecha um formulário substituto', async () => {
  const h = fixture(), old = h.open(), sending = old.save();
  h.calls[0].reject(Object.assign(new Error('offline'), { status: 0 })); await sending;
  const oldCheck = h.node('plan-check-saved').onclick, fresh = h.open(); await oldCheck();
  assert.equal(h.Modal.closes, 0); assert.equal(h.calls.length, 1); assert.equal(fresh.button.disabled, true);
});

test('validação inválida identifica nome obrigatório junto ao campo e impede escrita', async () => {
  const h = fixture(), editor = h.open(); h.node('input-plano-nome').value = '';
  await editor.save(); assert.equal(h.calls.length, 0);
  assert.equal(h.node('input-plano-nome').getAttribute('aria-invalid'), 'true'); assert.match(h.node('plan-name-error').textContent, /nome/i);
  assert.match(editor.feedback.textContent, /nome|campos/i);
});

test('lista malformada não anuncia ausência de planos e apresenta recuperação', async () => {
  const h = fixture(); h.API.get = async () => ({ data: null }); await h.view.carregarLista();
  assert.match(h.node('planos-grid').innerHTML, /data-plan-retry/); assert.doesNotMatch(h.node('planos-grid').innerHTML, /Nenhum plano cadastrado/);
});

test('detalhe mostra o item escolhido, escapa conteúdo e CTA abre a edição sem escrita', () => {
  const h = fixture();
  h.view.dados = [{ id: 3, name: 'Outro', price: 100, durationDays: 30, active: true },
    { id: 9, name: '<Plano anual>', price: 1200, durationDays: 365, active: false, description: '<script>teste</script>' }];
  h.view.cacheContext = h.view.contexto(); h.view.abrirDetalhe(9);
  const grid = h.node('planos-grid');
  assert.match(grid.innerHTML, /&lt;Plano anual&gt;/); assert.match(grid.innerHTML, /365 dias/);
  assert.match(grid.innerHTML, /Plano inativo/); assert.doesNotMatch(grid.innerHTML, /<script>|Outro/);
  assert.match(grid.innerHTML, /data-plan-detail="back"/);
  grid.onclick({ target: { closest: () => ({ dataset: { planDetail: 'edit' } }) } });
  assert.equal(h.view.planoAtualId, 9); assert.equal(h.Modal.title, 'Editar plano'); assert.equal(h.calls.length, 0);
});

test('detalhe recusa id inexistente e ação antiga após troca de conta', () => {
  const h = fixture(); h.view.dados = [{ id: 3, name: 'Plano', price: 100, durationDays: 30, active: true }];
  h.view.cacheContext = h.view.contexto(); const grid = h.node('planos-grid'); grid.innerHTML = 'Lista';
  h.view.abrirDetalhe(99); assert.equal(grid.innerHTML, 'Lista');
  h.view.abrirDetalhe(3); h.Auth.user.id = 8;
  grid.onclick({ target: { closest: () => ({ dataset: { planDetail: 'edit' } }) } });
  assert.equal(h.Modal.opened, false); assert.equal(h.calls.length, 0);
});

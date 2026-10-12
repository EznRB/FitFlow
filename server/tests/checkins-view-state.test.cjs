const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function browser(api = {}) {
  const nodes = new Map(), modals = [], messages = [], listeners = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { id, tagName: 'SELECT', innerHTML: '', textContent: '', value: '', style: {}, disabled: false, attributes: new Map(),
      isConnected: true, setAttribute(name, value) { this.attributes.set(name, value); }, getAttribute(name) { return this.attributes.get(name) ?? null; }, removeAttribute(name) { this.attributes.delete(name); }, contains: () => true, reportValidity: () => true,
      querySelector(selector) { return nodes.get(selector.replace(/^#/, '')) || null; }, querySelectorAll: () => [] });
    return nodes.get(id);
  }
  const modal = { revision: 0, opened: false, bodyEl: node('modal-body'), footerEl: node('modal-footer'), isOpen() { return this.opened; },
    open(title, html, buttons = []) {
      this.revision++; this.opened = true;
      for (const [id, entry] of nodes) if (/^(form-checkin|form-cancel-checkin|input-checkin-|input-cancel-|checkin-form-|checkin-cancel-)/.test(id)) { entry.isConnected = false; nodes.delete(id); }
      const owned = new Map();
      for (const match of html.matchAll(/id="([^"]+)"/g)) owned.set(match[1], node(match[1]));
      for (const entry of owned.values()) { entry.querySelector = selector => owned.get(selector.replace(/^#/, '')) || null; entry.querySelectorAll = () => [...owned.values()]; }
      const footerButtons = buttons.map(config => ({ ...config, disabled: false, isConnected: true }));
      this.footerEl.querySelector = selector => footerButtons.find(b => selector.includes(b.class)) || null;
      modals.push({ title, html, buttons: footerButtons, owned });
    },
    close() { this.revision++; this.opened = false; for (const entry of modals.at(-1)?.owned.values() || []) entry.isConnected = false; }
  };
  const context = vm.createContext({ URLSearchParams, window: { addEventListener: (name, fn) => listeners.set(name, fn) },
    document: { getElementById: id => nodes.get(id) || null, querySelector: selector => modal.footerEl.querySelector(selector), createElement: () => node('created-select') },
    Auth: { user: { id: 7, role: 'admin' }, generation: 1, sessionEpoch: 'a', sharedEpoch: 'a', getSessionEpoch() { return this.sharedEpoch; } },
    App: { currentPage: 'checkins' }, Modal: modal,
    Toast: { success: text => messages.push(text), warning: text => messages.push(text), error: text => messages.push(text) }, API: { get: async () => ({ data: [] }), ...api } });
  for (const file of ['security.js', 'checkins.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext('this.view = CheckinsView;', context);
  for (const id of ['checkins-table-body', 'kpi-checkins-total', 'kpi-ultimo-checkin', 'filtro-aluno-checkin', 'filtro-data-inicio', 'filtro-data-fim', 'btn-registrar-checkin', 'btn-ver-ranking', 'btn-atualizar-presencas']) node(id);
  return { context, view: context.view, nodes, node, modal, modals, messages, listeners };
}
const students = [{ id: 11, status: 'active', user: { active: true, name: 'Aluno fictício' } }];
async function ready(api = {}) { const h = browser({ get: async endpoint => ({ data: endpoint === '/alunos' ? students : endpoint === '/checkins/hoje' ? { totalHoje: 0, checkins: [] } : [] }), ...api }); await h.view.inicializar(); return h; }
function register(h, value = '11') { h.view.abrirModalRegistro(); h.node('input-checkin-aluno').value = value; return h.modals.at(-1); }
function cancel(h, id = 10, reason = 'Motivo fictício') { h.view.abrirModalCancelar(id, `Aluno ${id}`); h.node('input-cancel-motivo').value = reason; return h.modals.at(-1); }
const confirm = modal => modal.buttons.at(-1).action();

test('presença configura ações antes das três consultas e limita todas a 15 segundos', async () => {
  const requests = []; const h = browser({ get: (url, options) => { const pending = deferred(); requests.push({ url, options, pending }); return pending.promise; } });
  const initializing = h.view.inicializar();
  assert.equal(typeof h.node('btn-registrar-checkin').onclick, 'function'); assert.equal(typeof h.node('btn-ver-ranking').onclick, 'function');
  assert.equal(requests.length, 3); assert.ok(requests.every(r => r.options?.timeoutMs === 15000));
  h.node('btn-registrar-checkin').onclick(); assert.equal(h.modals.at(-1).title, 'Registrar presença');
  for (const r of requests) r.pending.resolve({ data: r.url === '/alunos' ? students : r.url.endsWith('/hoje') ? { totalHoje: 0, checkins: [] } : [] });
  await initializing; assert.ok(h.node('input-checkin-aluno').innerHTML.includes('Aluno fictício'));
});
test('frequência descarta resultado e erro depois de navegar ou substituir modal', async () => {
  for (const action of ['navigate', 'modal', 'error']) {
    const pending = deferred(); const h = await ready(); h.context.API.get = () => pending.promise;
    const request = h.view.abrirModalRanking();
    if (action === 'navigate') h.context.App.currentPage = 'planos'; else h.modal.open('Editar plano', '', []);
    if (action === 'error') pending.reject(new Error('Erro antigo')); else pending.resolve({ data: [{ nome: 'Antigo', totalCheckins: 2 }] });
    await request; assert.ok(!h.modals.some(m => m.title === 'Frequência nos últimos 30 dias')); assert.equal(h.messages.length, 0);
  }
});
test('frequência deduplica clique pendente, usa prazo e não fecha modal novo por callback antigo', async () => {
  const pending = deferred(), calls = []; const h = await ready(); h.context.API.get = (url, options) => { calls.push({ url, options }); return pending.promise; };
  const first = h.view.abrirModalRanking(); const duplicate = h.view.abrirModalRanking(); assert.equal(calls.length, 1); assert.equal(calls[0].options.timeoutMs, 15000);
  pending.resolve({ data: [] }); await Promise.all([first, duplicate]); const old = h.modals.at(-1).buttons[0].action;
  h.modal.open('Outro diálogo', '', []); old(); assert.equal(h.modal.opened, true);
});
test('cancelamento antigo não usa motivo do registro novo nem fecha por Voltar antigo', async () => {
  const writes = []; const h = await ready({ put: async (url, data) => writes.push({ url, data }) });
  const old = cancel(h, 10); cancel(h, 20, 'Motivo de B'); await confirm(old); old.buttons[0].action();
  assert.equal(writes.length, 0); assert.equal(h.modal.opened, true);
});
test('registro antigo não lê seleção do formulário novo e Cancelar antigo não o fecha', async () => {
  const writes = []; const h = await ready({ post: async (url, data) => writes.push({ url, data }) });
  const old = register(h); register(h, '22'); await confirm(old); old.buttons[0].action();
  assert.equal(writes.length, 0); assert.equal(h.modal.opened, true);
});
test('modal recusa gravação depois de mudar geração, conta, papel ou epoch compartilhado', async () => {
  for (const change of ['generation', 'account', 'role', 'epoch', 'page']) {
    const writes = []; const h = await ready({ put: async () => writes.push(1) }); const form = cancel(h);
    if (change === 'generation') h.context.Auth.generation++;
    if (change === 'account') h.context.Auth.user.id++;
    if (change === 'role') h.context.Auth.user.role = 'student';
    if (change === 'epoch') h.context.Auth.sharedEpoch = 'b';
    if (change === 'page') h.context.App.currentPage = 'alunos';
    await confirm(form); assert.equal(writes.length, 0, change);
  }
});
test('cada envio captura payload, deduplica footer/submit e tem prazo', async () => {
  for (const kind of ['register', 'cancel']) {
    const pending = deferred(), writes = []; const h = await ready({ post: (url, data, options) => { writes.push({ url, data, options }); return pending.promise; }, put: (url, data, options) => { writes.push({ url, data, options }); return pending.promise; } });
    const modal = kind === 'register' ? register(h) : cancel(h); const first = confirm(modal); await confirm(modal);
    assert.equal(writes.length, 1); assert.equal(writes[0].options.timeoutMs, 15000);
    pending.resolve({ data: {} }); await first; assert.equal(h.modal.opened, false);
  }
});
test('envio de um formulário não bloqueia o modal seguinte e resposta antiga não o altera', async () => {
  const first = deferred(), second = deferred(), writes = []; const h = await ready({ put: (url, data) => { writes.push({ url, data }); return writes.length === 1 ? first.promise : second.promise; } });
  const a = cancel(h, 10); const requestA = confirm(a); const b = cancel(h, 20); const requestB = confirm(b);
  assert.equal(writes.length, 2); first.resolve({ data: {} }); await requestA; assert.equal(h.modal.opened, true); assert.equal(b.buttons.at(-1).disabled, true);
  second.resolve({ data: {} }); await requestB; assert.equal(h.modal.opened, false);
});
test('edição durante envio preserva motivo/seleção novos sem enviar automaticamente', async () => {
  for (const kind of ['register', 'cancel']) {
    const pending = deferred(); let count = 0; const h = await ready({ post: () => { count++; return pending.promise; }, put: () => { count++; return pending.promise; } });
    const modal = kind === 'register' ? register(h) : cancel(h); const request = confirm(modal);
    const field = h.node(kind === 'register' ? 'input-checkin-aluno' : 'input-cancel-motivo'); field.value = kind === 'register' ? '22' : 'Outro motivo novo';
    pending.resolve({ data: {} }); await request; assert.equal(h.modal.opened, true); assert.equal(count, 1); assert.equal(field.value, kind === 'register' ? '22' : 'Outro motivo novo');
  }
});
test('resposta e erro de escrita antigos não notificam nem atualizam outra conta', async () => {
  for (const reject of [false, true]) {
    const pending = deferred(); let reads = 0; const h = await ready({ post: () => pending.promise }); const modal = register(h); const request = confirm(modal);
    h.context.Auth.user.id = 8; h.context.Auth.generation++; h.context.API.get = async () => { reads++; return { data: [] }; };
    if (reject) pending.reject(new Error('Erro de A')); else pending.resolve({ data: {} }); await request;
    assert.equal(reads, 0); assert.equal(h.messages.length, 0);
  }
});
test('KPIs e lista de alunos não substituem resposta mais recente ou página nova', async () => {
  for (const method of ['carregarKPIs', 'carregarAlunos']) {
    const a = deferred(), b = deferred(); const h = await ready(); let calls = 0; h.context.API.get = () => ++calls === 1 ? a.promise : b.promise;
    const first = h.view[method]();
    // A replacement summary has its own anchors and may load independently.
    if (method === 'carregarKPIs') for (const id of ['kpi-checkins-total', 'kpi-ultimo-checkin']) { h.node(id).isConnected = false; h.nodes.delete(id); h.node(id); }
    const second = h.view[method]();
    b.resolve({ data: method === 'carregarKPIs' ? { totalHoje: 2, checkins: [] } : [{ ...students[0], user: { name: 'Atual' } }] }); await second;
    a.resolve({ data: method === 'carregarKPIs' ? { totalHoje: 99, checkins: [] } : [{ ...students[0], user: { name: 'Antigo' } }] }); await first;
    if (method === 'carregarKPIs') assert.equal(h.node('kpi-checkins-total').textContent, 2); else assert.equal(h.view.alunos[0].user.name, 'Atual');
    const pending = deferred(); h.context.API.get = () => pending.promise; const old = h.view[method](); h.context.App.currentPage = 'alunos'; pending.reject(new Error('Antigo')); await old; assert.equal(h.messages.length, 0);
  }
});
test('callback de filtro antigo não inicia consulta na página nova', async () => {
  const h = await ready(); const old = h.node('filtro-data-inicio').onchange; let reads = 0; h.context.API.get = async () => { reads++; return { data: [] }; };
  h.context.App.currentPage = 'planos'; h.node('filtro-data-inicio').value = '2026-10-01'; old(); assert.equal(reads, 0);
});
test('Enter usa salvamento capturado e previne navegação, com validade nativa', async () => {
  let writes = 0; const h = await ready({ put: async () => { writes++; return { data: {} }; } }); const modal = cancel(h);
  const form = h.node('form-cancel-checkin'); assert.equal(typeof form.onsubmit, 'function'); let prevented = 0;
  form.reportValidity = () => false; await form.onsubmit({ preventDefault: () => prevented++ }); assert.equal(writes, 0);
  form.reportValidity = () => true; await form.onsubmit({ preventDefault: () => prevented++ }); assert.equal(writes, 1); assert.equal(prevented, 2);
});
test('resultado incerto orienta conferir histórico e não repete automaticamente', async () => {
  let writes = 0; const h = await ready({ post: async () => { writes++; throw Object.assign(new Error('Prazo'), { timeout: true, status: 0 }); } }); register(h);
  await confirm(h.modals.at(-1)); assert.equal(writes, 1); assert.equal(h.modal.opened, true); assert.ok(h.messages.some(m => /histórico/i.test(m)));
});
test('lista falha com texto seguro e retry capturado recusa segundo clique antigo', async () => {
  const h = await ready(); h.context.API.get = async () => { throw new Error('<img src=x onerror=bad()>'); }; await h.view.carregarLista();
  const tbody = h.node('checkins-table-body'); assert.ok(tbody.innerHTML.includes('&lt;img')); assert.ok(!tbody.innerHTML.includes('<img'));
  assert.ok(tbody.innerHTML.includes('data-checkin-retry')); const old = tbody.onclick;
  const pending = deferred(); let reads = 0; h.context.API.get = (url, options) => { reads++; assert.equal(options.timeoutMs, 15000); return pending.promise; };
  const retry = { disabled: false }; const event = { target: { closest: () => retry } };
  const request = old(event); old(event); assert.equal(reads, 2); // one KPI and one list, not two retries
  pending.resolve({ data: [] }); await request;
});
test('alunos indisponíveis podem ser recuperados no mesmo formulário preservando sua identidade', async () => {
  const h = await ready(); h.context.API.get = async () => { throw new Error('Falha'); }; await h.view.carregarAlunos();
  const modal = register(h); const form = h.node('form-checkin'), field = h.node('input-checkin-aluno'), retry = h.node('checkin-form-retry');
  assert.equal(field.disabled, true); assert.equal(retry.hidden, false); assert.equal(modal.buttons.at(-1).disabled, true);
  h.context.API.get = async () => ({ data: students }); await retry.onclick();
  assert.equal(h.node('form-checkin'), form); assert.equal(field.disabled, false); assert.equal(retry.hidden, true); assert.ok(field.innerHTML.includes('Aluno fictício'));
});
test('resposta da lista em tbody substituído é descartada mesmo na mesma página', async () => {
  const pending = deferred(); const h = await ready(); h.context.API.get = () => pending.promise; const old = h.node('checkins-table-body'); const request = h.view.carregarLista();
  old.isConnected = false; h.nodes.delete('checkins-table-body'); const current = h.node('checkins-table-body'); current.innerHTML = 'Tela nova';
  pending.resolve({ data: [{ id: 10, student: { user: { name: 'Antigo' } }, status: 'present' }] }); await request;
  assert.equal(current.innerHTML, 'Tela nova'); assert.equal(h.view.dados.length, 0);
});
test('presença legada do aluno deduplica, limita prazo e não confirma em conta nova', async () => {
  const pending = deferred(); let writes = 0, options; const h = browser({ post: (url, body, opt) => { writes++; options = opt; return pending.promise; } });
  h.context.Auth.user.role = 'student'; h.node('checkins-aluno-container'); h.node('btn-self-checkin'); h.node('self-checkin-feedback'); await h.view.renderVisaoAluno();
  const callback = h.node('btn-self-checkin').onclick, first = callback(), duplicate = callback();
  assert.equal(writes, 1); assert.equal(options.timeoutMs, 15000); h.context.Auth.generation++; h.context.Auth.user.id++;
  pending.resolve({ data: {} }); await Promise.all([first, duplicate]); assert.equal(h.node('self-checkin-feedback').textContent, '');
});
test('intervalo inválido interrompe a espera visual e corrigir datas recupera consulta', async () => {
  const pending = deferred(); const h = await ready(); let reads = 0; h.context.API.get = () => { reads++; return pending.promise; };
  const first = h.view.carregarLista(); assert.ok(h.node('checkins-table-body').innerHTML.includes('Carregando'));
  h.view.filtroAtual.startDate = '2026-10-12'; h.view.filtroAtual.endDate = '2026-10-01'; await h.view.carregarLista();
  assert.equal(reads, 1); assert.ok(!h.node('checkins-table-body').innerHTML.includes('Carregando'));
  assert.match(h.node('checkins-table-body').innerHTML, /data inicial|período inválido/i);
  pending.resolve({ data: [{ id: 10, student: { user: { name: 'Resposta antiga' } }, status: 'present' }] }); await first;
  assert.ok(!h.node('checkins-table-body').innerHTML.includes('Resposta antiga'));
  h.view.filtroAtual.endDate = '2026-10-20'; h.context.API.get = async () => { reads++; return { data: [] }; }; await h.view.carregarLista();
  assert.equal(reads, 2); assert.ok(h.node('checkins-table-body').innerHTML.includes('Nenhuma presença'));
});
test('frequência mantém botão focável com aria-busy e limpa apenas operação própria', async () => {
  const a = deferred(), b = deferred(); const h = await ready(); let reads = 0; h.context.API.get = () => ++reads === 1 ? a.promise : b.promise;
  const button = h.node('btn-ver-ranking'), first = h.view.abrirModalRanking();
  assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-busy'), 'true');
  h.modal.open('Outro diálogo', '', []); const second = h.view.abrirModalRanking();
  a.resolve({ data: [] }); await first; assert.equal(button.getAttribute('aria-busy'), 'true');
  b.resolve({ data: [] }); await second; assert.equal(button.getAttribute('aria-busy'), null); assert.equal(button.disabled, false);
  const oldClose = h.modals.at(-1).buttons[0].action; h.modal.open('Novo diálogo', '', []); oldClose(); assert.equal(h.modal.opened, true);
});
test('Atualizar resumo recupera KPIs após erro, deduplica cliques e mantém ação focável', async () => {
  const h = await ready(); h.context.API.get = async () => { throw new Error('Falha temporária'); }; await h.view.carregarKPIs();
  assert.match(h.node('kpi-ultimo-checkin').textContent, /Atualizar resumo/);
  const button = h.node('btn-atualizar-presencas'); assert.equal(typeof button.onclick, 'function');
  const pending = deferred(); let reads = 0; h.context.API.get = (url, options) => { reads++; assert.equal(url, '/checkins/hoje'); assert.equal(options.timeoutMs, 15000); return pending.promise; };
  const request = button.onclick(), duplicate = button.onclick(); assert.equal(reads, 1); assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-busy'), 'true');
  pending.resolve({ data: { totalHoje: 3, checkins: [{ alunoNome: 'Aluno fictício', horario: '10:15' }] } }); await Promise.all([request, duplicate]);
  assert.equal(button.getAttribute('aria-busy'), null); assert.equal(h.node('kpi-checkins-total').textContent, 3); assert.equal(h.node('kpi-ultimo-checkin').textContent, 'Aluno fictício às 10:15');
  const old = button.onclick; h.context.App.currentPage = 'planos'; await old(); assert.equal(reads, 1);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture({ get = async () => ({ data: [] }), post = async () => ({ data: {} }), page = 'pagamentos' } = {}) {
  const nodes = new Map(), events = new Map(), timers = [], toasts = [], modals = [];
  const node = id => { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', style: {}, isConnected: true, firstElementChild: null, contains: () => true,
    attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, String(value)); }, getAttribute(name) { return this.attributes.get(name) ?? null; } }); return nodes.get(id); };
  let epoch = 'session-a', open = false;
  const context = vm.createContext({ API: { get, post }, Auth: { user: { id: 7, role: 'admin' }, generation: 1, sessionEpoch: epoch, getSessionEpoch: () => epoch },
    App: { currentPage: page }, Intl, URLSearchParams, console: { warn() {} },
    window: { addEventListener: (name, fn) => { const listeners = events.get(name) || []; listeners.push(fn); events.set(name, listeners); } },
    localStorage: { getItem: () => null }, setTimeout: callback => { timers.push(callback); },
    document: { getElementById: node, querySelectorAll: () => [], querySelector: () => null },
    Modal: { isOpen: () => open, open: (title, html) => { open = true; node('modal-body').firstElementChild = {}; modals.push({ title, html }); }, close: () => { open = false; node('modal-body').firstElementChild = null; } },
    Toast: { success: message => toasts.push(['success', message]), error: message => toasts.push(['error', message]) }
  });
  for (const file of ['security', 'payment-adjustments', 'pagamentos', 'relatorios']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', `${file}.js`), 'utf8'), context);
  context.PaymentAdjustments = context.window.PaymentAdjustments;
  vm.runInContext('this.payments = PagamentosView; this.reports = RelatoriosView;', context);
  return { context, payments: context.payments, reports: context.reports, node, nodes, events, timers, toasts, modals,
    move(pageName) { context.App.currentPage = pageName; },
    replace(id) { const old = node(id); old.isConnected = false; nodes.delete(id); return node(id); },
    change(kind) {
      if (kind === 'page') context.App.currentPage = 'planos';
      if (kind === 'account') context.Auth.user = { id: 8, role: 'admin' };
      if (kind === 'generation') context.Auth.generation++;
      if (kind === 'epoch') epoch = 'session-b'; // Storage event has not reached Auth yet.
      if (kind === 'role') context.Auth.user.role = 'student';
    }
  };
}
const payment = (id, name, status) => ({ id, amount: 20, status, student: { user: { name } } });

test('lista financeira mantém filtro mais novo quando respostas chegam fora de ordem, incluindo erro antigo', async () => {
  for (const fails of [false, true]) {
    const old = deferred(), newest = deferred(); let calls = 0;
    const f = fixture({ get: () => ++calls === 1 ? old.promise : newest.promise });
    f.payments.filtroAtual.status = 'paid'; const first = f.payments.carregarLista();
    f.payments.filtroAtual.status = 'overdue'; const second = f.payments.carregarLista();
    newest.resolve({ data: [payment(2, 'Selecionado vencido', 'overdue')] }); await second;
    if (fails) old.reject(new Error('Consulta antiga falhou')); else old.resolve({ data: [payment(1, 'Antigo pago', 'paid')] });
    await first;
    assert.match(f.node('pagamentos-table-body').innerHTML, /Selecionado vencido/);
    assert.ok(!f.node('pagamentos-table-body').innerHTML.includes('Antigo pago'));
    assert.equal(f.payments.dados[0].id, 2); assert.equal(f.toasts.length, 0);
  }
});

test('listas financeiras e seus erros não atualizam página, âncora ou identidade nova', async () => {
  for (const change of ['page', 'anchor', 'account', 'generation', 'epoch', 'role']) for (const fails of [false, true]) {
    const old = deferred(), f = fixture({ get: () => old.promise });
    const pending = f.payments.carregarLista();
    if (change === 'anchor') f.replace('pagamentos-table-body'); else f.change(change);
    const table = f.node('pagamentos-table-body'); table.innerHTML = 'Conteúdo atual';
    if (fails) old.reject(new Error('Falha antiga')); else old.resolve({ data: [payment(1, 'Resposta antiga', 'paid')] });
    await pending;
    assert.equal(table.innerHTML, 'Conteúdo atual', change); assert.equal(f.payments.dados.length, 0, change); assert.equal(f.toasts.length, 0, change);
  }
});

test('detalhes pendentes não substituem modal de outra tarefa nem reabrem após navegação', async () => {
  for (const change of ['page', 'anchor', 'account', 'generation', 'epoch', 'modal']) {
    const old = deferred(), f = fixture({ get: () => old.promise });
    const pending = f.payments.verDetalhes(1);
    if (change === 'anchor') f.replace('pagamentos-table-body'); else if (change !== 'modal') f.change(change);
    f.context.Modal.open('Editar outro cadastro', 'Alteração não salva');
    old.resolve({ data: payment(1, 'Resposta antiga', 'paid') }); await pending;
    assert.deepEqual(f.modals.map(item => item.title), ['Editar outro cadastro'], change);
    assert.equal(f.toasts.length, 0);
  }
});

test('detalhes atuais continuam abrindo e escapando campos armazenados', async () => {
  const value = payment(1, '<img src=x>', 'paid'); value.notes = '<script>bad</script>';
  const f = fixture({ get: async () => ({ data: value }) });
  await f.payments.verDetalhes(1);
  assert.equal(f.modals.length, 1); assert.match(f.modals[0].html, /&lt;img/); assert.ok(!f.modals[0].html.includes('<script>'));
});

test('critério financeiro fica visível e troca de relatório restaura texto de situação atual', async () => {
  const f = fixture({ page: 'relatorios', get: async url => ({ data: url.startsWith('/relatorios/financeiro')
    ? { items: [], resumo: { criterio: 'Recebimentos por pagamento; ajustes pela data efetiva.' } } : [] }) });
  f.node('filtro-data-inicio').value = '2026-10-01'; f.node('filtro-data-fim').value = '2026-10-11';
  await f.reports.carregarRelatorio('pagamentos');
  assert.equal(f.node('aviso-filtro-data').style.display, 'block'); assert.match(f.node('aviso-filtro-data').textContent, /data efetiva/);
  await f.reports.carregarRelatorio('inadimplencia');
  assert.equal(f.node('aviso-filtro-data').style.display, 'block'); assert.match(f.node('aviso-filtro-data').textContent, /situação atual/);
  assert.doesNotMatch(f.node('aviso-filtro-data').textContent, /data efetiva/);
});

test('verificação administrativa já enviada mantém resultado real sem consultar nova conta nem abrir modal obsoleto', async () => {
  for (const change of ['page', 'account', 'generation', 'epoch']) {
    const old = deferred(); let writes = 0, reads = 0;
    const f = fixture({ post: () => { writes++; return old.promise; }, get: async () => { reads++; return { data: [] }; } });
    const pending = f.payments.abrirModalInadimplentes(); f.change(change);
    old.resolve({ data: { bloqueados: 1 } }); await pending;
    assert.equal(writes, 1); assert.equal(reads, 0, change); assert.equal(f.modals.length, 0, change); assert.equal(f.toasts.length, 0, change);
  }
});

test('atalho financeiro atrasado é descartado após mudar de página', async () => {
  const f = fixture(); let openings = 0;
  f.payments.abrirModalRegistro = async () => { openings++; };
  f.payments.registrarPagamentoRapido(11); f.move('planos');
  await f.timers.shift()();
  assert.equal(openings, 0);
});

test('relatório tardio resolve sem erro quando sua página já não existe', async () => {
  for (const fails of [false, true]) {
    const old = deferred(), f = fixture({ page: 'relatorios', get: () => old.promise });
    const pending = f.reports.carregarRelatorio('inadimplencia');
    f.move('pagamentos'); f.context.document.getElementById = () => null;
    if (fails) old.reject(new Error('Falha antiga')); else old.resolve({ data: [{ nome: 'Fixture', totalAtraso: 20 }] });
    await assert.doesNotReject(pending); assert.equal(f.toasts.length, 0);
  }
});

test('relatórios rejeitam resultados ou erros com conta, geração, epoch ou container antigo', async () => {
  for (const change of ['account', 'generation', 'epoch', 'anchor']) for (const fails of [false, true]) {
    const old = deferred(), f = fixture({ page: 'relatorios', get: () => old.promise });
    const pending = f.reports.carregarRelatorio('inadimplencia');
    if (change === 'anchor') f.replace('relatorios-container'); else f.change(change);
    f.node('relatorio-tbody').innerHTML = 'Relatório atual'; f.node('relatorio-error').textContent = 'Sem erro atual';
    if (fails) old.reject(new Error('Falha antiga')); else old.resolve({ data: [{ nome: 'Resposta antiga', totalAtraso: 20 }] });
    await pending;
    assert.equal(f.node('relatorio-tbody').innerHTML, 'Relatório atual', change);
    assert.equal(f.node('relatorio-error').textContent, 'Sem erro atual', change);
  }
});

test('relatório conserva seleção mais recente e falha atual aparece no próprio contexto', async () => {
  const old = deferred(); let calls = 0;
  const f = fixture({ page: 'relatorios', get: () => ++calls === 1 ? old.promise : Promise.resolve({ data: { items: [{ nome: 'Seleção atual', status: 'active' }], resumo: {} } }) });
  const first = f.reports.carregarRelatorio('inadimplencia'); await f.reports.carregarRelatorio('alunos');
  old.resolve({ data: [{ nome: 'Antigo', totalAtraso: 20 }] }); await first;
  assert.match(f.node('relatorio-tbody').innerHTML, /Seleção atual/);
  const fails = fixture({ page: 'relatorios', get: async () => { throw new Error('Indisponível agora'); } });
  await fails.reports.carregarRelatorio('inadimplencia');
  assert.equal(fails.node('relatorio-error').textContent, 'Indisponível agora');
});

test('dias de atraso seguem calendário brasileiro e não antecipam vencimento às 00 UTC', () => {
  const f = fixture(), due = '2026-10-08T00:00:00.000Z';
  assert.equal(f.payments.calcularDiasAtraso(due, new Date('2026-10-09T02:59:59Z')), 0);
  assert.equal(f.payments.calcularDiasAtraso(due, new Date('2026-10-09T03:00:00Z')), 1);
  assert.equal(f.payments.calcularDiasAtraso(due, new Date('2026-10-08T12:00:00Z')), 0);
  assert.equal(f.payments.calcularDiasAtraso('2026-02-30', new Date('2026-10-09T03:00:00Z')), null);
});

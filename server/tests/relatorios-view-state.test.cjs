const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(get) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', value: '', style: {}, isConnected: true, disabled: false,
      setAttribute(name, value) { this[name] = String(value); } });
    return nodes.get(id);
  };
  let prints = 0;
  const calls = [];
  const auth = { user: { id: 1, role: 'admin' }, generation: 2, sessionEpoch: 'owned', getSessionEpoch() { return this.sessionEpoch; } };
  const context = vm.createContext({ window: { print() { prints++; } }, URLSearchParams, Intl, Date,
    document: { getElementById: node }, Auth: auth, App: { currentPage: 'relatorios' },
    API: { get(url, options) { calls.push({ url, options }); return get(url, options); } } });
  for (const file of ['security.js', 'relatorios.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  const view = vm.runInContext('RelatoriosView', context);
  view.container = node('relatorios-container');
  view.bindEvents();
  node('filtro-data-inicio').value = '2026-10-01';
  node('filtro-data-fim').value = '2026-10-14';
  return { view, node, auth, context, calls, prints: () => prints };
}
const financial = (items = [], reviews = 3) => ({ data: { items, resumo: {
  totalBruto: items.length ? '100.00' : '0.00', totalCorrecoes: items.length ? '10.00' : '0.00', totalDevolucoesInformadas: items.length ? '20.00' : '0.00', totalReceita: items.length ? '70.00' : '0.00',
  totalPendente: '0.00', totalVencido: '0.00', conferenciasProvedor: reviews, criterio: 'Valores registrados, sem confirmação bancária.'
} } });
function deferred() { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }

test('financeiro vazio mantém resumo confirmado e separa conferências atuais do período', async () => {
  const { view, node, prints } = harness(async () => financial());
  await view.carregarRelatorio('pagamentos');
  assert.equal(node('relatorio-empty').style.display, 'block');
  assert.equal(node('relatorio-resumo').style.display, 'block');
  assert.equal(node('relatorios-container')['data-result-confirmed'], 'true');
  const html = node('relatorio-resumo').innerHTML;
  assert.match(html, /Líquido registrado/);
  assert.match(html, /0,00/);
  assert.match(html, /Conferência de checkout/);
  assert.match(html, /Situação atual/);
  assert.match(html, />3</);
  assert.match(html, /sem confirmação bancária/);
  assert.match(node('relatorio-periodo-aplicado').textContent, /01\/10\/2026.*14\/10\/2026/);
  node('btn-imprimir-relatorio').onclick();
  assert.equal(prints(), 1);
});

test('carregamento e erro ocultam resumo anterior, período aplicado e bloqueiam impressão; retry vazio confirma novo período', async () => {
  const pending = deferred(); let count = 0;
  const { view, node, prints, calls } = harness(() => ++count === 1 ? Promise.resolve(financial([{ aluno: 'A', paymentId: 1 }])) : count === 2 ? pending.promise : Promise.resolve(financial([], 0)));
  await view.carregarRelatorio('pagamentos');
  assert.match(node('relatorio-resumo').innerHTML, /70,00/);
  node('filtro-data-inicio').value = '2026-09-01';
  assert.match(node('relatorio-periodo-aplicado').textContent, /01\/10\/2026/);
  const loading = view.carregarRelatorio('pagamentos');
  assert.equal(node('relatorio-resumo').style.display, 'none');
  assert.equal(node('relatorio-periodo-aplicado').style.display, 'none');
  assert.equal(node('relatorios-container')['data-result-confirmed'], 'false');
  node('btn-imprimir-relatorio').onclick(); assert.equal(prints(), 0);
  pending.reject(new Error('Sem conexão')); await loading;
  assert.equal(node('relatorio-error').style.display, 'block');
  node('btn-imprimir-relatorio').onclick(); assert.equal(prints(), 0);
  await view.carregarRelatorio('pagamentos');
  assert.equal(node('relatorio-resumo').style.display, 'block');
  assert.match(node('relatorio-periodo-aplicado').textContent, /01\/09\/2026/);
  assert.match(node('relatorio-resumo').innerHTML, />0</);
  assert.ok(calls.every(call => call.options?.timeoutMs === 15000));
});

test('período confirmado usa valores capturados antes do await e situação atual não recebe datas', async () => {
  const pending = deferred();
  const { view, node } = harness(url => url.includes('financeiro') ? pending.promise : Promise.resolve({ data: { items: [], resumo: {} } }));
  const loading = view.carregarRelatorio('pagamentos');
  node('filtro-data-inicio').value = '2026-08-01'; node('filtro-data-fim').value = '2026-08-02';
  pending.resolve(financial()); await loading;
  assert.match(node('relatorio-periodo-aplicado').textContent, /01\/10\/2026.*14\/10\/2026/);
  await view.carregarRelatorio('alunos');
  assert.match(node('relatorio-periodo-aplicado').textContent, /Situação atual/);
  assert.doesNotMatch(node('relatorio-periodo-aplicado').textContent, /2026/);
});

test('resposta antiga não publica resumo nem período de outra seleção', async () => {
  const old = deferred();
  const { view, node } = harness(url => url.includes('financeiro') ? old.promise : Promise.resolve({ data: { items: [], resumo: { ativos: 2 } } }));
  const loading = view.carregarRelatorio('pagamentos');
  await view.carregarRelatorio('alunos');
  old.resolve(financial()); await loading;
  assert.match(node('relatorio-resumo').innerHTML, /Ativos/);
  assert.doesNotMatch(node('relatorio-resumo').innerHTML, /Líquido registrado/);
  assert.match(node('relatorio-periodo-aplicado').textContent, /Situação atual/);
});

for (const change of ['identity', 'generation', 'epoch', 'page', 'container']) {
  test(`relatório pendente não publica nem imprime após mudar ${change}`, async () => {
    const pending = deferred(); const { view, node, auth, context, prints } = harness(() => pending.promise);
    const loading = view.carregarRelatorio('pagamentos');
    if (change === 'identity') auth.user.id = 99;
    if (change === 'generation') auth.generation++;
    if (change === 'epoch') auth.sessionEpoch = 'other';
    if (change === 'page') context.App.currentPage = 'dashboard';
    if (change === 'container') node('relatorios-container').isConnected = false;
    pending.resolve(financial()); await loading;
    assert.equal(node('relatorio-resumo').innerHTML, '');
    node('btn-imprimir-relatorio').onclick(); assert.equal(prints(), 0);
  });
}

test('período inválido não consulta, não imprime e oferece erro claro', async () => {
  const { view, node, calls, prints } = harness(async () => financial());
  node('filtro-data-inicio').value = '2026-02-31';
  await view.carregarRelatorio('pagamentos');
  assert.equal(calls.length, 0);
  assert.match(node('relatorio-error').textContent, /período válido/);
  node('btn-imprimir-relatorio').onclick(); assert.equal(prints(), 0);
});

test('valores ausentes não viram zero e critérios externos permanecem texto escapado', async () => {
  const { view, node } = harness(async () => ({ data: { items: [], resumo: { criterio: '<img src=x onerror=alert(1)>' } } }));
  await view.carregarRelatorio('pagamentos');
  assert.doesNotMatch(node('relatorio-resumo').innerHTML, /R\$/);
  assert.match(node('relatorio-resumo').innerHTML, /—/);
  assert.equal(node('aviso-filtro-data').textContent, '<img src=x onerror=alert(1)>');
  assert.doesNotMatch(node('relatorio-resumo').innerHTML, /<img/);
});

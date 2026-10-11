const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../client/js/app.js'), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(get) {
  const nodes = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, { textContent: '', innerHTML: '', isConnected: true, querySelector: selector => node(selector) }); return nodes.get(id); };
  const screen = { isConnected: true }, identity = { id: 1, role: 'admin' };
  let currentScreen = screen, epoch = 'session-a', charts = [], activities = [];
  const context = vm.createContext({ API: { get }, Auth: { user: identity, generation: 1, sessionEpoch: epoch, getSessionEpoch: () => epoch },
    App: { currentPage: 'dashboard', navigateTo() {} }, Intl, console: { warn() {} },
    setTimeout: () => { throw new Error('Chart should render in the current response, not a delayed task'); },
    document: { getElementById: node, querySelector: () => currentScreen, addEventListener() {} }, window: {} });
  vm.runInContext(source.slice(source.indexOf('const DashboardView =')), context);
  const view = vm.runInContext('DashboardView', context);
  view.renderChart = value => charts.push(value);
  view.renderAtividades = value => activities.push(value);
  return { view, context, node, charts, activities, screen, replaceScreen() { currentScreen = { isConnected: true }; }, changeEpoch() { epoch = 'session-b'; } };
}
const response = total => ({ data: { totalAlunos: total, alunosAtivos: total, tendencias: { labels: [String(total)], data: [total] }, atividades: [total] } });

test('painel antigo não substitui indicadores, atividades ou gráfico de consulta mais nova', async () => {
  const old = deferred(); let calls = 0;
  const f = fixture(() => ++calls === 1 ? old.promise : Promise.resolve(response(20)));
  const pending = f.view.inicializar(); await f.view.inicializar();
  old.resolve(response(10)); await pending;
  assert.equal(f.node('kpi-total-alunos').textContent, 20);
  assert.equal(f.view.currentStats.totalAlunos, 20);
  assert.deepEqual(f.charts.map(row => row.data[0]), [20]);
  assert.deepEqual(f.activities, [[20]]);
});

test('sucesso ou erro tardio não altera nova tela, conta, geração ou epoch', async () => {
  for (const change of ['screen', 'page', 'account', 'generation', 'epoch']) for (const rejects of [false, true]) {
    const old = deferred(), f = fixture(() => old.promise);
    const pending = f.view.inicializar();
    f.node('page-content').innerHTML = 'Current screen';
    if (change === 'screen') f.replaceScreen();
    if (change === 'page') f.context.App.currentPage = 'alunos';
    if (change === 'account') f.context.Auth.user = { id: 2, role: 'admin' };
    if (change === 'generation') f.context.Auth.generation++;
    if (change === 'epoch') f.changeEpoch();
    if (rejects) old.reject(new Error('Old request failed')); else old.resolve(response(10));
    await pending;
    assert.equal(f.node('page-content').innerHTML, 'Current screen', change);
    assert.equal(f.node('kpi-total-alunos').textContent, '', change);
    assert.equal(f.view.currentStats, null, change);
    assert.equal(f.charts.length, 0); assert.equal(f.activities.length, 0);
  }
});

test('falha atual mostra retry no painel que originou a consulta', async () => {
  const f = fixture(async () => { throw new Error('Unavailable'); });
  await f.view.inicializar();
  assert.match(f.node('page-content').innerHTML, /dashboard-retry/);
  assert.equal(f.node('#dashboard-error').textContent, 'Unavailable');
});

test('marcador compartilhado já alterado impede consulta antes do evento entre abas', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return response(10); });
  f.changeEpoch();
  await f.view.inicializar();
  assert.equal(calls, 0); assert.equal(f.view.currentStats, null);
});

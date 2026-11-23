const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/app.js'), 'utf8');
const payload = () => ({ totalAlunos: 0, alunosAtivos: 0, checkinsHoje: 0, receitaEstimada: 0,
  financeiroMes: { grossAmount: 0, netAmount: 0, adjustedAmount: 0 }, conferenciasProvedor: 0,
  tendencias: { labels: ['20/11', '21/11'], data: [0, 3] }, atividades: [], pagamentosRecentes: [] });
function fixture(get, Chart) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { id, textContent: '', innerHTML: '', isConnected: true, style: {}, hidden: false,
      children: [], attributes: {}, setAttribute(key, value) { this.attributes[key] = value; },
      appendChild(child) { this.children.push(child); }, querySelector: selector => node(selector.replace(/^#/, '')) });
    return nodes.get(id);
  };
  const screen = { isConnected: true }, document = { getElementById: node, querySelector: () => screen,
    addEventListener() {}, createElement: () => node(`created-${nodes.size}`) };
  const security = { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) };
  const context = vm.createContext({ API: { get }, Auth: { user: { id: 1, role: 'admin' }, generation: 1 },
    App: { currentPage: 'dashboard', navigateTo() {} }, FitFlowSecurity: security, Intl, console: { error() {} },
    document, window: {}, ...(Chart ? { Chart } : {}) });
  vm.runInContext(source.slice(source.indexOf('const DashboardView =')), context);
  return { view: vm.runInContext('DashboardView', context), node, context };
}

test('dashboard rejects incomplete metrics before displaying fabricated zeros and retains recovery', async () => {
  const cases = [() => ({}), value => { delete value.totalAlunos; }, value => { value.receitaEstimada = null; },
    value => { value.checkinsHoje = Infinity; }, value => { value.alunosAtivos = '0'; },
    value => { value.financeiroMes.grossAmount = null; }, value => { value.financeiroMes.adjustedAmount = NaN; },
    value => { value.conferenciasProvedor = -1; }, value => { value.tendencias.data = [0]; },
    value => { value.tendencias.data[0] = null; }, value => { value.tendencias.labels[0] = {}; },
    value => { value.atividades = null; }, value => { value.pagamentosRecentes = {}; },
    value => { value.atividades = [{ tipo: 'checkin', nome: 'Ana', data: 'invalid' }]; },
    value => { value.atividades = [{ tipo: 'other', nome: 'Ana', data: '2026-11-21T12:00:00Z' }]; },
    value => { value.pagamentosRecentes = [{ nome: 'Ana', valor: null }]; }];
  for (const mutate of cases) {
    const data = payload(), result = mutate(data);
    const f = fixture(async () => ({ data: result || data }));
    await f.view.inicializar();
    assert.match(f.node('page-content').innerHTML, /role="alert"/, mutate.toString());
    assert.match(f.node('page-content').innerHTML, /dashboard-retry/);
    assert.equal(f.node('kpi-total-alunos').textContent, '');
    assert.equal(f.view.currentStats, null);
  }
});

test('valid zeros stay zero, and chart dependency absence shows genuine daily counts', async () => {
  const f = fixture(async () => ({ data: payload() }));
  await f.view.inicializar();
  assert.equal(f.node('kpi-total-alunos').textContent, 0);
  assert.equal(f.node('kpi-taxa-retencao').textContent, '0%');
  assert.match(f.node('kpi-receita-estimada').textContent, /0/);
  assert.ok(!f.node('page-content').innerHTML.includes('dashboard-retry'));
  assert.match(f.node('chart-counts-body').innerHTML, /20\/11/);
  assert.match(f.node('chart-counts-body').innerHTML, />0</);
  assert.match(f.node('chart-counts-body').innerHTML, />3</);
  assert.equal(f.node('chart-visual').hidden, true);
  assert.equal(f.node('chart-counts').open, true);
  assert.equal(f.node('chart-fallback').hidden, false);
  assert.ok(f.node('chart-fallback').textContent.length > 0);
});

test('chart constructor failure preserves metrics and accessible counts without showing a blank chart', async () => {
  const f = fixture(async () => ({ data: payload() }), function Chart() { throw new Error('Canvas unavailable'); });
  await f.view.inicializar();
  assert.ok(!f.node('page-content').innerHTML.includes('dashboard-retry'));
  assert.equal(f.node('chart-visual').hidden, true); assert.equal(f.node('chart-counts').open, true);
  assert.match(f.node('chart-counts-body').innerHTML, /21\/11/);
});

test('healthy chart uses verified values while the textual alternative remains available and escaped', async () => {
  let config;
  const data = payload(); data.tendencias.labels[0] = '<img src=x>';
  const f = fixture(async () => ({ data }), function Chart(canvas, options) { config = options; this.destroy = () => {}; });
  await f.view.inicializar();
  assert.deepEqual(Array.from(config.data.datasets[0].data), [0, 3]);
  assert.equal(f.node('chart-visual').hidden, false); assert.equal(f.node('chart-fallback').hidden, true);
  assert.match(f.node('chart-counts-body').innerHTML, /&lt;img src=x&gt;/);
  assert.ok(!f.node('chart-counts-body').innerHTML.includes('<img'));
  assert.match(source, /<details id="chart-counts"/);
  assert.match(source, /<summary>[^<]+<\/summary>/);
  assert.match(source, /<canvas id="tendencias-chart" aria-hidden="true"/);
  assert.match(source, /<caption>[^<]+<\/caption>/);
});

test('malformed response can recover through existing retry and display confirmed data', async () => {
  let calls = 0;
  const f = fixture(async () => ({ data: ++calls === 1 ? {} : payload() }));
  await f.view.inicializar();
  let retryCount = 0;
  f.context.App.navigateTo = page => { assert.equal(page, 'dashboard'); retryCount++; };
  f.node('page-content').querySelector('#dashboard-retry').onclick(); assert.equal(retryCount, 1);
  await f.view.inicializar(); assert.equal(f.view.currentStats.totalAlunos, 0); assert.equal(calls, 2);
});

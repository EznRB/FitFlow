const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const records = (id = 3) => ({ sessions: [{ id: 'session-' + id, planSnapshot: { name: 'Ficha', exercises: [{ id, name: 'Supino' }] }, sets: [
  { id: 'set10-' + id, exerciseId: id, weightKg: 20, reps: 10, kind: 'working', rir: 2, performedAt: '2026-10-12T10:00:00Z' },
  { id: 'set8-' + id, exerciseId: id, weightKg: 25, reps: 8, kind: 'working', rir: null, performedAt: '2026-10-12T10:02:00Z' },
] }], summary7Days: null, historyLimit: 100 });
function harness() {
  const nodes = new Map(), requests = [], events = []; let epoch = 'first';
  // Replacing markup detaches old controls and restores HTML defaults, as a browser does.
  const filterSelectors = ['exercise', 'reps', 'warmups', 'filter-note', 'filter-error', 'choice-note', 'series'];
  function detach(selector) { const old = nodes.get(selector); if (old) old.isConnected = false; nodes.delete(selector); }
  function parse(html) {
    for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bdata-progress-[\w-]+[^>]*)>/g)) {
      const selector = '[' + match[2].match(/\b(data-progress-[\w-]+)/)[1] + ']';
      const item = node(selector); item.tag = match[1];
      for (const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) item.attributes[attribute[1]] = attribute[2];
      item.value = item.attributes.value || ''; item.checked = /\bchecked(?:\s|$)/.test(match[2]);
      if (selector === '[data-progress-exercise]') {
        const selectHTML = html.slice(match.index).match(/<select[^>]*>([\s\S]*?)<\/select>/)?.[1] || '';
        item.innerHTML = selectHTML;
      }
    }
  }
  function node(selector) {
    if (nodes.has(selector)) return nodes.get(selector);
    const item = { isConnected: true, textContent: '', value: '', checked: false, disabled: false, hidden: false, attributes: {}, validity: { badInput: false },
      setAttribute(name, value) { this.attributes[name] = String(value); }, getAttribute(name) { return this.attributes[name] ?? null; },
      querySelector: selector => nodes.get(selector) || null };
    Object.defineProperty(item, 'innerHTML', { get: () => item.html || '', set: html => {
      item.html = html;
      if (selector === '[data-progress-content]') { for (const name of filterSelectors) detach('[data-progress-' + name + ']'); parse(html); }
      if (selector === '[data-progress-series]') { detach('[data-progress-chart]'); detach('[data-progress-chart-note]'); parse(html); }
      if (selector === '[data-progress-exercise]') {
        const options = [...html.matchAll(/<option\b([^>]*)>/g)].map(match => ({ value: match[1].match(/value="([^"]*)"/)?.[1] || '', selected: /\bselected\b/.test(match[1]) }));
        item.value = (options.find(option => option.selected) || options[0])?.value || ''; item.options = options;
      }
    } });
    nodes.set(selector, item); return item;
  }
  const container = { id: 'main-content', isConnected: true, querySelector: selector => nodes.get(selector) || null };
  Object.defineProperty(container, 'innerHTML', { get: () => container.html || '', set: html => { container.html = html; for (const selector of [...nodes.keys()]) detach(selector); parse(html); } });
  const Auth = { user: { id: 7, role: 'student' }, generation: 1, sessionEpoch: 'first', getSessionEpoch: () => epoch };
  const context = vm.createContext({ Auth, document: { getElementById: id => id === container.id ? container : [...nodes.values()].find(item => item.attributes.id === id) || null },
    window: { addEventListener() {}, dispatchEvent(event) { events.push(event.type); } }, CustomEvent: class { constructor(type) { this.type = type; } },
    API: { get(route, options) { const request = { route, options, ...deferred() }; requests.push(request); return request.promise; } },
    FitFlowSecurity: { escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]) } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/progressao.js'), 'utf8'), context);
  return { view: context.ProgressaoView, container, requests, nodes, Auth, events, node,
    replace(selector) { detach(selector); return node(selector); }, remoteEpoch(value) { epoch = value; },
    async open(data = records()) { const loading = this.view.render(container); requests.at(-1).resolve({ data }); await loading; } };
}

test('refresh preserva nós e filtros, inclusive edição enquanto consulta aguarda, com prazo de 15 segundos', async () => {
  const h = harness(); await h.open(); const reps = h.node('[data-progress-reps]'), warmups = h.node('[data-progress-warmups]');
  reps.value = '10'; reps.oninput(); warmups.checked = true; warmups.onchange();
  const refresh = h.view.load(); h.view.load(); assert.equal(h.requests.length, 2); assert.equal(h.requests[1].options?.timeoutMs, 15000);
  reps.value = '8'; reps.oninput(); warmups.checked = false; warmups.onchange();
  h.requests[1].resolve({ data: records() }); await refresh;
  assert.equal(h.node('[data-progress-reps]'), reps); assert.equal(h.node('[data-progress-warmups]'), warmups);
  assert.equal(reps.value, '8'); assert.equal(warmups.checked, false);
  assert.match(h.node('[data-progress-filter-note]').textContent, /8 repetições/);
  assert.equal(h.node('[data-progress-refresh]').disabled, false);
});

test('exercício removido não troca comparação por nome/posição e exige escolha explícita preservando filtros', async () => {
  const h = harness(); await h.open(); const reps = h.node('[data-progress-reps]'); reps.value = '10'; reps.oninput();
  const warmups = h.node('[data-progress-warmups]'); warmups.checked = true; warmups.onchange();
  const refresh = h.view.load(); h.requests[1].resolve({ data: records(9) }); await refresh;
  const select = h.node('[data-progress-exercise]'); assert.equal(select.value, ''); assert.equal(h.view.selectedId, null);
  assert.equal(reps.value, '10'); assert.equal(warmups.checked, true); assert.match(h.node('[data-progress-choice-note]').textContent, /não.*consulta|escolha/i);
  assert.doesNotMatch(h.node('[data-progress-series]').innerHTML, /Identificação 9/);
  select.value = '9'; select.onchange({ target: select }); assert.equal(h.view.selectedId, 9);
  assert.match(h.node('[data-progress-series]').innerHTML, /Identificação 9/);
});

test('consulta vazia seguida de novos exercícios mantém a escolha explícita após perder o exercício anterior', async () => {
  const h = harness(); await h.open(); const first = h.view.load(); h.requests[1].resolve({ data: { sessions: [] } }); await first;
  const next = h.view.load(); h.requests[2].resolve({ data: records(9) }); await next;
  assert.equal(h.view.selectedId, null); assert.equal(h.node('[data-progress-exercise]').value, '');
});

test('exercício removido também anuncia escolha necessária quando filtro de repetições está inválido', async () => {
  const h = harness(); await h.open(); const field = h.node('[data-progress-reps]'); field.value = '2.5'; field.oninput();
  const refresh = h.view.load(); h.requests[1].resolve({ data: records(9) }); await refresh;
  assert.equal(h.node('[data-progress-exercise]').getAttribute('aria-invalid'), 'true');
  assert.match(h.node('[data-progress-choice-note]').textContent, /escolha explicitamente/i);
  assert.equal(field.getAttribute('aria-invalid'), 'true'); assert.match(h.node('[data-progress-filter-error]').textContent, /inteiro/);
});

test('filtro inválido tem descrição/aria-invalid/anúncio e refresh não amplia comparação nem perde badInput', async () => {
  const h = harness(); await h.open(); const field = h.node('[data-progress-reps]'); field.value = '2.5'; field.oninput();
  assert.equal(field.getAttribute('aria-invalid'), 'true');
  const error = h.node('[data-progress-filter-error]'); assert.match(error.textContent, /inteiro/);
  assert.equal(error.getAttribute('role'), 'status'); assert.equal(error.getAttribute('aria-live'), 'polite');
  assert.ok(field.getAttribute('aria-describedby').split(' ').includes(error.getAttribute('id')));
  field.value = ''; field.validity.badInput = true; field.oninput();
  const refresh = h.view.load(); h.requests[1].resolve({ data: records() }); await refresh;
  assert.equal(h.node('[data-progress-reps]'), field); assert.equal(field.getAttribute('aria-invalid'), 'true');
  assert.equal(h.node('[data-progress-series]').innerHTML, '');
  field.validity.badInput = false; field.value = '10'; field.oninput(); assert.equal(field.getAttribute('aria-invalid'), 'false'); assert.equal(error.textContent, '');
});

test('respostas capturadas não afetam conta, geração, epoch ou âncoras alteradas', async () => {
  for (const changed of ['account', 'role', 'generation', 'localEpoch', 'remoteEpoch', 'page', 'status', 'button', 'content']) {
    const h = harness(), pending = h.view.render(h.container); const status = h.node('[data-progress-status]'), before = status.textContent;
    if (changed === 'account') h.Auth.user.id = 8; if (changed === 'role') h.Auth.user.role = 'instructor';
    if (changed === 'generation') h.Auth.generation += 2; if (changed === 'localEpoch') h.Auth.sessionEpoch = 'new';
    if (changed === 'remoteEpoch') h.remoteEpoch('new');
    if (['page', 'status', 'content'].includes(changed)) h.replace('[data-progress-' + changed + ']');
    if (changed === 'button') h.replace('[data-progress-refresh]');
    h.requests[0].resolve({ data: records() }); await pending;
    assert.equal(h.view.data, null, changed); assert.equal(status.textContent, before, changed);
  }
});

test('callback de controles/página substituídos não filtra nem dispara consulta ou navegação na tela nova', async () => {
  const h = harness(); await h.open(); const oldSelect = h.node('[data-progress-exercise]'), oldRefresh = h.node('[data-progress-refresh]'), oldLegacy = h.node('[data-progress-legacy]');
  await h.open(records(9)); oldSelect.value = '3'; oldSelect.onchange({ target: oldSelect });
  const possibleRead = oldRefresh.onclick(); if (h.requests.length > 2) h.requests.at(-1).resolve({ data: records(9) }); await possibleRead;
  oldLegacy.onclick(); assert.equal(h.view.selectedId, 9); assert.equal(h.requests.length, 2); assert.deepEqual(h.events, []);
});

test('leitura anterior não libera botão nem sobrescreve nova navegação enquanto a consulta nova aguarda', async () => {
  for (const rejected of [false, true]) {
    const h = harness(), old = h.view.render(h.container), fresh = h.view.render(h.container);
    const button = h.node('[data-progress-refresh]'), status = h.node('[data-progress-status]');
    if (rejected) h.requests[0].reject(new Error('Falha da tela antiga')); else h.requests[0].resolve({ data: records(3) });
    await old; assert.equal(button.disabled, true); assert.match(status.textContent, /Consultando/); assert.equal(h.view.data, null);
    h.requests[1].resolve({ data: records(9) }); await fresh;
    assert.equal(button.disabled, false); assert.equal(h.view.selectedId, 9);
  }
});

test('falha libera somente botão atual e preserva filtros/dados confirmados, permitindo retry', async () => {
  const h = harness(); await h.open(); const reps = h.node('[data-progress-reps]'); reps.value = '10'; reps.oninput();
  const failed = h.view.load(); h.requests[1].reject(new Error('Prazo excedido')); await failed;
  assert.equal(h.node('[data-progress-reps]'), reps); assert.equal(reps.value, '10'); assert.match(h.node('[data-progress-status]').textContent, /não foram atualizados/);
  assert.equal(h.node('[data-progress-refresh]').disabled, false);
  const retry = h.view.load(); h.requests[2].resolve({ data: records() }); await retry; assert.equal(h.requests.length, 3); assert.equal(reps.value, '10');
});

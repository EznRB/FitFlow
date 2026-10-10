const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const training = require('../../client/js/training-store');
const source = fs.readFileSync(path.resolve(__dirname, '../../client/js/sessoes.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const workout = { id: 2, name: 'Ficha salva', exercises: [{ id: 3, name: 'Supino', sets: 3, reps: '8–12' }] };

// Small DOM fixture retains nodes and typed values; assigning active HTML rebuilds its form.
function container() {
  const nodes = new Map();
  const node = selector => {
    if (nodes.has(selector)) return nodes.get(selector);
    const item = { dataset: {}, attributes: {}, textContent: '', hidden: false, disabled: false, writes: 0,
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] ?? null; },
      insertAdjacentHTML(position, value) { this.html += value; },
      querySelector(query) {
        if (query === '[data-set-form]') return this.form || null;
        return node(query);
      }, querySelectorAll: () => [] };
    Object.defineProperty(item, 'innerHTML', { get: () => item.html || '', set: value => {
      item.html = value; item.writes++;
      if (selector === '[data-active-session]') item.form = value.includes('data-set-form') ? {
        elements: Object.fromEntries(['exerciseId', 'kind', 'weightKg', 'reps', 'rir', 'notes'].map(name => [name, { value: name === 'exerciseId' ? '3' : '' }])),
        querySelector: query => node(query), reportValidity: () => true,
      } : null;
    } });
    nodes.set(selector, item); return item;
  };
  const dom = { isConnected: true, nodes, node,
    querySelector: selector => selector === '[data-set-form]' ? node('[data-active-session]').form || null : node(selector),
    querySelectorAll: () => [] };
  Object.defineProperty(dom, 'innerHTML', { get: () => dom.html || '', set: value => {
    dom.html = value;
    const button = node('[data-sync]');
    button.disabled = /data-sync disabled/.test(value);
    button.setAttribute('aria-busy', button.disabled ? 'true' : 'false');
  } });
  return dom;
}
function fixture({ online = true } = {}) {
  const rows = new Map(), requests = [], listeners = {}; let failNextRead = false, heldRead = null;
  const storage = { read: async id => { if (heldRead) { const held = heldRead; heldRead = null; return held.promise; } if (failNextRead) { failNextRead = false; throw new Error('IndexedDB transitoriamente indisponível'); } return structuredClone(rows.get(id) || null); }, clear: async id => rows.delete(id),
    update: async (id, fn) => { const value = fn(structuredClone(rows.get(id) || null)); rows.set(id, structuredClone(value)); return structuredClone(value); } };
  const Auth = { user: { id: 7, role: 'student' }, generation: 1, sessionEpoch: 'fixture', getSessionEpoch: () => Auth.sessionEpoch };
  let uuid = 0;
  const context = vm.createContext({ Auth, navigator: { onLine: online }, FitFlowSecurity: { escapeHtml: value => String(value) },
    FitFlowTrainingStore: { ...training, createTrainingStore: options => training.createTrainingStore({ ...options, storage, isOnline: () => false,
      uuid: () => `7ba13137-8849-48e1-baba-${String(++uuid).padStart(12, '0')}`, now: () => new Date('2026-10-10T10:00:00Z') }) },
    API: { get: endpoint => { const request = { endpoint, ...deferred() }; requests.push(request); return request.promise; }, post: async () => { throw new Error('No writes in fixture'); } },
    window: { addEventListener(name, callback) { listeners[name] = callback; } } });
  vm.runInContext(`${source}\nglobalThis.view = SessoesView;`, context);
  return { view: context.view, Auth, rows, requests, context, listeners,
    failRead() { failNextRead = true; },
    holdRead() { const held = deferred(); heldRead = held; return held; },
    success(batch = requests.slice(-2), workouts = [], sessions = []) {
      batch.find(request => request.endpoint === '/treinos/meus').resolve({ data: workouts });
      batch.find(request => request.endpoint === '/sessoes/mine').resolve({ data: { sessions, summary7Days: null } });
    } };
}

test('primeira consulta mostra espera, bloqueia botão e só confirma vazio após ambos os resultados', async () => {
  const h = fixture(), dom = container(), rendering = h.view.render(dom); await tick();
  assert.equal(h.requests.length, 2);
  const button = dom.node('[data-sync]');
  assert.equal(button.disabled, true); assert.equal(button.getAttribute('aria-busy'), 'true'); assert.match(button.textContent, /Atualizando/);
  assert.match(dom.node('[data-workouts-empty]').textContent, /Consultando/);
  assert.match(dom.node('[data-history-empty]').textContent, /Consultando/);
  assert.ok(!dom.node('[data-session-history]').innerHTML.includes('Sua primeira sessão'));
  h.success(); await rendering;
  assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-busy'), 'false'); assert.equal(button.textContent, 'Sincronizar');
  assert.match(dom.node('[data-workouts-empty]').textContent, /Nenhuma ficha encontrada/);
  assert.match(dom.node('[data-history-empty]').textContent, /Sua primeira sessão/);
  assert.match(dom.node('[data-workouts-query]').textContent, /atualizadas/);
});

test('cache de fichas e histórico continua visível durante consulta e falha sem ser declarado completo', async () => {
  const h = fixture(), store = await h.view.ensureStore(); await store.cacheWorkouts([workout]);
  await store.mergeHistory([{ id: 'done', status: 'completed', clientStartedAt: '2026-10-09T10:00:00Z', planSnapshot: workout, sets: [], summary: null }]);
  const dom = container(), rendering = h.view.render(dom); await tick();
  assert.match(dom.node('[data-workouts]').innerHTML, /Ficha salva/); assert.match(dom.node('[data-session-history]').innerHTML, /Ficha salva/);
  for (const request of h.requests) request.reject(new Error('O servidor demorou; resultado não confirmado.'));
  await rendering;
  assert.match(dom.node('[data-workouts-query]').textContent, /Não foi possível.*dispositivo/);
  assert.match(dom.node('[data-history-query]').textContent, /indisponível.*dispositivo/);
  assert.match(dom.node('[data-workouts]').innerHTML, /Ficha salva/); assert.match(dom.node('[data-session-history]').innerHTML, /Ficha salva/);
  assert.equal((await store.state()).sessions[0].id, 'done'); assert.equal(dom.node('[data-sync]').disabled, false);
});

test('êxitos parciais confirmam vazio somente no recurso que respondeu, nunca no histórico indisponível', async () => {
  for (const successTopic of ['workouts', 'history']) {
    const h = fixture(), dom = container(), rendering = h.view.render(dom); await tick();
    const workouts = h.requests.find(request => request.endpoint === '/treinos/meus'), history = h.requests.find(request => request.endpoint === '/sessoes/mine');
    if (successTopic === 'workouts') { workouts.resolve({ data: [] }); history.reject(new Error('timeout')); }
    else { workouts.reject(new Error('timeout')); history.resolve({ data: { sessions: [], summary7Days: null } }); }
    await rendering;
    assert.equal(dom.node('[data-sync]').disabled, false);
    assert.match(dom.node('[data-workouts-empty]').textContent, successTopic === 'workouts' ? /Nenhuma ficha encontrada/ : /salva neste dispositivo.*não.*confirmadas/);
    assert.match(dom.node('[data-history-empty]').textContent, successTopic === 'history' ? /Sua primeira sessão/ : /dispositivo.*não.*confirmado/);
  }
});

test('atualização preserva formulário digitado, sessão ativa e UUIDs da fila', async () => {
  const h = fixture(), store = await h.view.ensureStore(), active = await store.start(workout);
  const dom = container(), rendering = h.view.render(dom); await tick();
  const section = dom.node('[data-active-session]'), form = section.form, beforeWrites = section.writes;
  form.elements.weightKg.value = '42.5'; form.elements.reps.value = '9'; form.elements.notes.value = 'Nota ainda não salva';
  const before = await store.state(); h.success(); await rendering;
  assert.equal(section.form, form); assert.equal(section.writes, beforeWrites);
  assert.equal(form.elements.weightKg.value, '42.5'); assert.equal(form.elements.notes.value, 'Nota ainda não salva');
  assert.equal((await store.state()).sessions[0].id, active.id); assert.deepEqual((await store.state()).operations, before.operations);
  const refreshing = h.view.refresh(); await tick(); assert.equal(dom.node('[data-sync]').disabled, true);
  h.success(); await refreshing; assert.equal(section.form, form); assert.equal(dom.node('[data-sync]').disabled, false);
});

test('resposta de navegação/conta antiga não muda consulta nem libera botão da tela nova', async () => {
  const h = fixture(), oldDom = container(), oldRender = h.view.render(oldDom); await tick(); const oldRequests = h.requests.slice();
  h.view.destroy(); h.Auth.user = { id: 8, role: 'student' }; h.Auth.generation++;
  const newDom = container(), newRender = h.view.render(newDom); await tick();
  h.success(oldRequests, [{ ...workout, name: 'Ficha de outra conta' }]); await oldRender;
  assert.equal(newDom.node('[data-sync]').disabled, true); assert.match(newDom.node('[data-workouts-empty]').textContent, /Consultando/);
  assert.ok(!newDom.node('[data-workouts]').innerHTML.includes('outra conta'));
  h.success(); await newRender; assert.equal(newDom.node('[data-sync]').disabled, false);
  assert.ok(!(await h.view.store.state()).workouts.some(item => item.name === 'Ficha de outra conta'));
});

test('offline sem cache informa limite local em vez de ausência confirmada no servidor', async () => {
  const h = fixture({ online: false }), dom = container(); await h.view.render(dom);
  assert.equal(h.requests.length, 0); assert.equal(dom.node('[data-sync]').disabled, false);
  assert.match(dom.node('[data-workouts-empty]').textContent, /salva neste dispositivo.*não.*confirmadas/);
  assert.match(dom.node('[data-history-empty]').textContent, /dispositivo.*não.*confirmado/);
  assert.match(dom.node('[data-history-query]').textContent, /Sem conexão/);
});

test('leitura local inicial falha, libera botão e permite sincronizar após recuperação do armazenamento', async () => {
  const h = fixture(), dom = container(); h.failRead(); await h.view.render(dom);
  assert.equal(h.requests.length, 0);
  const button = dom.node('[data-sync]');
  assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-busy'), 'false'); assert.equal(button.textContent, 'Sincronizar');
  assert.match(dom.node('[data-session-error]').textContent, /IndexedDB/);
  assert.match(dom.node('[data-history-query]').textContent, /indisponível/);
  const retry = button.onclick(); await tick(); assert.equal(h.requests.length, 2); assert.equal(button.disabled, true);
  h.success(); await retry; assert.equal(button.disabled, false); assert.equal(dom.node('[data-session-error]').hidden, true);
  assert.match(dom.node('[data-history-empty]').textContent, /Sua primeira sessão/);
});

test('falha antes de instalar store também permite tentar de novo sem depender de current()', async () => {
  const h = fixture(), dom = container(), ensureStore = h.view.ensureStore.bind(h.view); let first = true;
  h.view.ensureStore = async () => { if (first) { first = false; throw new Error('Armazenamento local indisponível'); } return ensureStore(); };
  await h.view.render(dom); assert.equal(h.view.store, null);
  const button = dom.node('[data-sync]'); assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-busy'), 'false');
  assert.match(dom.node('[data-session-error]').textContent, /Armazenamento local/);
  const retry = button.onclick(); await tick(); assert.equal(button.disabled, true); assert.equal(button.getAttribute('aria-busy'), 'true'); h.success(); await retry;
  assert.equal(button.disabled, false); assert.ok(h.view.store); assert.equal(dom.node('[data-session-error]').hidden, true);
});

test('falha inicial tardia não escreve erro nem desbloqueia botão da nova navegação/conta', async () => {
  const h = fixture(), held = deferred(), ensureStore = h.view.ensureStore.bind(h.view); let first = true;
  h.view.ensureStore = () => { if (first) { first = false; return held.promise; } return ensureStore(); };
  const oldDom = container(), oldRender = h.view.render(oldDom); await tick();
  h.view.destroy(); h.Auth.user = { id: 8, role: 'student' }; h.Auth.generation++;
  const newDom = container(), newRender = h.view.render(newDom); await tick();
  held.reject(new Error('Falha local da conta antiga')); await oldRender;
  assert.equal(newDom.node('[data-sync]').disabled, true); assert.equal(newDom.node('[data-sync]').getAttribute('aria-busy'), 'true');
  assert.equal(newDom.node('[data-session-error]').textContent, ''); assert.match(newDom.node('[data-history-empty]').textContent, /Consultando/);
  h.success(); await newRender; assert.equal(newDom.node('[data-sync]').disabled, false);
});

test('evento online inicia atualização; falha da leitura inicial anterior não substitui busy nem consulta corrente', async () => {
  const h = fixture(), held = h.holdRead(), dom = container(), rendering = h.view.render(dom); await tick();
  const refresh = h.view.refresh.bind(h.view); let onlineRefresh;
  h.view.refresh = () => { onlineRefresh = refresh(); return onlineRefresh; };
  h.listeners.online(); await tick(); assert.equal(h.requests.length, 2);
  const button = dom.node('[data-sync]'); assert.equal(button.disabled, true); assert.equal(button.getAttribute('aria-busy'), 'true');
  held.reject(new Error('Falha da leitura local anterior')); await rendering;
  assert.ok(h.view.syncing); assert.equal(button.disabled, true); assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.match(dom.node('[data-workouts-query]').textContent, /Consultando/); assert.match(dom.node('[data-history-query]').textContent, /Consultando/);
  assert.equal(dom.node('[data-session-error]').textContent, '');
  h.success(); await onlineRefresh; assert.equal(button.disabled, false); assert.equal(button.getAttribute('aria-busy'), 'false');
  assert.match(dom.node('[data-history-empty]').textContent, /Sua primeira sessão/);
});

test('atualização online concluída mantém resultado confirmado quando leitura inicial rejeita depois', async () => {
  const h = fixture(), held = h.holdRead(), dom = container(), rendering = h.view.render(dom); await tick();
  const refresh = h.view.refresh.bind(h.view); let onlineRefresh;
  h.view.refresh = () => { onlineRefresh = refresh(); return onlineRefresh; };
  h.listeners.online(); await tick(); h.success(); await onlineRefresh;
  const beforeWorkouts = dom.node('[data-workouts-query]').textContent, beforeHistory = dom.node('[data-history-query]').textContent;
  held.reject(new Error('Erro local antigo depois do êxito')); await rendering;
  assert.equal(dom.node('[data-workouts-query]').textContent, beforeWorkouts); assert.equal(dom.node('[data-history-query]').textContent, beforeHistory);
  assert.match(beforeWorkouts, /atualizadas/); assert.match(beforeHistory, /consultado/);
  assert.equal(dom.node('[data-session-error]').textContent, ''); assert.equal(dom.node('[data-sync]').disabled, false);
  assert.equal(h.requests.length, 2);
});

test('cache inicial antigo não substitui ficha atual nem recria formulário digitado após atualização online', async () => {
  const h = fixture(), held = h.holdRead(), dom = container(); let rendered = false;
  const rendering = h.view.render(dom).then(() => { rendered = true; }); await tick();
  const refresh = h.view.refresh.bind(h.view); let onlineRefresh;
  h.view.refresh = () => { onlineRefresh = refresh(); return onlineRefresh; };
  h.listeners.online(); await tick();
  const currentWorkout = { ...workout, name: 'Ficha atual do servidor' };
  h.success(undefined, [currentWorkout], [{ id: 'current-active', status: 'active', clientStartedAt: '2026-10-10T10:00:00Z', planSnapshot: currentWorkout, sets: [] }]);
  await onlineRefresh;
  const section = dom.node('[data-active-session]'), form = section.form, writes = section.writes;
  form.elements.weightKg.value = '42.5'; form.elements.notes.value = 'Texto escrito após a consulta';
  held.resolve({ userId: 7, workouts: [{ ...workout, name: 'Ficha antiga do cache' }], sessions: [], operations: [], nextSequence: 1 }); await tick();
  assert.equal(h.requests.length, 2, 'leitura superada não inicia outra atualização'); assert.equal(rendered, true);
  assert.equal(h.view.workouts[0].name, 'Ficha atual do servidor'); assert.equal(section.form, form); assert.equal(section.writes, writes);
  assert.equal(form.elements.weightKg.value, '42.5'); assert.equal(form.elements.notes.value, 'Texto escrito após a consulta');
  assert.equal((await h.view.store.state()).sessions[0].id, 'current-active');
  await rendering;
});

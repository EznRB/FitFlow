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
      }, querySelectorAll: () => item.buttons || [], contains: button => (item.buttons || []).includes(button) };
    Object.defineProperty(item, 'innerHTML', { get: () => item.html || '', set: value => {
      item.html = value; item.writes++;
      if (selector === '[data-workouts]') item.buttons = [...value.matchAll(/data-start="(\d+)"/g)].map(match => ({ dataset: { start: match[1] }, isConnected: true }));
      if (selector === '[data-active-session]') {
        if (item.form) item.form.isConnected = false;
        item.form = value.includes('data-set-form') ? {
          isConnected: true,
          elements: Object.fromEntries(['exerciseId', 'kind', 'weightKg', 'reps', 'rir', 'notes'].map(name => [name, { value: name === 'exerciseId' ? '3' : name === 'kind' ? 'working' : '' }])),
          querySelector: query => node(query), reportValidity() { return this.elements.exerciseId.value !== ''; },
        } : null;
        if (item.form) {
          const select = item.form.elements.exerciseId;
          Object.defineProperty(select, 'innerHTML', { get: () => select.html || '', set: html => {
            select.html = html; select.value = html.match(/<option value="([^"]*)"/)?.[1] || '';
          } });
        }
      }
    } });
    nodes.set(selector, item); return item;
  };
  const dom = { isConnected: true, nodes, node,
    querySelector: selector => selector === '[data-set-form]' ? node('[data-active-session]').form || null : node(selector),
    querySelectorAll: selector => selector === '[data-start]' ? node('[data-workouts]').buttons || [] : [] };
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

test('botão de ficha captura o plano exibido durante refresh e callback substituído não inicia sessão', async () => {
  const h = fixture(), dom = container(), old = { ...workout, name: 'Ficha A exibida' }, newer = { ...workout, id: 8, name: 'Ficha B nova' };
  const rendering = h.view.render(dom); await tick(); h.success(undefined, [old]); await rendering;
  const button = dom.node('[data-workouts]').buttons[0], held = deferred();
  h.view.store.mergeHistory = () => held.promise;
  const started = []; h.view.store.start = async plan => started.push(plan); h.view.afterMutation = async () => {};
  const refreshing = h.view.refresh(); await tick(); h.success(undefined, [newer]); await tick();
  assert.match(dom.node('[data-workouts]').innerHTML, /Ficha A exibida/);
  await button.onclick(); assert.equal(started[0].id, old.id); assert.equal(started[0].name, old.name);
  held.resolve(); await refreshing;
  await button.onclick(); assert.equal(started.length, 1, 'botão removido não pode iniciar outra sessão');
});

test('início que remove o botão continua a sincronização sem reconstruir um rascunho recém-digitado', async () => {
  const h = fixture({ online: false }), dom = container(), store = await h.view.ensureStore(); await store.cacheWorkouts([workout]);
  await h.view.render(dom); const start = store.start.bind(store); let form, refreshes = 0;
  store.start = async plan => { const result = await start(plan); form = dom.node('[data-active-session]').form; form.elements.notes.value = 'Digitado após iniciar'; return result; };
  h.view.refresh = async () => { refreshes++; };
  await dom.node('[data-workouts]').buttons[0].onclick();
  assert.equal(refreshes, 1); assert.equal(dom.node('[data-active-session]').form, form);
  assert.equal(form.elements.notes.value, 'Digitado após iniciar');
});

async function activeFormFixture() {
  const h = fixture(), dom = container(), store = await h.view.ensureStore();
  await store.cacheWorkouts([workout]); const active = await store.start(workout);
  const rendering = h.view.render(dom); await tick(); h.success(undefined, [workout], [{ ...active, sets: [] }]); await rendering;
  const form = dom.node('[data-active-session]').form;
  form.elements.weightKg.value = '42.5'; form.elements.reps.value = '9'; form.elements.rir.value = '2'; form.elements.notes.value = 'Rascunho';
  return { h, dom, store, active, form };
}

test('snapshot canônico preserva exercício por ID e atualiza prescrição sem apagar rascunho', async () => {
  const { h, dom, active, form } = await activeFormFixture();
  const revised = { ...workout, exercises: [{ ...workout.exercises[0], name: 'Supino revisado', sets: 5, restSeconds: 90 }] };
  const refresh = h.view.refresh(); await tick(); h.success(undefined, [revised], [{ ...active, planSnapshot: revised, sets: [] }]); await refresh;
  assert.equal(dom.node('[data-active-session]').form, form); assert.equal(form.elements.exerciseId.value, '3');
  assert.equal(form.elements.weightKg.value, '42.5'); assert.equal(form.elements.notes.value, 'Rascunho');
  assert.match(dom.node('[data-prescription]').textContent, /5 séries.*90s/);
});

test('exercício removido exige escolha explícita sem atribuir os valores a outro por nome ou posição', async () => {
  const { h, dom, store, active, form } = await activeFormFixture();
  const revised = { ...workout, exercises: [{ ...workout.exercises[0], id: 40 }] };
  const refresh = h.view.refresh(); await tick(); h.success(undefined, [revised], [{ ...active, planSnapshot: revised, sets: [] }]); await refresh;
  assert.equal(dom.node('[data-active-session]').form, form); assert.equal(form.elements.exerciseId.value, '');
  assert.match(form.elements.exerciseId.innerHTML, /value="40"/); assert.match(dom.node('[data-session-plan-change]').textContent, /removido.*preservad/i);
  const before = (await store.state()).operations.length;
  await form.onsubmit({ preventDefault() {} }); assert.equal((await store.state()).operations.length, before);
  assert.equal(form.elements.weightKg.value, '42.5'); assert.equal(form.elements.notes.value, 'Rascunho');
  form.elements.exerciseId.value = '40'; form.elements.exerciseId.onchange(); assert.match(dom.node('[data-prescription]').textContent, /3 séries/);
});

test('envio de série não duplica e resposta preserva valores editados enquanto addSet aguarda', async () => {
  const { h, dom, store, form } = await activeFormFixture(); const held = deferred(), submissions = [];
  store.addSet = (id, values) => { submissions.push({ id, values }); return held.promise; };
  const first = form.onsubmit({ preventDefault() {} }), second = form.onsubmit({ preventDefault() {} }); await tick();
  assert.equal(submissions.length, 1); assert.equal(submissions[0].values.notes, 'Rascunho');
  form.elements.notes.value = 'Nova nota enquanto salva'; form.elements.weightKg.value = '50';
  held.resolve(); await tick(); h.success(undefined, [workout]); await Promise.all([first, second]);
  assert.equal(dom.node('[data-active-session]').form, form); assert.equal(form.elements.notes.value, 'Nova nota enquanto salva');
  assert.equal(form.elements.weightKg.value, '50'); assert.equal(dom.node('[type="submit"]').disabled, false);
});

test('resposta antiga de addSet não toca feedback, campos ou botão de formulário substituído', async () => {
  const { h, dom, store, form } = await activeFormFixture(), held = deferred();
  store.addSet = () => held.promise;
  const sending = form.onsubmit({ preventDefault() {} }); await tick();
  h.view.draw(await store.state()); const fresh = dom.node('[data-active-session]').form;
  fresh.elements.notes.value = 'Novo formulário'; const feedback = dom.node('[data-set-feedback]'); feedback.textContent = 'Estado atual';
  const button = dom.node('[type="submit"]'); button.disabled = true;
  held.resolve(); await tick(); if (h.requests.length > 2) h.success(); await sending;
  assert.equal(fresh.elements.notes.value, 'Novo formulário'); assert.equal(feedback.textContent, 'Estado atual');
  assert.equal(button.disabled, true); assert.equal(h.requests.length, 2);
});

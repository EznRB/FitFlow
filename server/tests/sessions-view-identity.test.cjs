const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const training = require('../../client/js/training-store.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const state = id => ({ userId: id, workouts: [], sessions: [], operations: [], nextSequence: 1 });
function container() { return { isConnected: true, innerHTML: '', querySelector: selector => selector === '[data-set-form]' ? null : {}, querySelectorAll: () => [] }; }
function fixture() {
  const records = new Map(), reads = [], callbacks = [], stores = [], guards = [], listeners = {};
  let heldRead = null, epoch = 'initial';
  const storage = { read: async id => { reads.push(id); if (heldRead?.id === id) { const held = heldRead; heldRead = null; return held.promise; } return records.get(id) || state(id); },
    update: async (id, fn) => { const value = fn(records.get(id) || state(id)); records.set(id, value); return value; }, clear: async id => records.delete(id) };
  const Auth = { user: { id: 1, role: 'student' }, generation: 1, sessionEpoch: 'initial', getSessionEpoch: () => epoch };
  const context = vm.createContext({ console, navigator: { onLine: false }, Auth, FitFlowSecurity: { escapeHtml: value => String(value) },
    API: { get: async () => { throw new Error('No cloud calls in fixture'); }, post: async () => ({ data: {} }) },
    FitFlowTrainingStore: { ...training, createTrainingStore: options => { callbacks.push(options.onChange); guards.push(options.isCurrentUser); const store = training.createTrainingStore({ ...options, storage, isOnline: () => false }); stores.push(store); return store; } },
    window: { addEventListener: (name, callback) => { listeners[name] = callback; } } });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../client/js/sessoes.js'), 'utf8') + '\nglobalThis.view = SessoesView;', context);
  const view = context.view, realDraw = view.draw.bind(view), draws = [], errors = [], changes = [];
  view.draw = value => draws.push({ account: Auth.user?.id, value });
  view.error = message => { if (message) errors.push(message); };
  view.updateIndicators = value => changes.push(value.userId);
  return { view, Auth, reads, draws, errors, callbacks, stores, guards, changes, context, listeners, realDraw,
    hold: id => { const held = deferred(); heldRead = { id, ...held }; return held; },
    epoch: value => { epoch = value; Auth.sessionEpoch = value; }, remoteEpoch: value => { epoch = value; },
    async render(id = Auth.user.id) { Auth.user = { id, role: 'student' }; await view.render(container()); } };
}

test('refresh IDB antigo não desenha nem mostra erro em B; B não espera a operação de A', async () => {
  const h = fixture(); await h.render(); h.draws.length = 0; h.errors.length = 0;
  const held = h.hold(1), old = h.view.refresh(); await tick();
  await h.view.logout('expired', 1); h.Auth.generation++; h.epoch('new');
  const before = h.reads.filter(id => id === 2).length; await h.render(2);
  assert.ok(h.reads.filter(id => id === 2).length - before >= 2, 'B deve poder carregar e atualizar enquanto A aguarda');
  held.resolve(state(1)); await old;
  assert.ok(h.draws.every(draw => draw.account === 2 && draw.value.userId === 2)); assert.deepEqual(h.errors, []);
});

test('navegação de ida e volta rejeita refresh antigo mesmo usando a mesma conta e store', async () => {
  const h = fixture(); await h.render();
  const held = h.hold(1), old = h.view.refresh(); await tick();
  h.view.destroy(); await h.render(); h.draws.length = 0;
  held.resolve(state(1)); await old; assert.equal(h.draws.length, 0);
});

test('callback de store antigo não atualiza a conta nova nem uma geração nova da mesma conta', async () => {
  for (const nextId of [1, 2]) {
    const h = fixture(); await h.render(); const oldCallback = h.callbacks[0];
    await h.view.logout('expired', 1); h.Auth.generation++; h.epoch('new'); await h.render(nextId);
    h.changes.length = 0; oldCallback(state(1)); assert.deepEqual(h.changes, []);
  }
});

test('ensureStore concorrente não reinstala a conta capturada antes de uma troca', async () => {
  const h = fixture(), disposal = deferred();
  h.view.userId = 99; h.view.store = { dispose: () => disposal.promise };
  const old = h.view.ensureStore(); const settled = old.then(value => value, error => error);
  h.Auth.user = { id: 2, role: 'student' }; h.Auth.generation++; h.epoch('new');
  const newer = h.view.ensureStore(); disposal.resolve(); await Promise.all([settled, newer]);
  assert.equal(h.view.userId, 2); assert.equal(h.stores.length, 1, 'não criar store A depois da troca');
});

test('ensureStore reutiliza só a geração e epoch atuais; mudança de epoch impede envios antigos', async () => {
  const h = fixture(); await h.render(); const old = h.view.store;
  h.Auth.generation++; h.epoch('new'); const next = await h.view.ensureStore();
  assert.notEqual(old, next); h.epoch('another-tab');
  assert.equal(h.guards.at(-1)(), false, 'store não envia com epoch obsoleto mesmo antes do storage event');
  // O callback antigo também não deve atingir uma tela que conserva o mesmo ID.
  h.changes.length = 0; h.callbacks.at(-1)(state(1)); assert.deepEqual(h.changes, []);
});

test('offline listener iniciado antes da navegação não aplica leitura na tela que abriu depois', async () => {
  const h = fixture(); await h.render(); const held = h.hold(1);
  h.listeners.offline(); await tick(); h.view.destroy(); await h.render(); h.changes.length = 0;
  held.resolve(state(1)); await tick(); assert.deepEqual(h.changes, []);
});

test('finalização pendente mantém o store de origem e não consulta nem atualiza B', async () => {
  const h = fixture(); await h.render(); const completion = deferred(), button = {};
  const original = h.view.store; original.complete = () => completion.promise;
  const section = { innerHTML: '', querySelector: selector => selector === '[data-complete]' ? button : selector === '[data-set-form]' ? null : {} };
  h.view.container = { isConnected: true, querySelector: selector => selector === '[data-active-session]' ? section : {}, querySelectorAll: () => [] };
  h.realDraw({ ...state(1), sessions: [{ id: 'active-a', status: 'active', clientStartedAt: '2026-10-07T10:00:00Z', planSnapshot: { name: 'A', exercises: [] }, sets: [] }] });
  const action = button.onclick(); await tick();
  await h.view.logout('expired', 1); h.Auth.generation++; h.epoch('new'); await h.render(2);
  h.draws.length = 0; const before = h.reads.length;
  completion.resolve({ status: 'completed' }); await action;
  assert.equal(h.reads.length, before); assert.deepEqual(h.draws, []); assert.deepEqual(h.errors, []);
});

test('leitura após mutação concluída não redesenha uma navegação mais nova', async () => {
  const h = fixture(); await h.render();
  const context = h.view.context(), held = h.hold(1), continuation = h.view.afterMutation(context); await tick();
  h.view.destroy(); await h.render(); h.draws.length = 0;
  held.resolve(state(1)); await continuation; assert.deepEqual(h.draws, []);
});

test('login rápido na mesma conta aguarda limpeza explícita e não perde a fila nova', async () => {
  const h = fixture(); await h.render(); const disposal = deferred(), old = h.view.store, dispose = old.dispose.bind(old);
  old.dispose = async options => { await disposal.promise; await dispose(options); };
  const leaving = h.view.logout('explicit', 1);
  h.Auth.generation++; h.epoch('new');
  let opened = false; const entering = h.view.ensureStore().then(store => { opened = true; return store; });
  await tick(); assert.equal(opened, false, 'nova fila da mesma conta não pode abrir antes da limpeza anterior');
  disposal.resolve(); await leaving; const next = await entering;
  const workout = { id: 2, name: 'Ficha nova', exercises: [{ id: 3, name: 'Supino', sets: 3, reps: '8–12' }] };
  await next.start(workout); assert.equal((await next.state()).operations.length, 1);
});

test('limpeza atrasada da conta A não bloqueia a abertura da conta B', async () => {
  const h = fixture(); await h.render(); const disposal = deferred(), old = h.view.store, dispose = old.dispose.bind(old);
  old.dispose = async options => { await disposal.promise; await dispose(options); };
  const leaving = h.view.logout('explicit', 1);
  h.Auth.user = { id: 2, role: 'student' }; h.Auth.generation++; h.epoch('new');
  await h.view.ensureStore(); assert.equal(h.view.userId, 2);
  disposal.resolve(); await leaving; assert.equal(h.view.userId, 2);
});

test('antes do storage event, epoch de outra aba impede cachear respostas B na conta A', async () => {
  const h = fixture(); await h.render(); const original = h.view.store; let networkReads = 0;
  h.context.navigator.onLine = true; h.remoteEpoch('cookie-now-B');
  h.context.API.get = async endpoint => { networkReads++; return { data: endpoint === '/treinos/meus' ? [{ id: 9, name: 'Treino privado B', exercises: [] }] : { sessions: [], summary7Days: null } }; };
  await h.view.refresh();
  assert.equal(networkReads, 0); assert.equal(h.view.store, original); assert.equal(h.stores.length, 1);
  assert.deepEqual((await original.state()).workouts, []);
  await assert.rejects(h.view.ensureStore(), error => error.obsolete === true);
});

test('listener de logout registra a limpeza pendente para Auth manter o lock entre abas', async () => {
  const h = fixture(); await h.render(); const disposal = deferred(), old = h.view.store, dispose = old.dispose.bind(old);
  old.dispose = async options => { await disposal.promise; await dispose(options); };
  let registered, finished = false;
  h.listeners['auth:logout']({ detail: { reason: 'explicit', userId: 1, waitUntil: promise => { registered = promise; } } });
  assert.equal(typeof registered?.then, 'function'); registered.then(() => { finished = true; });
  await tick(); assert.equal(finished, false);
  disposal.resolve(); await registered; assert.equal(finished, true);
});

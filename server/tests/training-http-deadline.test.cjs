// Real API and training queue, controlled transport/clock. No cloud or private data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const training = require('../../client/js/training-store');
const apiSource = fs.readFileSync(path.resolve(__dirname, '../../client/js/api.js'), 'utf8');
const viewSource = fs.readFileSync(path.resolve(__dirname, '../../client/js/sessoes.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const response = data => new Response(JSON.stringify({ data }));
function harness(fetchImpl) {
  const timers = new Map(), delays = [], requests = [], events = []; let id = 0;
  const Auth = { user: { id: 7, role: 'student' }, generation: 1, sessionEpoch: 'fixture', getSessionEpoch: () => 'fixture' };
  const context = vm.createContext({ Auth, AbortController, navigator: { onLine: true },
    fetch: (url, options) => { requests.push({ url, options }); return fetchImpl(url, options); },
    setTimeout: (callback, ms) => { const key = ++id; timers.set(key, callback); delays.push(ms); return key; },
    clearTimeout: key => timers.delete(key),
    window: { dispatchEvent: event => events.push(event.type), addEventListener() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } } });
  vm.runInContext(`${apiSource}\nglobalThis.api = API;`, context);
  return { context, api: context.api, Auth, timers, delays, requests, events,
    expire() { for (const callback of [...timers.values()]) callback(); } };
}
function observe(promise) {
  const result = { settled: false };
  result.promise = promise.then(value => { result.settled = true; result.value = value; }, error => { result.settled = true; result.error = error; });
  return result;
}
function memoryStorage() {
  const rows = new Map(); let chain = Promise.resolve();
  return { read: async id => structuredClone(rows.get(id) || null), clear: async id => rows.delete(id),
    update(id, fn) { const operation = chain.then(() => { const value = fn(structuredClone(rows.get(id) || null)); rows.set(id, structuredClone(value)); return structuredClone(value); }); chain = operation.catch(() => {}); return operation; } };
}
function sessions(h) {
  const storage = memoryStorage(); let uuid = 0;
  h.context.FitFlowTrainingStore = { ...training, createTrainingStore: options => training.createTrainingStore({ ...options, storage,
    uuid: () => `7ba13137-8849-48e1-baba-${String(++uuid).padStart(12, '0')}`, now: () => new Date('2026-10-10T10:00:00Z'), isOnline: () => true }) };
  vm.runInContext(`${viewSource}\nglobalThis.view = SessoesView;`, h.context);
  return h.context.view;
}

test('deadline solta fetch que ignora abort e descarta 401 tardio sem encerrar sessão', async () => {
  const pending = deferred(), h = harness(() => pending.promise);
  const result = observe(h.api.get('/treinos/meus', { timeoutMs: 15000 }));
  h.expire(); await tick();
  assert.equal(result.settled, true, 'requisição deve terminar mesmo se o transporte ignorar abort');
  assert.equal(result.error.status, 0); assert.equal(result.error.timeout, true);
  assert.match(result.error.message, /demorou.*não.*confirmado/i);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.timers.size, 0);
  pending.resolve(new Response(JSON.stringify({ message: 'old unauthorized' }), { status: 401 })); await tick();
  assert.deepEqual(h.events, []); assert.equal(h.Auth.user.id, 7); assert.equal(result.value, undefined);
});

test('deadline também cobre corpo pendente e ignora corpo 200 ou 401 entregue depois', async () => {
  for (const status of [200, 401]) {
    const body = deferred(), h = harness(async () => ({ ok: status === 200, status, text: () => body.promise }));
    const result = observe(h.api.post('/sessoes/start', { id: 'fixture' }, { timeoutMs: 15000 }));
    await tick(); h.expire(); await tick();
    assert.equal(result.settled, true); assert.equal(result.error.timeout, true); assert.equal(result.error.status, 0);
    body.resolve(JSON.stringify({ data: { id: 'fixture' } })); await tick();
    assert.equal(result.value, undefined); assert.deepEqual(h.events, []); assert.equal(h.timers.size, 0);
  }
});

test('opt-in limpa timer e listener externo; métodos e corpo não são sobrescritos por options', async () => {
  const external = new AbortController(), listeners = new Set();
  const add = external.signal.addEventListener.bind(external.signal), remove = external.signal.removeEventListener.bind(external.signal);
  external.signal.addEventListener = (name, callback, options) => { if (name === 'abort') listeners.add(callback); add(name, callback, options); };
  external.signal.removeEventListener = (name, callback) => { listeners.delete(callback); remove(name, callback); };
  const h = harness(async () => response({ saved: true }));
  const result = await h.api.post('/sessoes/start', { id: 'original' }, { timeoutMs: 60000, signal: external.signal, method: 'DELETE', body: 'replacement' });
  assert.equal(result.data.saved, true); assert.deepEqual(h.delays, [15000]);
  assert.equal(h.requests[0].options.method, 'POST'); assert.equal(h.requests[0].options.body, '{"id":"original"}');
  assert.notEqual(h.requests[0].options.signal, external.signal); assert.equal(h.requests[0].options.timeoutMs, undefined);
  assert.equal(listeners.size, 0); assert.equal(h.timers.size, 0);
});

test('cancelamento externo opt-in rejeita transporte parado e não processa erro tardio', async () => {
  const pending = deferred(), external = new AbortController(), h = harness(() => pending.promise);
  const result = observe(h.api.get('/sessoes/mine', { signal: external.signal, timeoutMs: 15000 }));
  external.abort(); await tick();
  assert.equal(result.settled, true); assert.equal(result.error.status, 0); assert.equal(result.error.timeout, undefined);
  assert.equal(h.requests[0].options.signal.aborted, true); assert.equal(h.timers.size, 0);
  pending.resolve(new Response('{}', { status: 401 })); await tick(); assert.deepEqual(h.events, []);
});

test('login e financeiro sem opt-in conservam espera e resposta reais, sem timer ou controller novo', async () => {
  for (const endpoint of ['/auth/login', '/pagamentos']) {
    const pending = deferred(), h = harness(() => pending.promise), result = observe(h.api.post(endpoint, { fixture: true }));
    h.expire(); await tick(); assert.equal(result.settled, false);
    assert.equal(h.timers.size, 0); assert.equal(h.requests[0].options.signal, undefined);
    pending.resolve(response({ committed: true })); await result.promise; assert.equal(result.value.data.committed, true);
  }
});

test('start, set e complete perdidos mantêm UUID e fila; replay idempotente recebe um único ACK', async () => {
  for (const lostStage of ['start', 'sets', 'complete']) {
    const pending = deferred(), delivered = new Map(), attempts = []; let held = false;
    const h = harness(async (url, options) => {
      const payload = JSON.parse(options.body), key = `${url}:${payload.id || payload.setIds.join(',')}`;
      attempts.push({ url, body: options.body });
      if (!delivered.has(key)) delivered.set(key, payload);
      if (url.endsWith(`/${lostStage}`) && !held) { held = true; return pending.promise; }
      return response(payload);
    });
    const view = sessions(h), store = await view.ensureStore();
    const workout = { id: 2, name: 'Ficha', exercises: [{ id: 3, name: 'Supino', sets: 3, reps: '8–12' }] };
    const session = await store.start(workout);
    await store.addSet(session.id, { exerciseId: 3, weightKg: 20, reps: 10, kind: 'working', rir: null });
    await store.complete(session.id);
    const sending = observe(store.flush());
    for (let i = 0; i < 5 && !held; i++) await tick();
    assert.equal(held, true); h.expire(); await tick();
    assert.equal(sending.settled, true, lostStage);
    const saved = await store.state(), unsent = structuredClone(saved.operations);
    assert.ok(unsent.length >= 1); assert.ok(unsent.every(op => op.status === 'pending'));
    const oldAttempt = attempts.at(-1);
    pending.resolve(response({ id: 'late-reply' })); await tick();
    assert.deepEqual((await store.state()).operations, unsent, 'resposta tardia não remove operações nem confirma a fila');
    await store.flush();
    assert.equal(attempts.filter(item => item.url === oldAttempt.url && item.body === oldAttempt.body).length, 2);
    const final = await store.state(); assert.equal(final.operations.length, 0); assert.equal(final.sessions[0].status, 'completed');
    assert.equal(final.sessions[0].sets.length, 1); assert.equal(final.sessions[0].sets[0].synced, true);
    assert.equal(delivered.size, 3, 'servidor idempotente simulado recebe somente start/set/complete distintos');
    assert.ok(h.delays.every(ms => ms === 15000)); assert.equal(h.timers.size, 0);
  }
});

test('refresh com duas leituras paradas libera syncing e preserva cache, permitindo nova tentativa', async () => {
  let stalled = true;
  const h = harness(async url => stalled ? new Promise(() => {}) : response(url.endsWith('/treinos/meus') ? [] : { sessions: [], summary7Days: null }));
  const view = sessions(h), store = await view.ensureStore(), errors = [];
  await store.cacheWorkouts([{ id: 2, name: 'Ficha offline', exercises: [] }]);
  view.container = { isConnected: true, querySelector: selector => selector === '[data-set-form]' ? null : {} };
  view.draw = () => {}; view.updateIndicators = () => {}; view.error = value => { if (value) errors.push(value); };
  const refresh = observe(view.refresh()); await tick();
  assert.equal(h.requests.length, 2); h.expire(); await tick();
  assert.equal(refresh.settled, true); assert.equal(view.syncing, null);
  assert.equal((await store.state()).workouts[0].name, 'Ficha offline'); assert.ok(errors.some(message => /demorou/.test(message)));
  stalled = false; await view.refresh(); assert.equal(view.syncing, null); assert.equal(h.requests.length, 4);
  assert.equal((await store.state()).workouts.length, 0); assert.equal(h.timers.size, 0);
});

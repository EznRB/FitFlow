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

test('start and completion move focus from removed controls to the next usable content', async () => {
  const h = fixture({ online: false }), dom = container(), document = { activeElement: null };
  h.context.document = document;
  const store = await h.view.ensureStore(); await store.cacheWorkouts([workout]); await h.view.render(dom);
  const start = dom.node('[data-workouts]').buttons[0];
  dom.node('[data-workouts]').contains = target => dom.node('[data-workouts]').buttons.includes(target);
  dom.node('[data-active-session]').contains = target => target === dom.node('[data-complete]');
  dom.node('[data-session-plan-name]').focus = function () { document.activeElement = this; };
  dom.node('[data-workouts]').querySelector = () => dom.node('[data-workouts]').buttons[0] || null;
  const originalNode = dom.node;
  dom.node('[data-active-session]').querySelector = selector => {
    const section = originalNode('[data-active-session]');
    if (selector === '[data-set-form]') return section.form;
    if (selector === '[name="exerciseId"]') return section.form?.elements.exerciseId;
    return originalNode(selector);
  };
  // Focus on fields created by the fixture is observable without browser automation.
  const realUpdate = h.view.updateIndicators.bind(h.view);
  h.view.updateIndicators = state => {
    const select = dom.node('[data-active-session]').form?.elements.exerciseId;
    if (select) select.focus = () => { document.activeElement = select; };
    for (const button of dom.node('[data-workouts]').buttons || []) button.focus = () => { document.activeElement = button; };
    realUpdate(state);
  };
  document.activeElement = start; await start.onclick();
  assert.equal(document.activeElement, dom.node('[data-active-session]').form.elements.exerciseId);
  const complete = dom.node('[data-complete]'); document.activeElement = complete;
  await complete.onclick();
  assert.equal(document.activeElement, dom.node('[data-session-plan-name]'));
  dom.node('[data-active-session]').contains = target => target === dom.node('[data-session-plan-name]');
  const state = await store.state();
  h.view.draw({ ...state, sessions: state.sessions.map(session => ({ ...session, status: 'completed' })) });
  assert.equal(document.activeElement, dom.node('[data-workouts]').buttons[0]);
});

function historyFixture() {
  const h = fixture({ online: false }), document = { activeElement: null };
  h.context.document = document; h.view.current = () => true;
  const slot = { writes: 0, roots: [], contains(target) { return this.roots.some(root => root.contains(target)); },
    querySelectorAll() { return this.roots; }, setAttribute() {}, focus() { document.activeElement = this; } };
  Object.defineProperty(slot, 'innerHTML', { set(html) {
    this.writes++; this.html = html;
    this.roots = [...html.matchAll(/data-history-id="([^"]+)"/g)].map(match => {
      const root = { dataset: { historyId: match[1] }, open: false, contains(target) { return [this, this.summary, this.nested, this.nested.summary, this.link].includes(target); }, querySelector(selector) { return selector === 'summary' ? this.summary : null; } };
      root.nested = { open: false, contains: target => target === root.nested.summary, querySelector: () => root.nested.summary };
      root.summary = { focus() { document.activeElement = this; } };
      root.nested.summary = { focus() { document.activeElement = this; } };
      root.link = { getAttribute: name => name === 'href' ? 'https://example.com/source' : null, focus() { document.activeElement = this; } };
      root.querySelectorAll = selector => selector === 'details' ? [root.nested] : selector === 'a[href]' ? [root.link] : [];
      return root;
    });
  }, get() { return this.html; } });
  h.view.container = { querySelector: selector => selector === '[data-session-history]' ? slot : { innerHTML: '' } };
  const session = { id: 'done', status: 'completed', clientStartedAt: '2026-10-10', planSnapshot: workout, sets: [] };
  return { ...h, slot, document, session };
}

test('unchanged history retains DOM; changed history retains nested disclosures and source focus by session ID', () => {
  const { view, slot, document, session } = historyFixture();
  view.drawHistory({ sessions: [session] });
  assert.equal(slot.roots.length, 1);
  let root = slot.roots[0]; root.open = root.nested.open = true; document.activeElement = root.link;
  view.drawHistory({ sessions: [session] });
  assert.equal(slot.writes, 1); assert.equal(slot.roots[0], root);
  view.drawHistory({ sessions: [{ ...session, summary: { missingPlannedSets: 2 } }] });
  root = slot.roots[0]; assert.equal(root.open, true); assert.equal(root.nested.open, true); assert.equal(document.activeElement, root.link);
  document.activeElement = root.nested.summary;
  view.drawHistory({ sessions: [{ ...session, summary: { missingPlannedSets: 3 } }, { ...session, id: 'newer', clientStartedAt: '2026-10-11' }] });
  root = slot.roots.find(item => item.dataset.historyId === session.id);
  assert.equal(document.activeElement, root.nested.summary); assert.equal(root.nested.open, true);
  view.drawHistory({ sessions: [] }); assert.equal(document.activeElement, slot);
});

test('background history changes never take focus from the set form', () => {
  const { view, slot, document, session } = historyFixture();
  view.drawHistory({ sessions: [session] }); const notes = { value: 'Draft' }; document.activeElement = notes;
  view.drawHistory({ sessions: [{ ...session, status: 'abandoned', abandonedOperations: [] }] });
  assert.equal(document.activeElement, notes); assert.equal(notes.value, 'Draft');
  assert.equal(slot.roots[0].dataset.historyId, session.id);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '../../client/js/password-change.js');
function harness(changePassword) {
  const nodes = new Map(), observers = [], events = new Map(), modals = [], calls = [], messages = [];
  function element(id, attributes = '') {
    const listeners = new Map(), attrs = new Map();
    for (const match of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) attrs.set(match[1], match[2]);
    const node = { id, value: '', textContent: '', disabled: false, isConnected: true,
      type: attrs.get('type'), style: {}, children: [],
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
      async emit(name, event = {}) { for (const fn of listeners.get(name) || []) await fn({ target: node, preventDefault() {}, ...event }); },
      setAttribute(name, value) { attrs.set(name, String(value)); }, getAttribute(name) { return attrs.get(name) ?? null; },
      removeAttribute(name) { attrs.delete(name); }, focus() { context.document.activeElement = node; },
      contains(other) { return this.children.includes(other); },
      querySelector(selector) { return this.children.find(child => `#${child.id}` === selector) ?? null; },
      querySelectorAll(selector) { return this.children.filter(child => selector.includes(child.type === 'password' ? 'input' : 'button')); }
    };
    nodes.set(id, node); return node;
  }
  function eventTarget() { return { addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener(name, fn) { events.get(name)?.delete(fn); },
    dispatch(name, detail) { for (const fn of [...(events.get(name) || [])]) fn({ detail }); } }; }
  const window = eventTarget();
  const Auth = { user: { id: 7, name: '<img src=x onerror=1>', email: '<email>&example.test', role: 'student' }, generation: 3,
    sessionEpoch: 'epoch-7', getSessionEpoch() { return this.sessionEpoch; },
    async changePassword(payload, captured) { calls.push({ payload: { ...payload }, captured });
      if (changePassword) return changePassword(payload, captured, h);
      return { changed: true, requiresLogin: true, userId: 7 };
    } };
  let isOpen = false;
  const Modal = { bodyEl: element('modal-body'), overlay: element('modal-overlay'), closeBtn: element('btn-modal-close'),
    open(title, html, actions) {
      for (const child of this.bodyEl.children) { child.isConnected = false; nodes.delete(child.id); }
      this.bodyEl.children = [];
      for (const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const node = element(match[3], match[2]); this.bodyEl.children.push(node);
      }
      const form = nodes.get('password-change-form');
      if (form) form.children = this.bodyEl.children.filter(node => node !== form);
      isOpen = true; modals.push({ title, html, actions }); flushObservers();
    },
    close() { isOpen = false; for (const node of this.bodyEl.children) { node.isConnected = false; nodes.delete(node.id); }
      this.bodyEl.children = []; flushObservers(); }, isOpen: () => isOpen };
  function flushObservers() { for (const observer of observers) if (observer.connected) observer.callback(); }
  const document = { ...eventTarget(), getElementById: id => nodes.get(id) ?? null, activeElement: null };
  element('page-content');
  const context = vm.createContext({ window, document, Modal, Auth, App: { currentPage: 'sessoes' }, TextEncoder,
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() { this.connected = true; } disconnect() { this.connected = false; } },
    Toast: { error: message => messages.push(['error', message]), success: message => messages.push(['success', message]) },
    localStorage: { getItem() { throw new Error('password UI must not access storage'); }, setItem() { throw new Error('password UI must not write storage'); } },
    sessionStorage: { setItem() { throw new Error('password UI must not write storage'); } } });
  vm.runInContext(fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '', context);
  const h = { module: window.PasswordChange, Auth, context, nodes, modals, calls, messages, window, Modal, flushObservers,
    fill(current = 'old-secret-123', next = 'new-secret-123', confirmation = next) {
      nodes.get('password-change-current').value = current; nodes.get('password-change-new').value = next;
      nodes.get('password-change-confirm').value = confirmation;
    }, submit: () => nodes.get('password-change-form').emit('submit'),
    fields: () => ['current', 'new', 'confirm'].map(id => nodes.get(`password-change-${id}`)) };
  return h;
}

test('open provides escaped account context and accessible password visibility without submitting', async () => {
  const h = harness(); assert.ok(h.module, 'PasswordChange UI is available'); h.module.open();
  assert.match(h.modals[0].html, /&lt;img/); assert.match(h.modals[0].html, /&lt;email&gt;&amp;example\.test/);
  assert.doesNotMatch(h.modals[0].html, /<img|on(?:click|submit)=/);
  assert.equal(h.nodes.get('password-change-current').getAttribute('autocomplete'), 'current-password');
  assert.equal(h.nodes.get('password-change-new').getAttribute('autocomplete'), 'new-password');
  assert.equal(h.nodes.get('password-change-confirm').getAttribute('autocomplete'), 'new-password');
  const toggle = h.nodes.get('password-change-toggle'); assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  await toggle.emit('click'); assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(h.fields().map(field => field.type), ['text', 'text', 'text']);
  await toggle.emit('click'); assert.deepEqual(h.fields().map(field => field.type), ['password', 'password', 'password']);
  assert.equal(h.calls.length, 0);
});

test('validation enforces new length, UTF-8 bytes, distinct encoded password and confirmation', async () => {
  for (const [current, next, confirm] of [
    ['', 'new-secret-123', 'new-secret-123'], ['old-secret-123', 'short', 'short'],
    ['old-secret-123', 'á'.repeat(37), 'á'.repeat(37)], ['old-secret-123', '😀'.repeat(19), '😀'.repeat(19)],
    ['old-secret-123', 'old-secret-123', 'old-secret-123'], ['old-secret-123', 'new-secret-123', 'different-secret'],
    ['\ud8001234567', '\ud8011234567', '\ud8011234567'],
  ]) {
    const h = harness(); h.module.open(); h.fill(current, next, confirm); await h.submit();
    assert.equal(h.calls.length, 0); assert.ok(h.nodes.get('password-change-feedback').textContent);
  }
  const h = harness(); h.module.open(); h.fill('old-secret-123', 'á'.repeat(36)); await h.submit();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].payload.newPassword, 'á'.repeat(36));
});

test('submission captures primitives, prevents duplicates and clears original input nodes after rejection', async () => {
  let reject; const h = harness(() => new Promise((_, no) => { reject = no; })); h.module.open(); h.fill();
  const fields = h.fields(), sending = h.submit(); await h.submit(); assert.equal(h.calls.length, 1);
  assert.deepEqual(Object.keys(h.calls[0].payload).sort(), ['currentPassword', 'newPassword']);
  assert.equal(h.calls[0].captured.userId, 7); assert.equal(h.calls[0].captured.generation, 3);
  assert.equal(h.calls[0].captured.epoch, 'epoch-7'); assert.equal(h.calls[0].captured.isCurrent(), true);
  assert.equal(h.nodes.get('password-change-submit').disabled, true);
  reject(Object.assign(new Error('Senha incorreta'), { status: 400 })); await sending;
  assert.deepEqual(fields.map(field => field.value), ['', '', '']);
  assert.equal(h.nodes.get('password-change-submit').disabled, false);
  assert.ok(h.nodes.get('password-change-feedback').textContent); assert.equal(h.Auth.user.id, 7);
});

test('queued auth operation sees account changes before send and response never touches replacement form', async () => {
  let release, commits = 0;
  const h = harness(async (_, captured) => { await new Promise(resolve => { release = resolve; });
    if (!captured.isCurrent()) throw new Error('interrompido'); commits++; return { changed: true, requiresLogin: true, userId: 7 }; });
  h.module.open(); h.fill(); const oldFields = h.fields(), pending = h.submit();
  h.Auth.user = { id: 8, name: 'Nova conta', email: 'new@example.test', role: 'admin' }; h.Auth.generation++;
  h.module.open(); h.fill('owner-eight-old', 'owner-eight-new'); const newFields = h.fields(); release(); await pending;
  assert.equal(commits, 0); assert.deepEqual(oldFields.map(field => field.value), ['', '', '']);
  assert.deepEqual(newFields.map(field => field.value), ['owner-eight-old', 'owner-eight-new', 'owner-eight-new']);
  assert.equal(h.Modal.isOpen(), true); assert.equal(h.messages.length, 0);
});

test('close, navigate, logout and modal replacement clear owned fields while ignoring delayed results', async () => {
  for (const action of ['close', 'navigate', 'logout', 'replacement']) {
    let resolve; const h = harness(() => new Promise(done => { resolve = done; })); h.module.open(); h.fill();
    const original = h.fields(), pending = h.submit();
    if (action === 'close') h.Modal.close();
    if (action === 'navigate') { h.context.App.currentPage = 'nutricao'; h.window.dispatch('navigate', { page: 'nutricao' }); }
    if (action === 'logout') { h.Auth.user = null; h.Auth.generation++; h.window.dispatch('auth:logout', { userId: 7 }); }
    if (action === 'replacement') h.Modal.open('Outro modal', '<p id="replacement">Contexto novo</p>');
    assert.deepEqual(original.map(field => field.value), ['', '', '']);
    assert.equal(h.calls[0].captured.isCurrent(), false);
    resolve({ changed: true, requiresLogin: true, userId: 7 }); await pending;
    assert.equal(h.calls.length, 1); assert.equal(h.messages.length, 0);
    if (action === 'replacement') assert.equal(h.Modal.isOpen(), true);
  }
});

test('uncertain outcome clears secrets, never retries automatically and never claims success', async () => {
  const h = harness(async () => { throw Object.assign(new Error('resultado incerto'), { credentialChangeUncertain: true, requiresLogin: true }); });
  h.module.open(); h.fill(); const original = h.fields(); await h.submit();
  assert.deepEqual(original.map(field => field.value), ['', '', '']); assert.equal(h.calls.length, 1);
  assert.equal(h.messages.filter(([kind]) => kind === 'success').length, 0);
  assert.doesNotMatch(h.nodes.get('password-change-feedback')?.textContent || '', /senha foi alterada/i);
});

test('successful auth logout owns login messaging, stale epoch stops submission and cancel clears secrets', async () => {
  const h = harness(async (_, captured, state) => { state.Auth.user = null; state.Auth.generation++;
    state.window.dispatch('auth:logout', { userId: captured.userId }); return { changed: true, requiresLogin: true, userId: captured.userId }; });
  h.module.open(); h.fill(); const original = h.fields(); await h.submit();
  assert.deepEqual(original.map(field => field.value), ['', '', '']); assert.equal(h.messages.length, 0);
  const stale = harness(); stale.module.open(); stale.fill(); stale.Auth.sessionEpoch = 'new-epoch'; await stale.submit();
  assert.equal(stale.calls.length, 0); assert.deepEqual(stale.fields().map(field => field.value), ['', '', '']);
  const canceled = harness(); canceled.module.open(); canceled.fill(); const fields = canceled.fields();
  await canceled.nodes.get('password-change-cancel').emit('click'); assert.deepEqual(fields.map(field => field.value), ['', '', '']);
  assert.equal(canceled.Modal.isOpen(), false); assert.equal(canceled.calls.length, 0);
});

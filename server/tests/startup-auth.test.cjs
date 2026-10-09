const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../../client/js/app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../../client/index.html'), 'utf8');
const controls = ['login-email', 'login-password', 'btn-toggle-password', 'btn-login'];

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(check) {
  const nodes = new Map();
  for (const id of ['login-form', 'login-error', 'login-session-status', 'btn-logout', ...controls]) {
    const listeners = {}, attributes = {};
    nodes.set(id, {
      listeners, attributes, disabled: controls.includes(id), style: {}, hidden: false,
      value: id === 'login-email' ? 'fixture@example.invalid' : 'fixture-password',
      setAttribute(key, value) { attributes[key] = value; },
      addEventListener(type, callback) { listeners[type] = callback; }, reset() {},
    });
  }
  let logins = 0;
  const auth = { user: null, checkAuth: () => check.promise, async login() {
    logins++; auth.user = { id: 7, name: 'Fixture', role: 'student' };
  } };
  const windowListeners = {};
  const context = vm.createContext({
    Auth: auth, Toast: { init() {}, success() {} }, Modal: { init() {} },
    document: { getElementById: id => nodes.get(id), addEventListener() {} },
    window: { addEventListener(type, callback) { windowListeners[type] = callback; } },
  });
  vm.runInContext(`${appSource}\nglobalThis.app = App;`, context);
  const app = context.app;
  let appViews = 0, loginViews = 0;
  app.updateTopbarDate = () => {};
  app.showApp = () => { appViews++; };
  app.showLogin = () => { loginViews++; };
  return { app, nodes, auth, context, get logins() { return logins; }, get appViews() { return appViews; }, get loginViews() { return loginViews; } };
}

test('HTML inicial bloqueia controles antes de executar JS e anuncia verificação acessível', () => {
  for (const id of controls) {
    const tag = indexHtml.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>`))?.[0];
    assert.ok(tag, `Referência de ${id} existe no HTML`);
    assert.match(tag, /\bdisabled\b/);
  }
  assert.match(indexHtml, /<form[^>]+id="login-form"[^>]+aria-busy="true"[^>]+aria-describedby="login-session-status"/);
  assert.match(indexHtml, /<p[^>]+id="login-session-status"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(indexHtml, /id="app-screen"[^>]+style="display: none;"/);
  assert.match(indexHtml, /<script[^>]+src="\/js\/app\.js"/);
});

test('sessão pendente impede submit por teclado ou evento e não mostra dados protegidos', async () => {
  const check = deferred(), h = harness(check);
  const init = h.app.init();
  assert.equal(h.app.sessionChecking, true);
  assert.equal(h.nodes.get('login-form').attributes['aria-busy'], 'true');
  assert.equal(h.nodes.get('login-session-status').hidden, false);
  for (const id of controls) assert.equal(h.nodes.get(id).disabled, true);
  let prevented = false;
  await h.nodes.get('login-form').listeners.submit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.logins, 0);
  assert.equal(h.appViews, 0);
  assert.equal(h.loginViews, 0);
  check.resolve(true);
  await init;
  assert.equal(h.appViews, 1);
  assert.equal(h.loginViews, 0);
  assert.equal(h.app.sessionChecking, false);
  assert.equal(h.nodes.get('login-session-status').hidden, true);
  assert.equal(h.nodes.get('login-form').attributes['aria-busy'], 'false');
});

test('sessão ausente libera formulário e permite novo login após a verificação', async () => {
  const check = deferred(), h = harness(check);
  const init = h.app.init();
  check.resolve(false);
  await init;
  assert.equal(h.appViews, 0);
  assert.equal(h.loginViews, 1);
  assert.equal(h.app.sessionChecking, false);
  for (const id of controls) assert.equal(h.nodes.get(id).disabled, false);
  await h.nodes.get('login-form').listeners.submit({ preventDefault() {} });
  assert.equal(h.logins, 1);
  assert.equal(h.appViews, 1);
});

test('falha assíncrona libera controles, encerra estado ocupado e mantém login com mensagem segura', async () => {
  const check = deferred(), h = harness(check);
  const init = h.app.init();
  check.reject(new Error('provider-private-detail'));
  await init;
  assert.equal(h.appViews, 0);
  assert.equal(h.loginViews, 1);
  assert.equal(h.app.sessionChecking, false);
  assert.equal(h.nodes.get('login-form').attributes['aria-busy'], 'false');
  assert.equal(h.nodes.get('login-session-status').hidden, true);
  assert.equal(h.nodes.get('login-error').style.display, 'flex');
  assert.match(h.nodes.get('login-error').textContent, /Entre novamente/);
  assert.doesNotMatch(h.nodes.get('login-error').textContent, /private/);
  for (const id of controls) assert.equal(h.nodes.get(id).disabled, false);
});

test('checagem que resolve false por indisponibilidade mostra aviso e libera login sem sucesso falso', async () => {
  const check = deferred(), h = harness(check);
  const init = h.app.init();
  h.auth.sessionCheckError = 'Não foi possível verificar sua sessão. Confira a conexão e tente entrar novamente.';
  check.resolve(false);
  await init;
  assert.equal(h.appViews, 0);
  assert.equal(h.loginViews, 1);
  assert.equal(h.nodes.get('login-error').style.display, 'flex');
  assert.equal(h.nodes.get('login-error').textContent, h.auth.sessionCheckError);
  assert.equal(h.nodes.get('login-form').attributes['aria-busy'], 'false');
  assert.equal(h.nodes.get('btn-login').disabled, false);
});

test('Auth real libera controles com logout pendente sem resposta, mantendo intenção e acesso automático bloqueado', async () => {
  const h = harness(deferred()), logout = deferred();
  const storage = new Map([['fitflow_logout_pending', 'pending-intent']]);
  let checks = 0, writes = 0;
  Object.assign(h.context, {
    AbortController, setTimeout, clearTimeout,
    API: { get: async () => { checks++; }, post: path => {
      assert.equal(path, '/auth/logout'); writes++; return logout.promise;
    } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  h.context.Toast.warning = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/auth.js'), 'utf8') + '\nglobalThis.realAuth = Auth;', h.context);
  await h.app.init();
  assert.equal(checks, 0);
  assert.equal(writes, 1);
  assert.equal(h.appViews, 0);
  assert.equal(h.loginViews, 1);
  assert.equal(storage.has('fitflow_logout_pending'), true);
  assert.match(h.nodes.get('login-error').textContent, /ainda não confirmada/);
  assert.equal(h.nodes.get('login-form').attributes['aria-busy'], 'false');
  for (const id of controls) assert.equal(h.nodes.get(id).disabled, false);
  logout.resolve({ status: 'success' });
  await h.context.realAuth.logoutRetryPending;
  assert.equal(storage.has('fitflow_logout_pending'), false);
});

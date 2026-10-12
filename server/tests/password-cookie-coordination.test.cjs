'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { browserAuthLocks } = require('./helpers/browser-auth-locks.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function browser({ post, locks = browserAuthLocks(), storage = new Map([['fitflow_auth_session_epoch_v1', 'epoch-a']]) } = {}) {
  const calls = [], events = [], handlers = new Map(), notice = { textContent: '', style: {} };
  const context = vm.createContext({ navigator: { locks },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    window: { addEventListener: (name, handler) => handlers.set(name, handler), dispatchEvent: event => { events.push(event); handlers.get(event.type)?.(event); } },
    CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } },
    console: { warn() {} }, document: { getElementById: () => notice },
    API: { post: async (url, body, options) => { calls.push({ url, body, options }); return post ? post(url, body, options) : url === '/auth/password'
      ? { data: { changed: true, requiresLogin: true, userId: 7 } } : {}; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js/auth.js'), 'utf8'), context);
  vm.runInContext('this.auth = Auth;', context);
  const auth = context.auth; Object.assign(auth, { user: { id: 7, role: 'student' }, generation: 3, sessionEpoch: 'epoch-a' });
  const captured = { userId: 7, generation: 3, epoch: 'epoch-a', isCurrent: () => true };
  return { auth, captured, calls, events, notice, storage, locks };
}
const input = () => ({ currentPassword: 'synthetic-old-password', newPassword: 'synthetic-new-password' });
test('troca confirmada usa lock, deriva titular e encerra cookie antes de permitir novo login', async () => {
  const f = browser(); const result = await f.auth.changePassword(input(), f.captured);
  assert.equal(result.changed, true); assert.deepEqual(f.calls.map(call => call.url), ['/auth/password', '/auth/logout']);
  assert.equal(f.calls[0].body.expectedActorId, 7); assert.equal(f.calls[0].options.timeoutMs, 15000);
  assert.equal(f.calls[1].options, undefined); assert.equal(f.auth.user, null);
  assert.equal(f.storage.has('fitflow_logout_pending'), false);
  assert.equal(f.events.at(-1).detail.reason, 'password_changed');
  assert.doesNotMatch(JSON.stringify([...f.storage]), /synthetic-(?:old|new)-password/);
});
test('senha atual incorreta e rejeições explícitas preservam sessão sem logout ou retry', async () => {
  for (const status of [400, 403, 409, 429]) {
    const f = browser({ post: async () => { throw Object.assign(new Error('Rejected fixture'), { status }); } });
    await assert.rejects(f.auth.changePassword(input(), f.captured), error => error.status === status);
    assert.equal(f.auth.user.id, 7); assert.equal(f.calls.length, 1); assert.equal(f.events.length, 0);
    assert.equal(f.storage.has('fitflow_logout_pending'), false);
  }
});
test('resposta incerta força reautenticação sem repetir envio da senha; falha de logout mantém intenção', async () => {
  const f = browser({ post: async url => { throw Object.assign(new Error('Offline fixture'), { status: 0 }); } });
  await assert.rejects(f.auth.changePassword(input(), f.captured), error => error.credentialChangeUncertain === true && error.requiresLogin === true);
  assert.deepEqual(f.calls.map(call => call.url), ['/auth/password', '/auth/logout']);
  assert.equal(f.auth.user, null); assert.ok(f.storage.get('fitflow_logout_pending'));
  assert.equal(f.events.at(-1).detail.reason, 'password_changed'); assert.equal(f.events.at(-1).detail.serverConfirmed, false);
});
test('conta, época ou formulário substituídos durante espera pelo lock não transmitem senhas', async () => {
  for (const change of ['account', 'epoch', 'form']) {
    const locks = browserAuthLocks(), hold = deferred(), acquired = deferred();
    const blocker = locks.request('fitflow_auth_cookie_mutation_v1', { mode: 'exclusive' }, async () => { acquired.resolve(); await hold.promise; });
    await acquired.promise; const f = browser({ locks });
    const pending = f.auth.changePassword(input(), f.captured);
    if (change === 'account') { f.auth.user = { id: 8, role: 'student' }; f.auth.generation++; }
    if (change === 'epoch') f.storage.set('fitflow_auth_session_epoch_v1', 'epoch-b');
    if (change === 'form') f.captured.isCurrent = () => false;
    hold.resolve(); await blocker; await assert.rejects(pending);
    assert.equal(f.calls.length, 0); assert.equal(f.events.length, 0);
  }
});
test('login em outra aba aguardando senha não recebe clear-cookie de uma operação antiga', async () => {
  const locks = browserAuthLocks(), storage = new Map([['fitflow_auth_session_epoch_v1', 'epoch-a']]), change = deferred(), cookieCalls = [];
  const a = browser({ locks, storage, post: async url => { cookieCalls.push('a:' + url); if (url === '/auth/password') return change.promise; return {}; } });
  const b = browser({ locks, storage, post: async url => { cookieCalls.push('b:' + url); return url === '/auth/login' ? { data: { user: { id: 8, role: 'student' } } } : {}; } });
  const changing = a.auth.changePassword(input(), a.captured);
  while (!a.calls.length) await new Promise(resolve => setImmediate(resolve));
  const logging = b.auth.login('fixture@example.invalid', 'synthetic-login-password');
  change.resolve({ data: { changed: true, requiresLogin: true, userId: 7 } });
  await Promise.all([changing, logging]);
  assert.equal(b.auth.user.id, 8); assert.equal(cookieCalls.at(-1), 'b:/auth/login');
  assert.equal(cookieCalls.filter(call => call.endsWith('/auth/logout')).length, 1);
});
test('resposta antiga após troca de conta não encerra sessão nova nem afirma identidade errada', async () => {
  const response = deferred(), f = browser({ post: async () => response.promise });
  const pending = f.auth.changePassword(input(), f.captured);
  while (!f.calls.length) await new Promise(resolve => setImmediate(resolve));
  f.auth.user = { id: 8, role: 'student' }; f.auth.generation++;
  f.auth.advanceSessionEpoch(); response.resolve({ data: { changed: true, requiresLogin: true, userId: 7 } });
  await pending; assert.equal(f.auth.user.id, 8); assert.equal(f.calls.length, 1); assert.equal(f.events.length, 0);
});

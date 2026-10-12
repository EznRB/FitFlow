const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createAuthService } = require('../src/services/auth.service');
const { createAuthenticate } = require('../src/middleware/auth');
const { createAuthRouter } = require('../src/routes/auth.routes');
const { createCsrfProtection } = require('../src/middleware/csrf');
const env = require('../src/config/env');

const oldPassword = 'senha-antiga-123';
const newPassword = 'senha-nova-456';
const body = (extra = {}) => ({ expectedActorId: 7, currentPassword: oldPassword, newPassword, ...extra });
const post = (data, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
const token = (id = 7, extra = { credentialVersion: 0 }) => jwt.sign({ id, ...extra }, env.jwt.secret);
const bearer = value => ({ authorization: `Bearer ${value}` });

// Only the external database is replaced. Snapshot reads and conditional writes
// model the Prisma boundary; all validation, hashing, JWT and HTTP code is real.
async function fixture({ version = 0, roles = ['student', 'instructor', 'admin'] } = {}) {
  const passwordHash = await bcrypt.hash(oldPassword, 10);
  const users = new Map(roles.map((role, i) => [7 + i, {
    id: 7 + i, name: `Pessoa ${i}`, email: `pessoa${i}@example.test`, role,
    active: true, credentialVersion: version, passwordHash,
  }]));
  const db = { user: {
    async findUnique({ where, select }) {
      const row = where.id !== undefined ? users.get(where.id) : [...users.values()].find(user => user.email === where.email);
      if (!row) return null;
      return select ? Object.fromEntries(Object.keys(select).map(key => [key, row[key]])) : { ...row };
    },
    async updateMany({ where, data }) {
      const row = users.get(where.id);
      if (!row || row.active !== where.active || row.credentialVersion !== where.credentialVersion || row.passwordHash !== where.passwordHash) return { count: 0 };
      row.passwordHash = data.passwordHash;
      row.credentialVersion += data.credentialVersion.increment;
      return { count: 1 };
    },
    async create({ data }) { const row = { id: 10, active: true, credentialVersion: 0, ...data }; users.set(10, row); return { ...row }; },
  } };
  return { users, db, service: createAuthService({ db }), authenticate: createAuthenticate({ findUser: id => db.user.findUnique({ where: { id } }) }) };
}

function sharedQuota() {
  const hits = new Map();
  return { async increment(key) {
    const count = (hits.get(key) || 0) + 1; hits.set(key, count);
    return { totalHits: count, resetTime: new Date(Date.now() + 900000) };
  } };
}

async function serve(t, f, { quotaOptions, csrf = false, twice = false } = {}) {
  const app = express(); app.use(express.json(), cookieParser());
  if (csrf) app.use('/api', createCsrfProtection({ allowedOrigins: 'https://fitflow.example' }));
  const router = () => createAuthRouter({ service: f.service, authenticate: f.authenticate, quotaOptions });
  app.use('/api/auth', router());
  if (twice) app.use('/other/auth', router());
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('troca salva bcrypt e revoga bearer/cookies antigos somente da própria conta', async t => {
  const f = await fixture(); const url = await serve(t, f);
  const before = await f.service.login('pessoa0@example.test', oldPassword);
  assert.equal(jwt.verify(before.token, env.jwt.secret).credentialVersion, 0);
  const response = await fetch(url + '/api/auth/password', post(body(), bearer(before.token)));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual((await response.json()).data, { changed: true, requiresLogin: true, userId: 7 });
  assert.equal(f.users.get(7).credentialVersion, 1);
  assert.equal(await bcrypt.compare(newPassword, f.users.get(7).passwordHash), true);
  assert.equal(await bcrypt.compare(oldPassword, f.users.get(7).passwordHash), false);
  for (const headers of [bearer(before.token), { cookie: `access_token=${before.token}` }]) {
    assert.equal((await fetch(url + '/api/auth/me', { headers })).status, 401);
    assert.equal((await fetch(url + '/api/auth/password', post(body(), headers))).status, 401);
  }
  assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(token(8)) })).status, 200);
  await assert.rejects(f.service.login('pessoa0@example.test', oldPassword), error => error.statusCode === 401);
  const login = await f.service.login('pessoa0@example.test', newPassword);
  assert.equal(jwt.verify(login.token, env.jwt.secret).credentialVersion, 1);
  const me = await fetch(url + '/api/auth/me', { headers: bearer(login.token) });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).data.user, { id: 7, name: 'Pessoa 0', email: 'pessoa0@example.test', role: 'student' });
});

test('JWT legado sem versão funciona somente antes da primeira troca', async t => {
  const f = await fixture(); const url = await serve(t, f); const legacy = token(7, {});
  assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(legacy) })).status, 200);
  assert.equal((await fetch(url + '/api/auth/password', post(body(), bearer(legacy)))).status, 200);
  assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(legacy) })).status, 401);
});

test('JWT exige versão inteira válida, mesmo com assinatura válida', async t => {
  const f = await fixture(); const url = await serve(t, f);
  for (const version of [null, true, false, '0', -1, 0.5, 2147483648, [], {}]) {
    assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(token(7, { credentialVersion: version })) })).status, 401, JSON.stringify(version));
  }
  f.users.get(7).credentialVersion = 2147483647;
  assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(token(7, { credentialVersion: 2147483647 })) })).status, 200);
});

test('versão inválida no banco e falha de consulta retornam 503 sem limpar cookie', async t => {
  const f = await fixture(); const url = await serve(t, f);
  for (const version of [null, true, '0', -1, 2147483648]) {
    f.users.get(7).credentialVersion = version;
    const response = await fetch(url + '/api/auth/me', { headers: bearer(token()) });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    await assert.rejects(f.service.login('pessoa0@example.test', oldPassword), error => error.statusCode === 503);
  }
  f.db.user.findUnique = async () => { throw new Error('database-private-detail'); };
  const response = await fetch(url + '/api/auth/password', post(body(), bearer(token())));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /database-private-detail/);
});

test('troca exige autenticação e mantém perfis públicos sem metadados secretos', async t => {
  const f = await fixture(); const url = await serve(t, f);
  assert.equal((await fetch(url + '/api/auth/password', post(body()))).status, 401);
  for (const id of [7, 8, 9]) {
    const response = await fetch(url + '/api/auth/password', post(body({ expectedActorId: id }), bearer(token(id))));
    assert.equal(response.status, 200);
  }
  const registered = await f.service.register({ name: 'Pessoa nova', email: 'nova@example.test', password: newPassword });
  assert.equal(registered.passwordHash, undefined); assert.equal(registered.credentialVersion, undefined);
});

test('corpo estrito recusa campos desconhecidos e associação a outra conta', async t => {
  const f = await fixture(); const url = await serve(t, f);
  const invalid = [null, [], {}, body({ expectedActorId: '7' }), body({ expectedActorId: 0 }), body({ currentPassword: '' }),
    body({ currentPassword: 123 }), body({ currentPassword: 'é'.repeat(37) }), body({ newPassword: 'curta' }),
    body({ newPassword: 'é'.repeat(37) }), body({ role: 'admin' }), body({ userId: 8 }), body({ credentialVersion: 0 })];
  for (const data of invalid) {
    await assert.rejects(f.service.changePassword(7, data, 0), error => error.statusCode === 400, JSON.stringify(data));
  }
  await assert.rejects(f.service.changePassword(7, body({ expectedActorId: 8 }), 0), error => error.statusCode === 403);
  const response = await fetch(url + '/api/auth/password', post(body({ expectedActorId: 8 }), bearer(token())));
  assert.equal(response.status, 403);
  assert.equal(f.users.get(7).credentialVersion, 0);
  assert.equal(await bcrypt.compare(oldPassword, f.users.get(7).passwordHash), true);
});

test('senha atual incorreta e reutilização são 400 e preservam a sessão', async t => {
  const f = await fixture(); const url = await serve(t, f);
  for (const data of [body({ currentPassword: 'senha-incorreta' }), body({ newPassword: oldPassword })]) {
    const response = await fetch(url + '/api/auth/password', post(data, bearer(token())));
    assert.equal(response.status, 400); assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(token()) })).status, 200);
});

test('duas trocas simultâneas da mesma versão permitem um único vencedor', async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    f.service.changePassword(7, body(), 0), f.service.changePassword(7, body({ newPassword: 'outra-senha-789' }), 0),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const loser = results.find(result => result.status === 'rejected'); assert.equal(loser.reason.statusCode, 409);
  assert.equal(f.users.get(7).credentialVersion, 1);
});

test('mudança de versão após autenticar e limite da revisão falham 409', async () => {
  const f = await fixture(); f.users.get(7).credentialVersion = 1;
  await assert.rejects(f.service.changePassword(7, body(), 0), error => error.statusCode === 409);
  f.users.get(7).credentialVersion = 2147483647;
  await assert.rejects(f.service.changePassword(7, body(), 2147483647), error => error.statusCode === 409);
  assert.equal(await bcrypt.compare(oldPassword, f.users.get(7).passwordHash), true);
});

test('remoção/desativação entre autenticação e serviço não permite troca', async () => {
  const f = await fixture(); f.users.get(7).active = false;
  await assert.rejects(f.service.changePassword(7, body(), 0), error => error.statusCode === 401);
  f.users.delete(7);
  await assert.rejects(f.service.changePassword(7, body(), 0), error => error.statusCode === 401);
});

test('CAS também protege hash alterado ou usuário desativado durante a operação', async () => {
  for (const change of [row => { row.passwordHash = 'hash-alterado'; }, row => { row.active = false; }]) {
    const f = await fixture(); const write = f.db.user.updateMany;
    f.db.user.updateMany = args => { change(f.users.get(7)); return write(args); };
    await assert.rejects(f.service.changePassword(7, body(), 0), error => error.statusCode === 409);
    assert.equal(f.users.get(7).credentialVersion, 0);
  }
});

test('login que leu hash antigo em corrida emite token já revogado', async t => {
  const f = await fixture(); const url = await serve(t, f); const read = f.db.user.findUnique;
  let release; let signal;
  const paused = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { signal = resolve; });
  f.db.user.findUnique = async args => {
    const result = await read(args);
    if (args.where.email) { signal(); await paused; }
    return result;
  };
  const login = f.service.login('pessoa0@example.test', oldPassword);
  await entered; await f.service.changePassword(7, body(), 0); release();
  const late = await login;
  assert.equal(jwt.verify(late.token, env.jwt.secret).credentialVersion, 0);
  assert.equal((await fetch(url + '/api/auth/me', { headers: bearer(late.token) })).status, 401);
});

test('quota persistente de cinco tentativas é por usuário e compartilhada entre roteadores', async t => {
  const f = await fixture(); const url = await serve(t, f, { quotaOptions: { production: true, store: sharedQuota() }, twice: true });
  for (let i = 0; i < 6; i++) {
    const response = await fetch(url + (i % 2 ? '/other/auth/password' : '/api/auth/password'), post(body({ currentPassword: 'incorreta' }), bearer(token())));
    assert.equal(response.status, i < 5 ? 400 : 429);
    if (i === 5) assert.ok(Number(response.headers.get('Retry-After')) > 0);
  }
  assert.equal((await fetch(url + '/api/auth/password', post(body({ expectedActorId: 8 }), bearer(token(8))))).status, 200);
});

test('quota indisponível retorna 503 antes de alterar senha', async t => {
  const f = await fixture(); const url = await serve(t, f, { quotaOptions: { production: true, store: { async increment() { throw new Error('private-quota-detail'); } } } });
  const response = await fetch(url + '/api/auth/password', post(body(), bearer(token())));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-quota-detail/);
  assert.equal(f.users.get(7).credentialVersion, 0);
});

test('CSRF protege troca com cookie e autenticação continua priorizando cookie sobre bearer', async t => {
  const f = await fixture(); const url = await serve(t, f, { csrf: true });
  const cookie = { cookie: `access_token=${token()}` };
  for (const Origin of [undefined, 'null', 'https://evil.example']) {
    assert.equal((await fetch(url + '/api/auth/password', post(body(), { ...cookie, ...(Origin ? { Origin } : {}) }))).status, 403);
  }
  const mismatch = await fetch(url + '/api/auth/password', post(body(), { ...bearer(token()), cookie: `access_token=${token(8)}`, Origin: 'https://fitflow.example' }));
  assert.equal(mismatch.status, 403);
  assert.equal((await fetch(url + '/api/auth/password', post(body(), { ...cookie, Origin: 'https://fitflow.example' }))).status, 200);
});

test('controller usa versão da autenticação e fallback zero somente quando metadata não existe', async t => {
  const f = await fixture({ version: 1 });
  f.authenticate = (req, res, next) => { req.user = { id: 7, role: 'student' }; next(); };
  const url = await serve(t, f);
  assert.equal((await fetch(url + '/api/auth/password', post(body()))).status, 409);
  f.users.get(7).credentialVersion = 0;
  assert.equal((await fetch(url + '/api/auth/password', post(body()))).status, 200);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { createAuthenticate, authorize } = require('../src/middleware/auth');
const { createAuthService } = require('../src/services/auth.service');
const { createAuthRouter } = require('../src/routes/auth.routes');
const { createCheckinsController } = require('../src/controllers/checkins.controller');
const { createCheckinsService } = require('../src/services/checkins.service');
const { createAlunosService } = require('../src/services/alunos.service');
const { createPagamentosService } = require('../src/services/pagamentos.service');
const env = require('../src/config/env');
const { resolveJwtSecret } = require('../src/config/jwtSecret');

test('produção recusa segredo JWT ausente/conhecido/fraco e desenvolvimento gera segredo efêmero', () => {
  for (const value of [undefined, '', 'dev_secret_change_me', 'x'.repeat(64), 'my-production-secret-change_me-12345']) {
    assert.throws(() => resolveJwtSecret(value, 'production'), /JWT_SECRET ausente ou fraco/);
  }
  const strong = require('node:crypto').randomBytes(48).toString('base64url');
  assert.equal(resolveJwtSecret(strong, 'production'), strong);
  const first = resolveJwtSecret(undefined, 'development');
  const second = resolveJwtSecret(undefined, 'development');
  assert.notEqual(first, second);
  assert.throws(() => jwt.verify(jwt.sign({ id: 7 }, 'dev_secret_change_me'), first));
  const boot = require('node:child_process').spawnSync(process.execPath, ['-e', "require('./src/config/env')"], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '' }, encoding: 'utf8'
  });
  assert.notEqual(boot.status, 0); assert.match(boot.stderr, /JWT_SECRET ausente ou fraco/);
});

async function serve(t, configure) {
  const app = express(); app.use(express.json(), cookieParser()); configure(app);
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}
const send = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const account = { name: 'Aluno Teste', email: 'aluno@example.test', password: 'individual-8793' };

test('JWT recusa usuário desativado/excluído e usa role atual do banco', async t => {
  let user = { id: 7, active: true, role: 'student', name: 'Aluno', email: 'a@example.test' };
  const authenticate = createAuthenticate({ findUser: async id => { assert.equal(id, 7); return user; } });
  const url = await serve(t, app => app.get('/private', authenticate, authorize('admin'), (req, res) => res.json(req.user)));
  const headers = { cookie: `access_token=${jwt.sign({ id: 7, role: 'admin' }, env.jwt.secret)}` };
  assert.equal((await fetch(`${url}/private`, { headers })).status, 403);
  user.role = 'admin'; assert.equal((await fetch(`${url}/private`, { headers })).status, 200);
  user.active = false; assert.equal((await fetch(`${url}/private`, { headers })).status, 401);
  user = null; assert.equal((await fetch(`${url}/private`, { headers })).status, 401);
  for (const id of ['7', 0, -1, {}, 1.1]) {
    assert.equal((await fetch(`${url}/private`, { headers: { authorization: `Bearer ${jwt.sign({ id }, env.jwt.secret)}` } })).status, 401);
  }
});

test('consulta indisponível retorna 503 sem invalidar sessão; JWT futuro retorna 401', async t => {
  let failure = Object.assign(new Error('Database unavailable'), { code: 'P1001' });
  const authenticate = createAuthenticate({ findUser: async () => { throw failure; } });
  const url = await serve(t, app => app.get('/me', authenticate, (req, res) => res.json(req.user)));
  const headers = { authorization: `Bearer ${jwt.sign({ id: 7 }, env.jwt.secret)}` };
  let response = await fetch(`${url}/me`, { headers });
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('P1001'));
  failure = new Error('Unexpected infrastructure failure');
  response = await fetch(`${url}/me`, { headers }); assert.equal(response.status, 503);
  const future = jwt.sign({ id: 7 }, env.jwt.secret, { notBefore: '5m' });
  assert.equal((await fetch(`${url}/me`, { headers: { authorization: `Bearer ${future}` } })).status, 401);
});

test('registro exige admin e valida entrada antes de consultar banco', async t => {
  let creates = 0;
  const service = createAuthService({ db: { user: {
    findUnique: async () => null,
    create: async ({ data }) => { creates++; return { id: 1, ...data }; }
  } } });
  for (const bad of [{ ...account, role: 'admin' }, { ...account, role: 'instructor' }]) {
    await assert.rejects(service.register(bad), e => e.statusCode === 403);
  }
  for (const bad of [{ ...account, password: {} }, { ...account, name: 'a'.repeat(101) },
    { ...account, email: 'invalid' }, { ...account, password: 'x'.repeat(73) }, { ...account, role: 'unknown' }]) {
    await assert.rejects(service.register(bad, { role: 'admin' }), e => e.statusCode === 400);
  }
  const created = await service.register({ ...account, role: 'admin' }, { role: 'admin' });
  assert.equal(created.role, 'admin'); assert.equal(created.passwordHash, undefined); assert.equal(creates, 1);
  const router = createAuthRouter({ service, authenticate: (req, res, next) => next(Object.assign(new Error('Sem sessão'), { statusCode: 401 })) });
  const url = await serve(t, app => app.use('/auth', router));
  assert.equal((await fetch(`${url}/auth/register`, send({ ...account, role: 'admin' }))).status, 401);
  assert.equal((await fetch(`${url}/auth/refresh`, send({}))).status, 501);
  assert.equal(creates, 1);
  let currentRole = 'student';
  const protectedRouter = createAuthRouter({ service, authenticate: (req, res, next) => { req.user = { id: 7, role: currentRole }; next(); } });
  const protectedUrl = await serve(t, app => app.use('/auth', protectedRouter));
  assert.equal((await fetch(`${protectedUrl}/auth/register`, send({ ...account, role: 'admin' }))).status, 403);
  currentRole = 'admin';
  const response = await fetch(`${protectedUrl}/auth/register`, send({ ...account, role: 'instructor' }));
  assert.equal(response.status, 201); assert.equal((await response.json()).data.user.role, 'instructor');
  assert.equal(creates, 2);
});

test('login legítimo usa senha individual e omite hash/token da resposta HTTP', async t => {
  const user = { id: 7, role: 'student', active: true, name: account.name, email: account.email,
    passwordHash: await bcrypt.hash(account.password, 10) };
  const service = createAuthService({ db: { user: { findUnique: async () => user } } });
  const url = await serve(t, app => app.use('/auth', createAuthRouter({ service })));
  const response = await fetch(`${url}/auth/login`, send(account));
  assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  const payload = await response.json(); assert.equal(payload.data.user.id, 7);
  assert.equal(payload.data.user.passwordHash, undefined); assert.equal(payload.data.token, undefined);
  await assert.rejects(service.login(account.email, 'senha-incorreta'), e => e.statusCode === 401);
  for (const password of [{}, [], 'x'.repeat(73)]) await assert.rejects(service.login(account.email, password), e => e.statusCode === 401);
});

test('login tem limite por IP e falha de forma genérica', async t => {
  let calls = 0;
  const service = { login: async () => { calls++; throw Object.assign(new Error('Credenciais inválidas.'), { statusCode: 401 }); } };
  const url = await serve(t, app => app.use('/auth', createAuthRouter({ service })));
  for (let i = 0; i < 11; i++) assert.equal((await fetch(`${url}/auth/login`, send(account))).status, i < 10 ? 401 : 429);
  assert.equal(calls, 10);
});

test('aluno só registra check-in do próprio perfil; admin preserva fluxo', async t => {
  const ids = [];
  const controller = createCheckinsController({ db: { student: { findUnique: async () => ({ id: 11 }) } },
    service: { registrar: async (id, actor) => { ids.push([id, actor]); return { id: 1 }; } } });
  let role = 'student';
  const url = await serve(t, app => app.post('/checkins', (req, res, next) => { req.user = { id: 7, role }; next(); }, controller.registrar));
  for (const id of [12, '12', '11junk', [], {}]) assert.equal((await fetch(`${url}/checkins`, send({ studentId: id }))).status, 403);
  assert.equal((await fetch(`${url}/checkins`, send({}))).status, 201);
  assert.equal((await fetch(`${url}/checkins`, send({ studentId: '11' }))).status, 201);
  role = 'admin'; assert.equal((await fetch(`${url}/checkins`, send({ studentId: 12 }))).status, 201);
  role = 'instructor'; assert.equal((await fetch(`${url}/checkins`, send({ studentId: 12 }))).status, 403);
  assert.deepEqual(ids, [[11, 7], [11, 7], [12, 7]]);
});

test('cancelamento mantém auditoria e impede reentrada diária', async () => {
  let existing = null; let created = 0;
  const repo = { hasCheckedInToday: async () => existing, create: async () => { created++; return existing = { id: 5, status: 'present' }; },
    findById: async () => existing, cancelCheckin: async (id, reason, actor) => existing = { ...existing, status: 'cancelled', cancelReason: reason, cancelledBy: actor } };
  const service = createCheckinsService({ repository: repo, db: { student: { findUnique: async () => ({ id: 11, status: 'active', user: { active: true } }) } } });
  await service.registrar(11, 7); await service.cancelarCheckin(5, 'Presença incorreta', 9);
  await assert.rejects(service.registrar(11, 7), e => e.statusCode === 409);
  assert.equal(created, 1); assert.equal(existing.cancelReason, 'Presença incorreta'); assert.equal(existing.cancelledBy, 9);
});

test('matrícula exige senha própria e não devolve hash', async () => {
  let stored;
  const service = createAlunosService({ db: { user: { findUnique: async () => null,
    create: async ({ data }) => { stored = data; return { id: 2, ...data }; } } } });
  for (const password of [undefined, '', 'short', {}, 'x'.repeat(73)]) await assert.rejects(service.criar({ ...account, password }), e => e.statusCode === 400);
  const result = await service.criar(account);
  assert.equal(await bcrypt.compare(account.password, stored.passwordHash), true);
  assert.equal(await bcrypt.compare('fitflow123', stored.passwordHash), false);
  assert.equal(result.passwordHash, undefined);
});

test('pagamentos validam método em criação e atualização antes do banco', async () => {
  let writes = 0;
  const db = { student: { findUnique: async () => ({ id: 11, user: { active: true }, status: 'active', planId: null }), update: async () => {} },
    payment: { findUnique: async ({ where }) => where.manualRequestId ? null : ({ id: 3 }), create: async ({ data }) => { writes++; return data; }, update: async ({ data }) => { writes++; return data; } } };
  db.$transaction = fn => fn(db); db.$queryRaw = async () => [];
  const service = createPagamentosService({ db });
  for (const paymentMethod of ['<img src=x onerror=alert(1)>', {}, ['pix'], 'pix ']) {
    await assert.rejects(service.registrar({ studentId: 11, amount: 50, paymentMethod, idempotencyKey: randomUUID() }, 7), e => e.statusCode === 400);
    await assert.rejects(service.atualizar(3, { paymentMethod }), e => e.statusCode === 400);
  }
  assert.equal(writes, 0);
  assert.equal((await service.registrar({ studentId: 11, amount: 50, paymentMethod: 'Pix', idempotencyKey: randomUUID() }, 7)).paymentMethod, 'pix');
  assert.equal((await service.atualizar(3, { paymentMethod: 'cartao_credito' })).paymentMethod, 'cartao_credito');
});

function browser(files, globals = {}, exports = '') {
  const context = vm.createContext({ window: {}, console, AbortController, setTimeout, clearTimeout, ...globals });
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../client/js', file), 'utf8'), context);
  vm.runInContext(exports, context); return context;
}
test('dados armazenados de pagamento são escapados na lista, modal e mensalidade', async () => {
  const evil = '<img src=x onerror=alert(1)>"';
  const payment = { id: 1, amount: 25, paymentMethod: evil, notes: evil, status: evil, student: { user: { name: evil } }, plan: { name: evil } };
  const tbody = {}; let modal;
  const context = browser(['security.js', 'pagamentos.js', 'aluno-painel.js'], {
    document: { getElementById: () => tbody }, API: { get: async url => ({ data: url === '/pagamentos' ? [payment] : payment }) },
    Modal: { open: (title, html) => { modal = html; } }, Toast: { error: message => { throw new Error(message); } }
  }, 'this.payments = PagamentosView; this.monthly = AlunoMensalidadeView;');
  await context.payments.carregarLista(); assert.ok(!tbody.innerHTML.includes(evil)); assert.ok(tbody.innerHTML.includes('&lt;img'));
  await context.payments.verDetalhes(1); assert.ok(!modal.includes(evil)); assert.ok(modal.includes('&lt;img'));
  const container = {};
  context.monthly.renderizar(container, { statusVisual: 'em_dia', statusAluno: 'active', diasRestantes: 3, plano: { nome: evil, preco: 25 }, historicoPagamentos: [{ valor: 25, metodo: evil, plano: evil, status: 'paid' }] });
  assert.ok(!container.innerHTML.includes(evil)); assert.ok(container.innerHTML.includes('&lt;img'));
});
test('cookie restaura sessão sem cache e logout preserva demais dados locais', async () => {
  const storage = new Map([['fitflow_calculator', 'kept']]); let checks = 0; const events = []; const listeners = {};
  const context = browser(['auth.js'], { window: { addEventListener: (event, fn) => { listeners[event] = fn; }, dispatchEvent: event => events.push(event) },
    navigator: { locks: require('./helpers/browser-auth-locks.cjs').browserAuthLocks() },
    CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key), clear: () => storage.clear() },
    API: { get: async () => { checks++; return { data: { user: { id: 7, role: 'student' } } }; }, post: async () => ({}) }
  }, 'this.auth = Auth;');
  assert.equal(await context.auth.checkAuth(), true); assert.equal(checks, 1);
  await context.auth.logout(); assert.equal(storage.get('fitflow_calculator'), 'kept'); assert.equal(storage.has('fitflow_user'), false);
  assert.equal(events[0].detail.reason, 'explicit');
  assert.equal(events[0].detail.userId, 7);
  listeners['auth:unauthorized']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events[1].detail.reason, 'expired'); assert.equal(storage.get('fitflow_calculator'), 'kept');
});

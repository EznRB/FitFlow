// Gate HTTP real no cluster PostgreSQL exclusivo de testes; nunca usa a URL
// herdada de outro projeto. Cookies Secure são enviados manualmente no HTTP
// local: este teste não substitui a validação HTTPS do aplicativo publicado.
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();

// Configuração efêmera de produção para exercitar cookie e quota reais.
// O segredo próprio também torna o bucket HMAC exclusivo desta execução.
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.CORS_ORIGIN = 'http://127.0.0.1:3109';
process.env.VERCEL = '1';
process.env.DEBUG_SQL = 'false';
const { getPrismaClientClass, getDatabaseProvider } = require('../src/config/databaseProvider');
assert.equal(getDatabaseProvider(), 'postgresql');
const PrismaClient = getPrismaClientClass();
const db = new PrismaClient({ log: [] });
globalThis.prisma = db;
const bcrypt = require('bcryptjs');
const { createFirstAdmin } = require('../scripts/bootstrap-admin.cjs');
const { hashIdentity } = require('../src/middleware/quota');
const app = require('../src/app');
const testIp = '198.51.100.25';
const quotaKey = hashIdentity('auth:login', testIp);
const password = randomBytes(24).toString('base64url');
const suffix = randomUUID();
const userIds = [];
let server;
let loginRequests = 0;

(async () => {
  try {
    assert.equal(await db.rateLimitBucket.findUnique({ where: { key: quotaKey } }), null);
    const passwordHash = await bcrypt.hash(password, 10);
    const users = {};
    for (const role of ['admin', 'instructor', 'student']) {
      if (role === 'admin') {
        const created = await createFirstAdmin(db, { name: 'Fixture admin', email: `admin.${suffix}@fixture.invalid`, password });
        userIds.push(created.id);
        users[role] = await db.user.findUnique({ where: { id: created.id } });
        assert.equal(users[role].role, 'admin');
        assert.ok(await bcrypt.compare(password, users[role].passwordHash));
        await assert.rejects(() => createFirstAdmin(db, { name: 'Second fixture admin', email: `second.${suffix}@fixture.invalid`, password }), /Já existe um administrador/);
        assert.equal(await db.user.count({ where: { role: 'admin' } }), 1);
        continue;
      }
      users[role] = await db.user.create({ data: { name: `Fixture ${role}`, email: `${role}.${suffix}@fixture.invalid`, passwordHash, role } });
      userIds.push(users[role].id);
    }
    const blocked = await db.user.create({ data: { name: 'Fixture blocked', email: `blocked.${suffix}@fixture.invalid`, passwordHash, role: 'student', active: false } });
    userIds.push(blocked.id);

    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const login = async (email, providedPassword = password) => {
      loginRequests++;
      return fetch(url + '/api/auth/login', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: process.env.CORS_ORIGIN, 'X-Vercel-Forwarded-For': testIp },
        body: JSON.stringify({ email, password: providedPassword }),
      });
    };
    const get = (path, cookie) => fetch(url + path, { headers: cookie ? { Cookie: cookie } : {} });
    assert.equal((await get('/api/auth/me')).status, 401);
    const health = await get('/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).database, 'ready');
    const cookies = {};
    for (const role of ['admin', 'instructor', 'student']) {
      // Verifica normalização de caixa e espaços no e-mail pelo serviço real.
      const response = await login(` ${users[role].email.toUpperCase()} `);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const cookie = response.headers.get('set-cookie');
      assert.ok(cookie?.startsWith('access_token='));
      assert.match(cookie, /; HttpOnly/i);
      assert.match(cookie, /; Secure/i);
      assert.match(cookie, /; SameSite=Lax/i);
      cookies[role] = cookie.split(';')[0];
      const body = await response.json();
      assert.equal(body.data.user.id, users[role].id);
      assert.equal(body.data.user.role, role);
      assert.doesNotMatch(JSON.stringify(body), /"(?:token|access_token|passwordHash|password)"/);
      const me = await get('/api/auth/me', cookies[role]);
      assert.equal(me.status, 200);
      const current = await me.json();
      assert.equal(current.data.user.id, users[role].id);
      assert.equal(current.data.user.role, role);
      assert.doesNotMatch(JSON.stringify(current), /"(?:token|access_token|passwordHash|password)"/);
      assert.equal((await get('/api/nutricao/scenario', cookies[role])).status, 200);
    }
    assert.equal((await get('/api/relatorios/dashboard', cookies.admin)).status, 200);
    assert.equal((await get('/api/treinos/catalogo', cookies.instructor)).status, 200);
    assert.equal((await get('/api/relatorios/dashboard', cookies.instructor)).status, 403);
    assert.equal((await get('/api/relatorios/dashboard', cookies.student)).status, 403);
    assert.equal((await get('/api/treinos/catalogo', cookies.student)).status, 403);

    const wrongPassword = await login(users.admin.email, 'fixture-wrong-password');
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.headers.get('set-cookie'), null);
    const blockedLogin = await login(blocked.email);
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.headers.get('set-cookie'), null);

    // Mudanças no banco valem imediatamente mesmo com um JWT emitido antes.
    await db.user.update({ where: { id: users.instructor.id }, data: { role: 'student' } });
    const changed = await get('/api/auth/me', cookies.instructor);
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).data.user.role, 'student');
    assert.equal((await get('/api/treinos/catalogo', cookies.instructor)).status, 403);
    await db.user.update({ where: { id: users.student.id }, data: { active: false } });
    assert.equal((await get('/api/auth/me', cookies.student)).status, 401);
    assert.equal((await login(users.student.email)).status, 403);

    // A rota de login real consome o bucket PostgreSQL também nas falhas.
    while (loginRequests < 10) assert.equal((await login(users.admin.email, 'fixture-wrong-password')).status, 401);
    const limited = await login(users.admin.email);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('Retry-After')) > 0);
    assert.equal(limited.headers.get('RateLimit-Remaining'), '0');
    assert.equal((await db.rateLimitBucket.findUnique({ where: { key: quotaKey } })).hits, 11);

    const logout = await fetch(url + '/api/auth/logout', { method: 'POST', headers: { Origin: process.env.CORS_ORIGIN, Cookie: cookies.admin } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /access_token=;/);
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    assert.equal((await get('/api/auth/me')).status, 401);
    console.log('PASS auth PostgreSQL HTTP: bootstrap do primeiro admin sem reset, três perfis, cookie Secure/HttpOnly sem token no JSON, autorização, senha inválida, bloqueio, mudança de perfil, logout e quota real de login.');
  } finally {
    server?.closeAllConnections(); server?.close();
    // Somente contas e bucket sintéticos criados por esta execução.
    try {
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.rateLimitBucket.deleteMany({ where: { key: quotaKey } });
    } finally { await db.$disconnect(); }
  }
})().catch(() => { console.error('FAIL auth PostgreSQL local; detalhes internos não exibidos.'); process.exitCode = 1; });

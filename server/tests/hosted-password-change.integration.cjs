'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { assertHostedTarget } = require('./hosted-management.integration.cjs');
const canonical = 'https://fit-flow-indol.vercel.app';

async function runHostedPasswordChange() {
  assert.equal(process.argv[2], '--execute-hosted-fixtures', 'Execução explícita obrigatória.');
  const vars = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../.env.remote.local')));
  assertHostedTarget(vars, canonical);
  const { PrismaClient } = require('../generated/postgresql');
  const owner = new PrismaClient({ datasources: { db: { url: vars.DIRECT_URL } }, log: [] });
  const prefix = 'Hosted password ' + randomUUID(), users = [];
  const oldPassword = randomBytes(24).toString('base64url'), newPassword = randomBytes(24).toString('base64url');
  let stage = 'target', loginCount = 0;
  const request = async (endpoint, { method = 'GET', cookie, body, origin = canonical, expected = 200 } = {}) => {
    assert.ok(endpoint.startsWith('/api/'));
    const response = await fetch(new URL(endpoint, canonical), { method, redirect: 'manual', signal: AbortSignal.timeout(25000),
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, expected, `${stage}: HTTP ${expected} esperado.`);
    const result = await response.json();
    assert.doesNotMatch(JSON.stringify(result), /"(?:password|passwordHash|token|credentialVersion)"\s*:/);
    return { response, result, data: result.data };
  };
  const login = async (account, password, expected = 200) => {
    assert.ok(++loginCount <= 4, 'Limite de quatro logins; quotas preservadas.');
    const result = await request('/api/auth/login', { method: 'POST', body: { email: account.email, password }, expected });
    if (expected !== 200) return null;
    assert.equal(result.data.user.id, account.id);
    const cookie = result.response.headers.get('set-cookie');
    assert.match(cookie || '', /; Secure/i); assert.match(cookie || '', /; HttpOnly/i);
    return cookie.split(';')[0];
  };
  try {
    const [identity] = await owner.$queryRaw`SELECT current_database() AS database, current_user AS role`;
    assert.equal(identity.database, 'fitflow'); assert.equal(identity.role, 'fitflow_owner');
    assert.equal((await request('/api/health')).result.database, 'ready');
    const passwordHash = await require('bcryptjs').hash(oldPassword, 10);
    for (const role of ['admin', 'student']) users.push(await owner.user.create({ data: { name: prefix, email: randomUUID() + '@example.invalid', passwordHash, role } }));
    const before = await owner.user.findUnique({ where: { id: users[1].id } });
    stage = 'old and independent sessions';
    const oldCookie = await login(users[0], oldPassword), independentCookie = await login(users[1], oldPassword);
    const body = { expectedActorId: users[0].id, currentPassword: oldPassword, newPassword };
    stage = 'actor, CSRF and current password checks';
    await request('/api/auth/password', { method: 'POST', cookie: oldCookie, body: { ...body, expectedActorId: users[1].id }, expected: 403 });
    await request('/api/auth/password', { method: 'POST', cookie: oldCookie, body, origin: 'https://example.invalid', expected: 403 });
    await request('/api/auth/password', { method: 'POST', cookie: oldCookie, body: { ...body, currentPassword: 'wrong-password' }, expected: 400 });
    assert.equal((await request('/api/auth/me', { cookie: oldCookie })).data.user.id, users[0].id);
    stage = 'change and revocation';
    const changed = await request('/api/auth/password', { method: 'POST', cookie: oldCookie, body });
    assert.deepEqual(changed.data, { changed: true, requiresLogin: true, userId: users[0].id });
    assert.equal(changed.response.headers.get('set-cookie'), null);
    await request('/api/auth/me', { cookie: oldCookie, expected: 401 });
    await request('/api/auth/password', { method: 'POST', cookie: oldCookie, body, expected: 401 });
    assert.equal((await request('/api/auth/me', { cookie: independentCookie })).data.user.id, users[1].id);
    assert.deepEqual(await owner.user.findUnique({ where: { id: users[1].id } }), before);
    assert.equal((await owner.user.findUnique({ where: { id: users[0].id } })).credentialVersion, 1);
    stage = 'new credential accepted and old credential refused';
    await login(users[0], oldPassword, 401);
    const newCookie = await login(users[0], newPassword);
    assert.equal((await request('/api/auth/me', { cookie: newCookie })).data.user.id, users[0].id);
    console.log('Hosted password PASS: actor/CSRF/current-password checks, no Set-Cookie, old sessions revoked, new login and independent account preserved.');
  } finally {
    if (users.length) await owner.user.deleteMany({ where: { id: { in: users.map(user => user.id) }, name: prefix } });
    await owner.$disconnect();
    console.log('Only this run’s UUID accounts removed; quotas unchanged.');
  }
}
if (require.main === module) runHostedPasswordChange().catch(error => { console.error('Hosted password gate failed: ' + (error.code || error.name)); process.exitCode = 1; });
module.exports = { runHostedPasswordChange };

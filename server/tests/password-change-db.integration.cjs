'use strict';
const assert = require('node:assert/strict'), { randomUUID, randomBytes } = require('node:crypto');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
assert.ok(['test', 'development'].includes(process.env.NODE_ENV));
if (target.protocol === 'mysql:') {
  assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1'); assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '3308'); assert.equal(target.pathname, '/fitflow_dev');
} else require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();
const PrismaClient = require('../src/config/databaseProvider').getPrismaClientClass();
const db = new PrismaClient({ log: [] }), otherDb = new PrismaClient({ log: [] });
const { createAuthService } = require('../src/services/auth.service'), { createAuthenticate } = require('../src/middleware/auth');
const env = require('../src/config/env'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const users = [], prefix = 'Password fixture ' + randomUUID(), old = randomBytes(24).toString('base64url');
let stage = 'fixtures';
const valid = token => new Promise(resolve => {
  const middleware = createAuthenticate({ findUser: id => db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, active: true, credentialVersion: true } }) });
  middleware({ headers: { authorization: 'Bearer ' + token } }, {}, error => resolve(error?.statusCode || 200));
});
(async () => {
  try {
    const hash = await bcrypt.hash(old, 10), first = createAuthService({ db }), second = createAuthService({ db: otherDb });
    for (const role of ['admin', 'student']) users.push(await db.user.create({ data: { name: prefix, email: randomUUID() + '@example.invalid', passwordHash: hash, role } }));
    const owner = users[0], next = randomBytes(24).toString('base64url');
    const oldLogin = await first.login(owner.email, old), otherLogin = await first.login(users[1].email, old);
    const legacy = jwt.sign({ id: owner.id }, env.jwt.secret);
    assert.equal(await valid(oldLogin.token), 200); assert.equal(await valid(legacy), 200);
    stage = 'CHECK';
    await assert.rejects(db.user.update({ where: { id: owner.id }, data: { credentialVersion: -1 } }), error => /users_credential_version_check/.test(error.message));
    stage = 'conditional race';
    const outcomes = await Promise.allSettled([first.changePassword(owner.id, { expectedActorId: owner.id, currentPassword: old, newPassword: next }, 0),
      second.changePassword(owner.id, { expectedActorId: owner.id, currentPassword: old, newPassword: next }, 0)]);
    assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(outcomes.find(row => row.status === 'rejected').reason.statusCode, 409);
    assert.equal((await db.user.findUnique({ where: { id: owner.id } })).credentialVersion, 1);
    assert.equal(await valid(oldLogin.token), 401); assert.equal(await valid(legacy), 401); assert.equal(await valid(otherLogin.token), 200);
    stage = 'login and old credential';
    await assert.rejects(first.login(owner.email, old), error => error.statusCode === 401);
    const latest = await first.login(owner.email, next); assert.equal(jwt.verify(latest.token, env.jwt.secret).credentialVersion, 1);
    assert.equal(await valid(latest.token), 200);
    await assert.rejects(first.changePassword(owner.id, { expectedActorId: owner.id, currentPassword: next, newPassword: old }, 0), error => error.statusCode === 409);
    const before = await db.user.findUnique({ where: { id: owner.id } });
    await assert.rejects(first.changePassword(owner.id, { expectedActorId: users[1].id, currentPassword: next, newPassword: old }, 1), error => error.statusCode === 403);
    assert.deepEqual(await db.user.findUnique({ where: { id: owner.id } }), before);
    console.log('Password DB PASS: CHECK, two-client CAS race, old/legacy JWT revoked, other account preserved and new login accepted.');
  } finally {
    if (users.length) await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) }, name: prefix } });
    console.log('Only this run’s UUID accounts removed.');
  }
})().catch(error => { console.error('Password DB gate failed at ' + stage + ': ' + (error.code || error.name)); process.exitCode = 1; })
  .finally(async () => { await otherDb.$disconnect(); await db.$disconnect(); });

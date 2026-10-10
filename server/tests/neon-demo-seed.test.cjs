'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { assertTargets, verifyExistingAccounts, definitions } = require('../scripts/seed-neon-demo.cjs');

const remote = {
  NODE_ENV: 'development', DATABASE_PROVIDER: 'postgresql', NEON_PROJECT_ID: 'mute-night-99440749',
  NEON_BRANCH_ID: 'br-tiny-king-b6carztp',
  DATABASE_URL: 'postgresql://fitflow_owner:fixture@ep-jolly-grass-b6jl6hjo-pooler.c-2.sa-east-1.aws.neon.tech/fitflow?sslmode=require&sslaccept=strict',
  DIRECT_URL: 'postgresql://fitflow_owner:fixture@ep-jolly-grass-b6jl6hjo.c-2.sa-east-1.aws.neon.tech/fitflow?sslmode=require&sslaccept=strict',
};
const local = { LOCAL_DB_MANAGED: 'fitflow-native-v1', DATABASE_URL: 'mysql://fixture:fixture@127.0.0.1:3308/fitflow_dev' };

test('Neon demo seed refuses other projects, branches, credentials, TLS and inherited databases', () => {
  assert.doesNotThrow(() => assertTargets(remote, local));
  for (const patch of [
    { NODE_ENV: 'production' }, { DATABASE_PROVIDER: 'mysql' }, { NEON_PROJECT_ID: 'other' },
    { NEON_BRANCH_ID: 'br-restless-cell-b61mst0r' },
    { DATABASE_URL: remote.DATABASE_URL.replace('fitflow_owner', 'fitflow_app') },
    { DATABASE_URL: remote.DATABASE_URL.replace('-pooler', '') },
    { DIRECT_URL: remote.DIRECT_URL.replace('sslaccept=strict', 'sslaccept=accept_invalid_certs') },
    { DIRECT_URL: remote.DIRECT_URL.replace('sslmode=require', 'sslmode=disable') },
    { DIRECT_URL: remote.DIRECT_URL.replace('/fitflow?', '/unrelated?') },
  ]) assert.throws(() => assertTargets({ ...remote, ...patch }, local));
  for (const patch of [
    { LOCAL_DB_MANAGED: '' },
    { DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:5432/copytrade' },
    { DATABASE_URL: local.DATABASE_URL.replace(':3308', ':3306') },
    { DATABASE_URL: local.DATABASE_URL.replace('127.0.0.1', 'remote.example') },
    { DATABASE_URL: local.DATABASE_URL.replace('/fitflow_dev', '/defaultdb') },
  ]) assert.throws(() => assertTargets(remote, { ...local, ...patch }));
});

test('Neon demo seed resumes only accounts whose saved password and demo profile match', async () => {
  const password = 'fixture-password-32-characters-safe';
  const hash = await bcrypt.hash(password, 4);
  const admin = definitions[0];
  const credentials = { admin: { email: admin.email, password } };
  const account = { name: admin.name, email: admin.email, role: admin.role, passwordHash: hash };
  const prisma = { user: { findUnique: async ({ where }) => where.email === admin.email ? account : null } };
  await assert.doesNotReject(() => verifyExistingAccounts(prisma, credentials));
  await assert.rejects(() => verifyExistingAccounts(prisma, {}), /Colisão/);
  await assert.rejects(() => verifyExistingAccounts(prisma, { admin: { email: admin.email, password: 'different-password-32-characters' } }), /Colisão/);
  account.name = 'Conta original';
  await assert.rejects(() => verifyExistingAccounts(prisma, credentials), /Colisão/);
});

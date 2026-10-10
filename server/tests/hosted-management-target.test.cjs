const test = require('node:test');
const assert = require('node:assert/strict');
const { assertHostedTarget } = require('./hosted-management.integration.cjs');
const target = 'https://fit-flow-indol.vercel.app';
const direct = 'postgresql://fitflow_owner:synthetic-only@ep-jolly-grass-b6jl6hjo.c-2.sa-east-1.aws.neon.tech/fitflow?sslmode=require&sslaccept=strict';
const vars = { DATABASE_PROVIDER: 'postgresql', DATABASE_URL: direct.replace('.c-2.', '-pooler.c-2.'), DIRECT_URL: direct,
  NEON_PROJECT_ID: 'mute-night-99440749', NEON_BRANCH_ID: 'br-tiny-king-b6carztp' };

test('gate publicado aceita somente o owner explícito no Neon confirmado com TLS estrito', () => {
  assert.doesNotThrow(() => assertHostedTarget(vars, target, 'test'));
});

test('gate publicado recusa outros bancos, branches, roles, TLS e destinos antes de conectar', () => {
  for (const change of [{ DATABASE_PROVIDER: 'mysql' }, { NEON_PROJECT_ID: 'other' }, { NEON_BRANCH_ID: 'other' },
    { DIRECT_URL: 'postgresql://fixture:pass@127.0.0.1:5432/copytrade' },
    { DIRECT_URL: direct.replace('fitflow_owner', 'fitflow_app') },
    { DIRECT_URL: direct.replace('/fitflow?', '/other?') },
    { DIRECT_URL: direct.replace('sslaccept=strict', 'sslaccept=accept_invalid_certs') },
    { DIRECT_URL: direct.replace('sslmode=require', 'sslmode=disable') },
    { DATABASE_URL: direct }, { DATABASE_URL: '' }, { DIRECT_URL: 'broken' }]) {
    assert.throws(() => assertHostedTarget({ ...vars, ...change }, target, 'test'), /Gate restrito/);
  }
  assert.throws(() => assertHostedTarget(vars, target, 'production'), /Gate restrito/);
  for (const url of ['http://fit-flow-indol.vercel.app', 'https://attacker.invalid', target + '/', target + '/api']) {
    assert.throws(() => assertHostedTarget(vars, url, 'test'), /Gate restrito/);
  }
});

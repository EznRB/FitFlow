'use strict';
const assert = require('node:assert/strict');
function assertPostgresqlTestTarget(env = process.env) {
  assert.ok(['development', 'test'].includes(env.NODE_ENV), 'Produção ou ambiente desconhecido recusado');
  const url = new URL(env.DATABASE_URL || 'file:missing');
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  if (env.NEON_VERIFICATION_MANAGED === 'fitflow-neon-verification-v1') {
    assert.equal(env.NEON_PROJECT_ID, 'mute-night-99440749');
    assert.equal(env.NEON_BRANCH_ID, 'br-restless-cell-b61mst0r');
    assert.equal(url.hostname, 'ep-noisy-haze-b6r9zqdq-pooler.c-2.sa-east-1.aws.neon.tech');
    assert.equal(url.pathname, '/fitflow');
    assert.equal(url.searchParams.get('sslmode'), 'require');
    assert.equal(url.searchParams.get('sslaccept'), 'strict');
    const direct = new URL(env.DIRECT_URL);
    assert.equal(direct.hostname, 'ep-noisy-haze-b6r9zqdq.c-2.sa-east-1.aws.neon.tech');
    assert.equal(direct.pathname, '/fitflow');
    return 'neon-verification';
  }
  assert.equal(env.LOCAL_DB_MANAGED, 'fitflow-postgresql-test-v1');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '5448'); assert.equal(url.pathname, '/fitflow_pg_test');
  return 'native-postgresql';
}
module.exports = { assertPostgresqlTestTarget };

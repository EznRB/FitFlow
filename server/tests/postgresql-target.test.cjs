const test = require('node:test');
const assert = require('node:assert/strict');
const { assertPostgresqlTestTarget } = require('./helpers/postgresql-target.cjs');
const fixture = {
  NODE_ENV:'test', NEON_VERIFICATION_MANAGED:'fitflow-neon-verification-v1',
  NEON_PROJECT_ID:'mute-night-99440749', NEON_BRANCH_ID:'br-restless-cell-b61mst0r',
  DATABASE_URL:'postgresql://fixture:unused@ep-noisy-haze-b6r9zqdq-pooler.c-2.sa-east-1.aws.neon.tech/fitflow?sslmode=require&sslaccept=strict',
  DIRECT_URL:'postgresql://fixture:unused@ep-noisy-haze-b6r9zqdq.c-2.sa-east-1.aws.neon.tech/fitflow?sslmode=require&sslaccept=strict'
};
test('gate admite somente o cluster nativo ou a branch Neon dedicada aos testes', () => {
  assert.equal(assertPostgresqlTestTarget(fixture), 'neon-verification');
  assert.equal(assertPostgresqlTestTarget({NODE_ENV:'development',LOCAL_DB_MANAGED:'fitflow-postgresql-test-v1',DATABASE_URL:'postgresql://fixture:unused@127.0.0.1:5448/fitflow_pg_test'}), 'native-postgresql');
  for(const change of [{NODE_ENV:'production'},{NEON_BRANCH_ID:'br-tiny-king-b6carztp'},{NEON_PROJECT_ID:'other-project'},
    {DATABASE_URL:fixture.DATABASE_URL.replace('ep-noisy-haze-b6r9zqdq','ep-jolly-grass-b6jl6hjo')},
    {DIRECT_URL:fixture.DIRECT_URL.replace('ep-noisy-haze-b6r9zqdq','ep-jolly-grass-b6jl6hjo')},
    {DATABASE_URL:fixture.DATABASE_URL.replace('sslaccept=strict','sslaccept=accept_invalid_certs')},
    {DATABASE_URL:fixture.DATABASE_URL.replace('/fitflow?','/other?')},
    {NEON_VERIFICATION_MANAGED:undefined}]) assert.throws(()=>assertPostgresqlTestTarget({...fixture,...change}));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createDatabaseQuotaStore, createQuotaLimiter } = require('../src/middleware/quota');

const key = 'a'.repeat(64);
const databaseReset = new Date('2026-10-08T21:15:00.000Z');
function fakePostgres(result) {
  const calls = [];
  return {
    calls, rateLimitBucket: {},
    async $queryRaw(strings, ...values) { calls.push({ sql: strings.join('?'), values }); return result; },
    async $executeRaw(strings, ...values) { calls.push({ sql: strings.join('?'), values }); return 3; },
    async $transaction() { throw new Error('A quota PostgreSQL deve retornar do próprio UPSERT'); },
  };
}

test('PostgreSQL retorna a quota do UPSERT e parametriza identidade e janela', async () => {
  const db = fakePostgres([{ hits: 11, windowEndsAt: databaseReset }]);
  const store = createDatabaseQuotaStore({ db, provider: 'postgresql', windowMs: 60000 });
  const result = await store.increment(key);
  assert.deepEqual(result, { totalHits: 11, resetTime: databaseReset });
  assert.equal(result.resetTime, databaseReset, 'preserva o instante retornado pelo banco');
  assert.equal(db.calls.length, 1, 'não relê a linha após liberar o lock');
  assert.deepEqual(db.calls[0].values, [key, 60000, 60000]);
  assert.ok(!db.calls[0].sql.includes(key));
  assert.match(db.calls[0].sql, /ON CONFLICT \("key"\) DO UPDATE/);
  assert.match(db.calls[0].sql, /RETURNING hits, window_ends_at AS "windowEndsAt"/);
  assert.equal((db.calls[0].sql.match(/clock_timestamp\(\)/g) || []).length, 1);
  assert.match(db.calls[0].sql, /AS MATERIALIZED/);
  assert.match(db.calls[0].sql, /bucket\.hits::bigint \+ 1/);
  assert.doesNotMatch(db.calls[0].sql, /UTC_TIMESTAMP|TIMESTAMPADD|ON DUPLICATE/);
});

test('PostgreSQL aceita o máximo INT e recusa respostas sem uma quota válida', async () => {
  const db = fakePostgres([{ hits: 2147483647, windowEndsAt: databaseReset }]);
  assert.equal((await createDatabaseQuotaStore({ db, provider: 'postgresql' }).increment(key)).totalHits, 2147483647);
  const invalid = [undefined, [], [{ hits: 1, windowEndsAt: databaseReset }, { hits: 2, windowEndsAt: databaseReset }],
    [{ hits: 0, windowEndsAt: databaseReset }], [{ hits: -1, windowEndsAt: databaseReset }],
    [{ hits: 1.5, windowEndsAt: databaseReset }], [{ hits: '1', windowEndsAt: databaseReset }],
    [{ hits: 2147483648, windowEndsAt: databaseReset }], [{ hits: 1, windowEndsAt: new Date(NaN) }],
    [{ hits: 1, windowEndsAt: databaseReset.toISOString() }], [{ hits: 1, windowEndsAt: null }]];
  for (const result of invalid) {
    await assert.rejects(createDatabaseQuotaStore({ db: fakePostgres(result), provider: 'postgresql' }).increment(key), /Resposta de quota inválida/);
  }
});

test('PostgreSQL rejeita chave e configuração inválidas antes de consultar o banco', async () => {
  const db = fakePostgres([{ hits: 1, windowEndsAt: databaseReset }]);
  const store = createDatabaseQuotaStore({ db, provider: 'postgresql' });
  for (const invalid of ['', "'; DELETE FROM rate_limit_buckets; --", 'A'.repeat(64), 'a'.repeat(63)]) {
    await assert.rejects(store.increment(invalid), /Armazenamento de quota indisponível/);
  }
  assert.equal(db.calls.length, 0);
  for (const windowMs of [0, 999, 1000.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createDatabaseQuotaStore({ db, provider: 'postgresql', windowMs }), /Janela de quota inválida/);
  }
  assert.throws(() => createDatabaseQuotaStore({ db, provider: 'sqlite' }), /Provedor de quota inválido/);
});

test('PostgreSQL remove somente buckets expirados há mais de um dia pelo relógio do banco', async () => {
  const db = fakePostgres([]);
  assert.equal(await createDatabaseQuotaStore({ db, provider: 'postgresql' }).pruneExpired(), 3);
  assert.match(db.calls[0].sql, /window_ends_at < clock_timestamp\(\) - INTERVAL '1 day'/);
  assert.deepEqual(db.calls[0].values, []);
});

test('contrato MySQL mantém transação, UPSERT e leitura sob o mesmo lock', async () => {
  const calls = [];
  const db = {
    rateLimitBucket: {},
    async $transaction(run) {
      calls.push('transaction');
      return run({
        async $executeRaw(strings) { assert.match(strings.join('?'), /ON DUPLICATE KEY UPDATE/); calls.push('upsert'); },
        rateLimitBucket: { async findUnique({ where }) { assert.deepEqual(where, { key }); calls.push('read'); return { hits: 2, windowEndsAt: databaseReset }; } },
      });
    },
  };
  assert.deepEqual(await createDatabaseQuotaStore({ db, provider: 'mysql' }).increment(key), { totalHits: 2, resetTime: databaseReset });
  assert.deepEqual(calls, ['transaction', 'upsert', 'read']);
});

test('erro ou resposta inválida PostgreSQL falha com 503 antes da operação protegida', async t => {
  for (const failure of ['database-private-detail', 'invalid-result']) {
    let operations = 0;
    const db = fakePostgres([]);
    if (failure === 'database-private-detail') db.$queryRaw = async () => { throw new Error(failure); };
    const app = express();
    const store = createDatabaseQuotaStore({ db, provider: 'postgresql' });
    app.post('/quota', createQuotaLimiter({ endpoint: 'fixture:pg', production: true, store }), (req, res) => { operations++; res.sendStatus(204); });
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/quota`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /database-private-detail|Resposta de quota inválida/);
    assert.equal(operations, 0);
  }
});

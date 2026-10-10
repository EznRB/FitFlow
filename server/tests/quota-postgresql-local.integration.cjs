// Executar somente pelo wrapper privado do cluster PostgreSQL dedicado de testes.
// O guard roda antes de carregar Prisma e impede atingir outro banco do computador.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./helpers/postgresql-target.cjs').assertPostgresqlTestTarget();

const { getPrismaClientClass, getDatabaseProvider } = require('../src/config/databaseProvider');
assert.equal(getDatabaseProvider(), 'postgresql');
const PrismaClient = getPrismaClientClass();
const express = require('express');
const db = new PrismaClient({ log: [] });
const secondDb = new PrismaClient({ log: [] });
globalThis.prisma = db;
const { createDatabaseQuotaStore, createQuotaLimiter, hashIdentity } = require('../src/middleware/quota');
const key = hashIdentity('fixture:pg-quota', randomUUID());
const endpoint = `fixture:pg:${randomUUID()}`;
const httpKey = hashIdentity(endpoint, '127.0.0.1');
let server;

(async () => {
  try {
    const first = createDatabaseQuotaStore({ db, provider: 'postgresql' });
    const second = createDatabaseQuotaStore({ db: secondDb, provider: 'postgresql' });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).increment(key)));
    assert.deepEqual(results.map(result => result.totalHits).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(new Set(results.map(result => result.resetTime.getTime())).size, 1);
    const [{ databaseNow }] = await db.$queryRaw`SELECT clock_timestamp() AS "databaseNow"`;
    const resetTime = results[0].resetTime.getTime();
    assert.ok(resetTime > databaseNow.getTime() && resetTime <= databaseNow.getTime() + 900000);
    assert.equal(resetTime % 900000, 0);

    await db.rateLimitBucket.update({ where: { key }, data: { windowEndsAt: new Date('2000-01-01T00:00:00.000Z') } });
    const reset = await first.increment(key);
    assert.equal(reset.totalHits, 1);
    assert.ok(reset.resetTime.getTime() > databaseNow.getTime());
    assert.equal(reset.resetTime.getTime() % 900000, 0);
    await db.rateLimitBucket.update({ where: { key }, data: { hits: 2147483647 } });
    assert.equal((await second.increment(key)).totalHits, 2147483647, 'satura INT sem overflow na soma');

    const app = express(); let accepted = 0;
    app.post('/first', createQuotaLimiter({ endpoint, production: true, db }), (req, res) => { accepted++; res.sendStatus(204); });
    app.post('/second', createQuotaLimiter({ endpoint, production: true, db: secondDb }), (req, res) => { accepted++; res.sendStatus(204); });
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: 'Falha controlada' }));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const responses = await Promise.all(Array.from({ length: 16 }, (_, i) => fetch(url + (i % 2 ? '/first' : '/second'), {
      method: 'POST', headers: { 'X-Forwarded-For': `198.51.100.${i}` },
    })));
    assert.equal(responses.filter(response => response.status === 204).length, 10);
    assert.equal(responses.filter(response => response.status === 429).length, 6);
    assert.equal(accepted, 10);
    assert.equal((await db.rateLimitBucket.findUnique({ where: { key: httpKey } })).hits, 16);
    console.log('PASS quota PostgreSQL: UPSERT 20 concorrentes entre dois clientes, 2 instâncias/10 permitidos, HMAC, reset alinhado pelo banco e saturação INT.');
  } finally {
    server?.closeAllConnections(); server?.close();
    // Os únicos DELETEs são os dois buckets sintéticos criados por esta execução.
    try { await db.rateLimitBucket.deleteMany({ where: { key: { in: [key, httpKey] } } }); }
    finally { await Promise.all([db.$disconnect(), secondDb.$disconnect()]); }
  }
})().catch(() => { console.error('FAIL quota PostgreSQL local; detalhes internos não exibidos.'); process.exitCode = 1; });

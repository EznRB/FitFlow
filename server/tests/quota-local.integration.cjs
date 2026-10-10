// Teste explicitamente local: node scripts/with-local-env.cjs node tests/quota-local.integration.cjs
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const target = new URL(process.env.DATABASE_URL || 'file:missing');
assert.equal(process.env.LOCAL_DB_MANAGED, 'fitflow-native-v1');
assert.equal(target.protocol, 'mysql:'); assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
assert.equal(target.port, '3308'); assert.equal(target.pathname, '/fitflow_dev');
const db = new PrismaClient({ log: [] }); globalThis.prisma = db;
const { createDatabaseQuotaStore, createQuotaLimiter, hashIdentity } = require('../src/middleware/quota');
const key = hashIdentity('fixture:quota', randomUUID());
const endpoint = `fixture:${randomUUID()}`;
const httpKey = hashIdentity(endpoint, '127.0.0.1');
let server;
(async () => {
  try {
    const first = createDatabaseQuotaStore({ db }); const second = createDatabaseQuotaStore({ db });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).increment(key)));
    assert.deepEqual(results.map(result => result.totalHits).sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(new Set(results.map(result => result.resetTime.getTime())).size, 1);
    const resetTime = results[0].resetTime.getTime();
    assert.ok(resetTime > Date.now() && resetTime <= Date.now() + 900000);
    assert.equal(resetTime % 900000, 0);
    await db.rateLimitBucket.update({ where: { key }, data: { windowEndsAt: new Date('2000-01-01') } });
    const reset = await first.increment(key); assert.equal(reset.totalHits, 1);
    assert.ok(reset.resetTime.getTime() > Date.now());
    await db.rateLimitBucket.update({ where: { key }, data: { hits: 2147483647 } });
    assert.equal((await second.increment(key)).totalHits, 2147483647);
    const app = express(); let accepted = 0;
    app.post('/first', createQuotaLimiter({ endpoint, production: true, db }), (req, res) => { accepted++; res.sendStatus(204); });
    app.post('/second', createQuotaLimiter({ endpoint, production: true, db }), (req, res) => { accepted++; res.sendStatus(204); });
    app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: 'Falha controlada' }));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const responses = await Promise.all(Array.from({ length: 16 }, (_, i) => fetch(url + (i % 2 ? '/first' : '/second'), { method: 'POST', headers: { 'X-Forwarded-For': `198.51.100.${i}` } })));
    assert.equal(responses.filter(response => response.status === 204).length, 10);
    assert.equal(responses.filter(response => response.status === 429).length, 6); assert.equal(accepted, 10);
    assert.equal((await db.rateLimitBucket.findUnique({ where: { key: httpKey } })).hits, 16);
    console.log('PASS quota MariaDB: UPSERT 20 concorrentes, 2 instâncias/10 permitidos, HMAC, reset UTC alinhado e limite inteiro.');
  } finally {
    server?.closeAllConnections(); server?.close();
    try { await db.rateLimitBucket.deleteMany({ where: { key: { in: [key, httpKey] } } }); }
    finally { await db.$disconnect(); }
  }
})().catch(() => { console.error('FAIL quota local; detalhes internos não exibidos.'); process.exitCode = 1; });

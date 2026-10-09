const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createNutricaoRouter } = require('../src/routes/nutricao.routes');
const { createNutricaoService } = require('../src/services/nutricao.service');
const AppError = require('../src/utils/AppError');
const input = { formula: 'mifflin', sex: 'male', age: 30, weightKg: 80, heightCm: 180, activityFactor: 1.5, adjustmentPercent: 0, proteinPerKg: 1.6, fatPercent: 25, eligible: true };
test('HTTP não autenticado é bloqueado e corpo/query nunca escolhem o dono de nutrição', async () => {
  const rows = new Map(), service = createNutricaoService({ find: async id => rows.get(id) || null,
    save: async (id, data) => { rows.set(id, data); return data; }, remove: async id => ({ count: rows.delete(id) ? 1 : 0 }) });
  const app = express(); app.use(express.json());
  app.use('/api/nutricao', createNutricaoRouter(service, { authenticate(req, res, next) {
    const id = Number(req.headers['x-test-user']);
    if (![1, 2].includes(id)) return next(new AppError('Autenticação necessária.', 401));
    req.user = { id, role: 'student' }; next();
  } }));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/nutricao/scenario`;
  async function request(id, method = 'GET', body, query = '') {
    return fetch(endpoint + query, { method, headers: { ...(id ? { 'x-test-user': String(id) } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  try {
    for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await request(null, method, method === 'PUT' ? { consent: true, inputs: input } : undefined)).status, 401);
    assert.equal((await request(1, 'PUT', { consent: true, inputs: input })).status, 200);
    assert.equal((await request(2, 'PUT', { consent: true, inputs: { ...input, weightKg: 90 } })).status, 200);
    const response = await request(1, 'GET', undefined, '?userId=2');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).data.scenario.inputs.weightKg, 80);
    assert.equal((await request(1, 'PUT', { consent: true, inputs: input, userId: 2 })).status, 400);
    await request(1, 'DELETE', undefined, '?userId=2');
    assert.equal((await (await request(1)).json()).data.scenario, null);
    assert.equal((await (await request(2)).json()).data.scenario.inputs.weightKg, 90);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

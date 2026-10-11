const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const express = require('express');

test('rotas não permitem substituir ou apagar um recebimento financeiro', async t => {
  let writes = 0, creates = 0;
  const controllers = new Proxy({}, { get: (_, key) => (req, res) => {
    if (key === 'atualizar') writes++;
    if (key === 'registrar') creates++;
    res.json({ status: 'success', data: { id: 1 } });
  } });
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/pagamentos.routes.js'), 'utf8'), {
    module, require(name) {
      if (name === 'express') return express;
      if (name.includes('controllers/')) return controllers;
      if (name.includes('middleware/auth')) return {
        authenticate(req, res, next) { if (!req.headers['x-test-role']) return res.sendStatus(401); req.user = { role: req.headers['x-test-role'] }; next(); },
        authorize(role) { return (req, res, next) => req.user.role === role ? next() : res.sendStatus(403); },
      };
      throw new Error('Unexpected dependency');
    },
  });
  const app = express(); app.use(express.json()); app.use('/api/pagamentos', module.exports);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/pagamentos`;
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const response = await fetch(url + '/1', { method, headers: { 'x-test-role': 'admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1, status: 'pending', paymentDate: '2000-01-01' }) });
    assert.equal(response.status, 405, method); assert.equal(response.headers.get('allow'), 'GET');
    assert.match((await response.json()).message, /preservad|alteração/i);
  }
  assert.equal(writes, 0);
  assert.equal((await fetch(url + '/1', { headers: { 'x-test-role': 'admin' } })).status, 200);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-test-role': 'admin' } })).status, 200);
  assert.equal(creates, 1);
  assert.equal((await fetch(url + '/1', { method: 'PUT' })).status, 401);
  assert.equal((await fetch(url + '/1', { method: 'PUT', headers: { 'x-test-role': 'student' } })).status, 403);
});

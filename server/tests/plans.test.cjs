const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const express = require('express');
const filename = path.join(__dirname, '../src/services/planos.service.js');
function factory() {
  const module = { exports: {} }, req = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module,
    require: id => id === '../repositories/planos.repository' ? {} : req(id) });
  return module.exports.createPlanosService;
}
const valid = { name: 'Trimestral', price: '299.90', durationDays: 90, description: 'Acesso' };
test('planos recusam coerções e limites inválidos antes de consultar banco', async () => {
  let calls = 0;
  const service = factory()({ repo: { create: async () => { calls++; }, findById: async () => { calls++; }, update: async () => { calls++; } } });
  for (const input of [null, [], {}, ...[true, {}, 'NaN', Infinity, -1, 0, '12kg', '12.345', 100000000].map(price => ({ ...valid, price })),
    ...['30days', true, '', 1.5, 0, 3651].map(durationDays => ({ ...valid, durationDays })),
    { ...valid, name: 'x'.repeat(101) }, { ...valid, description: {} }]) {
    await assert.rejects(() => service.criar(input), e => e.statusCode === 400);
  }
  for (const id of ['1junk', '1.0', true, 0, [], '2147483648']) {
    await assert.rejects(() => service.buscarPorId(id), e => e.statusCode === 400);
    await assert.rejects(() => service.atualizar(id, valid), e => e.statusCode === 400);
  }
  assert.equal(calls, 0);
});
test('plano normaliza somente campos públicos e desativa preservando referências e histórico', async () => {
  const history = [{ planId: 3, amount: 199 }]; let fields, deactivated;
  const service = factory()({ repo: { create: async data => { fields = data; return data; }, findById: async () => ({ id: 3, active: true }),
    deactivate: async id => { deactivated = id; return { id, active: false }; } } });
  await service.criar({ ...valid, name: ' Trimestral ', id: 99, active: false, students: { deleteMany: {} } });
  assert.equal(fields.price, 299.9); assert.equal(fields.name, 'Trimestral'); assert.equal(fields.id, undefined); assert.equal(fields.active, undefined); assert.equal(fields.students, undefined);
  await service.desativar('3'); assert.equal(deactivated, 3); assert.deepEqual(history, [{ planId: 3, amount: 199 }]);
});
test('vencimento adiciona dias civis sem normalizar calendários inexistentes ou alterar a base', () => {
  const service = factory()({ repo: {} });
  const base = new Date('2024-02-28T00:00:00.000Z');
  assert.equal(service.calcularVencimento(2, base).toISOString(), '2024-03-01T00:00:00.000Z');
  assert.equal(base.toISOString(), '2024-02-28T00:00:00.000Z');
  for (const invalid of [null, true, '', '2026-02-31', '2026-13-10', 123, new Date('bad')]) {
    assert.throws(() => service.calcularVencimento(30, invalid), e => e.statusCode === 400);
  }
  assert.throws(() => service.calcularVencimento('30x', base), e => e.statusCode === 400);
});
test('HTTP mantém planos exclusivos do admin e rejeita filtro/IDs inválidos antes do banco', async t => {
  let role = 'admin', calls = 0, activeFilter;
  const service = factory()({ repo: { findAll: async active => { calls++; activeFilter = active; return []; },
    findById: async () => { calls++; return { id: 3 }; } } });
  function load(relative, stubs) {
    const file = path.join(__dirname, '../src', relative), module = { exports: {} }, req = createRequire(file);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, require: id => Object.hasOwn(stubs, id) ? stubs[id] : req(id) });
    return module.exports;
  }
  const controller = load('controllers/planos.controller.js', { '../services/planos.service': service });
  const router = load('routes/planos.routes.js', { '../controllers/planos.controller': controller, '../middleware/auth': {
    authenticate: (req, res, next) => { req.user = { id: 2, role }; next(); },
    authorize: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403)
  } });
  const app = express(); app.use(express.json()); app.use('/planos', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  t.after(() => server.close()); const url = `http://127.0.0.1:${server.address().port}/planos`;
  assert.equal((await fetch(url + '?ativo=true')).status, 200); assert.equal(activeFilter, true);
  for (const endpoint of ['?ativo=1', '?ativo=true&ativo=false', '/3junk', '/3.0']) assert.equal((await fetch(url + endpoint)).status, 400);
  assert.equal(calls, 1);
  for (role of ['instructor', 'student']) {
    for (const [endpoint, method] of [['', 'GET'], ['/3', 'GET'], ['', 'POST'], ['/3', 'PUT'], ['/3', 'DELETE']]) assert.equal((await fetch(url + endpoint, { method })).status, 403);
  }
  assert.equal(calls, 1);
});

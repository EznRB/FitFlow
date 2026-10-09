const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const rules = require('../src/utils/businessRules');

function load(file, stubs = {}) {
  const filename = path.join(__dirname, '../src', file), module = { exports: {} }, req = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, require: id => id in stubs ? stubs[id] :
    id === '../config/prisma' ? { prisma: {} } : req(id) });
  return module.exports;
}
const createService = load('services/treinos.service.js', { '../repositories/treinos.repository': {} }).createTreinosService;
const createRepository = load('repositories/treinos.repository.js').createTreinosRepository;
const admin = { id: 1, role: 'admin' }, owner = { id: 2, role: 'instructor' }, other = { id: 3, role: 'instructor' };
const valid = { studentId: 11, name: 'Ficha A', exercises: [{ name: 'Supino', muscleGroup: 'Peito', sets: 2, reps: '8-12', restSeconds: 0 }] };

test('instrutor lista apenas sua autoria; somente admin pode consultar e editar outras fichas', async () => {
  let filters, updateScope; let writes = 0;
  const repo = { findAll: async value => { filters = value; return []; },
    findById: async id => ({ id, studentId: 11, instructorId: 2, active: true }),
    updateWithExercises: async (id, fields, exercises, scope) => { updateScope = scope; writes++; return {}; },
    deactivate: async () => { writes++; } };
  const service = createService({ repo });
  await service.listar({ studentId: '11', instructorId: 3 }, owner);
  assert.equal(filters.instructorId, 2); assert.equal(filters.studentId, 11);
  await service.listar({}, admin); assert.equal(filters.instructorId, undefined);
  for (const action of [() => service.buscarPorId(5, other), () => service.atualizar(5, valid, other), () => service.desativar(5, other),
    () => service.listar({}, { id: 11, role: 'student' }), () => service.criar(valid, { id: 11, role: 'student' })]) {
    await assert.rejects(action, e => e.statusCode === 403);
  }
  assert.equal(writes, 0);
  await service.atualizar(5, valid, owner); assert.equal(updateScope.instructorId, 2);
  await service.atualizar(5, valid, admin); assert.equal(updateScope.instructorId, undefined);
});
test('seleção profissional expõe apenas id/nome e ficha não permite transferência de aluno ou autor', async () => {
  let query, created;
  const db = { student: { findMany: async q => { query = q; return [{ id: 11, user: { name: 'Ana' } }]; },
    findUnique: async () => ({ id: 11, status: 'active', user: { active: true } }) } };
  const service = createService({ db, repo: { createWithExercises: async (fields, plan) => { created = { fields, plan }; return fields; },
    findById: async () => ({ id: 5, studentId: 11, instructorId: 2, active: true }) } });
  const students = await service.listarAlunosElegiveis(owner);
  assert.deepEqual(Object.keys(students[0]).sort(), ['id', 'name']);
  assert.equal(query.where.status, 'active'); assert.equal(query.where.user.active, true);
  assert.deepEqual(Object.keys(query.select).sort(), ['id', 'user']); assert.deepEqual(Object.keys(query.select.user.select), ['name']);
  await service.criar({ ...valid, instructorId: 99 }, owner);
  assert.equal(created.fields.instructorId, 2); assert.equal(created.plan[0].restSeconds, 0);
  await assert.rejects(() => service.atualizar(5, { ...valid, studentId: 22 }, owner), e => e.statusCode === 400);
});
test('validação rejeita coerções, parâmetros ausentes e matrículas inativas', async () => {
  let writes = 0;
  const db = { student: { findUnique: async () => ({ id: 11, status: 'active', user: { active: true } }) } };
  const service = createService({ db, repo: { createWithExercises: async () => { writes++; }, findById: async () => ({ id: 5, studentId: 11, instructorId: 2, active: true }) } });
  for (const extra of [{ studentId: '11junk' }, { studentId: '11.0' }, { name: true }, { exercises: [] }, { exercises: [null] },
    ...[true, '', '3junk', 1.5, 0, 101].map(sets => ({ exercises: [{ ...valid.exercises[0], sets }] })),
    ...['12-8', '12x', true, '0'].map(reps => ({ exercises: [{ ...valid.exercises[0], reps }] })),
    ...[undefined, '', '60s', -1].map(restSeconds => ({ exercises: [{ ...valid.exercises[0], restSeconds }] }))]) {
    await assert.rejects(() => service.criar({ ...valid, ...extra }, owner), e => e.statusCode === 400);
  }
  assert.equal(writes, 0);
  db.student.findUnique = async () => ({ status: 'inactive', user: { active: true } });
  await assert.rejects(() => service.criar(valid, owner), e => e.statusCode === 400);
});
test('carga legada valida propriedade/status e aceita zero de carga externa sem inventar repetições', async () => {
  let student = { id: 11, status: 'active', user: { active: true } };
  let exercise = { workout: { studentId: 11, active: true } }, record;
  const db = { student: { findUnique: async () => student }, exercise: { findUnique: async () => exercise } };
  const service = createService({ db, repo: { createWorkoutLog: async value => { record = value; return value; } } });
  for (const weight of [true, '', '40kg', -1, NaN, 10000, 1.234]) await assert.rejects(() => service.registrarCarga({ exerciseId: 9, weight }, 4), e => e.statusCode === 400);
  await service.registrarCarga({ exerciseId: 9, weight: 0 }, 4); assert.equal(record.weight, 0); assert.equal(record.repsCompleted, null);
  exercise = { workout: { studentId: 12, active: true } }; await assert.rejects(() => service.registrarCarga({ exerciseId: 9, weight: 40 }, 4), e => e.statusCode === 403);
  exercise = { workout: { studentId: 11, active: false } }; await assert.rejects(() => service.registrarCarga({ exerciseId: 9, weight: 40 }, 4), e => e.statusCode === 409);
  student.status = 'blocked'; await assert.rejects(() => service.registrarCarga({ exerciseId: 9, weight: 40 }, 4), e => e.statusCode === 403);
});

function historyDb(logs, sessions) {
  const state = { rows: [{ id: 5, studentId: 11, instructorId: 2, name: 'Anterior', active: true }],
    exercises: [{ id: 9, workoutId: 5, name: 'Anterior' }], deletes: 0, records: logs, sessions };
  const db = { workout: {
    findFirst: async ({ where }) => state.rows.find(w => w.id === where.id && (where.instructorId === undefined || w.instructorId === where.instructorId)),
    findUnique: async ({ where }) => ({ ...state.rows.find(w => w.id === where.id), exercises: state.exercises.filter(e => e.workoutId === where.id) }),
    update: async ({ where, data }) => Object.assign(state.rows.find(w => w.id === where.id), data),
    create: async ({ data }) => { const row = { ...data, id: 6 }; state.rows.push(row); return row; },
  }, exercise: { deleteMany: async () => { state.deletes++; state.exercises = []; },
    createMany: async ({ data }) => { state.exercises.push(...data.map((e, i) => ({ ...e, id: i + 10 }))); } },
    workoutLog: { count: async () => state.records }, workoutSession: { count: async () => state.sessions } };
  db.$transaction = async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(db); };
  return { state, repo: createRepository(db) };
}
test('toda edição preserva exercícios originais e cria revisão, inclusive ficha ainda sem registros no servidor', async () => {
  for (const counts of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const s = historyDb(...counts);
    const result = await s.repo.updateWithExercises(5, { name: 'Nova' }, valid.exercises, { instructorId: 2 });
    assert.equal(s.state.deletes, 0); assert.equal(s.state.rows[0].name, 'Anterior'); assert.equal(s.state.rows[0].active, false);
    assert.equal(s.state.exercises[0].id, 9); assert.equal(s.state.exercises[0].name, 'Anterior');
    assert.equal(result.id, 6); assert.equal(result.studentId, 11); assert.equal(result.instructorId, 2);
    assert.equal(result._replacedWorkoutId, 5); assert.equal(result._historyPreserved, true);
  }
  const s = historyDb(1, 0);
  await assert.rejects(() => s.repo.updateWithExercises(5, { name: 'Outra' }, valid.exercises, { instructorId: 3 }), e => e.statusCode === 404);
  assert.equal(s.state.rows.length, 1); assert.equal(s.state.rows[0].active, true);
});
test('rotas HTTP aceitam instrutor no gerenciamento e mantêm aluno sem edição', async t => {
  let role = 'instructor';
  const calls = [];
  const handlers = Object.fromEntries(['listar', 'buscarPorId', 'criar', 'atualizar', 'desativar', 'alunosElegiveis', 'catalogo', 'meusTreinos', 'registrarCarga', 'historicoCarga'].map(name =>
    [name, (req, res) => { calls.push(name); res.json({ name }); }]));
  const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403);
  const router = load('routes/treinos.routes.js', { '../controllers/treinos.controller': handlers,
    '../middleware/auth': { authenticate: (req, res, next) => { req.user = { id: 2, role }; next(); }, authorize } });
  const app = express(); app.use('/treinos', router);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close()); const url = `http://127.0.0.1:${server.address().port}/treinos`;
  assert.equal((await fetch(`${url}/alunos`)).status, 200); assert.equal(calls.at(-1), 'alunosElegiveis');
  assert.equal((await fetch(`${url}/catalogo`)).status, 200); assert.equal(calls.at(-1), 'catalogo');
  assert.equal((await fetch(`${url}/5`, { method: 'PUT' })).status, 200);
  role = 'student';
  for (const [endpoint, method] of [['', 'GET'], ['/alunos', 'GET'], ['/5', 'PUT'], ['', 'POST'], ['/5', 'DELETE']]) {
    assert.equal((await fetch(`${url}${endpoint}`, { method })).status, 403);
  }
  assert.equal((await fetch(`${url}/meus`)).status, 200);
});
test('controller HTTP conserva ator e aplica autoria/filtros antes de retornar dados', async t => {
  let actor = owner, filters;
  const service = createService({ db: { student: { findMany: async () => [{ id: 11, user: { name: 'Ana' } }] } },
    repo: { findAll: async f => { filters = f; return []; }, findById: async () => ({ id: 5, instructorId: 2, studentId: 11, active: true }) } });
  const controller = load('controllers/treinos.controller.js', { '../services/treinos.service': service });
  const router = load('routes/treinos.routes.js', { '../controllers/treinos.controller': controller,
    '../middleware/auth': { authenticate: (req, res, next) => { req.user = actor; next(); },
      authorize: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403) } });
  const app = express(); app.use(express.json()); app.use('/treinos', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close()); const url = `http://127.0.0.1:${server.address().port}/treinos`;
  assert.equal((await fetch(`${url}?studentId=11`)).status, 200); assert.equal(filters.instructorId, 2);
  const eligible = await (await fetch(`${url}/alunos`)).json(); assert.deepEqual(eligible.data, [{ id: 11, name: 'Ana' }]);
  actor = other; assert.equal((await fetch(`${url}/5`)).status, 403);
  actor = admin; assert.equal((await fetch(`${url}/5`)).status, 200);
  assert.equal((await fetch(`${url}?active=other`)).status, 400); assert.equal((await fetch(`${url}/5junk`)).status, 400);
  actor = { id: 11, role: 'student' }; assert.equal((await fetch(`${url}/5`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) })).status, 403);
});

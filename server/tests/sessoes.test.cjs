const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessoesService, summarizeSessions } = require('../src/services/sessoes.service');
const SESSION = '7ba13137-8849-48e1-baba-346a30d8e500';
const SET = '7ba13137-8849-48e1-baba-346a30d8e501';
const OTHER = '7ba13137-8849-48e1-baba-346a30d8e502';
// Simulates a JSON database roundtrip that normalizes object key order.
// Arrays retain their order, as they do in PostgreSQL jsonb.
function reorderedJson(value) {
  if (Array.isArray(value)) return value.map(reorderedJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorderedJson(item)]));
  return value;
}
function fixture({ roundtripJson = false } = {}) {
  const sessions = new Map(), sets = new Map(), student = { id: 1, userId: 1, status: 'active', planEndDate: null };
  const workout = { id: 2, studentId: 1, active: true, name: 'Treino A', exercises: [
    { id: 3, name: 'Supino', muscleGroup: 'Peito', sets: 3, reps: '8–12', restSeconds: 90, suggestedLoad: '20', orderIndex: 0 } ] };
  const repo = {
    transaction: async fn => fn(repo), findStudent: async id => id === 1 ? student : ({ id, userId: id, status: 'active' }),
    findWorkout: async () => workout, findSession: async id => sessions.get(id), lockSession: async id => sessions.get(id),
    createSession: async data => { const row = { ...data, ...(roundtripJson ? { startRequest: reorderedJson(data.startRequest), planSnapshot: reorderedJson(data.planSnapshot) } : {}), sets: [], startedAt: new Date(data.clientStartedAt) }; sessions.set(row.id, row); return row; },
    findSet: async id => sets.get(id), createSet: async data => { const row = { ...data, ...(roundtripJson ? { payload: reorderedJson(data.payload) } : {}) }; sets.set(row.id, row); sessions.get(row.sessionId).sets.push(row); return row; },
    completeSession: async (id, data) => Object.assign(sessions.get(id), data, roundtripJson ? { completionRequest: reorderedJson(data.completionRequest) } : {}),
    listSessions: async id => [...sessions.values()].filter(s => s.studentId === id),
    listRecentSessions: async id => [...sessions.values()].filter(s => s.studentId === id),
  };
  return { service: createSessoesService(repo, { now: () => new Date('2026-10-07T12:00:00Z') }), sessions, workout, student, repo };
}
const start = { id: SESSION, workoutId: 2, clientStartedAt: '2026-10-07T10:00:00.000Z' };
const entry = { id: SET, exerciseId: 3, weightKg: 20, reps: 10, rir: 2, kind: 'working', performedAt: '2026-10-07T10:05:00.000Z', notes: 'Sem ajuda' };
const rejectsStatus = (fn, status) => assert.rejects(fn, e => e.statusCode === status);
test('retry de início aceita JSON reordenado pelo banco e rejeita valor diferente', async () => {
  const f = fixture({ roundtripJson: true });
  await f.service.start(1, start);
  assert.notDeepEqual(Object.keys(f.sessions.get(SESSION).startRequest), Object.keys(start));
  assert.equal((await f.service.start(1, start)).id, SESSION);
  assert.equal(f.sessions.size, 1);
  await rejectsStatus(() => f.service.start(1, { ...start, clientStartedAt: '2026-10-07T10:01:00.000Z' }), 409);
});
test('retry de série aceita payload JSON reordenado e mantém diferenças de tipo e valor', async () => {
  const f = fixture({ roundtripJson: true });
  await f.service.start(1, start);
  const first = await f.service.addSet(1, SESSION, entry);
  assert.notDeepEqual(Object.keys(first.payload), Object.keys(entry));
  assert.equal((await f.service.addSet(1, SESSION, entry)).id, SET);
  assert.equal(f.sessions.get(SESSION).sets.length, 1);
  await rejectsStatus(() => f.service.addSet(1, SESSION, { ...entry, notes: 'Com ajuda' }), 409);
  await rejectsStatus(() => f.service.addSet(1, SESSION, { ...entry, rir: null }), 409);
});
test('retry de finalização após roundtrip JSON preserva manifesto e rejeita outra lista', async () => {
  const f = fixture({ roundtripJson: true });
  await f.service.start(1, start);
  await f.service.addSet(1, SESSION, entry);
  await f.service.addSet(1, SESSION, { ...entry, id: OTHER });
  await f.service.complete(1, SESSION, { setIds: [OTHER, SET] });
  const result = await f.service.complete(1, SESSION, { setIds: [SET, OTHER] });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.completionRequest.setIds, [SET, OTHER].sort());
  assert.equal(result.sets.length, 2);
  await rejectsStatus(() => f.service.complete(1, SESSION, { setIds: [SET] }), 409);
});
test('snapshot sobrevive à alteração da ficha e iniciar é idempotente', async () => {
  const f = fixture();
  const first = await f.service.start(1, start);
  f.workout.exercises[0].name = 'Alterado';
  assert.equal((await f.service.start(1, start)).id, first.id);
  assert.equal(first.planSnapshot.exercises[0].name, 'Supino');
  await rejectsStatus(() => f.service.start(1, { ...start, workoutId: 99 }), 409);
});
test('bloqueia sessão e ficha de outra conta sem ler histórico', async () => {
  const f = fixture(); await f.service.start(1, start);
  await rejectsStatus(() => f.service.addSet(2, SESSION, entry), 403);
  assert.equal((await f.service.mine(2)).sessions.length, 0);
  await rejectsStatus(() => f.service.start(2, { ...start, id: OTHER }), 403);
});
test('bloqueio de matrícula impede iniciar mas permite retries e acesso ao histórico', async () => {
  const f = fixture(); await f.service.start(1, start);
  f.student.status = 'blocked';
  await f.service.start(1, start);
  await rejectsStatus(() => f.service.start(1, { ...start, id: OTHER }), 403);
  assert.equal((await f.service.mine(1)).sessions.length, 1);
});
test('retry idêntico permanece idempotente quando o registro ficou antigo', async () => {
  const f = fixture(); await f.service.start(1, start); await f.service.addSet(1, SESSION, entry);
  const later = createSessoesService(f.repo, { now: () => new Date('2028-10-07T12:00:00Z') });
  assert.equal((await later.start(1, start)).id, SESSION);
  assert.equal((await later.addSet(1, SESSION, entry)).id, SET);
});
test('resumo recente inclui séries de sessões fora da página limitada do histórico', async () => {
  const f = fixture(); await f.service.start(1, start); await f.service.addSet(1, SESSION, entry);
  f.repo.listSessions = async () => [];
  const result = await f.service.mine(1);
  assert.equal(result.sessions.length, 0);
  assert.equal(result.summary7Days.workingVolumeKg, 200);
  assert.equal(result.historyLimit, 100);
});
test('série é append-only e retry idêntico continua válido após finalizar', async () => {
  const f = fixture(); await f.service.start(1, start);
  await f.service.addSet(1, SESSION, entry);
  await f.service.addSet(1, SESSION, entry);
  await rejectsStatus(() => f.service.addSet(1, SESSION, { ...entry, reps: 8 }), 409);
  const completed = await f.service.complete(1, SESSION, { setIds: [SET] });
  assert.equal(completed.summary.workingSets, 1);
  assert.equal(completed.summary.plannedWorkingSets, 3);
  assert.equal(completed.summary.missingPlannedSets, 2);
  assert.equal(completed.summary.planFullyLogged, false);
  await f.service.addSet(1, SESSION, entry);
  await rejectsStatus(() => f.service.addSet(1, SESSION, { ...entry, id: OTHER }), 409);
  assert.equal(f.sessions.get(SESSION).sets.length, 1);
});
test('finalização exige todos os IDs da fila e retries têm o mesmo manifesto', async () => {
  const f = fixture(); await f.service.start(1, start);
  await rejectsStatus(() => f.service.complete(1, SESSION, { setIds: [SET] }), 409);
  assert.equal(f.sessions.get(SESSION).status, 'active');
  await f.service.addSet(1, SESSION, entry);
  await f.service.complete(1, SESSION, { setIds: [SET] });
  await f.service.complete(1, SESSION, { setIds: [SET] });
  await rejectsStatus(() => f.service.complete(1, SESSION, { setIds: [] }), 409);
});
test('rejeita coerções silenciosas, unidades, enums e notas inválidas', async () => {
  const f = fixture(); await f.service.start(1, start);
  for (const weightKg of [null, true, '', [], -1, 2001, '20kg', 2.345]) {
    await rejectsStatus(() => f.service.addSet(1, SESSION, { ...entry, weightKg }), 400);
  }
  for (const extra of [{ reps: 0 }, { reps: 2.5 }, { rir: '' }, { rir: true }, { rir: 11 }, { kind: 'fake' }, { notes: false }, { exerciseId: 77 }, { performedAt: '2027-01-01T00:00:00Z' }]) {
    await rejectsStatus(() => f.service.addSet(1, SESSION, { ...entry, ...extra }), 400);
  }
  const zero = await f.service.addSet(1, SESSION, { ...entry, weightKg: 0, notes: 'Peso corporal' });
  assert.equal(Number(zero.weightKg), 0);
});
test('7 dias separa aquecimento, desconhecidos e grupos diretos sem inventar secundários', () => {
  const summary = summarizeSessions([{ planSnapshot: { exercises: [{ id: 3, name: 'Supino', muscleGroup: 'Peito', sets: 3 }] }, sets: [
    { ...entry }, { ...entry, id: OTHER, kind: 'warmup', weightKg: 10 },
    { ...entry, id: 'unknown', muscleGroup: null, exerciseId: 9 },
    { ...entry, id: 'old', performedAt: '2026-09-29T00:00:00Z' },
  ] }], new Date('2026-10-07T12:00:00Z'));
  assert.equal(summary.workingVolumeKg, 400);
  assert.equal(summary.warmupVolumeKg, 100);
  assert.equal(summary.directSetsByMuscle.Peito, 1);
  assert.equal(summary.unknownMuscleSets, 1);
  assert.equal(summary.directSetsByMuscle.Triceps, undefined);
});
test('7 dias mantém categorias genéricas desconhecidas e preserva snapshot, nulo explícito e aquecimento', () => {
  const categories = [' MÚLTIPLOS ', 'multiplos', 'Mu\u0301ltiplos', ' OUTROS ', ' NÃO INFORMADO ',
    'nao   informado', ' cardio ', 'FUNCIONAL', ' '];
  const summary = summarizeSessions([{ planSnapshot: { exercises: [{ id: entry.exerciseId, muscleGroup: ' Peito ' }] },
    sets: categories.map((muscleGroup, i) => ({ ...entry, id: `generic-${i}`, muscleGroup }))
      .concat([{ ...entry, id: 'snapshot-fallback' }, { ...entry, id: 'explicit-null', muscleGroup: null },
        { ...entry, id: 'warmup-generic', muscleGroup: 'Múltiplos', kind: 'warmup', weightKg: 10 },
        { ...entry, id: 'warmup-known', muscleGroup: 'Peito', kind: 'warmup', weightKg: 10 }]),
  }], new Date('2026-10-07T12:00:00Z'));
  assert.deepEqual({ ...summary.directSetsByMuscle }, { Peito: 1 });
  assert.equal(summary.unknownMuscleSets, categories.length + 1);
  assert.equal(summary.workingSets, categories.length + 2);
  assert.equal(summary.workingVolumeKg, (categories.length + 2) * entry.weightKg * entry.reps);
  assert.equal(summary.warmupSets, 2);
  assert.equal(summary.warmupVolumeKg, 2 * 10 * entry.reps);
});

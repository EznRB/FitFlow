// Teste integrado opt-in: grava somente registros na demonstração local e preserva histórico.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
if (process.env.LOCAL_DB_MANAGED !== 'fitflow-native-v1' || process.env.NODE_ENV === 'production' ||
    new URL(process.env.DATABASE_URL).hostname !== '127.0.0.1') throw new Error('Smoke permitido somente na demonstração local.');
const accounts = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../.demo-credentials.local.json')));
const base = 'http://127.0.0.1:3107/api';
async function request(route, cookie, method = 'GET', body) {
  const res = await fetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: 'http://127.0.0.1:3107', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
async function login(account) {
  const result = await request('/auth/login', null, 'POST', account);
  assert.equal(result.status, 200); assert.ok(result.cookie); return result.cookie;
}
async function main() {
  assert.equal((await request('/health')).body.database, 'ready');
  const student = await login(accounts.student), other = await login(accounts.secondStudent), blocked = await login(accounts.blockedStudent), admin = await login(accounts.admin);
  assert.equal((await request('/relatorios/dashboard', student)).status, 403);
  assert.equal((await request('/relatorios/inadimplencia', admin)).status, 200);
  const workouts = (await request('/treinos/meus', student)).body.data;
  const workout = Array.isArray(workouts) ? workouts[0] : workouts.workouts?.[0];
  assert.ok(workout?.id && workout.exercises.length);
  const start = { id: randomUUID(), workoutId: workout.id, clientStartedAt: new Date().toISOString() };
  const starts = await Promise.all(Array.from({ length: 4 }, () => request('/sessoes/start', student, 'POST', start)));
  for (const result of starts) assert.ok([200, 201].includes(result.status), 'Retries simultâneos de início devem ser idempotentes.');
  const set = { id: randomUUID(), exerciseId: workout.exercises[0].id, weightKg: 25, reps: 8, kind: 'working', rir: 2,
    performedAt: new Date().toISOString(), notes: 'Teste integrado local: sincronização concorrente.' };
  const sets = await Promise.all(Array.from({ length: 4 }, () => request(`/sessoes/${start.id}/sets`, student, 'POST', set)));
  for (const result of sets) assert.ok([200, 201].includes(result.status), 'Retries simultâneos de série devem ser idempotentes.');
  assert.equal((await request(`/sessoes/${start.id}/sets`, other, 'POST', { ...set, id: randomUUID() })).status, 403);
  assert.equal((await request(`/sessoes/${start.id}/sets`, student, 'POST', { ...set, reps: 9 })).status, 409);
  assert.equal((await request(`/sessoes/${start.id}/complete`, student, 'POST', { setIds: [] })).status, 409);
  const completions = await Promise.all(Array.from({ length: 3 }, () => request(`/sessoes/${start.id}/complete`, student, 'POST', { setIds: [set.id] })));
  for (const result of completions) assert.equal(result.status, 200);
  const history = (await request('/sessoes/mine', student)).body.data;
  const saved = history.sessions.find(session => session.id === start.id);
  assert.equal(saved.sets.length, 1); assert.equal(saved.summary.workingVolumeKg, 200); assert.equal(saved.status, 'completed');
  const blockedStart = await request('/sessoes/start', blocked, 'POST', { ...start, id: randomUUID() });
  assert.ok([403, 404].includes(blockedStart.status));
  console.log('Smoke local passou: login, relatórios, ownership, concorrência, idempotência e volume persistido.');
}
main().catch(error => { console.error('Smoke local falhou:', error.message); process.exitCode = 1; });

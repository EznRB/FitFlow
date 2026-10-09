// Opt-in integration gate; writes only new append-only records in the managed local demo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createSessoesService } = require('../src/services/sessoes.service');
const { createSessoesRepository } = require('../src/repositories/sessoes.repository');
const local = process.env.LOCAL_DB_MANAGED === 'fitflow-native-v1' && process.env.NODE_ENV !== 'production' &&
  (() => { try { return new URL(process.env.DATABASE_URL).hostname === '127.0.0.1'; } catch { return false; } })();
test('MariaDB real serializa quatro retries e mantém um único registro de série', { skip: !local }, async () => {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ log: [] });
  try {
    const workout = await db.workout.findFirst({ where: { active: true, student: { status: 'active', user: { active: true } } }, include: { student: { select: { userId: true } }, exercises: true } });
    assert.ok(workout?.exercises.length, 'A demonstração local precisa de uma ficha ativa.');
    const service = createSessoesService(createSessoesRepository(db));
    const start = { id: randomUUID(), workoutId: workout.id, clientStartedAt: new Date().toISOString() };
    const starts = await Promise.allSettled(Array.from({ length: 4 }, () => service.start(workout.student.userId, start)));
    const errors = results => results.filter(r => r.status === 'rejected').map(r => `${r.reason.name}:${r.reason.code || r.reason.statusCode || 'unknown'}:db${r.reason.meta?.code || 'none'}:${String(r.reason.message).split('\n').slice(-3).join(' ').slice(0, 300)}`).join(',');
    assert.ok(starts.every(r => r.status === 'fulfilled'), `Start retries rejected: ${errors(starts)}`);
    const set = { id: randomUUID(), exerciseId: workout.exercises[0].id, weightKg: 25, reps: 8, rir: 2, kind: 'working', performedAt: new Date().toISOString() };
    const sets = await Promise.allSettled(Array.from({ length: 4 }, () => service.addSet(workout.student.userId, start.id, set)));
    assert.ok(sets.every(r => r.status === 'fulfilled'), `Set retries rejected: ${errors(sets)}`);
    const completed = await Promise.allSettled(Array.from({ length: 3 }, () => service.complete(workout.student.userId, start.id, { setIds: [set.id] })));
    assert.ok(completed.every(r => r.status === 'fulfilled'), `Complete retries rejected: ${errors(completed)}`);
    const saved = await db.workoutSession.findUnique({ where: { id: start.id }, include: { sets: true } });
    assert.equal(saved.sets.length, 1); assert.equal(saved.status, 'completed');
    assert.equal(Number(saved.sets[0].weightKg) * saved.sets[0].reps, 200);
    const racingStart = { ...start, id: randomUUID() };
    await service.start(workout.student.userId, racingStart);
    const firstSet = { ...set, id: randomUUID() }, racingSet = { ...set, id: randomUUID() };
    await service.addSet(workout.student.userId, racingStart.id, firstSet);
    const [append, close] = await Promise.allSettled([
      service.addSet(workout.student.userId, racingStart.id, racingSet),
      service.complete(workout.student.userId, racingStart.id, { setIds: [firstSet.id] }),
    ]);
    if (close.status === 'fulfilled') {
      assert.equal(append.status, 'rejected'); assert.equal(append.reason.statusCode, 409);
    } else {
      assert.equal(close.reason.statusCode, 409); assert.equal(append.status, 'fulfilled');
      await service.complete(workout.student.userId, racingStart.id, { setIds: [firstSet.id, racingSet.id] });
    }
    const racingSaved = await db.workoutSession.findUnique({ where: { id: racingStart.id }, include: { sets: true } });
    assert.equal(racingSaved.status, 'completed');
    assert.equal(racingSaved.sets.length, close.status === 'fulfilled' ? 1 : 2);
  } finally { await db.$disconnect(); }
});

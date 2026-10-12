// Integration gate restricted to native MariaDB; UUID accounts own all writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createSessoesService } = require('../src/services/sessoes.service');
const { createSessoesRepository } = require('../src/repositories/sessoes.repository');
const local = process.env.LOCAL_DB_MANAGED === 'fitflow-native-v1' && process.env.NODE_ENV !== 'production' &&
  (() => { try { const url = new URL(process.env.DATABASE_URL); return url.protocol === 'mysql:' && url.hostname === '127.0.0.1' && url.port === '3308' && url.pathname === '/fitflow_dev'; } catch { return false; } })();
test('MariaDB real serializa quatro retries e mantém um único registro de série', { skip: !local }, async () => {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ log: [] });
  const userIds = [], sessionIds = [randomUUID(), randomUUID()];
  const prefix = 'Concurrency fixture ' + randomUUID();
  let student, workout, plan, exercise;
  try {
    const passwordHash = await require('bcryptjs').hash(randomUUID(), 4);
    for (const role of ['student', 'instructor']) userIds.push((await db.user.create({ data: { name: prefix, email: randomUUID() + '@example.invalid', role, passwordHash } })).id);
    plan = await db.plan.create({ data: { name: prefix, price: '100.00', durationDays: 30 } });
    student = await db.student.create({ data: { userId: userIds[0], planId: plan.id, planEndDate: new Date('2099-11-01T00:00:00.000Z') } });
    workout = await db.workout.create({ data: { name: prefix, studentId: student.id, instructorId: userIds[1] } });
    exercise = await db.exercise.create({ data: { workoutId: workout.id, name: prefix, muscleGroup: 'Peito', sets: 2, reps: '8–12', restSeconds: 90 } });
    const service = createSessoesService(createSessoesRepository(db));
    const start = { id: sessionIds[0], workoutId: workout.id, clientStartedAt: new Date().toISOString() };
    const starts = await Promise.allSettled(Array.from({ length: 4 }, () => service.start(student.userId, start)));
    const errors = results => results.filter(r => r.status === 'rejected').map(r => `${r.reason.name}:${r.reason.code || r.reason.statusCode || 'unknown'}:db${r.reason.meta?.code || 'none'}:${String(r.reason.message).split('\n').slice(-3).join(' ').slice(0, 300)}`).join(',');
    assert.ok(starts.every(r => r.status === 'fulfilled'), `Start retries rejected: ${errors(starts)}`);
    const set = { id: randomUUID(), exerciseId: exercise.id, weightKg: 25, reps: 8, rir: 2, kind: 'working', performedAt: new Date().toISOString() };
    const sets = await Promise.allSettled(Array.from({ length: 4 }, () => service.addSet(student.userId, start.id, set)));
    assert.ok(sets.every(r => r.status === 'fulfilled'), `Set retries rejected: ${errors(sets)}`);
    const completed = await Promise.allSettled(Array.from({ length: 3 }, () => service.complete(student.userId, start.id, { setIds: [set.id] })));
    assert.ok(completed.every(r => r.status === 'fulfilled'), `Complete retries rejected: ${errors(completed)}`);
    const saved = await db.workoutSession.findUnique({ where: { id: start.id }, include: { sets: true } });
    assert.equal(saved.sets.length, 1); assert.equal(saved.status, 'completed');
    assert.equal(Number(saved.sets[0].weightKg) * saved.sets[0].reps, 200);
    const racingStart = { ...start, id: sessionIds[1] };
    await service.start(student.userId, racingStart);
    const firstSet = { ...set, id: randomUUID() }, racingSet = { ...set, id: randomUUID() };
    await service.addSet(student.userId, racingStart.id, firstSet);
    const [append, close] = await Promise.allSettled([
      service.addSet(student.userId, racingStart.id, racingSet),
      service.complete(student.userId, racingStart.id, { setIds: [firstSet.id] }),
    ]);
    if (close.status === 'fulfilled') {
      assert.equal(append.status, 'rejected'); assert.equal(append.reason.statusCode, 409);
    } else {
      assert.equal(close.reason.statusCode, 409); assert.equal(append.status, 'fulfilled');
      await service.complete(student.userId, racingStart.id, { setIds: [firstSet.id, racingSet.id] });
    }
    const racingSaved = await db.workoutSession.findUnique({ where: { id: racingStart.id }, include: { sets: true } });
    assert.equal(racingSaved.status, 'completed');
    assert.equal(racingSaved.sets.length, close.status === 'fulfilled' ? 1 : 2);
  } finally {
    try {
      const cleanup = [db.workoutSet.deleteMany({ where: { sessionId: { in: sessionIds } } }), db.workoutSession.deleteMany({ where: { id: { in: sessionIds } } })];
      if (exercise) cleanup.push(db.exercise.delete({ where: { id: exercise.id } }));
      if (workout) cleanup.push(db.workout.delete({ where: { id: workout.id } }));
      if (student) cleanup.push(db.student.delete({ where: { id: student.id } }));
      if (userIds.length) cleanup.push(db.user.deleteMany({ where: { id: { in: userIds }, name: prefix } }));
      if (plan) cleanup.push(db.plan.delete({ where: { id: plan.id } }));
      await db.$transaction(cleanup);
      assert.equal(await db.workoutSession.count({ where: { id: { in: sessionIds } } }), 0);
      assert.equal(await db.user.count({ where: { id: { in: userIds } } }), 0);
    } finally { await db.$disconnect(); }
  }
});

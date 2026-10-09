'use strict';
function retryableTransactionError(error) {
  if (['P2002', 'P2034'].includes(error.code)) return true;
  // Prisma 6 exposes some MariaDB snapshot conflicts as an unknown connector error.
  // Retry only database concurrency codes, not arbitrary query or application failures.
  if (error.code === 'P2010' && ([1020, 1205, 1213].includes(Number(error.meta?.code))
    || ['40001', '40P01'].includes(String(error.meta?.code)))) return true;
  return error.name === 'PrismaClientUnknownRequestError' && /MysqlError \{ code: (?:1020|1205|1213)\b/.test(error.message || '');
}
function createSessoesRepository(db, insideTransaction = false) {
  const include = { sets: { orderBy: [{ performedAt: 'asc' }, { id: 'asc' }] } };
  const repo = {
    findStudent: userId => db.student.findUnique({ where: { userId }, select: { id: true, userId: true, status: true, planEndDate: true } }),
    findWorkout: id => db.workout.findUnique({ where: { id }, include: { exercises: { orderBy: { orderIndex: 'asc' } } } }),
    findSession: id => db.workoutSession.findUnique({ where: { id }, include }),
    async lockSession(id) {
      // Row lock serializes adding a set and completing the same session.
      await db.$queryRaw`SELECT id FROM workout_sessions WHERE id = ${id} FOR UPDATE`;
      return repo.findSession(id);
    },
    createSession: data => db.workoutSession.create({ data, include }),
    findSet: id => db.workoutSet.findUnique({ where: { id } }),
    createSet: data => db.workoutSet.create({ data }),
    completeSession: (id, data) => db.workoutSession.update({ where: { id }, data, include }),
    listSessions: studentId => db.workoutSession.findMany({ where: { studentId }, include, orderBy: { startedAt: 'desc' }, take: 100 }),
    listRecentSessions: (studentId, from, to) => db.workoutSession.findMany({
      where: { studentId, sets: { some: { performedAt: { gte: from, lte: to } } } },
      select: { planSnapshot: true, sets: { where: { performedAt: { gte: from, lte: to } }, select: { exerciseId: true, muscleGroup: true, weightKg: true, reps: true, kind: true, performedAt: true } } },
    }),
    async transaction(fn) {
      if (insideTransaction) return fn(repo);
      // Concurrent UUID inserts or serializable conflicts are re-read by the service.
      for (let attempt = 0; ; attempt++) {
        try { return await db.$transaction(tx => fn(createSessoesRepository(tx, true)), { isolationLevel: 'Serializable' }); }
        catch (error) { if (attempt >= 2 || !retryableTransactionError(error)) throw error; }
      }
    },
  };
  return repo;
}
module.exports = { createSessoesRepository };

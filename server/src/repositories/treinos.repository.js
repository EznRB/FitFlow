'use strict';
const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
// Ficha responses expose names, not enrollment, contact or payment details.
const identity = { instructor: { select: { id: true, name: true } },
  student: { select: { id: true, user: { select: { name: true } } } } };
const plan = { ...identity, exercises: { orderBy: { orderIndex: 'asc' } } };
const detail = { ...identity, exercises: { orderBy: { orderIndex: 'asc' },
  include: { workoutLogs: { orderBy: { createdAt: 'desc' }, take: 1,
    select: { weight: true, repsCompleted: true, createdAt: true } } } } };

function createTreinosRepository(db = prisma) {
  async function transaction(action) {
    for (let attempt = 0; ; attempt++) {
      try { return await db.$transaction(action, { isolationLevel: 'Serializable' }); }
      catch (error) { if (error.code !== 'P2034' || attempt >= 2) throw error; }
    }
  }
  async function create(tx, fields, exercises) {
    const workout = await tx.workout.create({ data: { ...fields, active: true } });
    await tx.exercise.createMany({ data: exercises.map(ex => ({ ...ex, workoutId: workout.id })) });
    return tx.workout.findUnique({ where: { id: workout.id }, include: plan });
  }
  return {
    findAll: filters => db.workout.findMany({ where: filters, include: plan, orderBy: { createdAt: 'desc' } }),
    findById: id => db.workout.findUnique({ where: { id }, include: detail }),
    findByStudentId: studentId => db.workout.findMany({ where: { studentId, active: true },
      include: { instructor: identity.instructor, exercises: detail.exercises }, orderBy: { createdAt: 'desc' } }),
    findHistoryByStudentId: studentId => db.workout.findMany({ where: { studentId },
      include: { instructor: identity.instructor, exercises: plan.exercises }, orderBy: { createdAt: 'desc' } }),
    createWithExercises: (fields, exercises) => transaction(tx => create(tx, fields, exercises)),
    async updateWithExercises(id, fields, exercises, scope = {}) {
      return transaction(async tx => {
        const current = await tx.workout.findFirst({ where: { id, ...scope } });
        if (!current) throw new AppError('Ficha não encontrada para este instrutor.', 404);
        if (!current.active) throw new AppError('Ficha arquivada.', 409);
        // A plan may already be cached on a disconnected phone before its
        // first session reaches the server. Never replace exercise identities
        // under an existing workout ID, even when no server logs exist yet.
        await tx.workout.update({ where: { id }, data: { active: false } });
        const revision = await create(tx, { ...fields, studentId: current.studentId, instructorId: current.instructorId }, exercises);
        return { ...revision, _replacedWorkoutId: id, _historyPreserved: true };
      });
    },
    async deactivate(id, scope = {}) {
      const result = await db.workout.updateMany({ where: { id, ...scope }, data: { active: false } });
      if (!result.count) throw new AppError('Ficha não encontrada para este instrutor.', 404);
      return { id, active: false };
    },
    createWorkoutLog: data => transaction(async tx => {
      const owned = await tx.exercise.findFirst({ where: { id: data.exerciseId, workout: { studentId: data.studentId, active: true } }, select: { id: true } });
      if (!owned) throw new AppError('O exercício não está em uma ficha ativa deste aluno.', 409);
      return tx.workoutLog.create({ data, include: { exercise: { select: { name: true, suggestedLoad: true, workoutId: true } } } });
    }),
    findWorkoutLogs: (studentId, exerciseId = null) => db.workoutLog.findMany({ where: { studentId, ...(exerciseId === null ? {} : { exerciseId }) },
      include: { exercise: { select: { name: true, muscleGroup: true, workoutId: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
  };
}
module.exports = { ...createTreinosRepository(), createTreinosRepository };

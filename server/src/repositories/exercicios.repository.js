/**
 * ============================================
 * FitFlow Caraguá — Repository de Exercícios
 * ============================================
 * Acesso a dados de exercícios de treinos via Prisma.
 */

const { prisma } = require('../config/prisma');

class ExerciciosRepository {
  async findByWorkoutId(workoutId) {
    return prisma.exercise.findMany({
      where: { workoutId: parseInt(workoutId) },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async findById(id) {
    return prisma.exercise.findUnique({
      where: { id: parseInt(id) },
      include: { workout: { select: { id: true, name: true, studentId: true } } },
    });
  }

  async create(data) {
    return prisma.exercise.create({ data });
  }

  async createMany(workoutId, exercises) {
    return prisma.exercise.createMany({
      data: exercises.map((ex, index) => ({
        ...ex,
        workoutId: parseInt(workoutId),
        orderIndex: ex.orderIndex ?? index + 1,
      })),
    });
  }

  async update(id, data) {
    return prisma.exercise.update({ where: { id: parseInt(id) }, data });
  }

  async delete(id) {
    return prisma.exercise.delete({ where: { id: parseInt(id) } });
  }

  async reorder(workoutId, orderedIds) {
    const updates = orderedIds.map((exerciseId, index) =>
      prisma.exercise.update({
        where: { id: exerciseId },
        data: { orderIndex: index + 1 },
      })
    );
    return prisma.$transaction(updates);
  }
}

module.exports = new ExerciciosRepository();

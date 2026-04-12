/**
 * ============================================
 * FitFlow Caraguá — Repository de Treinos
 * ============================================
 * Camada de acesso a dados para treinos (workouts),
 * exercícios vinculados e histórico de cargas.
 * 
 * Utiliza Prisma Client para todas as operações.
 * Transações garantem atomicidade na criação/edição.
 * 
 * Modelos envolvidos:
 * - Workout (treinos)
 * - Exercise (exercícios do treino)  
 * - WorkoutLog (histórico de cargas - append-only)
 */

const { prisma } = require('../config/prisma');

class TreinosRepository {

  // ============================================
  // CONSULTAS DE TREINOS
  // ============================================

  /**
   * Lista todos os treinos com filtros opcionais.
   * Retorna dados do aluno, instrutor e exercícios.
   * @param {object} filters - { studentId, active }
   * @returns {Promise<Array>} Lista de treinos
   */
  async findAll(filters = {}) {
    const where = {};

    // Filtra por aluno específico, se fornecido
    if (filters.studentId) where.studentId = parseInt(filters.studentId);

    // Filtra por status ativo/inativo (permite ver histórico)
    if (filters.active !== undefined) where.active = filters.active;

    return prisma.workout.findMany({
      where,
      include: {
        // Inclui nome do aluno via relação User
        student: { 
          include: { 
            user: { select: { id: true, name: true, email: true } } 
          } 
        },
        // Inclui nome do instrutor que criou o treino
        instructor: { select: { id: true, name: true } },
        // Inclui exercícios ordenados pela posição
        exercises: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca um treino específico por ID com todos os relacionamentos.
   * Carrega exercícios, dados do aluno e instrutor.
   * @param {number} id - ID do treino
   * @returns {Promise<object|null>} Treino encontrado ou null
   */
  async findById(id) {
    return prisma.workout.findUnique({
      where: { id: parseInt(id) },
      include: {
        student: { 
          include: { 
            user: { select: { id: true, name: true, email: true } } 
          } 
        },
        instructor: { select: { id: true, name: true } },
        exercises: { 
          orderBy: { orderIndex: 'asc' },
          // Inclui o último log de carga de cada exercício
          include: {
            workoutLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { weight: true, repsCompleted: true, createdAt: true }
            }
          }
        },
      },
    });
  }

  /**
   * Busca treinos ATIVOS de um aluno específico.
   * Usado na visão do aluno para ver sua ficha atual.
   * @param {number} studentId - ID do aluno (tabela students)
   * @returns {Promise<Array>} Treinos ativos do aluno
   */
  async findByStudentId(studentId) {
    return prisma.workout.findMany({
      where: { 
        studentId: parseInt(studentId), 
        active: true 
      },
      include: {
        instructor: { select: { id: true, name: true } },
        exercises: { 
          orderBy: { orderIndex: 'asc' },
          include: {
            workoutLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { weight: true, repsCompleted: true, createdAt: true }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca TODOS os treinos de um aluno (ativos + inativos).
   * Preserva o histórico completo de fichas anteriores.
   * @param {number} studentId - ID do aluno
   * @returns {Promise<Array>} Todos os treinos do aluno
   */
  async findHistoryByStudentId(studentId) {
    return prisma.workout.findMany({
      where: { studentId: parseInt(studentId) },
      include: {
        instructor: { select: { id: true, name: true } },
        exercises: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // CRIAÇÃO E EDIÇÃO DE TREINOS
  // ============================================

  /**
   * Cria um treino com exercícios em uma transação atômica.
   * Garante que treino + exercícios sejam criados juntos.
   * @param {object} workoutData - { name, description, notes, studentId, instructorId }
   * @param {Array} exercises - Lista de exercícios com { name, muscleGroup, sets, reps, suggestedLoad, notes, orderIndex }
   * @returns {Promise<object>} Treino criado com exercícios
   */
  async createWithExercises(workoutData, exercises) {
    return prisma.$transaction(async (tx) => {
      // 1. Cria o treino principal
      const workout = await tx.workout.create({
        data: {
          name: workoutData.name,
          description: workoutData.description || null,
          notes: workoutData.notes || null,
          studentId: parseInt(workoutData.studentId),
          instructorId: parseInt(workoutData.instructorId),
          active: true,
        },
      });

      // 2. Insere os exercícios vinculados ao treino
      if (exercises && exercises.length > 0) {
        await tx.exercise.createMany({
          data: exercises.map((ex, index) => ({
            workoutId: workout.id,
            name: ex.name,
            muscleGroup: ex.muscleGroup || null,
            sets: parseInt(ex.sets) || 3,
            reps: String(ex.reps || '12'),
            restSeconds: parseInt(ex.restSeconds) || 60,
            suggestedLoad: ex.suggestedLoad || null,
            notes: ex.notes || null,
            orderIndex: ex.orderIndex ?? index + 1,
          })),
        });
      }

      // 3. Retorna o treino completo com exercícios
      return tx.workout.findUnique({
        where: { id: workout.id },
        include: {
          student: { include: { user: { select: { name: true } } } },
          instructor: { select: { name: true } },
          exercises: { orderBy: { orderIndex: 'asc' } },
        },
      });
    });
  }

  /**
   * Atualiza um treino e substitui seus exercícios.
   * Deleta exercícios antigos e insere os novos (abordagem replace-all).
   * O histórico de cargas é preservado pois usa ON DELETE RESTRICT.
   * 
   * IMPORTANTE: Se existirem logs vinculados aos exercícios antigos,
   * NÃO deleta os exercícios (preservação do histórico).
   * Em vez disso, desativa o treino atual e cria um novo.
   * 
   * @param {number} id - ID do treino
   * @param {object} workoutData - Dados atualizados do treino
   * @param {Array} exercises - Nova lista de exercícios
   * @returns {Promise<object>} Treino atualizado
   */
  async updateWithExercises(id, workoutData, exercises) {
    const workoutId = parseInt(id);

    return prisma.$transaction(async (tx) => {
      // Verifica se existem logs vinculados aos exercícios atuais
      const existingLogs = await tx.workoutLog.count({
        where: { exercise: { workoutId } },
      });

      if (existingLogs > 0) {
        // Se existem logs, NÃO altera os exercícios para preservar histórico.
        // Apenas atualiza os metadados do treino (nome, descrição, notas).
        const updated = await tx.workout.update({
          where: { id: workoutId },
          data: {
            name: workoutData.name,
            description: workoutData.description || null,
            notes: workoutData.notes || null,
          },
          include: {
            student: { include: { user: { select: { name: true } } } },
            instructor: { select: { name: true } },
            exercises: { orderBy: { orderIndex: 'asc' } },
          },
        });
        // Sinaliza que exercícios não foram alterados
        updated._exercisesLocked = true;
        return updated;
      }

      // Se NÃO existem logs, pode substituir exercícios livremente
      // 1. Remove exercícios antigos
      await tx.exercise.deleteMany({ where: { workoutId } });

      // 2. Atualiza dados do treino
      await tx.workout.update({
        where: { id: workoutId },
        data: {
          name: workoutData.name,
          description: workoutData.description || null,
          notes: workoutData.notes || null,
        },
      });

      // 3. Insere novos exercícios
      if (exercises && exercises.length > 0) {
        await tx.exercise.createMany({
          data: exercises.map((ex, index) => ({
            workoutId,
            name: ex.name,
            muscleGroup: ex.muscleGroup || null,
            sets: parseInt(ex.sets) || 3,
            reps: String(ex.reps || '12'),
            restSeconds: parseInt(ex.restSeconds) || 60,
            suggestedLoad: ex.suggestedLoad || null,
            notes: ex.notes || null,
            orderIndex: ex.orderIndex ?? index + 1,
          })),
        });
      }

      // 4. Retorna treino atualizado
      return tx.workout.findUnique({
        where: { id: workoutId },
        include: {
          student: { include: { user: { select: { name: true } } } },
          instructor: { select: { name: true } },
          exercises: { orderBy: { orderIndex: 'asc' } },
        },
      });
    });
  }

  /**
   * Desativa um treino (soft delete).
   * Preserva os dados para histórico — nunca deleta fisicamente.
   * @param {number} id - ID do treino
   * @returns {Promise<object>} Treino desativado
   */
  async deactivate(id) {
    return prisma.workout.update({
      where: { id: parseInt(id) },
      data: { active: false },
    });
  }

  // ============================================
  // HISTÓRICO DE CARGAS (APPEND-ONLY)
  // ============================================

  /**
   * Registra uma carga executada pelo aluno.
   * Inserção append-only: sem UPDATE nem DELETE.
   * @param {object} data - { studentId, exerciseId, weight, repsCompleted, notes }
   * @returns {Promise<object>} Registro de carga criado
   */
  async createWorkoutLog(data) {
    return prisma.workoutLog.create({
      data: {
        studentId: parseInt(data.studentId),
        exerciseId: parseInt(data.exerciseId),
        weight: parseFloat(data.weight),
        repsCompleted: data.repsCompleted ? parseInt(data.repsCompleted) : null,
        notes: data.notes || null,
      },
      include: {
        exercise: { 
          select: { name: true, suggestedLoad: true, workoutId: true } 
        },
      },
    });
  }

  /**
   * Busca histórico de cargas de um aluno, opcionalmente por exercício.
   * @param {number} studentId - ID do aluno
   * @param {number|null} exerciseId - ID do exercício (opcional)
   * @returns {Promise<Array>} Lista de registros de carga
   */
  async findWorkoutLogs(studentId, exerciseId = null) {
    const where = { studentId: parseInt(studentId) };
    if (exerciseId) where.exerciseId = parseInt(exerciseId);

    return prisma.workoutLog.findMany({
      where,
      include: {
        exercise: { 
          select: { name: true, muscleGroup: true, workoutId: true } 
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limita para performance
    });
  }
}

module.exports = new TreinosRepository();

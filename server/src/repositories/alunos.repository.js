/**
 * ============================================
 * FitFlow Caraguá — Repository de Alunos
 * ============================================
 * Camada de acesso a dados via Prisma Client.
 * Encapsula todas as queries relacionadas a alunos.
 */

const { prisma } = require('../config/prisma');

class AlunosRepository {
  /**
   * Lista todos os alunos com dados do usuário e plano.
   * @param {object} filters - Filtros opcionais (status, planId, search)
   */
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) where.status = filters.status;
    if (filters.planId) where.planId = parseInt(filters.planId);
    if (filters.search) {
      where.user = {
        OR: [
          { name: { contains: filters.search } },
          { email: { contains: filters.search } },
        ],
      };
    }

    return prisma.student.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, active: true } },
        plan: { select: { id: true, name: true, price: true, durationDays: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca aluno por ID com todos os relacionamentos.
   */
  async findById(id) {
    return prisma.student.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, active: true } },
        plan: true,
        workouts: {
          where: { active: true },
          include: { exercises: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
  }

  /**
   * Busca aluno pelo userId.
   */
  async findByUserId(userId) {
    return prisma.student.findUnique({
      where: { userId: parseInt(userId) },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        plan: true,
      },
    });
  }

  /**
   * Cria um novo aluno.
   */
  async create(data) {
    return prisma.student.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: true,
      },
    });
  }

  /**
   * Atualiza um aluno existente.
   */
  async update(id, data) {
    return prisma.student.update({
      where: { id: parseInt(id) },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: true,
      },
    });
  }

  /**
   * Busca alunos com mensalidade vencida há mais de N dias.
   * Usado para o bloqueio automático.
   */
  async findOverdue(graceDays = 5) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - graceDays);

    return prisma.student.findMany({
      where: {
        status: 'active',
        planEndDate: { lt: cutoffDate },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Total de alunos por status.
   */
  async countByStatus() {
    const results = await prisma.student.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    return results.reduce((acc, r) => {
      acc[r.status] = r._count.status;
      return acc;
    }, {});
  }
}

module.exports = new AlunosRepository();

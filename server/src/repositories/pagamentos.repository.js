/**
 * ============================================
 * FitFlow Caraguá — Repository de Pagamentos
 * ============================================
 * Acesso a dados de pagamentos via Prisma.
 */

const { prisma } = require('../config/prisma');

class PagamentosRepository {
  async findAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.studentId) where.studentId = parseInt(filters.studentId);
    if (filters.startDate && filters.endDate) {
      where.paymentDate = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    return prisma.payment.findMany({
      where,
      include: {
        student: { include: { user: { select: { name: true } } } },
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.payment.findUnique({
      where: { id: parseInt(id) },
      include: {
        student: { include: { user: { select: { name: true } } } },
        plan: true,
      },
    });
  }

  async findByStudentId(studentId) {
    return prisma.payment.findMany({
      where: { studentId: parseInt(studentId) },
      include: { plan: { select: { name: true } } },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async create(data) {
    return prisma.payment.create({
      data,
      include: {
        student: { include: { user: { select: { name: true } } } },
        plan: { select: { name: true } },
      },
    });
  }

  async update(id, data) {
    return prisma.payment.update({
      where: { id: parseInt(id) },
      data,
    });
  }

  /**
   * Calcula receita total por período.
   */
  async totalRevenue(startDate, endDate) {
    const result = await prisma.payment.aggregate({
      where: {
        status: 'paid',
        paymentDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      _sum: { amount: true },
      _count: true,
    });
    return {
      total: result._sum.amount || 0,
      count: result._count,
    };
  }

  /**
   * Busca pagamentos vencidos para atualizar status.
   */
  async findPendingOverdue() {
    return prisma.payment.findMany({
      where: {
        status: 'pending',
        dueDate: { lt: new Date() },
      },
    });
  }
}

module.exports = new PagamentosRepository();

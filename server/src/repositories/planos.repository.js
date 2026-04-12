/**
 * ============================================
 * FitFlow Caraguá — Repository de Planos
 * ============================================
 * Acesso a dados de planos via Prisma.
 */

const { prisma } = require('../config/prisma');

class PlanosRepository {
  async findAll(activeOnly = false) {
    const where = activeOnly ? { active: true } : {};
    return prisma.plan.findMany({ where, orderBy: { price: 'asc' } });
  }

  async findById(id) {
    return prisma.plan.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { students: true } } },
    });
  }

  async create(data) {
    return prisma.plan.create({ data });
  }

  async update(id, data) {
    return prisma.plan.update({ where: { id: parseInt(id) }, data });
  }

  async deactivate(id) {
    return prisma.plan.update({
      where: { id: parseInt(id) },
      data: { active: false },
    });
  }
}

module.exports = new PlanosRepository();

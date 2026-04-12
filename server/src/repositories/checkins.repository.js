/**
 * ============================================
 * FitFlow Caraguá — Repository de Check-ins
 * ============================================
 * Acesso a dados de check-ins via Prisma.
 * ⚠️ Sem método delete — regra de negócio.
 */

const { prisma } = require('../config/prisma');

class CheckinsRepository {
  async findAll(filters = {}) {
    const where = {};
    if (filters.studentId) where.studentId = parseInt(filters.studentId);
    if (filters.date) where.checkinDate = new Date(filters.date);
    if (filters.startDate && filters.endDate) {
      where.checkinDate = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    return prisma.checkin.findMany({
      where,
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStudentId(studentId, limit = 30) {
    return prisma.checkin.findMany({
      where: { studentId: parseInt(studentId) },
      orderBy: { checkinDate: 'desc' },
      take: limit,
    });
  }

  /**
   * Registra check-in do dia.
   * A constraint UNIQUE(studentId, checkinDate) previne duplicatas.
   */
  async create(studentId) {
    const now = new Date();
    return prisma.checkin.create({
      data: {
        studentId: parseInt(studentId),
        checkinDate: now,
        checkinTime: now,
      },
    });
  }

  /**
   * Verifica se o aluno já fez check-in hoje.
   */
  async hasCheckedInToday(studentId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkin = await prisma.checkin.findFirst({
      where: {
        studentId: parseInt(studentId),
        checkinDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    return !!checkin;
  }

  /**
   * Conta check-ins de hoje (para dashboard).
   */
  async countToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.checkin.count({
      where: {
        checkinDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  /**
   * Frequência por aluno nos últimos N dias.
   */
  async frequencyByStudent(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.checkin.groupBy({
      by: ['studentId'],
      where: { checkinDate: { gte: startDate } },
      _count: { studentId: true },
      orderBy: { _count: { studentId: 'desc' } },
    });
  }
}

module.exports = new CheckinsRepository();

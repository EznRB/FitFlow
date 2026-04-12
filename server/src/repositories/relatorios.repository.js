/**
 * ============================================
 * FitFlow Caraguá — Repository de Relatórios
 * ============================================
 * Queries agregadas para dashboard e relatórios.
 */

const { prisma } = require('../config/prisma');

class RelatoriosRepository {
  /**
   * KPIs do dashboard.
   */
  async getDashboardKPIs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [totalStudents, activeStudents, blockedStudents, checkinsToday, monthlyRevenue] =
      await Promise.all([
        prisma.student.count(),
        prisma.student.count({ where: { status: 'active' } }),
        prisma.student.count({ where: { status: 'blocked' } }),
        prisma.checkin.count({
          where: { checkinDate: { gte: today, lt: tomorrow } },
        }),
        prisma.payment.aggregate({
          where: {
            status: 'paid',
            paymentDate: { gte: firstOfMonth, lte: lastOfMonth },
          },
          _sum: { amount: true },
        }),
      ]);

    return {
      totalStudents,
      activeStudents,
      blockedStudents,
      checkinsToday,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
    };
  }

  /**
   * Receita por mês (últimos N meses).
   */
  async revenueByMonth(months = 6) {
    const results = [];
    const today = new Date();

    for (let i = 0; i < months; i++) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);

      const revenue = await prisma.payment.aggregate({
        where: {
          status: 'paid',
          paymentDate: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _count: true,
      });

      results.push({
        month: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        total: revenue._sum.amount || 0,
        count: revenue._count,
      });
    }

    return results.reverse();
  }

  /**
   * Frequência de check-ins por dia (últimos N dias).
   */
  async checkinsByDay(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.checkin.groupBy({
      by: ['checkinDate'],
      where: { checkinDate: { gte: startDate } },
      _count: { checkinDate: true },
      orderBy: { checkinDate: 'asc' },
    });
  }
}

module.exports = new RelatoriosRepository();

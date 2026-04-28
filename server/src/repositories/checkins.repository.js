/**
 * ============================================================================
 * FitFlow Caraguá — Repository de Check-ins (TASK 08)
 * ============================================================================
 * Acesso a dados de check-ins via Prisma.
 * 
 * Regras Fundamentais:
 * ⚠️ Sem método DELETE — regra de negócio (histórico imutável).
 * ⚠️ Duplicidade prevenida pela constraint UNIQUE(studentId, checkinDate).
 * ⚠️ "Exclusão" é feita via status = 'cancelled' (soft-cancel).
 */

const { prisma } = require('../config/prisma');

/**
 * Retorna a data atual no fuso horário de São Paulo (UTC-3).
 * Importante: MySQL armazena checkinDate como DATE (sem hora),
 * então precisamos garantir que a data corresponda ao dia no Brasil.
 */
function getBrazilToday() {
  const now = new Date();
  // Calcula o offset para America/Sao_Paulo (UTC-3, sem horário de verão atual)
  const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  brDate.setHours(0, 0, 0, 0);
  return brDate;
}

function getBrazilNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

class CheckinsRepository {
  /**
   * Busca um check-in específico por ID.
   * Inclui dados completos do aluno para exibição.
   */
  async findById(id) {
    return prisma.checkin.findUnique({
      where: { id: parseInt(id) },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
      },
    });
  }

  /**
   * Lista check-ins com filtros opcionais.
   * Por padrão, retorna apenas check-ins com status 'present'.
   * 
   * @param {object} filters - Filtros: studentId, startDate, endDate, incluirCancelados
   */
  async findAll(filters = {}) {
    const where = {};

    // Filtro por status: por padrão, só mostra presentes
    if (filters.incluirCancelados) {
      // Sem filtro de status — mostra tudo
    } else {
      where.status = 'present';
    }

    if (filters.studentId) where.studentId = parseInt(filters.studentId);

    // Filtro por data específica
    if (filters.date) {
      const d = new Date(filters.date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.checkinDate = { gte: d, lt: nextDay };
    }

    // Filtro por período (startDate + endDate)
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.checkinDate = { gte: start, lte: end };
    }

    return prisma.checkin.findMany({
      where,
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca check-ins de um aluno específico com paginação.
   * @param {number} studentId - ID do aluno
   * @param {object} filters - startDate, endDate, limit
   */
  async findByStudentId(studentId, filters = {}) {
    const where = { studentId: parseInt(studentId) };

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.checkinDate = { gte: start, lte: end };
    }

    return prisma.checkin.findMany({
      where,
      orderBy: { checkinDate: 'desc' },
      take: filters.limit ? parseInt(filters.limit) : 60,
    });
  }

  /**
   * Verifica se o aluno já fez check-in hoje (status = present).
   * Ignora check-ins cancelados para permitir recheck-in após cancelamento.
   */
  async hasCheckedInToday(studentId) {
    const today = getBrazilToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkin = await prisma.checkin.findFirst({
      where: {
        studentId: parseInt(studentId),
        status: 'present',
        checkinDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
    return checkin;
  }

  /**
   * Registra check-in do dia.
   * A constraint UNIQUE(studentId, checkinDate) previne duplicatas no banco.
   * O campo registeredBy rastreia quem efetuou o registro.
   */
  async create(studentId, registeredBy = null) {
    const brNow = getBrazilNow();
    const brToday = getBrazilToday();

    try {
      return await prisma.checkin.create({
        data: {
          studentId: parseInt(studentId),
          checkinDate: brToday,   // Data do Brasil (DATE sem hora)
          checkinTime: brNow,     // Hora atual do Brasil
          registeredBy: registeredBy ? parseInt(registeredBy) : null,
          status: 'present',
        },
        include: {
          student: { include: { user: { select: { name: true } } } },
        },
      });
    } catch (error) {
      // Captura violação da constraint UNIQUE(studentId, checkinDate)
      if (error.code === 'P2002') {
        const AppError = require('../utils/AppError');
        throw new AppError('Este aluno já possui check-in registrado para hoje.', 409);
      }
      throw error;
    }
  }

  /**
   * Cancela um check-in (soft-cancel).
   * ⚠️ Não deleta — apenas marca como 'cancelled' com motivo e quem cancelou.
   * Esse é o fluxo administrativo controlado exigido pela regra de negócio.
   */
  async cancelCheckin(id, motivo, adminId) {
    return prisma.checkin.update({
      where: { id: parseInt(id) },
      data: {
        status: 'cancelled',
        cancelReason: motivo,
        cancelledBy: parseInt(adminId),
        cancelledAt: new Date(),
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
    });
  }

  /**
   * Conta check-ins de hoje (status = present) para dashboard.
   */
  async countToday() {
    const today = getBrazilToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.checkin.count({
      where: {
        status: 'present',
        checkinDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  /**
   * Retorna os check-ins de hoje com dados do aluno (para resumo).
   */
  async findToday() {
    const today = getBrazilToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.checkin.findMany({
      where: {
        checkinDate: { gte: today, lt: tomorrow },
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Frequência por aluno nos últimos N dias.
   * Conta apenas check-ins com status 'present'.
   */
  async frequencyByStudent(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return prisma.checkin.groupBy({
      by: ['studentId'],
      where: {
        status: 'present',
        checkinDate: { gte: startDate },
      },
      _count: { studentId: true },
      orderBy: { _count: { studentId: 'desc' } },
    });
  }
}

module.exports = new CheckinsRepository();

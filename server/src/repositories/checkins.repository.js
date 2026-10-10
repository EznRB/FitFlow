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
const { brazilDate, addDays, checkinFilters, civilRange, positiveInteger } = require('../utils/civil-date');

class CheckinsRepository {
  constructor({ db = prisma, now = () => new Date() } = {}) { this.db = db; this.now = now; }
  /**
   * Busca um check-in específico por ID.
   * Inclui dados completos do aluno para exibição.
   */
  async findById(id) {
    return this.db.checkin.findUnique({
      where: { id: positiveInteger(id, 'ID do check-in', 2147483647) },
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
    const where = checkinFilters(filters);

    return this.db.checkin.findMany({
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
    const where = { studentId: positiveInteger(studentId, 'ID do aluno', 2147483647) };
    const period = civilRange(filters);
    if (period) where.checkinDate = period;
    const limit = filters.limit === undefined ? 60 : positiveInteger(filters.limit, 'Limite', 366);

    return this.db.checkin.findMany({
      where,
      orderBy: { checkinDate: 'desc' },
      take: limit,
    });
  }

  /**
   * Verifica o registro diário, incluindo cancelados para preservar auditoria.
   */
  async hasCheckedInToday(studentId) {
    const today = brazilDate(this.now());
    const tomorrow = addDays(today, 1);

    const checkin = await this.db.checkin.findFirst({
      where: {
        studentId: positiveInteger(studentId, 'ID do aluno', 2147483647),
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
   * A constraint UNIQUE(studentId, checkinDate) previne duplicatas no banco,
   * inclusive após cancelamento, preservando o registro diário e sua auditoria.
   * O campo registeredBy rastreia quem efetuou o registro.
   */
  async create(studentId, registeredBy = null) {
    const instant = this.now();
    const brToday = brazilDate(instant);

    try {
      return await this.db.checkin.create({
        data: {
          studentId: positiveInteger(studentId, 'ID do aluno', 2147483647),
          checkinDate: brToday,   // Data do Brasil (DATE sem hora)
          checkinTime: instant,   // TIME legado: componente UTC; createdAt mantém o instante completo
          createdAt: instant,
          registeredBy: registeredBy === null ? null : positiveInteger(registeredBy, 'ID do responsável', 2147483647),
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
    const checkinId = positiveInteger(id, 'ID do check-in', 2147483647);
    // A condição faz a primeira transição vencer, mesmo quando dois serviços
    // leram "present" simultaneamente. A auditoria confirmada não é regravada.
    const result = await this.db.checkin.updateMany({
      where: { id: checkinId, status: 'present' },
      data: {
        status: 'cancelled',
        cancelReason: motivo,
        cancelledBy: positiveInteger(adminId, 'ID do administrador', 2147483647),
        cancelledAt: new Date(),
      },
    });
    if (result.count !== 1) {
      const AppError = require('../utils/AppError');
      const existing = await this.findById(checkinId);
      if (!existing) throw new AppError('Check-in não encontrado.', 404);
      throw new AppError('Este check-in já foi cancelado anteriormente. A auditoria original foi preservada.', 409);
    }
    return this.findById(checkinId);
  }

  /**
   * Conta check-ins de hoje (status = present) para dashboard.
   */
  async countToday() {
    const today = brazilDate(this.now());
    const tomorrow = addDays(today, 1);

    return this.db.checkin.count({
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
    const today = brazilDate(this.now());
    const tomorrow = addDays(today, 1);

    return this.db.checkin.findMany({
      where: {
        checkinDate: { gte: today, lt: tomorrow },
        status: 'present',
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
    const periodDays = positiveInteger(days, 'Quantidade de dias');
    const today = brazilDate(this.now());
    const startDate = addDays(today, 1 - periodDays);

    return this.db.checkin.groupBy({
      by: ['studentId'],
      where: {
        status: 'present',
        checkinDate: { gte: startDate, lte: today },
      },
      _count: { studentId: true },
      orderBy: { _count: { studentId: 'desc' } },
    });
  }
}

module.exports = new CheckinsRepository();

module.exports.createCheckinsRepository = options => new CheckinsRepository(options);

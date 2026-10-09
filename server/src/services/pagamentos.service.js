/**
 * ============================================================================
 * FitFlow Caraguá — Service de Pagamentos (TASK 07)
 * ============================================================================
 * Centraliza toda a lógica de negócios financeira do sistema.
 * 
 * Regras de Negócio Implementadas:
 * 1. Ao registrar pagamento, calcula automaticamente o vencimento baseado
 *    na duração do plano vinculado ao aluno.
 * 2. Atualiza planEndDate no perfil do aluno (Student) ao confirmar pagamento.
 * 3. Se o vencimento estiver atrasado > 5 dias, bloqueia o aluno (status: blocked).
 * 4. Histórico financeiro nunca é deletado (append-only para pagamentos antigos).
 * 5. Marcação automática de pagamentos pendentes como "overdue" quando passam do vencimento.
 */

const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const { isOverdue } = require('../utils/helpers');
const { validatePaymentMethod } = require('../utils/paymentMethod');
const { paymentId, moneyCents, paymentDate: validateDate, brazilDate, validateNotes, paymentStatus } = require('../utils/paymentValidation');
const { lockStudent, renewalDates } = require('../utils/membershipRenewal');
const { manualRequestId, manualRequestHash, sameManualRequest } = require('../utils/manualPaymentRequest');

/** Dias de carência antes de bloquear o aluno por inadimplência. */
const GRACE_DAYS = 5;

class PagamentosService {
  constructor({ db = prisma, now = () => new Date() } = {}) {
    this.db = db;
    this.now = now;
  }
  /**
   * Lista todos os pagamentos com filtros opcionais.
   * Suporta filtro por status, aluno e período de datas.
   */
  async listar(filters = {}) {
    const where = {};

    if (filters.status !== undefined) where.status = paymentStatus(filters.status);
    if (filters.studentId !== undefined) where.studentId = paymentId(filters.studentId, 'ID do aluno');

    if (filters.startDate !== undefined || filters.endDate !== undefined) {
      const start = filters.startDate === undefined ? undefined : validateDate(filters.startDate);
      const end = filters.endDate === undefined ? undefined : validateDate(filters.endDate);
      if (start && end && start > end) throw new AppError('Período de pagamentos inválido.', 400);
      where.paymentDate = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
    }

    return this.db.payment.findMany({
      where,
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        plan: { select: { id: true, name: true, price: true, durationDays: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca um pagamento específico por ID.
   */
  async buscarPorId(id) {
    const pagamento = await this.db.payment.findUnique({
      where: { id: paymentId(id, 'ID do pagamento') },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        plan: { select: { id: true, name: true, price: true, durationDays: true } },
      },
    });

    if (!pagamento) throw new AppError('Pagamento não encontrado.', 404);
    return pagamento;
  }

  /**
   * Busca todos os pagamentos de um aluno específico (histórico completo).
   * Ordenado do mais recente para o mais antigo.
   */
  async buscarPorAluno(studentId) {
    const idValue = paymentId(studentId, 'ID do aluno');
    const aluno = await this.db.student.findUnique({
      where: { id: idValue },
    });
    if (!aluno) throw new AppError('Aluno não encontrado.', 404);

    return this.db.payment.findMany({
      where: { studentId: idValue },
      include: {
        plan: { select: { name: true, price: true, durationDays: true } },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  /**
   * REGRA PRINCIPAL — Registrar um novo pagamento.
   * 
   * Fluxo:
   * 1. Valida existência do aluno e do plano.
   * 2. Calcula a data de vencimento baseada na duração do plano.
   * 3. Cria o registro de pagamento com status "paid".
   * 4. Atualiza as datas de plano do aluno (planStartDate e planEndDate).
   * 5. Reativa o aluno se ele estava bloqueado por inadimplência.
   */
  async registrar(data, registeredBy) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Dados de pagamento inválidos.', 400);
    const requestId = manualRequestId(data.idempotencyKey);
    const actorId = paymentId(registeredBy, 'ID do responsável');
    // Outra aba pode trocar o cookie sem atualizar a memória desta tela.
    // O cliente só informa a expectativa; a autoridade continua no ator autenticado.
    if (data.expectedActorId !== undefined && paymentId(data.expectedActorId, 'ID esperado do responsável') !== actorId)
      throw new AppError('A sessão mudou. Recarregue a página e confira a conta antes de registrar o recebimento.', 403);
    const { planId, paymentMethod, paymentDate } = data;
    const studentId = paymentId(data.studentId, 'ID do aluno');
    const amountCents = moneyCents(data.amount);
    const amount = amountCents / 100;
    const notes = validateNotes(data.notes);
    const requestedPlanId = planId == null ? null : paymentId(planId, 'ID do plano');
    const validatedMethod = validatePaymentMethod(paymentMethod);
    const dataPagamento = paymentDate === undefined ? brazilDate(this.now()) : validateDate(paymentDate);
    // O hash descreve a intenção solicitada; padrões dinâmicos só são resolvidos
    // na primeira criação. Mudança de plano ou de dia não muda um retry antigo.
    const requestHash = manualRequestHash({ studentId, planId: requestedPlanId, amountCents,
      paymentMethod: validatedMethod, paymentDate: paymentDate === undefined ? null : paymentDate, notes }, actorId);
    try { return await this.db.$transaction(async tx => {
      await lockStudent(tx, studentId);
      const previous = await tx.payment.findUnique({ where: { manualRequestId: requestId },
        include: { student: { include: { user: { select: { name: true } } } }, plan: { select: { name: true } } } });
      if (previous) return sameManualRequest(previous, requestId, requestHash, actorId);
      const aluno = await tx.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, active: true } },
        plan: true,
      },
    });
    if (!aluno) throw new AppError('Aluno não encontrado.', 404);
    if (!aluno.user.active) throw new AppError('Este aluno está desativado do sistema.', 400);

    // 3. Determina o plano a associar: o informado ou o atual do aluno
    const planoId = requestedPlanId || aluno.planId;
    let plano = null;

    if (planoId) {
      plano = await tx.plan.findUnique({ where: { id: planoId } });
      if (!plano) throw new AppError('Plano não encontrado.', 404);
      if (!plano.active) throw new AppError('Este plano está inativo.', 400);
    }

    const { startDate, endDate: dataVencimento } = renewalDates(aluno.planEndDate, dataPagamento, plano ? plano.durationDays : 30);
      // 5a. Cria o registro de pagamento
      const novoPagamento = await tx.payment.create({
        data: {
          studentId: parseInt(studentId),
          planId: planoId || null,
          amount,
          paymentMethod: validatedMethod,
          paymentDate: dataPagamento,
          dueDate: dataVencimento,
          status: 'paid',
          notes,
          registeredBy: actorId,
          manualRequestId: requestId,
          manualRequestHash: requestHash,
        },
        include: {
          student: { include: { user: { select: { name: true } } } },
          plan: { select: { name: true } },
        },
      });

      // 5b. Atualiza as datas do plano no perfil do aluno
      const updateData = {
        planStartDate: startDate,
        planEndDate: dataVencimento,
      };

      // Se o plano informado é diferente do atual, atualiza também
      if (planoId && planoId !== aluno.planId) {
        updateData.planId = planoId;
      }

      // 5c. Se o aluno estava bloqueado, reativa ao confirmar pagamento
      if (aluno.status === 'blocked') {
        updateData.status = 'active';
      }

      await tx.student.update({
        where: { id: parseInt(studentId) },
        data: updateData,
      });

      return novoPagamento;
    }); } catch (error) {
      // UUID global também impede duplicação entre pedidos que bloquearam alunos
      // diferentes. Uma disputa no índice único só é reconciliada após rollback.
      if (error.code === 'P2002') {
        const previous = await this.db.payment.findUnique({ where: { manualRequestId: requestId },
          include: { student: { include: { user: { select: { name: true } } } }, plan: { select: { name: true } } } });
        if (previous) return sameManualRequest(previous, requestId, requestHash, actorId);
      }
      throw error;
    }

  }

  async buscarPorSolicitacao(value, registeredBy) {
    const requestId = manualRequestId(value);
    const actorId = paymentId(registeredBy, 'ID do responsável');
    const payment = await this.db.payment.findUnique({ where: { manualRequestId: requestId },
      include: { student: { include: { user: { select: { name: true } } } }, plan: { select: { name: true } } } });
    // Não revela existência ou dados de pedidos de outro administrador.
    if (!payment || payment.registeredBy !== actorId) throw new AppError('Recebimento não localizado para esta solicitação.', 404);
    return payment;
  }

  /**
   * Atualiza um pagamento existente.
   * ⚠️ Nunca apaga — apenas permite correção de dados.
   */
  async atualizar(id, data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Dados de pagamento inválidos.', 400);
    const idValue = paymentId(id, 'ID do pagamento');
    const validatedMethod = data.paymentMethod === undefined ? undefined : validatePaymentMethod(data.paymentMethod);
    const updateData = {};
    if (data.amount !== undefined) updateData.amount = moneyCents(data.amount) / 100;
    if (validatedMethod !== undefined) updateData.paymentMethod = validatedMethod;
    if (data.paymentDate !== undefined) updateData.paymentDate = validateDate(data.paymentDate);
    if (data.dueDate !== undefined) updateData.dueDate = validateDate(data.dueDate);
    if (data.status !== undefined) {
      updateData.status = paymentStatus(data.status);
    }
    if (data.notes !== undefined) updateData.notes = validateNotes(data.notes);
    const pagamento = await this.buscarPorId(idValue);
    if (this.db.paymentIntent && await this.db.paymentIntent.findFirst({ where: { paymentId: idValue } })) throw new AppError('Pagamento conciliado pelo provedor não admite alteração manual.', 409);
    if (new Date(updateData.dueDate || pagamento.dueDate) < new Date(updateData.paymentDate || pagamento.paymentDate)) throw new AppError('Vencimento não pode anteceder o pagamento.', 400);

    return this.db.payment.update({
      where: { id: idValue },
      data: updateData,
      include: {
        student: { include: { user: { select: { name: true } } } },
        plan: { select: { name: true } },
      },
    });
  }

  /**
   * REGRA DE NEGÓCIO CRÍTICA — Verificação de inadimplência.
   * 
   * Deve ser chamada periodicamente (ex: ao iniciar o servidor, via cron, ou
   * quando o admin acessa o dashboard).
   * 
   * Ações:
   * 1. Busca todos os alunos ativos cujo planEndDate já passou.
   * 2. Marca pagamentos pendentes como "overdue".
   * 3. Se o atraso excede GRACE_DAYS (5 dias), bloqueia o aluno.
   */
  async verificarInadimplencia() {
    const agora = this.now();
    const hoje = brazilDate(agora);
    let bloqueados = 0;
    let atualizados = 0;

    // 1. Busca alunos ativos com vencimento passado
    const alunosVencidos = await this.db.student.findMany({
      where: {
        status: 'active',
        planEndDate: { lt: hoje },
      },
      include: {
        user: { select: { name: true } },
      },
    });

    for (const aluno of alunosVencidos) {
      // Confere a vigência atual após o mesmo lock usado pela renovação.
      const blocked = await this.db.$transaction(async tx => {
        await lockStudent(tx, aluno.id);
        const current = await tx.student.findUnique({ where: { id: aluno.id } });
        if (!current || current.status !== 'active' || !current.planEndDate || !isOverdue(current.planEndDate, GRACE_DAYS, agora)) return false;
        await tx.student.update({ where: { id: aluno.id }, data: { status: 'blocked' } });
        return true;
      });
      if (blocked) bloqueados++;
    }

    // 3. Marca pagamentos pendentes cujo dueDate já passou como "overdue"
    const resultado = await this.db.payment.updateMany({
      where: {
        status: 'pending',
        dueDate: { lt: hoje },
      },
      data: { status: 'overdue' },
    });
    atualizados = resultado.count;

    return {
      alunosBloqueados: bloqueados,
      pagamentosAtualizados: atualizados,
      verificadoEm: agora.toISOString(),
    };
  }

  /**
   * Lista alunos inadimplentes (bloqueados ou com vencimento passado).
   * Retorna dados completos para o painel do admin.
   */
  async listarInadimplentes() {
    const hoje = brazilDate(this.now());

    return this.db.student.findMany({
      where: {
        OR: [
          { status: 'blocked' },
          {
            status: 'active',
            planEndDate: { lt: hoje },
          },
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
        plan: { select: { name: true, price: true } },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 1, // Último pagamento registrado
          select: {
            paymentDate: true,
            dueDate: true,
            amount: true,
            status: true,
          },
        },
      },
      orderBy: { planEndDate: 'asc' }, // Mais atrasados primeiro
    });
  }

  /**
   * Resumo financeiro para o dashboard.
   * Calcula receita do mês, total de inadimplentes e pagamentos pendentes.
   */
  async resumoFinanceiro() {
    const hoje = brazilDate(this.now());
    const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const inicioProximoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 1));

    const [receitaMes, totalPagos, totalPendentes, totalOverdue, inadimplentes] =
      await Promise.all([
        // Receita do mês atual
        this.db.payment.aggregate({
          where: {
            status: 'paid',
            paymentDate: { gte: inicioMes, lt: inicioProximoMes },
          },
          _sum: { amount: true },
          _count: true,
        }),
        // Total de pagamentos "paid"
        this.db.payment.count({ where: { status: 'paid' } }),
        // Total pendentes
        this.db.payment.count({ where: { status: 'pending' } }),
        // Total vencidos
        this.db.payment.count({ where: { status: 'overdue' } }),
        // Total de alunos bloqueados
        this.db.student.count({ where: { status: 'blocked' } }),
      ]);

    return {
      receitaMesAtual: receitaMes._sum.amount || 0,
      pagamentosMes: receitaMes._count,
      totalPagos,
      totalPendentes,
      totalOverdue,
      alunosInadimplentes: inadimplentes,
    };
  }
}

module.exports = new PagamentosService();
module.exports.createPagamentosService = options => new PagamentosService(options);

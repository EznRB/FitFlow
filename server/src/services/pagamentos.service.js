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

/** Dias de carência antes de bloquear o aluno por inadimplência. */
const GRACE_DAYS = 5;

class PagamentosService {
  /**
   * Lista todos os pagamentos com filtros opcionais.
   * Suporta filtro por status, aluno e período de datas.
   */
  async listar(filters = {}) {
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
    const pagamento = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
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
    const aluno = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
    });
    if (!aluno) throw new AppError('Aluno não encontrado.', 404);

    return prisma.payment.findMany({
      where: { studentId: parseInt(studentId) },
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
    const { studentId, planId, amount, paymentMethod, paymentDate, notes } = data;

    // 1. Validações obrigatórias
    if (!studentId) throw new AppError('ID do aluno é obrigatório.', 400);
    if (!amount || parseFloat(amount) <= 0) throw new AppError('O valor do pagamento deve ser positivo.', 400);

    // 2. Busca o aluno com seu plano atual
    const aluno = await prisma.student.findUnique({
      where: { id: parseInt(studentId) },
      include: {
        user: { select: { name: true, active: true } },
        plan: true,
      },
    });
    if (!aluno) throw new AppError('Aluno não encontrado.', 404);
    if (!aluno.user.active) throw new AppError('Este aluno está desativado do sistema.', 400);

    // 3. Determina o plano a associar: o informado ou o atual do aluno
    const planoId = planId ? parseInt(planId) : aluno.planId;
    let plano = null;

    if (planoId) {
      plano = await prisma.plan.findUnique({ where: { id: planoId } });
      if (!plano) throw new AppError('Plano não encontrado.', 404);
    }

    // 4. Calcula data de pagamento e vencimento
    const dataPagamento = paymentDate ? new Date(paymentDate) : new Date();

    // Data de vencimento: data do pagamento + duração do plano em dias
    let dataVencimento;
    if (plano) {
      dataVencimento = new Date(dataPagamento);
      dataVencimento.setDate(dataVencimento.getDate() + plano.durationDays);
    } else {
      // Sem plano vinculado, vencimento padrão de 30 dias
      dataVencimento = new Date(dataPagamento);
      dataVencimento.setDate(dataVencimento.getDate() + 30);
    }

    // 5. Transação atômica: cria pagamento + atualiza aluno
    const resultado = await prisma.$transaction(async (tx) => {
      // 5a. Cria o registro de pagamento
      const novoPagamento = await tx.payment.create({
        data: {
          studentId: parseInt(studentId),
          planId: planoId || null,
          amount: parseFloat(amount),
          paymentMethod: paymentMethod || null,
          paymentDate: dataPagamento,
          dueDate: dataVencimento,
          status: 'paid',
          notes: notes || null,
          registeredBy: registeredBy || null,
        },
        include: {
          student: { include: { user: { select: { name: true } } } },
          plan: { select: { name: true } },
        },
      });

      // 5b. Atualiza as datas do plano no perfil do aluno
      const updateData = {
        planStartDate: dataPagamento,
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
    });

    return resultado;
  }

  /**
   * Atualiza um pagamento existente.
   * ⚠️ Nunca apaga — apenas permite correção de dados.
   */
  async atualizar(id, data) {
    const pagamento = await this.buscarPorId(id);

    const updateData = {};
    if (data.amount !== undefined) updateData.amount = parseFloat(data.amount);
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.paymentDate !== undefined) updateData.paymentDate = new Date(data.paymentDate);
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return prisma.payment.update({
      where: { id: parseInt(id) },
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
    const agora = new Date();
    let bloqueados = 0;
    let atualizados = 0;

    // 1. Busca alunos ativos com vencimento passado
    const alunosVencidos = await prisma.student.findMany({
      where: {
        status: 'active',
        planEndDate: { lt: agora },
      },
      include: {
        user: { select: { name: true } },
      },
    });

    for (const aluno of alunosVencidos) {
      // 2. Verifica se o atraso ultrapassa o período de carência
      if (isOverdue(aluno.planEndDate, GRACE_DAYS)) {
        // Bloqueia o aluno por inadimplência
        await prisma.student.update({
          where: { id: aluno.id },
          data: { status: 'blocked' },
        });
        bloqueados++;
      }
    }

    // 3. Marca pagamentos pendentes cujo dueDate já passou como "overdue"
    const resultado = await prisma.payment.updateMany({
      where: {
        status: 'pending',
        dueDate: { lt: agora },
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
    const agora = new Date();

    return prisma.student.findMany({
      where: {
        OR: [
          { status: 'blocked' },
          {
            status: 'active',
            planEndDate: { lt: agora },
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
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const [receitaMes, totalPagos, totalPendentes, totalOverdue, inadimplentes] =
      await Promise.all([
        // Receita do mês atual
        prisma.payment.aggregate({
          where: {
            status: 'paid',
            paymentDate: { gte: inicioMes, lte: fimMes },
          },
          _sum: { amount: true },
          _count: true,
        }),
        // Total de pagamentos "paid"
        prisma.payment.count({ where: { status: 'paid' } }),
        // Total pendentes
        prisma.payment.count({ where: { status: 'pending' } }),
        // Total vencidos
        prisma.payment.count({ where: { status: 'overdue' } }),
        // Total de alunos bloqueados
        prisma.student.count({ where: { status: 'blocked' } }),
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

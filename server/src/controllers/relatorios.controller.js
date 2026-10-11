/**
 * ============================================================================
 * FitFlow Caraguá — Controller de Relatórios (TASK 08 — Integração)
 * ============================================================================
 * Gera dados agregados para dashboard e relatórios.
 * Integrado com check-ins reais (não mais placeholder).
 */

const { sendSuccess } = require('../utils/helpers');
const { prisma } = require('../config/prisma');
const { financialCents, financialSummary, totalsByPeriod } = require('../utils/financialTotals');
const checkinsRepository = require('../repositories/checkins.repository');
const { brazilDate, addDays, dateKey, civilRange, brazilDayStartInstant } = require('../utils/civil-date');

function createRelatoriosController({ db = prisma, repository = checkinsRepository, now = () => new Date() } = {}) {
return {
  /**
   * GET /api/relatorios/dashboard
   * KPIs principais do sistema. Agora com check-ins reais.
   */
  async dashboard(req, res, next) {
    try {
      const today = brazilDate(now());
      const tomorrow = addDays(today, 1);
      const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const firstOfNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
      const sevenDaysAgo = addDays(today, -6);
      const newStudentsStart = brazilDayStartInstant(sevenDaysAgo);
      const newStudentsEnd = brazilDayStartInstant(tomorrow);

      // Executa todas as queries em paralelo para performance
      const [totalAlunos, alunosAtivos, alunosInadimplentes, treinosAtivos, checkinsHoje, receitaMes, checkins7dias, recentesCheckins, recentesAlunos, pagamentos7dias, alunos7dias, recentesPagamentos, ajustes7dias, conferenciasProvedor] = await Promise.all([
        db.student.count(),
        db.student.count({ where: { status: 'active' } }),
        db.student.count({ where: { status: 'blocked' } }),
        db.workout.count({ where: { active: true } }),
        // Check-ins reais do dia (apenas status 'present')
        repository.countToday(),
        // Receita do mês via pagamentos confirmados
        totalsByPeriod(db, { gte: firstOfMonth, lt: firstOfNextMonth }),
        // Tendencias: check-ins dos ultimos 7 dias
        db.checkin.findMany({
          where: {
            status: 'present',
            checkinDate: { gte: sevenDaysAgo, lt: tomorrow }
          },
          select: { checkinDate: true }
        }),
        // Atividades recentes: ultimos 5 checkins
        db.checkin.findMany({
          where: { status: 'present' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { student: { include: { user: true } } }
        }),
        // Atividades recentes: ultimas 5 matriculas
        db.student.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { user: true }
        }),
        // Pagamentos dos ultimos 7 dias
        db.payment.findMany({
          where: {
            status: 'paid',
            paymentDate: { gte: sevenDaysAgo, lt: tomorrow }
          },
          select: { paymentDate: true, amount: true }
        }),
        // Novos alunos dos ultimos 7 dias
        db.student.findMany({
          where: {
            createdAt: { gte: newStudentsStart, lt: newStudentsEnd }
          },
          select: { createdAt: true }
        }),
        // Pagamentos recentes
        db.payment.findMany({
          where: { status: 'paid' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { student: { include: { user: true } } }
        }),
        db.paymentAdjustment.findMany({ where: { effectiveDate: { gte: sevenDaysAgo, lt: tomorrow } }, select: { effectiveDate: true, amount: true, kind: true } }),
        db.paymentIntent.count({ where: { state: 'review' } })
      ]);

      // Processando tendências
      const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const tendenciasMap = {};
      const receitaMap = {};
      const novosAlunosMap = {};
      
      for(let i = 6; i >= 0; i--) {
        const d = addDays(today, -i);
        const key = dateKey(d);
        const dayLabel = diasDaSemana[d.getUTCDay()];
        tendenciasMap[key] = { label: dayLabel, count: 0 };
        receitaMap[key] = { label: dayLabel, amount: 0 };
        novosAlunosMap[key] = { label: dayLabel, count: 0 };
      }
      
      checkins7dias.forEach(chk => {
        const d = new Date(chk.checkinDate);
        const key = dateKey(d);
        if (tendenciasMap[key] !== undefined) {
           tendenciasMap[key].count++;
        }
      });

      pagamentos7dias.forEach(pag => {
        const d = new Date(pag.paymentDate);
        const key = dateKey(d);
        if (receitaMap[key] !== undefined) {
           receitaMap[key].amount += financialCents(pag.amount);
        }
      });

      ajustes7dias.forEach(event => {
        const key = dateKey(new Date(event.effectiveDate));
        if (receitaMap[key]) receitaMap[key].amount -= financialCents(event.amount);
      });

      alunos7dias.forEach(aluno => {
        const d = new Date(aluno.createdAt);
        const key = dateKey(brazilDate(d));
        if (novosAlunosMap[key] !== undefined) {
           novosAlunosMap[key].count++;
        }
      });

      // Processando atividades
      let atividades = [];
      recentesCheckins.forEach(chk => {
         atividades.push({
           tipo: 'checkin',
           nome: chk.student?.user?.name || 'Aluno Desconhecido',
           descricao: 'Check-in realizado',
           data: chk.createdAt
         });
      });
      recentesAlunos.forEach(aluno => {
         atividades.push({
           tipo: 'matricula',
           nome: aluno.user?.name || 'Aluno Desconhecido',
           descricao: 'Nova matrícula',
           data: aluno.createdAt
         });
      });
      
      let pagamentosAtv = [];
      recentesPagamentos.forEach(pag => {
         pagamentosAtv.push({
           tipo: 'pagamento',
           nome: pag.student?.user?.name || 'Aluno Desconhecido',
           valor: Number(pag.amount),
           descricao: `Pagamento de R$ ${parseFloat(pag.amount).toFixed(2)}`,
           data: pag.createdAt
         });
      });
      
      atividades.sort((a, b) => new Date(b.data) - new Date(a.data));
      atividades = atividades.slice(0, 5);


      sendSuccess(res, 200, 'Dashboard KPIs', {
        totalAlunos: totalAlunos || 0,
        alunosAtivos: alunosAtivos || 0,
        alunosInadimplentes: alunosInadimplentes || 0,
        treinosAtivos: treinosAtivos || 0,
        checkinsHoje: checkinsHoje || 0,
        receitaEstimada: receitaMes.netAmount,
        financeiroMes: receitaMes,
        conferenciasProvedor,
        tendencias: {
          labels: Object.values(tendenciasMap).map(i => i.label),
          data: Object.values(tendenciasMap).map(i => i.count)
        },
        historico: {
          labels: Object.values(tendenciasMap).map(i => i.label),
          checkins: Object.values(tendenciasMap).map(i => i.count),
          receita: Object.values(receitaMap).map(i => i.amount / 100),
          alunos: Object.values(novosAlunosMap).map(i => i.count)
        },
        atividades,
        pagamentosRecentes: pagamentosAtv
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/relatorios/inadimplencia
   * Retorna os alunos com status 'blocked' e o valor total de pagamentos em atraso
   */
  async inadimplencia(req, res, next) {
    try {
      const inadimplentes = await db.student.findMany({
        where: {
          OR: [
            { status: 'blocked' },
            { 
              payments: {
                some: { status: 'overdue' }
              }
            }
          ]
        },
        include: {
          user: { select: { name: true, email: true } },
          plan: { select: { name: true } },
          payments: {
            where: { status: 'overdue' },
            select: { amount: true, dueDate: true }
          }
        }
      });

      const resultado = inadimplentes.map(aluno => {
        const totalAtraso = aluno.payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
        return {
          id: aluno.id,
          nome: aluno.user?.name,
          email: aluno.user?.email,
          telefone: aluno.phone,
          plano: aluno.plan?.name,
          status: aluno.status,
          totalAtraso,
          mensalidadesAtrasadas: aluno.payments.length,
          vencimentos: aluno.payments.map(p => p.dueDate)
        };
      });

      // Ordenar do maior devedor para o menor
      resultado.sort((a, b) => b.totalAtraso - a.totalAtraso);

      sendSuccess(res, 200, 'Relatório de inadimplência', resultado);
    } catch (error) {
      next(error);
    }
  },

  /** 
   * GET /api/relatorios/financeiro 
   * Relatório de pagamentos por período. Query: ?startDate=...&endDate=...
   */
  async financeiro(req, res, next) {
    try {
      const where = {};
      const period = civilRange(req.query);
      if (period) where.paymentDate = period;

      const pagamentos = await db.payment.findMany({
        where,
        include: {
          student: { include: { user: { select: { name: true } } } },
          plan: { select: { name: true } }
        },
        orderBy: { paymentDate: 'desc' }
      });

      const ajustes = await db.paymentAdjustment.findMany({
        where: period ? { effectiveDate: period } : {},
        include: { payment: { include: { student: { include: { user: { select: { name: true } } } }, plan: { select: { name: true } } } } },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }]
      });
      let grossCents = 0, pendingCents = 0, overdueCents = 0;
      const items = pagamentos.map(p => {
        const cents = financialCents(p.amount);
        if (p.status === 'paid') grossCents += cents;
        else if (p.status === 'pending') pendingCents += cents;
        else if (p.status === 'overdue') overdueCents += cents;
        return { id: p.id, paymentId: p.id, tipo: 'recebimento', aluno: p.student?.user?.name || 'Aluno #' + p.studentId,
          plano: p.plan?.name || 'Avulso', valor: cents / 100, dataPagamento: p.paymentDate,
          vencimento: p.dueDate, status: p.status, metodo: p.paymentMethod };
      });
      for (const event of ajustes) items.push({ id: event.id, paymentId: event.paymentId,
        tipo: event.kind === 'correction' ? 'correction' : 'refund_recorded', aluno: event.payment.student?.user?.name || 'Aluno #' + event.payment.studentId,
        plano: event.payment.plan?.name || 'Avulso', valor: -financialCents(event.amount) / 100,
        dataPagamento: event.effectiveDate, vencimento: event.payment.dueDate, status: event.kind,
        metodo: 'Registro administrativo', motivo: event.reason, responsavel: event.actorName, providerRefundPerformed: false });
      items.sort((a,b) => new Date(b.dataPagamento) - new Date(a.dataPagamento));
      const totals = financialSummary((grossCents / 100).toFixed(2), ajustes);
      const conferenciasProvedor = await db.paymentIntent.count({ where: { state: 'review' } });
      sendSuccess(res, 200, 'Relatório financeiro', { resumo: {
        totalReceita: totals.netAmount, totalBruto: totals.grossAmount, totalCorrecoes: totals.correctionAmount,
        totalDevolucoesInformadas: totals.refundRecordedAmount, totalAjustes: totals.adjustedAmount,
        totalPendente: pendingCents / 100, totalVencido: overdueCents / 100, conferenciasProvedor,
        criterio: 'Recebimentos por data de pagamento; ajustes por data efetiva. Líquido registrado, sem confirmação bancária.'
      }, items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/relatorios/frequencia
   * Relatório de frequência com filtros de data.
   * Query: ?startDate=...&endDate=...
   */
  async frequencia(req, res, next) {
    try {
      const today = brazilDate(now());
      const dateFilter = { checkinDate: civilRange(req.query) || { gte: addDays(today, -29), lte: today } };

      // Ranking de frequência dos alunos no período
      const ranking = await db.checkin.groupBy({
        by: ['studentId'],
        where: {
          status: 'present',
          ...dateFilter
        },
        _count: { studentId: true },
        orderBy: { _count: { studentId: 'desc' } },
      });

      // Enriquece com nomes dos alunos e plano
      const studentIds = ranking.map(r => r.studentId);
      const alunos = await db.student.findMany({
        where: { id: { in: studentIds } },
        include: { 
          user: { select: { name: true } },
          plan: { select: { name: true } }
        },
      });
      
      const alunoMap = {};
      alunos.forEach(a => { 
        alunoMap[a.id] = {
          nome: a.user?.name || `Aluno #${a.id}`,
          plano: a.plan?.name || 'Sem plano',
          status: a.status
        }; 
      });

      const items = ranking.map(r => ({
        studentId: r.studentId,
        nome: alunoMap[r.studentId]?.nome || `Aluno #${r.studentId}`,
        plano: alunoMap[r.studentId]?.plano,
        statusAluno: alunoMap[r.studentId]?.status,
        totalCheckins: r._count.studentId,
      }));

      sendSuccess(res, 200, 'Relatório de frequência', items);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/relatorios/checkins
   * Check-ins por período.
   * Query: ?startDate=...&endDate=...
   */
  async checkins(req, res, next) {
    try {
      const where = { status: 'present' };
      const period = civilRange(req.query);
      if (period) where.checkinDate = period;

      const checkins = await db.checkin.findMany({
        where,
        include: {
          student: { include: { user: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'desc' }
      });

      const items = checkins.map(c => ({
        id: c.id,
        aluno: c.student?.user?.name || `Aluno #${c.studentId}`,
        data: c.checkinDate,
        hora: c.createdAt,
        status: c.status
      }));

      sendSuccess(res, 200, 'Relatório de check-ins', { total: items.length, items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/relatorios/alunos
   * Relatório de alunos (ativos vs inativos/bloqueados)
   */
  async alunos(req, res, next) {
    try {
      const alunos = await db.student.findMany({
        include: {
          user: { select: { name: true, email: true, createdAt: true } },
          plan: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      let ativos = 0;
      let inativos = 0;
      let bloqueados = 0;

      const items = alunos.map(a => {
        if (a.status === 'active') ativos++;
        else if (a.status === 'inactive') inativos++;
        else if (a.status === 'blocked') bloqueados++;

        return {
          id: a.id,
          nome: a.user?.name,
          email: a.user?.email,
          plano: a.plan?.name || 'Sem plano',
          status: a.status,
          dataMatricula: a.createdAt
        };
      });

      sendSuccess(res, 200, 'Relatório de alunos', {
        resumo: { ativos, inativos, bloqueados, total: items.length },
        items
      });
    } catch (error) {
      next(error);
    }
  }
};

}

module.exports = createRelatoriosController();
module.exports.createRelatoriosController = createRelatoriosController;

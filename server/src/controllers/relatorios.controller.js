/**
 * ============================================================================
 * FitFlow Caraguá — Controller de Relatórios (TASK 08 — Integração)
 * ============================================================================
 * Gera dados agregados para dashboard e relatórios.
 * Integrado com check-ins reais (não mais placeholder).
 */

const { sendSuccess } = require('../utils/helpers');
const { prisma } = require('../config/prisma');
const checkinsRepository = require('../repositories/checkins.repository');

const relatoriosController = {
  /**
   * GET /api/relatorios/dashboard
   * KPIs principais do sistema. Agora com check-ins reais.
   */
  async dashboard(req, res, next) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      // Executa todas as queries em paralelo para performance
      const [totalAlunos, alunosAtivos, alunosInadimplentes, treinosAtivos, checkinsHoje, receitaMes, checkins7dias, recentesCheckins, recentesAlunos, pagamentos7dias, alunos7dias, recentesPagamentos] = await Promise.all([
        prisma.student.count(),
        prisma.student.count({ where: { status: 'active' } }),
        prisma.student.count({ where: { status: 'blocked' } }),
        prisma.workout.count({ where: { active: true } }),
        // Check-ins reais do dia (apenas status 'present')
        checkinsRepository.countToday(),
        // Receita do mês via pagamentos confirmados
        prisma.payment.aggregate({
          where: {
            status: 'paid',
            paymentDate: { gte: firstOfMonth, lte: lastOfMonth },
          },
          _sum: { amount: true },
        }),
        // Tendencias: check-ins dos ultimos 7 dias
        prisma.checkin.findMany({
          where: {
            status: 'present',
            checkinDate: { gte: sevenDaysAgo }
          },
          select: { checkinDate: true }
        }),
        // Atividades recentes: ultimos 5 checkins
        prisma.checkin.findMany({
          where: { status: 'present' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { student: { include: { user: true } } }
        }),
        // Atividades recentes: ultimas 5 matriculas
        prisma.student.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { user: true }
        }),
        // Pagamentos dos ultimos 7 dias
        prisma.payment.findMany({
          where: {
            status: 'paid',
            paymentDate: { gte: sevenDaysAgo }
          },
          select: { paymentDate: true, amount: true }
        }),
        // Novos alunos dos ultimos 7 dias
        prisma.student.findMany({
          where: {
            createdAt: { gte: sevenDaysAgo }
          },
          select: { createdAt: true }
        }),
        // Pagamentos recentes
        prisma.payment.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { student: { include: { user: true } } }
        })
      ]);

      // Processando tendências
      const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const tendenciasMap = {};
      const receitaMap = {};
      const novosAlunosMap = {};
      const labelsFormatados = [];
      
      for(let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // Usa a data no formato YYYY-MM-DD como chave primária interna
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const dayLabel = diasDaSemana[d.getDay()];
        tendenciasMap[key] = { label: dayLabel, count: 0 };
        receitaMap[key] = { label: dayLabel, amount: 0 };
        novosAlunosMap[key] = { label: dayLabel, count: 0 };
        labelsFormatados.push(dayLabel);
      }
      
      checkins7dias.forEach(chk => {
        const d = new Date(chk.checkinDate);
        const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
        if (tendenciasMap[key] !== undefined) {
           tendenciasMap[key].count++;
        }
      });

      pagamentos7dias.forEach(pag => {
        const d = new Date(pag.paymentDate);
        const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
        if (receitaMap[key] !== undefined) {
           receitaMap[key].amount += parseFloat(pag.amount);
        }
      });

      alunos7dias.forEach(aluno => {
        const d = new Date(aluno.createdAt);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
           descricao: `Pagamento de R$ ${parseFloat(pag.amount).toFixed(2)}`,
           data: pag.createdAt
         });
      });
      
      atividades.sort((a, b) => new Date(b.data) - new Date(a.data));
      atividades = atividades.slice(0, 5);

      const receitaValor = receitaMes && receitaMes._sum && receitaMes._sum.amount
        ? parseFloat(receitaMes._sum.amount)
        : 0;

      sendSuccess(res, 200, 'Dashboard KPIs', {
        totalAlunos: totalAlunos || 0,
        alunosAtivos: alunosAtivos || 0,
        alunosInadimplentes: alunosInadimplentes || 0,
        treinosAtivos: treinosAtivos || 0,
        checkinsHoje: checkinsHoje || 0,
        receitaEstimada: receitaValor,
        tendencias: {
          labels: Object.values(tendenciasMap).map(i => i.label),
          data: Object.values(tendenciasMap).map(i => i.count)
        },
        historico: {
          labels: Object.values(tendenciasMap).map(i => i.label),
          checkins: Object.values(tendenciasMap).map(i => i.count),
          receita: Object.values(receitaMap).map(i => i.amount),
          alunos: Object.values(novosAlunosMap).map(i => i.count)
        },
        atividades,
        pagamentosRecentes: pagamentosAtv
      });
    } catch (error) {
      console.error('RelatoriosController.dashboard [ERR]:', error);
      next(error);
    }
  },

  /**
   * GET /api/relatorios/inadimplencia
   * Retorna os alunos com status 'blocked' e o valor total de pagamentos em atraso
   */
  async inadimplencia(req, res, next) {
    try {
      const inadimplentes = await prisma.student.findMany({
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
          user: { select: { name: true, email: true, phone: true } },
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
          telefone: aluno.user?.phone,
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
      let where = {};
      
      if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        where.paymentDate = { gte: start, lte: end };
      }

      const pagamentos = await prisma.payment.findMany({
        where,
        include: {
          student: { include: { user: { select: { name: true } } } },
          plan: { select: { name: true } }
        },
        orderBy: { paymentDate: 'desc' }
      });

      let totalReceita = 0;
      let totalPendente = 0;
      let totalVencido = 0;

      const items = pagamentos.map(p => {
        const valor = parseFloat(p.amount);
        if (p.status === 'paid') totalReceita += valor;
        else if (p.status === 'pending') totalPendente += valor;
        else if (p.status === 'overdue') totalVencido += valor;

        return {
          id: p.id,
          aluno: p.student?.user?.name || `Aluno #${p.studentId}`,
          plano: p.plan?.name || 'Avulso',
          valor: valor,
          dataPagamento: p.paymentDate,
          vencimento: p.dueDate,
          status: p.status,
          metodo: p.paymentMethod
        };
      });

      sendSuccess(res, 200, 'Relatório financeiro', {
        resumo: {
          totalReceita,
          totalPendente,
          totalVencido
        },
        items
      });
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
      let dateFilter = {};
      
      if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter = { checkinDate: { gte: start, lte: end } };
      } else {
        // Padrão: últimos 30 dias se nenhuma data for fornecida
        const d = new Date();
        d.setDate(d.getDate() - 30);
        dateFilter = { checkinDate: { gte: d } };
      }

      // Ranking de frequência dos alunos no período
      const ranking = await prisma.checkin.groupBy({
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
      const alunos = await prisma.student.findMany({
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
      let where = { status: 'present' };
      
      if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        where.checkinDate = { gte: start, lte: end };
      }

      const checkins = await prisma.checkin.findMany({
        where,
        include: {
          student: { include: { user: { select: { name: true } } } }
        },
        orderBy: { checkinTime: 'desc' }
      });

      const items = checkins.map(c => ({
        id: c.id,
        aluno: c.student?.user?.name || `Aluno #${c.studentId}`,
        data: c.checkinDate,
        hora: c.checkinTime,
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
      const alunos = await prisma.student.findMany({
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

module.exports = relatoriosController;

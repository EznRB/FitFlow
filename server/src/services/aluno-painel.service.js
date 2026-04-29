/**
 * ============================================================================
 * FitFlow Caraguá — Service do Painel do Aluno (TASK 10)
 * ============================================================================
 * Agrega TODOS os dados relevantes do aluno logado em uma única chamada,
 * otimizando a performance no frontend (menos requisições HTTP).
 *
 * Dados retornados:
 * - Perfil do aluno (nome, status, plano)
 * - Situação financeira (vencimento, dias restantes, inadimplência)
 * - Treinos ativos com exercícios
 * - Histórico de check-ins recentes
 * - Histórico de cargas agrupado por exercício
 * - Alertas dinâmicos (inadimplência, treino desatualizado, etc.)
 *
 * Regra de segurança:
 * ⚠️ Todos os métodos recebem o userId do JWT e buscam APENAS
 *    os dados vinculados a esse aluno. Nenhum dado de terceiro é exposto.
 */

const { prisma } = require('../config/prisma');
const AppError = require('../utils/AppError');
const businessRules = require('../utils/businessRules');
const pagamentosService = require('./pagamentos.service');

class AlunoPainelService {

  /**
   * Busca o registro Student vinculado ao userId do JWT.
   * Método interno reutilizado por todos os outros.
   * @param {number} userId - ID do user logado (vem do token JWT)
   * @returns {Promise<object>} Dados do aluno
   * @throws {AppError} 404 se não encontrar perfil de aluno
   */
  async _getStudentByUserId(userId) {
    const aluno = await prisma.student.findUnique({
      where: { userId: parseInt(userId) },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        plan: { select: { id: true, name: true, price: true, durationDays: true } },
      },
    });

    if (!aluno) {
      throw new AppError('Perfil de aluno não encontrado para este usuário.', 404);
    }

    return aluno;
  }

  /**
   * ENDPOINT PRINCIPAL — Retorna todos os dados do aluno em uma chamada.
   * 
   * Fluxo:
   * 1. Busca perfil do aluno pelo userId
   * 2. Executa em paralelo: treinos, check-ins, pagamentos, estatísticas
   * 3. Monta alertas dinâmicos baseados no estado
   * 4. Retorna objeto consolidado
   *
   * @param {number} userId - ID do user logado
   * @returns {Promise<object>} Dados consolidados do painel
   */
  async getPainelCompleto(userId) {
    // 1. Busca o perfil do aluno
    const aluno = await this._getStudentByUserId(userId);

    // 2. Executa todas as consultas em paralelo para máxima performance
    const [treinos, checkinsRecentes, ultimoPagamento, statsCheckins] = await Promise.all([
      // Treinos ativos com exercícios e última carga (só busca se não estiver bloqueado)
      (async () => {
        try {
          businessRules.validateWorkoutView(aluno);
          return prisma.workout.findMany({
            where: { studentId: aluno.id, active: true },
            include: {
              exercises: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  workoutLogs: {
                    where: { studentId: aluno.id },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { weight: true, repsCompleted: true, createdAt: true },
                  },
                },
              },
              instructor: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
          });
        } catch (e) {
          // Se falhou na validação da regra de negócio, retorna array vazio (treino bloqueado)
          return [];
        }
      })(),

      // Últimos 10 check-ins
      prisma.checkin.findMany({
        where: { studentId: aluno.id, status: 'present' },
        orderBy: { checkinDate: 'desc' },
        take: 10,
        select: { id: true, checkinDate: true, checkinTime: true, createdAt: true },
      }),

      // Último pagamento registrado
      prisma.payment.findFirst({
        where: { studentId: aluno.id },
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true, amount: true, paymentDate: true, dueDate: true,
          status: true, paymentMethod: true,
          plan: { select: { name: true } },
        },
      }),

      // Contagem de check-ins no mês atual
      prisma.checkin.count({
        where: {
          studentId: aluno.id,
          status: 'present',
          checkinDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    // 3. Calcula dados derivados de mensalidade
    const mensalidade = this._calcularMensalidade(aluno, ultimoPagamento);

    // 4. Monta alertas dinâmicos
    const alertas = this._gerarAlertas(aluno, mensalidade, treinos);

    // 5. Retorna objeto consolidado
    return {
      perfil: {
        id: aluno.id,
        userId: aluno.user.id,
        nome: aluno.user.name,
        email: aluno.user.email,
        status: aluno.status,
        plano: aluno.plan ? {
          id: aluno.plan.id,
          nome: aluno.plan.name,
          preco: aluno.plan.price,
          duracaoDias: aluno.plan.durationDays,
        } : null,
      },
      mensalidade,
      treinos: treinos.map(t => ({
        id: t.id,
        nome: t.name,
        descricao: t.description,
        instrutor: t.instructor?.name || 'Instrutor',
        criadoEm: t.createdAt,
        qtdExercicios: t.exercises.length,
        exercicios: t.exercises.map(ex => ({
          id: ex.id,
          nome: ex.name,
          grupoMuscular: ex.muscleGroup,
          series: ex.sets,
          reps: ex.reps,
          cargaSugerida: ex.suggestedLoad,
          notas: ex.notes,
          ultimaCarga: ex.workoutLogs[0] ? {
            peso: ex.workoutLogs[0].weight,
            reps: ex.workoutLogs[0].repsCompleted,
            data: ex.workoutLogs[0].createdAt,
          } : null,
        })),
      })),
      checkins: {
        recentes: checkinsRecentes.map(c => ({
          id: c.id,
          data: c.checkinDate,
          hora: c.checkinTime,
          criadoEm: c.createdAt,
        })),
        totalMes: statsCheckins,
      },
      alertas,
    };
  }

  /**
   * Retorna detalhes da situação financeira do aluno.
   * Inclui últimos 5 pagamentos e status do plano.
   *
   * @param {number} userId - ID do user logado
   * @returns {Promise<object>} Dados financeiros do aluno
   */
  async getMensalidade(userId) {
    const aluno = await this._getStudentByUserId(userId);

    const pagamentos = await prisma.payment.findMany({
      where: { studentId: aluno.id },
      orderBy: { paymentDate: 'desc' },
      take: 5,
      include: {
        plan: { select: { name: true, price: true } },
      },
    });

    const ultimoPagamento = pagamentos.length > 0 ? pagamentos[0] : null;
    const mensalidade = this._calcularMensalidade(aluno, ultimoPagamento);

    return {
      ...mensalidade,
      plano: aluno.plan ? {
        nome: aluno.plan.name,
        preco: aluno.plan.price,
        duracaoDias: aluno.plan.durationDays,
      } : null,
      historicoPagamentos: pagamentos.map(p => ({
        id: p.id,
        valor: p.amount,
        dataPagamento: p.paymentDate,
        vencimento: p.dueDate,
        status: p.status,
        metodo: p.paymentMethod,
        plano: p.plan?.name || '—',
      })),
    };
  }

  /**
   * Retorna histórico de check-ins do aluno com paginação.
   *
   * @param {number} userId - ID do user logado
   * @param {number} limit - Quantidade de registros (padrão 20)
   * @param {number} offset - Ponto de início (padrão 0)
   * @returns {Promise<object>} Check-ins e total
   */
  async getCheckins(userId, limit = 20, offset = 0) {
    const aluno = await this._getStudentByUserId(userId);

    const [checkins, total] = await Promise.all([
      prisma.checkin.findMany({
        where: { studentId: aluno.id },
        orderBy: { checkinDate: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true, checkinDate: true, checkinTime: true,
          status: true, createdAt: true,
        },
      }),
      prisma.checkin.count({ where: { studentId: aluno.id, status: 'present' } }),
    ]);

    // Calcula o total no mês atual
    const totalMes = await prisma.checkin.count({
      where: {
        studentId: aluno.id,
        status: 'present',
        checkinDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    return {
      checkins: checkins.map(c => ({
        id: c.id,
        data: c.checkinDate,
        hora: c.checkinTime,
        status: c.status,
        criadoEm: c.createdAt,
      })),
      total,
      totalMes,
    };
  }

  /**
   * Retorna histórico de cargas do aluno agrupado por exercício.
   * Permite filtrar por exercício específico.
   *
   * @param {number} userId - ID do user logado
   * @param {number|null} exerciseId - Filtro por exercício
   * @returns {Promise<object>} Histórico agrupado
   */
  async getHistoricoCarga(userId, exerciseId = null) {
    const aluno = await this._getStudentByUserId(userId);

    const where = { studentId: aluno.id };
    if (exerciseId) where.exerciseId = parseInt(exerciseId);

    const logs = await prisma.workoutLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        exercise: {
          select: { id: true, name: true, muscleGroup: true },
        },
      },
    });

    // Agrupa por exercício
    const agrupado = {};
    logs.forEach(log => {
      const key = log.exercise.id;
      if (!agrupado[key]) {
        agrupado[key] = {
          exercicioId: log.exercise.id,
          exercicioNome: log.exercise.name,
          grupoMuscular: log.exercise.muscleGroup,
          registros: [],
        };
      }
      agrupado[key].registros.push({
        id: log.id,
        peso: log.weight,
        reps: log.repsCompleted,
        notas: log.notes,
        data: log.createdAt,
      });
    });

    return Object.values(agrupado);
  }

  // ============================================
  // MÉTODOS INTERNOS (cálculos e lógica derivada)
  // ============================================

  /**
   * Calcula dados derivados da mensalidade do aluno.
   * Determina status visual (em dia, vencendo, vencido) e dias restantes.
   *
   * @param {object} aluno - Dados do aluno com plano
   * @param {object|null} ultimoPagamento - Último pagamento registrado
   * @returns {object} Dados calculados da mensalidade
   */
  _calcularMensalidade(aluno, ultimoPagamento) {
    const agora = new Date();
    const vencimento = aluno.planEndDate ? new Date(aluno.planEndDate) : null;

    let diasRestantes = null;
    let statusVisual = 'indefinido'; // verde, amarelo, vermelho, indefinido

    if (vencimento) {
      diasRestantes = Math.ceil((vencimento - agora) / (1000 * 60 * 60 * 24));

      if (aluno.status === 'blocked') {
        statusVisual = 'bloqueado';
      } else if (diasRestantes < 0) {
        statusVisual = 'vencido';
      } else if (diasRestantes <= 5) {
        statusVisual = 'vencendo';
      } else {
        statusVisual = 'em_dia';
      }
    }

    return {
      statusAluno: aluno.status,
      statusVisual,
      vencimento: vencimento ? vencimento.toISOString() : null,
      diasRestantes,
      ultimoPagamento: ultimoPagamento ? {
        valor: ultimoPagamento.amount,
        data: ultimoPagamento.paymentDate,
        vencimento: ultimoPagamento.dueDate,
        status: ultimoPagamento.status,
        metodo: ultimoPagamento.paymentMethod,
      } : null,
    };
  }

  /**
   * Gera alertas dinâmicos baseados no estado atual do aluno.
   * Os alertas são exibidos no painel como banners ou notificações.
   *
   * @param {object} aluno - Dados do aluno
   * @param {object} mensalidade - Dados calculados da mensalidade
   * @param {Array} treinos - Treinos ativos do aluno
   * @returns {Array} Lista de alertas com tipo e mensagem
   */
  _gerarAlertas(aluno, mensalidade, treinos) {
    const alertas = [];

    // Alerta crítico: bloqueio por inadimplência
    if (aluno.status === 'blocked') {
      alertas.push({
        tipo: 'bloqueio',
        severidade: 'critico',
        mensagem: 'Sua matrícula está bloqueada por inadimplência. Procure a recepção para regularizar.',
        icone: 'alert-triangle',
      });
    }

    // Alerta de vencimento próximo
    if (mensalidade.statusVisual === 'vencendo') {
      alertas.push({
        tipo: 'vencimento',
        severidade: 'aviso',
        mensagem: `Sua mensalidade vence em ${mensalidade.diasRestantes} dia(s). Evite bloqueio renovando com antecedência.`,
        icone: 'clock',
      });
    }

    // Alerta de mensalidade vencida (mas ainda não bloqueado)
    if (mensalidade.statusVisual === 'vencido' && aluno.status !== 'blocked') {
      alertas.push({
        tipo: 'vencimento',
        severidade: 'alerta',
        mensagem: 'Sua mensalidade está vencida. Regularize para evitar bloqueio.',
        icone: 'alert-circle',
      });
    }

    // Alerta: nenhum treino ativo
    if (treinos.length === 0) {
      alertas.push({
        tipo: 'treino',
        severidade: 'info',
        mensagem: 'Você ainda não tem uma ficha de treino ativa. Fale com seu instrutor.',
        icone: 'clipboard-list',
      });
    }

    return alertas;
  }

  /**
   * Processa um pagamento realizado pelo próprio aluno via checkout.
   * Como é um MVP, apenas delegamos para o PagamentosService.registrar
   * simulando um sucesso após validações básicas.
   *
   * @param {number} userId - ID do user logado
   * @param {object} data - { paymentMethod, planId }
   */
  async processarCheckout(userId, data) {
    const { paymentMethod, planId } = data;
    const aluno = await this._getStudentByUserId(userId);

    if (!aluno.planId && !planId) {
      throw new AppError('Você precisa selecionar um plano para realizar o pagamento.', 400);
    }

    const targetPlanId = planId ? parseInt(planId) : aluno.planId;
    const plano = await prisma.plan.findUnique({ where: { id: targetPlanId } });
    
    if (!plano) throw new AppError('Plano não encontrado.', 404);

    // Delega para o serviço central de pagamentos
    // O registeredBy fica null pois foi um auto-pagamento
    return pagamentosService.registrar({
      studentId: aluno.id,
      planId: targetPlanId,
      amount: plano.price,
      paymentMethod: paymentMethod || 'Simulado',
      notes: 'Pagamento realizado pelo aluno via checkout SPA.'
    }, null);
  }
}

module.exports = new AlunoPainelService();

/**
 * ============================================
 * FitFlow Caraguá — Controller de Relatórios
 * ============================================
 * Gera dados agregados para dashboard e relatórios.
 */

const { sendSuccess } = require('../utils/helpers');

const relatoriosController = {
  /** GET /api/relatorios/dashboard */
  async dashboard(req, res, next) {
    try {
      const prisma = require('../config/database');
      
      const totalAlunos = await prisma.student.count();
      const alunosAtivos = await prisma.student.count({
        where: { status: 'active' }
      });
      // Receita Estimada baseada nos planos dos alunos ativos
      const ativosComPlano = await prisma.student.findMany({
        where: { status: 'active', planId: { not: null } },
        include: { plan: true }
      });
      
      const receitaEstimada = ativosComPlano.reduce((acc, aluno) => {
        return acc + (aluno.plan ? parseFloat(aluno.plan.price) : 0);
      }, 0);

      sendSuccess(res, 200, 'Dashboard KPIs', {
        totalAlunos,
        alunosAtivos,
        checkinsHoje: 0, // Implementar checkins em task futura
        receitaEstimada,
      });
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/relatorios/financeiro */
  async financeiro(req, res, next) {
    try {
      // TODO: Implementar na Task 10
      sendSuccess(res, 200, 'Relatório financeiro — a implementar', []);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/relatorios/frequencia */
  async frequencia(req, res, next) {
    try {
      // TODO: Implementar na Task 10
      sendSuccess(res, 200, 'Relatório de frequência — a implementar', []);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = relatoriosController;

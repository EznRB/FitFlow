/**
 * ============================================================================
 * FitFlow Caraguá — Controller de Check-ins (TASK 08)
 * ============================================================================
 * Gerencia endpoints de presença diária.
 * Delega regras de negócio para o checkins.service.js.
 * 
 * Endpoints:
 * POST   /api/checkins                 → Registrar check-in
 * GET    /api/checkins                 → Listar check-ins (admin)
 * GET    /api/checkins/hoje            → Resumo do dia (admin)
 * GET    /api/checkins/frequencia      → Ranking de frequência (admin)
 * GET    /api/checkins/aluno/:alunoId  → Histórico de um aluno (admin)
 * PUT    /api/checkins/:id/cancelar    → Cancelar check-in (admin)
 * 
 * ⚠️ Não existe rota DELETE — regra de negócio.
 */

const { sendSuccess } = require('../utils/helpers');
const checkinsService = require('../services/checkins.service');
const AppError = require('../utils/AppError');

const checkinsController = {
  /**
   * POST /api/checkins
   * Registra check-in do dia para um aluno.
   * 
   * Dois fluxos:
   * - Admin: envia { studentId } no body para registrar presença de qualquer aluno.
   * - Aluno: o sistema usa o req.user para identificar o próprio aluno.
   * 
   * Body: { studentId? } — obrigatório para admin, opcional para aluno.
   */
  async registrar(req, res, next) {
    try {
      let studentId = req.body.studentId;

      // Se o usuário logado é aluno e não informou studentId, usa o próprio perfil
      if (!studentId && req.user && req.user.role === 'student') {
        // Busca o studentId vinculado ao userId do token
        const { prisma } = require('../config/prisma');
        const student = await prisma.student.findUnique({
          where: { userId: req.user.id },
        });
        if (!student) throw new AppError('Perfil de aluno não encontrado para este usuário.', 404);
        studentId = student.id;
      }

      if (!studentId) throw new AppError('ID do aluno é obrigatório.', 400);

      // Passa o ID de quem está registrando (para auditoria)
      const registeredBy = req.user ? req.user.id : null;

      const checkin = await checkinsService.registrar(studentId, registeredBy);
      sendSuccess(res, 201, 'Check-in registrado com sucesso!', checkin);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/checkins
   * Lista todos os check-ins com filtros opcionais via query string.
   * Filtros: ?studentId=1&startDate=2026-01-01&endDate=2026-12-31&incluirCancelados=true
   */
  async listar(req, res, next) {
    try {
      const checkins = await checkinsService.listar(req.query);
      sendSuccess(res, 200, 'Lista de check-ins recuperada com sucesso', checkins);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/checkins/hoje
   * Retorna o resumo de check-ins do dia atual.
   * Inclui total e lista de alunos com horários.
   */
  async resumoHoje(req, res, next) {
    try {
      const resumo = await checkinsService.resumoHoje();
      sendSuccess(res, 200, 'Resumo de check-ins de hoje', resumo);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/checkins/frequencia
   * Retorna ranking de frequência dos alunos.
   * Query: ?dias=30 (padrão: 30 dias)
   */
  async frequencia(req, res, next) {
    try {
      const dias = req.query.dias ? parseInt(req.query.dias) : 30;
      const ranking = await checkinsService.frequenciaPorAluno(dias);
      sendSuccess(res, 200, `Ranking de frequência dos últimos ${dias} dias`, ranking);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/checkins/aluno/:alunoId
   * Retorna o histórico de check-ins de um aluno específico.
   * Query: ?startDate=...&endDate=...&limit=60
   */
  async buscarPorAluno(req, res, next) {
    try {
      if (!req.params.alunoId) throw new AppError('ID do aluno não fornecido.', 400);

      const checkins = await checkinsService.buscarPorAluno(req.params.alunoId, req.query);
      sendSuccess(res, 200, 'Histórico de check-ins do aluno', checkins);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/checkins/:id/cancelar
   * Cancela um check-in com motivo obrigatório (fluxo administrativo).
   * ⚠️ Não deleta — apenas marca como 'cancelled' no banco.
   * 
   * Body: { motivo: "Descrição do motivo" }
   */
  async cancelar(req, res, next) {
    try {
      if (!req.params.id) throw new AppError('ID do check-in não fornecido.', 400);
      if (!req.body.motivo) throw new AppError('Motivo do cancelamento é obrigatório.', 400);

      const adminId = req.user ? req.user.id : null;
      if (!adminId) throw new AppError('Autenticação necessária.', 401);

      const checkin = await checkinsService.cancelarCheckin(
        req.params.id,
        req.body.motivo,
        adminId
      );

      sendSuccess(res, 200, 'Check-in cancelado com sucesso. O registro foi preservado para auditoria.', checkin);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = checkinsController;

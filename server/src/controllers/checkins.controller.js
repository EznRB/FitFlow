/**
 * ============================================
 * FitFlow Caraguá — Controller de Check-ins
 * ============================================
 * Registra presença diária. Sem delete (regra de negócio).
 */

const { sendSuccess } = require('../utils/helpers');

const checkinsController = {
  /** POST /api/checkins */
  async registrar(req, res, next) {
    try {
      // TODO: Implementar na Task 8
      sendSuccess(res, 201, 'Registrar check-in — a implementar');
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/checkins (admin) */
  async listar(req, res, next) {
    try {
      // TODO: Implementar na Task 8
      sendSuccess(res, 200, 'Listar check-ins — a implementar', []);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/checkins/aluno/:alunoId (admin) */
  async buscarPorAluno(req, res, next) {
    try {
      // TODO: Implementar na Task 8
      sendSuccess(res, 200, 'Check-ins do aluno — a implementar', []);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = checkinsController;

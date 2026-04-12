/**
 * ============================================
 * FitFlow Caraguá — Controller de Pagamentos
 * ============================================
 * Gerencia pagamentos de mensalidades. Apenas admin.
 */

const { sendSuccess } = require('../utils/helpers');

const pagamentosController = {
  /** GET /api/pagamentos */
  async listar(req, res, next) {
    try {
      // TODO: Implementar na Task 9
      sendSuccess(res, 200, 'Listar pagamentos — a implementar', []);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/pagamentos/:id */
  async buscarPorId(req, res, next) {
    try {
      // TODO: Implementar na Task 9
      sendSuccess(res, 200, 'Buscar pagamento — a implementar');
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/pagamentos/aluno/:alunoId */
  async buscarPorAluno(req, res, next) {
    try {
      // TODO: Implementar na Task 9
      sendSuccess(res, 200, 'Pagamentos do aluno — a implementar', []);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/pagamentos */
  async registrar(req, res, next) {
    try {
      // TODO: Implementar na Task 9
      sendSuccess(res, 201, 'Registrar pagamento — a implementar');
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/pagamentos/:id */
  async atualizar(req, res, next) {
    try {
      // TODO: Implementar na Task 9
      sendSuccess(res, 200, 'Atualizar pagamento — a implementar');
    } catch (error) {
      next(error);
    }
  },
};

module.exports = pagamentosController;

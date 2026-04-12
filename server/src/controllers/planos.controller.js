/**
 * ============================================
 * FitFlow Caraguá — Controller de Planos
 * ============================================
 * CRUD completo de planos de academia. Apenas admin acessa.
 */

const { sendSuccess } = require('../utils/helpers');
const planosService = require('../services/planos.service');

const planosController = {
  /** GET /api/planos */
  async listar(req, res, next) {
    try {
      const apenasAtivos = req.query.ativo === 'true';
      const planos = await planosService.listar(apenasAtivos);
      sendSuccess(res, 200, 'Planos listados com sucesso', planos);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/planos/:id */
  async buscarPorId(req, res, next) {
    try {
      const plano = await planosService.buscarPorId(req.params.id);
      sendSuccess(res, 200, 'Plano encontrado', plano);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/planos */
  async criar(req, res, next) {
    try {
      const plano = await planosService.criar(req.body);
      sendSuccess(res, 201, 'Plano criado com sucesso', plano);
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/planos/:id */
  async atualizar(req, res, next) {
    try {
      const plano = await planosService.atualizar(req.params.id, req.body);
      sendSuccess(res, 200, 'Plano atualizado com sucesso', plano);
    } catch (error) {
      next(error);
    }
  },

  /** DELETE /api/planos/:id (soft delete) */
  async desativar(req, res, next) {
    try {
      await planosService.desativar(req.params.id);
      sendSuccess(res, 200, 'Plano desativado com sucesso');
    } catch (error) {
      next(error);
    }
  },
};

module.exports = planosController;

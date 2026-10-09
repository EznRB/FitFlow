'use strict';
const { sendSuccess } = require('../utils/helpers');
const service = require('../services/treinos.service');
const AppError = require('../utils/AppError');

module.exports = {
  async alunosElegiveis(req, res, next) {
    try { sendSuccess(res, 200, 'Alunos elegíveis para fichas', await service.listarAlunosElegiveis(req.user)); }
    catch (error) { next(error); }
  },
  async catalogo(req, res, next) {
    try { sendSuccess(res, 200, 'Catálogo para seleção profissional', await service.listarCatalogo(req.user)); }
    catch (error) { next(error); }
  },
  async listar(req, res, next) {
    try {
      const filters = {};
      if (req.query.studentId !== undefined) filters.studentId = req.query.studentId;
      if (req.query.active !== undefined) {
        if (!['true', 'false'].includes(req.query.active)) throw new AppError('Use active=true ou active=false.', 400);
        filters.active = req.query.active === 'true';
      }
      sendSuccess(res, 200, 'Fichas listadas', await service.listar(filters, req.user));
    } catch (error) { next(error); }
  },
  async buscarPorId(req, res, next) {
    try { sendSuccess(res, 200, 'Ficha encontrada', await service.buscarPorId(req.params.id, req.user)); }
    catch (error) { next(error); }
  },
  async criar(req, res, next) {
    try { sendSuccess(res, 201, 'Ficha criada', await service.criar(req.body, req.user)); }
    catch (error) { next(error); }
  },
  async atualizar(req, res, next) {
    try {
      const workout = await service.atualizar(req.params.id, req.body, req.user);
      sendSuccess(res, 200, workout._historyPreserved ?
        'Nova revisão criada. A ficha anterior foi arquivada com exercícios e histórico preservados.' : 'Ficha atualizada', workout);
    } catch (error) { next(error); }
  },
  async desativar(req, res, next) {
    try { await service.desativar(req.params.id, req.user); sendSuccess(res, 200, 'Ficha arquivada. Histórico preservado.'); }
    catch (error) { next(error); }
  },
  async meusTreinos(req, res, next) {
    try { sendSuccess(res, 200, 'Suas fichas', await service.buscarMeusTreinos(req.user.id)); }
    catch (error) { next(error); }
  },
  async registrarCarga(req, res, next) {
    try { sendSuccess(res, 201, 'Carga registrada', await service.registrarCarga(req.body, req.user.id)); }
    catch (error) { next(error); }
  },
  async historicoCarga(req, res, next) {
    try { sendSuccess(res, 200, 'Histórico de cargas', await service.listarHistoricoCarga(req.user.id, req.query.exerciseId ?? null)); }
    catch (error) { next(error); }
  },
};

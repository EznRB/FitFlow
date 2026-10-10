'use strict';
const { sendSuccess } = require('../utils/helpers');
const { createSessoesService } = require('../services/sessoes.service');
const { createSessoesRepository } = require('../repositories/sessoes.repository');
const { prisma } = require('../config/prisma');
const service = createSessoesService(createSessoesRepository(prisma));
function action(method, message, status = 200) {
  return async (req, res, next) => {
    try {
      const result = method === 'mine' ? await service.mine(req.user.id)
        : method === 'start' ? await service.start(req.user.id, req.body)
          : await service[method](req.user.id, req.params.id, req.body);
      sendSuccess(res, status, message, result);
    } catch (error) { next(error); }
  };
}
module.exports = { start: action('start', 'Sessão registrada', 201), addSet: action('addSet', 'Série registrada', 201), complete: action('complete', 'Sessão finalizada'), mine: action('mine', 'Histórico de sessões') };

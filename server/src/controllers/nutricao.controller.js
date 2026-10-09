'use strict';
const { sendSuccess } = require('../utils/helpers');
function createNutricaoController(service) {
  const action = (method, message) => async (req, res, next) => {
    try { sendSuccess(res, 200, message, await service[method](req.user.id, req.body)); }
    catch (error) { next(error); }
  };
  return { get: action('get', 'Simulação da sua conta'), save: action('save', 'Simulação salva na sua conta'), remove: action('remove', 'Simulação salva excluída') };
}
module.exports = { createNutricaoController };

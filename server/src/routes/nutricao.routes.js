'use strict';
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { createNutricaoController } = require('../controllers/nutricao.controller');
function defaultService() {
  const { prisma } = require('../config/prisma');
  return require('../services/nutricao.service').createNutricaoService(require('../repositories/nutricao.repository').createNutricaoRepository(prisma));
}
function createNutricaoRouter(service = defaultService(), { authenticate: verify = authenticate } = {}) {
  const router = express.Router(), controller = createNutricaoController(service);
  router.use(verify, authorize('student', 'admin', 'instructor'));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/scenario', controller.get);
  router.put('/scenario', express.json({ limit: '4kb' }), controller.save);
  router.delete('/scenario', controller.remove);
  return router;
}
module.exports = { createNutricaoRouter };

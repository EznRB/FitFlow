// Mantém autenticação e limite de geração separados da calculadora local.
const express = require('express');
const { createQuotaLimiter } = require('../middleware/quota');
const { authenticate, authorize } = require('../middleware/auth');
const { createIaService } = require('../services/ia.service');

function createIaRouter(service = createIaService(), { authenticate: authenticateRequest = authenticate, quotaOptions } = {}) {
  const router = express.Router();
  router.use(authenticateRequest, authorize('admin', 'instructor', 'student'));
  router.get('/status', (req, res) => res.json({ status: 'success', data: { enabled: service.enabled } }));
  const limiter = createQuotaLimiter({ ...quotaOptions, endpoint: 'ia:explicar', windowMs: 15 * 60 * 1000, max: 10, keyGenerator: req => String(req.user.id),
    message: { status: 'fail', message: 'Limite de explicações atingido. Tente novamente em 15 minutos.' } });
  router.post('/explicar', limiter, async (req, res, next) => {
    try {
      const data = await service.explain(req.body?.topic);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createIaRouter };

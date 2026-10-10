// Mantém autenticação e limite de geração separados da calculadora local.
const express = require('express');
const { createQuotaLimiter } = require('../middleware/quota');
const { authenticate, authorize } = require('../middleware/auth');
const { createIaService } = require('../services/ia.service');

function createIaRouter(service = createIaService(), { authenticate: authenticateRequest = authenticate, quotaOptions } = {}) {
  const router = express.Router();
  router.use(authenticateRequest, authorize('admin', 'instructor', 'student'));
  router.get('/status', (req, res) => res.json({ status: 'success', data: { enabled: service.enabled,
    ...(['gemini', 'groq'].includes(service.provider) ? { provider: service.provider } : {}),
  } }));
  const limiter = createQuotaLimiter({ ...quotaOptions, endpoint: 'ia:explicar', windowMs: 15 * 60 * 1000, max: 10, keyGenerator: req => String(req.user.id),
    message: { status: 'fail', message: 'Limite de explicações atingido. Tente novamente em 15 minutos.' } });
  // Só o glossário fixo dispensa quota de inferência. A autenticação acima e a
  // proteção global de API continuam aplicadas a todas as solicitações.
  router.post('/explicar', (req, res, next) => req.body?.topic === 'volume' ? next() : limiter(req, res, next), async (req, res, next) => {
    try {
      const data = await service.explain(req.body?.topic);
      res.json({ status: 'success', data });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createIaRouter };

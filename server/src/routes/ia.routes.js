// Mantém autenticação e limite de geração separados da calculadora local.
const express = require('express');
const { createQuotaLimiter } = require('../middleware/quota');
const { authenticate, authorize } = require('../middleware/auth');
const { createIaService } = require('../services/ia.service');
const { createIaChatService, validateChatInput } = require('../services/ia-chat.service');

function createIaRouter(service = createIaService(), { authenticate: authenticateRequest = authenticate, quotaOptions,
  chatService = createIaChatService() } = {}) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticateRequest, authorize('admin', 'instructor', 'student'));
  router.get('/status', (req, res) => res.json({ status: 'success', data: { enabled: service.enabled, chatEnabled: chatService.enabled,
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
  const chatLimiter = createQuotaLimiter({ ...quotaOptions, endpoint: 'ia:chat', windowMs: 15 * 60 * 1000, max: 10,
    keyGenerator: req => String(req.user.id),
    message: { status: 'fail', message: 'Limite de mensagens atingido. Tente novamente em 15 minutos.' } });
  router.post('/chat', (req, res, next) => {
    try { validateChatInput(req.body); next(); } catch (error) { next(error); }
  }, chatLimiter, async (req, res, next) => {
    try { res.json({ status: 'success', data: await chatService.chat(req.body) }); }
    catch (error) { next(error); }
  });
  return router;
}
module.exports = { createIaRouter };

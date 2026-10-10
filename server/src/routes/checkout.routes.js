const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate: defaultAuthenticate, authorize } = require('../middleware/auth');
const { createCheckoutService } = require('../services/checkout.service');
function createCheckoutRouter({ service = createCheckoutService(), authenticate = defaultAuthenticate } = {}) {
  const router = express.Router();
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/webhook', rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }), async (req, res, next) => {
    try { await service.webhook(req); res.sendStatus(200); } catch (error) { next(error); }
  });
  router.use(authenticate, authorize('student'));
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 60, keyGenerator: req => String(req.user.id), standardHeaders: true, legacyHeaders: false }));
  router.get('/status', (req, res) => res.json({ status: 'success', data: service.status() }));
  router.get('/plans', async (req, res, next) => {
    try { res.json({ status: 'success', data: await service.plans() }); } catch (error) { next(error); }
  });
  router.post('/intents', async (req, res, next) => {
    try { res.status(201).json({ status: 'success', data: await service.start(req.user.id, req.body) }); } catch (error) { next(error); }
  });
  router.get('/intents/:id', async (req, res, next) => {
    try { res.json({ status: 'success', data: await service.get(req.user.id, req.params.id) }); } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createCheckoutRouter };

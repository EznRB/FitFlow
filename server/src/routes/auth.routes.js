/**
 * ============================================
 * FitFlow Caraguá — Rotas de Autenticação
 * ============================================
 * POST /api/auth/login    — Login
 * POST /api/auth/register — Registro (somente admin)
 * POST /api/auth/logout   — Logout
 * POST /api/auth/refresh  — Renovação indisponível (501)
 * GET  /api/auth/me       — Dados do usuário logado
 */

const express = require('express');
const { createQuotaLimiter } = require('../middleware/quota');
const { createAuthController } = require('../controllers/auth.controller');
const { authenticate: defaultAuthenticate, authorize } = require('../middleware/auth');

function createAuthRouter({ service, authenticate = defaultAuthenticate, quotaOptions } = {}) {
  const router = express.Router();
  const controller = createAuthController(service);
  const loginLimiter = createQuotaLimiter({ ...quotaOptions, endpoint: 'auth:login', windowMs: 15 * 60 * 1000, max: 10,
    message: { status: 'fail', message: 'Muitas tentativas de login. Aguarde 15 minutos.' } });
  router.post('/login', loginLimiter, controller.login);
  router.post('/register', authenticate, authorize('admin'), controller.register);
  router.post('/logout', controller.logout);
  router.post('/refresh', controller.refreshToken);
  router.get('/me', authenticate, controller.getMe);
  return router;
}

module.exports = createAuthRouter();
module.exports.createAuthRouter = createAuthRouter;

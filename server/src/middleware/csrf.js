const env = require('../config/env');
const AppError = require('../utils/AppError');
const { normalizeOrigins, resolveAllowedOrigins } = require('../config/origins');

// Montar em /api após cookieParser e antes das rotas.
function createCsrfProtection({ allowedOrigins = resolveAllowedOrigins(env.cors.origin) } = {}) {
  const trusted = new Set(normalizeOrigins(allowedOrigins));
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const json = req.is('application/json');
    // Essa exceção só entrega o pedido à rota que exige HMAC; não autentica o webhook.
    if (req.method === 'POST' && req.path === '/checkout/webhook' && json) return next();
    const origin = req.get('Origin');
    if (origin !== undefined) {
      if (trusted.has(origin)) return next();
      return next(new AppError('Origem da solicitação não autorizada.', 403));
    }
    const cookieSession = Boolean(req.cookies?.access_token || req.signedCookies?.access_token);
    const browserRequest = req.get('Sec-Fetch-Site') !== undefined;
    // Cookie tem precedência sobre Bearer em authenticate; nunca pode contornar a checagem.
    if (!cookieSession && !browserRequest && (/^Bearer \S+$/.test(req.get('Authorization') || '') ||
      (req.method === 'POST' && req.path === '/auth/login' && json))) return next();
    return next(new AppError('Origem obrigatória para esta solicitação.', 403));
  };
}
module.exports = { createCsrfProtection, normalizeOrigins };

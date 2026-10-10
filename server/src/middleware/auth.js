/**
 * ============================================
 * FitFlow Caraguá — Middleware de Autenticação
 * ⚠️ Todas as rotas exigem autenticação + role 'student'.
 * ============================================
 * Verifica JWT em cookies httpOnly e controla
 * acesso baseado em roles (admin/student).
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { prisma } = require('../config/prisma');

/**
 * Middleware que verifica se o usuário está autenticado.
 * Extrai o token do cookie httpOnly ou do header Authorization.
 */
function createAuthenticate({ findUser = id => prisma.user.findUnique({
  where: { id }, select: { id: true, name: true, email: true, role: true, active: true },
}), secret = env.jwt.secret } = {}) {
return async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Tenta extrair do cookie httpOnly
    if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }
    // 2. Fallback: header Authorization (Bearer token)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Acesso não autorizado. Faça login para continuar.', 401);
    }

    // Verifica e decodifica o token
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(decoded.id) || decoded.id <= 0) throw new AppError('Token inválido. Faça login novamente.', 401);
    let user;
    try {
      user = await findUser(decoded.id);
    } catch (error) {
      // Falha de infraestrutura não invalida o cookie nem deve provocar logout.
      throw new AppError('Serviço de autenticação temporariamente indisponível.', 503);
    }
    if (!user || user.active !== true) throw new AppError('Sessão inválida ou conta desativada. Faça login novamente.', 401);

    // Anexa os dados do usuário ao request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Sessão expirada. Faça login novamente.', 401));
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return next(new AppError('Token inválido. Faça login novamente.', 401));
    }
    return next(new AppError('Erro na autenticação.', 401));
  }
};
}
const authenticate = createAuthenticate();

/**
 * Middleware factory que restringe acesso por role.
 * @param  {...string} roles - Roles permitidas ('admin', 'student')
 * @returns {Function} Middleware do Express
 * 
 * Uso: router.get('/rota', authenticate, authorize('admin'), controller.metodo)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Autenticação necessária.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Você não tem permissão para acessar este recurso.', 403));
    }

    next();
  };
}

module.exports = { authenticate, authorize, createAuthenticate };

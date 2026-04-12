/**
 * ============================================
 * FitFlow Caraguá — Middleware de Erro Global
 * ============================================
 * Captura todos os erros da aplicação e retorna
 * respostas padronizadas. Diferencia erros operacionais
 * (AppError) de bugs inesperados.
 */

const env = require('../config/env');

/**
 * Middleware de erro centralizado.
 * Deve ser registrado DEPOIS de todas as rotas.
 */
function errorHandler(err, req, res, next) {
  // Valores padrão
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log do erro (sempre no servidor)
  if (err.statusCode === 500) {
    console.error('🔴 ERRO INTERNO:', err);
  } else if (env.isDev) {
    console.error(`⚠️  [${err.statusCode}]`, err.message);
  }

  // ---- Erros específicos do MySQL ----
  if (err.code === 'ER_DUP_ENTRY') {
    err.statusCode = 409;
    err.message = 'Registro duplicado. Este dado já existe no sistema.';
    err.status = 'fail';
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    err.statusCode = 400;
    err.message = 'Referência inválida. O registro relacionado não existe.';
    err.status = 'fail';
  }

  // ---- Erros de validação (express-validator) ----
  if (err.type === 'validation') {
    err.statusCode = 422;
    err.status = 'fail';
  }

  // ---- Resposta ----
  const response = {
    status: err.status,
    message: err.isOperational ? err.message : 'Erro interno do servidor. Tente novamente.',
  };

  // Em desenvolvimento, inclui detalhes extras
  if (env.isDev && !err.isOperational) {
    response.error = err.message;
    response.stack = err.stack;
  }

  // Se tiver erros de validação, inclui detalhes
  if (err.errors) {
    response.errors = err.errors;
  }

  res.status(err.statusCode).json(response);
}

/**
 * Middleware para rotas não encontradas (404).
 * Deve ser registrado DEPOIS de todas as rotas e ANTES do errorHandler.
 */
function notFoundHandler(req, res, next) {
  const err = new Error(`Rota não encontrada: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  err.status = 'fail';
  err.isOperational = true;
  next(err);
}

module.exports = { errorHandler, notFoundHandler };

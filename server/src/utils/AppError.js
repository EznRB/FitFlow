/**
 * ============================================
 * FitFlow Caraguá — Classe de Erro Customizada
 * ============================================
 * Permite lançar erros com status HTTP e mensagem
 * amigável, capturados pelo middleware de erro.
 * 
 * Uso: throw new AppError('Aluno não encontrado', 404);
 */

class AppError extends Error {
  /**
   * @param {string} message - Mensagem de erro amigável
   * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 409, 500...)
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Diferencia erros esperados de bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

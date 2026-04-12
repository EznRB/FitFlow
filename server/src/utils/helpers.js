/**
 * ============================================
 * FitFlow Caraguá — Funções Utilitárias
 * ============================================
 * Helpers compartilhados por todo o backend.
 */

/**
 * Formata uma resposta de sucesso padronizada.
 * @param {object} res - Objeto response do Express
 * @param {number} statusCode - Código HTTP de sucesso
 * @param {string} message - Mensagem descritiva
 * @param {*} data - Dados a retornar (opcional)
 */
function sendSuccess(res, statusCode, message, data = null) {
  const response = {
    status: 'success',
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

/**
 * Formata data para o padrão brasileiro (DD/MM/AAAA).
 * @param {string|Date} date - Data em qualquer formato
 * @returns {string} Data formatada
 */
function formatDateBR(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Formata valor para moeda brasileira (R$).
 * @param {number} value - Valor numérico
 * @returns {string} Valor formatado (ex: R$ 89,90)
 */
function formatCurrencyBR(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Verifica se uma data de vencimento está vencida há mais de N dias.
 * @param {string|Date} dueDate - Data de vencimento
 * @param {number} graceDays - Dias de carência (padrão: 5)
 * @returns {boolean} true se estiver vencida além da carência
 */
function isOverdue(dueDate, graceDays = 5) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now - due;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > graceDays;
}

module.exports = {
  sendSuccess,
  formatDateBR,
  formatCurrencyBR,
  isOverdue,
};
